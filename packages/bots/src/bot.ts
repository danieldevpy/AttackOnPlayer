// Bots headless de debug: conectam como jogadores reais e caçam coletáveis.
// Uso: npm run bots -- <qtd> <segundos>   (padrão: 2 bots, 20s)
import WebSocket from "ws";
(globalThis as any).WebSocket = WebSocket; // polyfill p/ colyseus.js em Node

const { Client } = await import("colyseus.js");
const { ROOM_NAME, SERVER_PORT } = await import("@aop/shared");

const COUNT = Number(process.argv[2] ?? 2);
const DURATION_S = Number(process.argv[3] ?? 20);
const URL = process.env.SERVER_URL ?? `ws://localhost:${SERVER_PORT}`;

async function runBot(i: number) {
  const name = `bot-${i}`;
  const client = new Client(URL);
  const room = await client.joinOrCreate(ROOM_NAME, { name, bot: true });
  console.log(`[${name}] entrou na sala ${room.roomId}`);
  let pickupsSeen = 0;

  const think = setInterval(() => {
    const state: any = room.state;
    const me = state?.players?.get?.(room.sessionId);
    if (!me) return;

    // alvo: coletável mais próximo
    let target: { x: number; z: number } | undefined;
    let best = Infinity;
    state.collectibles?.forEach?.((c: any) => {
      const d = Math.hypot(c.x - me.x, c.z - me.z);
      if (d < best) {
        best = d;
        target = { x: c.x, z: c.z };
      }
    });

    let dir: { x: number; z: number };
    if (target) {
      dir = { x: target.x - me.x, z: target.z - me.z };
    } else {
      // vagueia
      dir = { x: Math.random() * 2 - 1, z: Math.random() * 2 - 1 };
    }
    const len = Math.hypot(dir.x, dir.z) || 1;
    room.send("input", { x: dir.x / len, z: dir.z / len });

    if (me.level > 1 + pickupsSeen) {
      pickupsSeen = me.level - 1;
      console.log(`[${name}] coletou! nível ${me.level}`);
    }
  }, 100);

  setTimeout(async () => {
    clearInterval(think);
    const me: any = room.state?.players?.get?.(room.sessionId);
    console.log(`[${name}] saindo — nível final ${me?.level ?? "?"}`);
    await room.leave();
  }, DURATION_S * 1000);
}

console.log(`Iniciando ${COUNT} bot(s) por ${DURATION_S}s em ${URL}`);
for (let i = 0; i < COUNT; i++) {
  runBot(i).catch((e) => console.error(`[bot-${i}] erro:`, e.message ?? e));
  await new Promise((r) => setTimeout(r, 300));
}
