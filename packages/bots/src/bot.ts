// Bots headless de debug: conectam como jogadores reais, reconstroem o mapa
// pelo seed (ADR-007) e navegam com BFS até o coletável mais próximo.
// Uso: npm run bots -- <qtd> <segundos>   (padrão: 2 bots, 20s; 0 = para sempre)
import WebSocket from "ws";
(globalThis as any).WebSocket = WebSocket; // polyfill p/ colyseus.js em Node

const { Client } = await import("colyseus.js");
const { ROOM_NAME, SERVER_PORT, buildMap, isWall } = await import("@aop/shared");
type GameMap = import("@aop/shared").GameMap;

const COUNT = Number(process.argv[2] ?? 2);
const DURATION_S = Number(process.argv[3] ?? 20);
const URL = process.env.SERVER_URL ?? `ws://localhost:${SERVER_PORT}`;
const BOT_VERBOSE = process.env.BOT_VERBOSE === "1";

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
  const client = new Client(URL);
  const room = await client.joinOrCreate(ROOM_NAME, { name, bot: true });
  room.onMessage("debug_event", () => {});
  console.log(`[${name}] entrou na sala ${room.roomId}`);

  let map: GameMap | undefined;
  let path: Array<{ x: number; z: number }> | null = null;
  let targetId = "";
  let pickupsSeen = 0;
  let boostLogged = false;

  const think = setInterval(() => {
    const state: any = room.state;
    const me = state?.players?.get?.(room.sessionId);
    if (!me) return;
    if (!map && state.mapW > 0) {
      map = buildMap(state.mapW, state.mapH, state.mapSeed);
      console.log(`[${name}] mapa ${state.mapW}x${state.mapH} reconstruído (seed ${state.mapSeed})`);
    }
    if (!map) return;

    // alvo: coletável mais próximo
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
    room.send("input", len > 0.01 ? { x: dir.x / len, z: dir.z / len } : { x: 0, z: 0 });

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
      console.log(`[${name}] saindo — nível final ${me?.level ?? "?"}, boosts pegos: ver métricas`);
      await room.leave();
    }, DURATION_S * 1000);
  }
}

console.log(`Iniciando ${COUNT} bot(s) ${DURATION_S > 0 ? `por ${DURATION_S}s` : "para sempre"} em ${URL}`);
for (let i = 0; i < COUNT; i++) {
  runBot(i).catch((e) => console.error(`[bot-${i}] erro:`, e.message ?? e));
  await new Promise((r) => setTimeout(r, 300));
}
