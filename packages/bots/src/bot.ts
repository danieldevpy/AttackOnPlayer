// Bots headless de debug: conectam como jogadores reais, reconstroem o mapa pelo seed
// (ADR-007) e decidem via a arquitetura de IA em camadas (T-020, docs/ai/bot-architecture.md):
// Percepção → Memória → Decisão (utility) → Steering contextual → Humanizador → Atuação.
// Uso: npm run bots -- <qtd> <segundos>   (padrão: 2 bots, 20s; 0 = para sempre)
import WebSocket from "ws";
(globalThis as any).WebSocket = WebSocket; // polyfill p/ colyseus.js em Node

const { Client } = await import("colyseus.js");
const { ROOM_NAME, SERVER_PORT, buildMap, isWall, zoneAt, LAUNCHERS } = await import("@aop/shared");
type GameMap = import("@aop/shared").GameMap;

import { profileFor, pickCard, BOSS_PROFILE, isBossIndex } from "./ai/personality";
import { buildPerception } from "./ai/perception";
import { initMemory, applyStickiness, shouldGiveUp, updateTarget } from "./ai/memory";
import { decide } from "./ai/decision";
import { steer } from "./ai/steering";
import { Humanizer } from "./ai/humanizer";
import type { ActionKind, Vec2, Zone } from "./ai/types";

const COUNT = Number(process.argv[2] ?? 2);
const DURATION_S = Number(process.argv[3] ?? 20);
const URL = process.env.SERVER_URL ?? `ws://localhost:${SERVER_PORT}`;
const BOT_VERBOSE = process.env.BOT_VERBOSE === "1";

/** Anti-stuck: bot fica "grudado" em obstáculo quando pretende andar mas quase não desloca.
 * Camada 4 (steering) já evita a maior parte dos casos — isto agora é rede de segurança
 * raramente acionada (bot-architecture.md §4), não o mecanismo primário. */
const STUCK_DIST_EPS = 0.05; // deslocamento mínimo esperado por tick (100ms) andando livre
const STUCK_TICKS_THRESHOLD = 5; // ~500ms tentando andar sem sair do lugar

/** BFS 4-direções no grid; retorna centros de tile do caminho (sem o inicial). BFS continua
 * só para coleta distante — o steering local cuida do resto (bot-architecture.md §4). */
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

/** Perigo amostrado (borda + props) para uma direção candidata — alimenta o steering
 * contextual sem o steering.ts precisar conhecer o mapa (mantém a camada pura/testável). */
function borderPropDanger(map: GameMap, x: number, z: number, dir: Vec2): number {
  const lookaheads = [0.5, 1.0, 1.6];
  for (let i = 0; i < lookaheads.length; i++) {
    const L = lookaheads[i];
    const px = x + dir.x * L;
    const pz = z + dir.z * L;
    if (px < 0.5 || pz < 0.5 || px > map.w - 0.5 || pz > map.h - 0.5 || isWall(map, Math.floor(px), Math.floor(pz))) {
      return 1 - i * 0.25; // mais perto = mais perigoso
    }
  }
  return 0;
}

/** Sinal estável por alvo (evita trocar de lado de órbita a cada tick — sem estado extra). */
function orbitSignFor(id: string): 1 | -1 {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h % 2 === 0 ? 1 : -1;
}

async function runBot(i: number) {
  const name = `bot-${i}`;
  const isBoss = isBossIndex(i);
  const profile = isBoss ? BOSS_PROFILE : profileFor(i);
  const personality = profile.personality;
  const client = new Client(URL);
  const room = await client.joinOrCreate(ROOM_NAME, { name, bot: true, boss: isBoss });
  room.onMessage("debug_event", () => {});
  // T-008b: cada perfil tem uma política de card determinística (bruto/tanque/caçador
  // concentram sempre o mesmo par de atributos; equilibrado auto-pica como sempre) —
  // observável no F3 pelas skills/atributos que o bot acumula ao longo da sessão.
  room.onMessage("upgrade_applied", () => {});
  room.onMessage("upgrade_offer", (offer: any) => {
    const cards: any[] = offer?.cards ?? [];
    const pickId = pickCard(profile.cardPolicy, cards);
    if (pickId) setTimeout(() => room.send("choose_upgrade", pickId), 150 + Math.random() * 250);
  });
  console.log(`[${name}] entrou na sala ${room.roomId} — perfil ${profile.name}${isBoss ? " [BOSS]" : ""}`);

  let map: GameMap | undefined;
  let path: Array<{ x: number; z: number }> | null = null;
  let collectTargetId = "";
  let pickupsSeen = 0;
  let boostLogged = false;
  let fleeingLogged = false;
  let unstuckLogged = false;
  let shots = 0; // telemetria: comandos de tiro enviados
  let engagedTicks = 0; // telemetria: ticks em que houve inimigo engajado
  let minDist = Infinity; // telemetria: menor distância a um inimigo
  let lastPos: { x: number; z: number } | null = null; // anti-stuck: posição no tick anterior
  let stuckTicks = 0;
  let unstuckUntil = 0;
  let unstuckDir: Vec2 = { x: 0, z: 0 };
  let prevAction: ActionKind | null = null;
  const track = new Map<string, { x: number; z: number; t: number }>(); // p/ estimar velocidade do alvo (lead)

  const memory = initMemory();
  const humanizer = new Humanizer(personality);

  const think = setInterval(() => {
    const now = Date.now();
    const state: any = room.state;
    const me = state?.players?.get?.(room.sessionId);
    if (!me) return;
    if (!map && state.mapW > 0) {
      map = buildMap(state.mapW, state.mapH, state.mapSeed);
      console.log(`[${name}] mapa ${state.mapW}x${state.mapH} reconstruído (seed ${state.mapSeed})`);
    }
    if (!map) return;
    const gmap = map; // referência não-nula p/ uso dentro de closures

    const ldef = LAUNCHERS[me.launcher] ?? LAUNCHERS.basic_shot;
    const fireRange = ldef.projectile.range;

    // --- Camada 1: Percepção (snapshot filtrado, não o estado inteiro) ---
    const enemiesRaw: Array<{ id: string; x: number; z: number; hp: number; maxHp: number; level: number }> = [];
    state.players?.forEach?.((pl: any, id: string) => {
      if (id === room.sessionId || pl.hp <= 0) return;
      enemiesRaw.push({ id, x: pl.x, z: pl.z, hp: pl.hp, maxHp: pl.maxHp, level: pl.level });
    });
    const collectiblesRaw: Array<{ id: string; x: number; z: number }> = [];
    state.collectibles?.forEach?.((c: any, id: string) => collectiblesRaw.push({ id, x: c.x, z: c.z }));

    const perceptionRadius = personality.engageRange * 1.6;
    let perception = buildPerception(gmap, me, enemiesRaw, collectiblesRaw, perceptionRadius, (x, z) => zoneAt(gmap, x, z) as Zone);

    // --- Camada 2: Memória (hysteresis de alvo + desistência) ---
    if (shouldGiveUp(memory, now, personality.giveUpMs)) updateTarget(memory, undefined, now);
    perception = { ...perception, enemies: applyStickiness(perception.enemies, memory) };

    // --- Camada 3: Decisão (utility AI, função pura — ver decision.test.ts) ---
    const decision = decide(perception, personality, prevAction);
    prevAction = decision.action;

    // --- Camada 5 (parte 1): atraso de reação — só troca de ação após reactionMs ---
    const activeAction = humanizer.reactToAction(decision.action, now);

    let desired: Vec2 = { x: 0, z: 0 };
    let lateralBias = 0;
    let aim: { aimX: number; aimZ: number } | null = null;
    let fire = false;
    let inCombat = false;

    if (activeAction === "engage" && decision.targetId) {
      updateTarget(memory, decision.targetId, now);
      const target = perception.enemies.find((e) => e.id === decision.targetId);
      if (target) {
        inCombat = true;
        engagedTicks++;
        if (target.dist < minDist) minDist = target.dist;
        fleeingLogged = false;

        if (target.dist > fireRange * 0.5) desired = { x: target.x - me.x, z: target.z - me.z };
        else if (target.dist < 1.5) desired = { x: me.x - target.x, z: me.z - target.z }; // recua se colar
        else {
          desired = { x: target.x - me.x, z: target.z - me.z };
          lateralBias = 0.6 * orbitSignFor(target.id); // strafe orbital — comportamento humano de trocação
        }

        // chumbo (lead): prevê a posição do alvo pelo tempo de voo do projétil
        const prevSeen = track.get(target.id);
        let ex = target.x;
        let ez = target.z;
        if (prevSeen && now > prevSeen.t) {
          const dts = (now - prevSeen.t) / 1000;
          const vx = (target.x - prevSeen.x) / dts;
          const vz = (target.z - prevSeen.z) / dts;
          const tof = target.dist / ldef.projectile.speed;
          ex = target.x + vx * tof;
          ez = target.z + vz * tof;
        }
        track.set(target.id, { x: target.x, z: target.z, t: now });

        // --- Camada 5 (parte 2): mira com lerp + erro que decai (resolve o "robô") ---
        const idealAngle = Math.atan2(ez - me.z, ex - me.x);
        const aimAngle = humanizer.smoothAim(idealAngle, memory.currentTargetId === target.id);
        aim = { aimX: Math.cos(aimAngle), aimZ: Math.sin(aimAngle) };

        const myZone = zoneAt(gmap, me.x, me.z);
        if (target.dist <= fireRange && myZone !== "safe" && humanizer.canFire(now)) {
          fire = true;
          shots++;
          humanizer.recordShot(now);
        }
        if (BOT_VERBOSE && engagedTicks % 30 === 0) {
          console.log(`[${name}] engaj dist=${target.dist.toFixed(1)} myzone=${myZone} tgtzone=${target.zone}`);
        }
      }
    } else if (activeAction === "flee" && perception.enemies[0]) {
      const threat = perception.enemies[0];
      desired = { x: me.x - threat.x, z: me.z - threat.z };
      if (BOT_VERBOSE && !fleeingLogged) {
        fleeingLogged = true;
        console.log(`[${name}] fugindo — hp ${Math.ceil(me.hp)}/${me.maxHp}`);
      }
    } else if (activeAction === "collect" && decision.targetId) {
      fleeingLogged = false;
      const target = perception.collectibles.find((c) => c.id === decision.targetId);
      if (target) {
        if (decision.targetId !== collectTargetId) {
          collectTargetId = decision.targetId;
          path = bfsPath(gmap, Math.floor(me.x), Math.floor(me.z), Math.floor(target.x), Math.floor(target.z));
          if (BOT_VERBOSE) {
            console.log(`[${name}] novo alvo: coletável ${collectTargetId} — caminho: ${path?.length ?? "inalcançável"} passos`);
          }
        }
        let dir: Vec2 = { x: 0, z: 0 };
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
        if ((!path || path.length === 0)) dir = { x: target.x - me.x, z: target.z - me.z }; // reta final dentro do tile
        desired = dir;
      }
    } else {
      fleeingLogged = false;
      collectTargetId = ""; // saiu do modo coleta — recalcula caminho quando voltar
      // --- Camada 5 (parte 3): perambular com pausas, não vagar geométrico uniforme ---
      desired = humanizer.wanderVector(now);
    }

    // --- Camada 4: Steering contextual (resolve o esbarrão na borda; função pura, ver steering.test.ts) ---
    const danger = (dir: Vec2) => borderPropDanger(gmap, me.x, me.z, dir);
    let moveVec = steer({ desired, lateralBias, danger });

    // --- Anti-stuck: rede de segurança (raramente acionada agora que o steering evita borda/prop) ---
    const wantsToMove = Math.hypot(moveVec.x, moveVec.z) > 0.3;
    const distMoved = lastPos ? Math.hypot(me.x - lastPos.x, me.z - lastPos.z) : Infinity;
    lastPos = { x: me.x, z: me.z };

    if (now >= unstuckUntil) {
      if (wantsToMove && distMoved < STUCK_DIST_EPS) stuckTicks++;
      else stuckTicks = 0;

      if (stuckTicks >= STUCK_TICKS_THRESHOLD) {
        const side = Math.random() < 0.5 ? 1 : -1;
        const perp = { x: -moveVec.z * side, z: moveVec.x * side };
        const pl = Math.hypot(perp.x, perp.z) || 1;
        unstuckDir = { x: perp.x / pl, z: perp.z / pl };
        unstuckUntil = now + 350 + Math.random() * 350;
        stuckTicks = 0;
        unstuckLogged = false;
      }
    }
    if (now < unstuckUntil) {
      moveVec = unstuckDir;
      if (BOT_VERBOSE && !unstuckLogged) {
        unstuckLogged = true;
        console.log(`[${name}] preso — escapando lateralmente`);
      }
    }

    // --- Camada 6: Atuação — mesma intenção {move, aim, fire} dos perfis humanos (ADR-015) ---
    const payload: { x: number; z: number; aimX?: number; aimZ?: number; fire?: boolean } = { x: moveVec.x, z: moveVec.z };
    if (inCombat) {
      if (aim) {
        payload.aimX = aim.aimX;
        payload.aimZ = aim.aimZ;
      }
      if (fire) payload.fire = true;
    }
    room.send("input", payload);

    if (me.level > 1 + pickupsSeen) {
      pickupsSeen = me.level - 1;
      collectTargetId = ""; // força re-alvo
      console.log(`[${name}] level_up! nível ${me.level}`);
    }
    if (me.speed > 1 && !boostLogged) {
      boostLogged = true;
      collectTargetId = "";
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
