// Bots headless de debug: conectam como jogadores reais, reconstroem o mapa
// pelo seed (ADR-007) e navegam com BFS até o coletável mais próximo.
// Uso: npm run bots -- <qtd> <segundos>   (padrão: 2 bots, 20s; 0 = para sempre)
import WebSocket from "ws";
(globalThis as any).WebSocket = WebSocket; // polyfill p/ colyseus.js em Node

const { Client } = await import("colyseus.js");
const { ROOM_NAME, SERVER_PORT, buildMap, isWall, zoneAt, LAUNCHERS } = await import("@aop/shared");
type GameMap = import("@aop/shared").GameMap;

const COUNT = Number(process.argv[2] ?? 2);
const DURATION_S = Number(process.argv[3] ?? 20);
const URL = process.env.SERVER_URL ?? `ws://localhost:${SERVER_PORT}`;
const BOT_VERBOSE = process.env.BOT_VERBOSE === "1";

// T-008: perfis de skill de combate. aimError = spread em rad; engageRange = detecção;
// fleeHp = fração de HP p/ recuar; a força da skill deixa o gancho p/ personalidade/boss (T-008b).
type SkillName = "fraco" | "medio" | "forte";
// engageRange = raio de detecção/caça (bot persegue inimigo até aqui, mesmo fora do alcance de tiro).
// fireIntervalMs = [min,max] do intervalo entre decisões de puxar o gatilho — bugfix pós-teste
// manual: antes o bot atirava a cada tick assim que no alcance, ficando "impossível de matar"
// (só o cooldown do lançador, igual pra todo mundo, limitava). Cada skill agora tem seu próprio
// ritmo de ataque, e o intervalo real sorteia dentro da faixa a cada tiro — não é 100% fixo.
const SKILLS: Record<SkillName, { aimError: number; engageRange: number; fleeHp: number; fireIntervalMs: [number, number] }> = {
  fraco: { aimError: 0.4, engageRange: 12, fleeHp: 0.5, fireIntervalMs: [1000, 1900] }, // reativo: só briga quem chega perto
  medio: { aimError: 0.18, engageRange: 30, fleeHp: 0.35, fireIntervalMs: [550, 1050] }, // caça em raio médio
  forte: { aimError: 0.06, engageRange: 9999, fleeHp: 0.25, fireIntervalMs: [280, 600] }, // caçador: persegue pelo mapa todo
};
const SKILL_NAMES: SkillName[] = ["fraco", "medio", "forte"];
/** BOT_SKILL fixa a skill de todos; ausente = sorteada por bot (variedade na sessão). */
function skillFor(i: number): SkillName {
  const env = process.env.BOT_SKILL as SkillName | undefined;
  if (env && SKILLS[env]) return env;
  return SKILL_NAMES[i % SKILL_NAMES.length];
}

/** Anti-stuck: bot fica "grudado" em obstáculo quando pretende andar mas quase não desloca. */
const STUCK_DIST_EPS = 0.05; // deslocamento mínimo esperado por tick (100ms) andando livre
const STUCK_TICKS_THRESHOLD = 5; // ~500ms tentando andar sem sair do lugar

/** BFS 4-direções no grid; retorna centros de tile do caminho (sem o inicial). */
function bfsPath(map: GameMap, fx: number, fz: number, tx: number, tz: number) {
  if (fx === tx && fz === tz) return [];
  const { w, h } = map;
  const prev = new Int32Array(w * h).fill(-1);
  const queue = [fz * w + fx];
  prev[fz * w + fx] = fz * w + fx;
  const goal = tz * w + tx;
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === goal) break;
    const cx = cur % w;
    const cz = (cur / w) | 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx;
      const nz = cz + dz;
      const ni = nz * w + nx;
      if (isWall(map, nx, nz) || prev[ni] !== -1) continue;
      prev[ni] = cur;
      queue.push(ni);
    }
  }
  if (prev[goal] === -1) return null; // inalcançável
  const path: Array<{ x: number; z: number }> = [];
  for (let i = goal; i !== fz * w + fx; i = prev[i]) path.push({ x: (i % w) + 0.5, z: ((i / w) | 0) + 0.5 });
  return path.reverse();
}

async function runBot(i: number) {
  const name = `bot-${i}`;
  const skillName = skillFor(i);
  const skill = SKILLS[skillName];
  const client = new Client(URL);
  const room = await client.joinOrCreate(ROOM_NAME, { name, bot: true });
  room.onMessage("debug_event", () => {});
  console.log(`[${name}] entrou na sala ${room.roomId} — skill ${skillName}`);

  let map: GameMap | undefined;
  let path: Array<{ x: number; z: number }> | null = null;
  let targetId = "";
  let pickupsSeen = 0;
  let boostLogged = false;
  let fleeingLogged = false;
  let shots = 0; // telemetria: comandos de tiro enviados
  let engagedTicks = 0; // telemetria: ticks em que houve inimigo em alcance de engajamento
  let minDist = Infinity; // telemetria: menor distância a um inimigo
  let nextFireAt = 0; // ritmo de ataque por skill (fireIntervalMs), não o cooldown do lançador
  let lastPos: { x: number; z: number } | null = null; // anti-stuck: posição no tick anterior
  let stuckTicks = 0;
  let unstuckUntil = 0;
  let unstuckDir = { x: 0, z: 0 };
  let unstuckLogged = false;
  const track = new Map<string, { x: number; z: number; t: number }>(); // p/ estimar velocidade do alvo (lead)

  const think = setInterval(() => {
    const state: any = room.state;
    const me = state?.players?.get?.(room.sessionId);
    if (!me) return;
    if (!map && state.mapW > 0) {
      map = buildMap(state.mapW, state.mapH, state.mapSeed);
      console.log(`[${name}] mapa ${state.mapW}x${state.mapH} reconstruído (seed ${state.mapSeed})`);
    }
    if (!map) return;
    const gmap = map; // referência não-nula p/ uso dentro de closures

    // --- Combate (T-008): tem prioridade sobre a coleta ---
    const ldef = LAUNCHERS[me.launcher] ?? LAUNCHERS.basic_shot;
    const fireRange = ldef.projectile.range;

    const myZone = zoneAt(gmap, me.x, me.z);

    // inimigo vivo mais próximo (p/ fuga) e mais próximo "lutável" — fora de safe (p/ engajar).
    // Ignorar quem está em safe evita ficar preso mirando alguém intocável no próprio spawn.
    let enemy: any; let enemyId = ""; let ebest = Infinity;
    let foe: any; let foeId = ""; let fbest = Infinity;
    state.players?.forEach?.((pl: any, id: string) => {
      if (id === room.sessionId || pl.hp <= 0) return;
      const d = Math.hypot(pl.x - me.x, pl.z - me.z);
      if (d < ebest) { ebest = d; enemy = pl; enemyId = id; }
      if (zoneAt(gmap, pl.x, pl.z) !== "safe" && d < fbest) { fbest = d; foe = pl; foeId = id; }
    });

    const lowHp = me.hp < skill.fleeHp * me.maxHp;
    let combatDir: { x: number; z: number } | null = null;
    // T-013: mira (aimX/aimZ) e gatilho (fire) são independentes, como no protocolo
    // real (T-009/T-010) — o bot mira continuamente no alvo engajado, e só liga o
    // gatilho quando está de fato no alcance do launcher.
    let aim: { aimX: number; aimZ: number } | null = null;
    let fire = false;

    if (enemy && lowHp && ebest < skill.engageRange * 1.6) {
      // fugir: afasta do inimigo (e, de quebra, tende a sair da zona de guerra)
      combatDir = { x: me.x - enemy.x, z: me.z - enemy.z };
      if (BOT_VERBOSE && !fleeingLogged) {
        fleeingLogged = true;
        console.log(`[${name}] fugindo — hp ${Math.ceil(me.hp)}/${me.maxHp}`);
      }
    } else if (foe && fbest <= skill.engageRange) {
      // engaja o inimigo lutável mais próximo. Como ele está no campo, aproximar-se
      // naturalmente me tira da minha safe até o alcance de tiro.
      fleeingLogged = false;
      engagedTicks++;
      if (fbest < minDist) minDist = fbest;
      const tgtZone = zoneAt(map, foe.x, foe.z);
      if (BOT_VERBOSE && engagedTicks % 30 === 0) console.log(`[${name}] engaj fbest=${fbest.toFixed(1)} myzone=${myZone} tgtzone=${tgtZone}`);

      if (fbest > fireRange * 0.5) combatDir = { x: foe.x - me.x, z: foe.z - me.z }; // fecha a distância
      else if (fbest < 1.5) combatDir = { x: me.x - foe.x, z: me.z - foe.z }; // recua se colar em cima
      else combatDir = { x: 0, z: 0 }; // mantém o duelo

      // chumbo (lead): prevê a posição do alvo pelo tempo de voo do projétil
      const now = Date.now();
      const prev = track.get(foeId);
      let ex = foe.x;
      let ez = foe.z;
      if (prev && now > prev.t) {
        const dts = (now - prev.t) / 1000;
        const vx = (foe.x - prev.x) / dts;
        const vz = (foe.z - prev.z) / dts;
        const tof = fbest / ldef.projectile.speed;
        ex = foe.x + vx * tof;
        ez = foe.z + vz * tof;
      }
      const ang = Math.atan2(ez - me.z, ex - me.x) + (Math.random() * 2 - 1) * skill.aimError;
      aim = { aimX: Math.cos(ang), aimZ: Math.sin(ang) };

      // gatilho só liga se no alcance, fora de safe, e o ritmo de ataque da skill permitir
      // (bugfix: sem isso o bot atirava a cada tick, limitado só pelo cooldown do lançador —
      // igual pra todo mundo — e virava "impossível de matar" independente da skill).
      if (fbest <= fireRange && myZone !== "safe" && now >= nextFireAt) {
        fire = true;
        shots++;
        const [lo, hi] = skill.fireIntervalMs;
        nextFireAt = now + lo + Math.random() * (hi - lo); // "peso" aleatório — nunca 100% fixo
      }
      track.set(foeId, { x: foe.x, z: foe.z, t: now });
    } else {
      fleeingLogged = false;
    }

    let moveVec = { x: 0, z: 0 };
    const inCombat = combatDir !== null;

    if (combatDir) {
      const l = Math.hypot(combatDir.x, combatDir.z);
      moveVec = l > 0.01 ? { x: combatDir.x / l, z: combatDir.z / l } : { x: 0, z: 0 };
      targetId = ""; // volta a caçar coletável quando o combate acabar
      path = null;
    } else {
      // --- Default: caça o coletável mais próximo (M0) ---
      let bestId = "";
      let target: { x: number; z: number } | undefined;
      let best = Infinity;
      state.collectibles?.forEach?.((c: any, id: string) => {
        const d = Math.hypot(c.x - me.x, c.z - me.z);
        if (d < best) {
          best = d;
          bestId = id;
          target = { x: c.x, z: c.z };
        }
      });

      if (target && bestId !== targetId) {
        targetId = bestId;
        path = bfsPath(map, Math.floor(me.x), Math.floor(me.z), Math.floor(target.x), Math.floor(target.z));
        if (BOT_VERBOSE) console.log(`[${name}] novo alvo: coletável ${targetId} em (${target.x.toFixed(1)}, ${target.z.toFixed(1)}) — caminho: ${path?.length ?? 'inalcançável'} passos`);
      }

      // segue o caminho waypoint a waypoint
      let dir = { x: 0, z: 0 };
      while (path && path.length > 0) {
        const wp = path[0];
        const d = Math.hypot(wp.x - me.x, wp.z - me.z);
        if (d < 0.3) {
          path.shift();
          continue;
        }
        dir = { x: wp.x - me.x, z: wp.z - me.z };
        break;
      }
      if ((!path || path.length === 0) && target) {
        dir = { x: target.x - me.x, z: target.z - me.z }; // reta final dentro do tile
      }

      const len = Math.hypot(dir.x, dir.z);
      moveVec = len > 0.01 ? { x: dir.x / len, z: dir.z / len } : { x: 0, z: 0 };
    }

    // --- Anti-stuck: detecta quando o movimento pretendido não produz deslocamento real
    // (bot grudado num prop/parede) e força uma saída lateral temporária. Não depende de
    // raycasting contra props — só observa a posição autoritativa do servidor tick a tick,
    // que já reflete a colisão real (moveWithCollision no servidor).
    const now3 = Date.now();
    const wantsToMove = Math.hypot(moveVec.x, moveVec.z) > 0.3;
    const distMoved = lastPos ? Math.hypot(me.x - lastPos.x, me.z - lastPos.z) : Infinity;
    lastPos = { x: me.x, z: me.z };

    if (now3 >= unstuckUntil) {
      if (wantsToMove && distMoved < STUCK_DIST_EPS) stuckTicks++;
      else stuckTicks = 0;

      if (stuckTicks >= STUCK_TICKS_THRESHOLD) {
        // escapa de lado (perpendicular ao movimento pretendido, lado sorteado) por um tempo curto
        const side = Math.random() < 0.5 ? 1 : -1;
        const perp = { x: -moveVec.z * side, z: moveVec.x * side };
        const pl = Math.hypot(perp.x, perp.z) || 1;
        unstuckDir = { x: perp.x / pl, z: perp.z / pl };
        unstuckUntil = now3 + 350 + Math.random() * 350;
        stuckTicks = 0;
        unstuckLogged = false;
      }
    }

    if (now3 < unstuckUntil) {
      moveVec = unstuckDir;
      if (BOT_VERBOSE && !unstuckLogged) {
        unstuckLogged = true;
        console.log(`[${name}] preso — escapando lateralmente`);
      }
    }

    const payload: { x: number; z: number; aimX?: number; aimZ?: number; fire?: boolean } = { x: moveVec.x, z: moveVec.z };
    if (inCombat) {
      if (aim) { payload.aimX = aim.aimX; payload.aimZ = aim.aimZ; }
      if (fire) payload.fire = true;
    }
    room.send("input", payload);

    if (me.level > 1 + pickupsSeen) {
      pickupsSeen = me.level - 1;
      targetId = ""; // força re-alvo
      console.log(`[${name}] level_up! nível ${me.level}`);
    }
    if (me.speed > 1 && !boostLogged) {
      boostLogged = true;
      targetId = "";
      console.log(`[${name}] speed_up! velocidade x${me.speed}`);
    } else if (me.speed <= 1) {
      boostLogged = false;
    }
  }, 100);

  if (DURATION_S > 0) {
    setTimeout(async () => {
      clearInterval(think);
      const state: any = room.state;
      const me: any = state?.players?.get?.(room.sessionId);
      console.log(`[${name}] saindo — nível final ${me?.level ?? "?"}, hp ${Math.ceil(me?.hp ?? 0)}, tiros ${shots}, ticks engajado ${engagedTicks}, menor dist ${minDist === Infinity ? "-" : minDist.toFixed(1)}`);
      await room.leave();
    }, DURATION_S * 1000);
  }
}

console.log(`Iniciando ${COUNT} bot(s) ${DURATION_S > 0 ? `por ${DURATION_S}s` : "para sempre"} em ${URL}`);
for (let i = 0; i < COUNT; i++) {
  runBot(i).catch((e) => console.error(`[bot-${i}] erro:`, e.message ?? e));
  await new Promise((r) => setTimeout(r, 300));
}
