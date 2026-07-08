import { describe, it, expect } from "vitest";
import { ArenaRoom } from "../../rooms/ArenaRoom";
import { ArenaState, Collectible, Player } from "../../state/ArenaState";
import { ProjectileSystem } from "../projectiles";
import { EffectSystem } from "../effects";
import { BattleRoyaleEvent, outsideDps, pickZoneCenter, zoneStartRadius } from "./battleRoyale";
import { EligibilityContext } from "./types";
import {
  buildMap,
  isWall,
  GameMap,
  BR_MIN_PLAYERS,
  BR_COOLDOWN_MS,
  BR_WARNING_MS,
  BR_DURATION_MS,
  BR_ENDING_MS,
  BR_OUTSIDE_DPS_BASE,
  BR_OUTSIDE_DPS_GROWTH,
  BR_ZONE_RADIUS_MIN,
  BR_ZONE_RADIUS_MAX,
  BR_SURVIVOR_COINS_BONUS,
  EVENT_GLOBAL_COOLDOWN_MS,
} from "@aop/shared";

/**
 * T-066 (SPEC-0016): Battle Royale server-side. Duas camadas:
 * - helpers puros (curva de dps, centro por densidade, raio inicial) testados isolados;
 * - integração com um `ArenaRoom` REAL (mesmo harness do deathPipeline.test) dirigindo as
 *   fases via `room.director` com timestamps sintéticos — warning/active/ending sem esperar
 *   relógio de verdade. O registry agora tem o BR de verdade, então `forceTrigger` cobre o
 *   mesmo caminho da mensagem `dev_event`.
 */
function makeRoom(): any {
  const room: any = new ArenaRoom();
  room.clients = [];
  room.onCreate({ flagEnabled: false });
  return room;
}

function addPlayer(room: any, id: string, x: number, z: number): Player {
  const p = new Player();
  p.name = id;
  p.playerToken = `tok_${id}`;
  p.x = x;
  p.z = z;
  p.hp = 100;
  p.maxHp = 100;
  room.state.players.set(id, p);
  return p;
}

/** Célula alcançável de referência (players precisam nascer em área jogável do mapa gerado). */
function openCell(room: any): { x: number; z: number } {
  const map: GameMap = room.map;
  for (let z = 0; z < map.h; z++) {
    for (let x = 0; x < map.w; x++) {
      if (room.reachable[z * map.w + x]) return { x: x + 0.5, z: z + 0.5 };
    }
  }
  throw new Error("mapa sem célula alcançável");
}

/** 4 players num cluster walkable + trigger manual (mesmo caminho do dev_event). */
function startEvent(room: any, now: number): { center: { x: number; z: number }; players: Player[] } {
  const c = openCell(room);
  const players = ["A", "B", "C", "D"].map((id, i) => addPlayer(room, id, c.x + (i % 2), c.z + Math.floor(i / 2)));
  const res = room.director.forceTrigger("battle_royale", room, now);
  expect(res.ok).toBe(true);
  return { center: c, players };
}

describe("outsideDps — curva do dano de zona (T-066)", () => {
  it("t=0/5/10 seguem dps = base × (1 + growth × t)", () => {
    expect(outsideDps(0)).toBeCloseTo(BR_OUTSIDE_DPS_BASE); // 10
    expect(outsideDps(5)).toBeCloseTo(BR_OUTSIDE_DPS_BASE * (1 + BR_OUTSIDE_DPS_GROWTH * 5)); // 35
    expect(outsideDps(10)).toBeCloseTo(BR_OUTSIDE_DPS_BASE * (1 + BR_OUTSIDE_DPS_GROWTH * 10)); // 60
  });
});

describe("pickZoneCenter — centro por densidade (T-066)", () => {
  it("com 2 clusters, escolhe o mais denso (empate = qualquer)", () => {
    const map = buildMap(60, 60, 7);
    const positions = [
      // cluster denso: 5 players em torno de (12, 12)
      { x: 11, z: 11 },
      { x: 12, z: 12 },
      { x: 13, z: 12 },
      { x: 12, z: 13 },
      { x: 11.5, z: 12.5 },
      // cluster raso: 2 players em torno de (45, 45)
      { x: 45, z: 45 },
      { x: 46, z: 44 },
    ];
    const center = pickZoneCenter(positions, map);
    expect(Math.hypot(center.x - 12, center.z - 12)).toBeLessThan(9); // caiu sobre o cluster denso
    expect(Math.hypot(center.x - 45, center.z - 45)).toBeGreaterThan(20); // longe do raso
  });
});

describe("zoneStartRadius — envolve o cluster com folga + clamp (T-066)", () => {
  it("cluster apertado cai no clamp mínimo", () => {
    const center = { x: 10, z: 10 };
    const positions = [
      { x: 10, z: 10 },
      { x: 11, z: 10 },
      { x: 10, z: 11 },
    ];
    expect(zoneStartRadius(center, positions)).toBe(BR_ZONE_RADIUS_MIN);
  });

  it("player espalhado até a borda satura no clamp máximo; mais longe que o máximo fica de fora", () => {
    const center = { x: 30, z: 30 };
    const spread = [{ x: 30, z: 30 }, { x: 30 + BR_ZONE_RADIUS_MAX - 1, z: 30 }];
    expect(zoneStartRadius(center, spread)).toBe(BR_ZONE_RADIUS_MAX); // 19 + folga 2 → clamp 20

    const farAway = [{ x: 30, z: 30 }, { x: 30 + BR_ZONE_RADIUS_MAX + 30, z: 30 }];
    expect(zoneStartRadius(center, farAway)).toBe(BR_ZONE_RADIUS_MIN); // o distante não é envolvido
  });
});

describe("checkEligibility — regras de ativação (T-066)", () => {
  const ctx = (over: Partial<EligibilityContext>): EligibilityContext => ({
    now: 1_000_000,
    livingCount: BR_MIN_PLAYERS,
    positions: [],
    deathsPerMinute: 0,
    lastEndedAt: 0,
    enabled: true,
    ...over,
  });

  it("exige BR_MIN_PLAYERS vivos (bots contam) — 3 recusa, 4 aceita", () => {
    expect(BattleRoyaleEvent.checkEligibility(ctx({ livingCount: BR_MIN_PLAYERS - 1 }))).toBe(false);
    expect(BattleRoyaleEvent.checkEligibility(ctx({ livingCount: BR_MIN_PLAYERS }))).toBe(true);
  });

  it("cooldown próprio: bloqueia dentro de BR_COOLDOWN_MS do último fim, libera depois", () => {
    const now = 1_000_000;
    expect(BattleRoyaleEvent.checkEligibility(ctx({ now, lastEndedAt: now - BR_COOLDOWN_MS + 1 }))).toBe(false);
    expect(BattleRoyaleEvent.checkEligibility(ctx({ now, lastEndedAt: now - BR_COOLDOWN_MS }))).toBe(true);
    expect(BattleRoyaleEvent.checkEligibility(ctx({ now, lastEndedAt: 0 }))).toBe(true); // nunca rodou
  });

  it("enabled=false (painel Django, T-071) recusa mesmo com sala cheia", () => {
    expect(BattleRoyaleEvent.checkEligibility(ctx({ enabled: false }))).toBe(false);
  });
});

describe("Battle Royale — integração com ArenaRoom (T-066)", () => {
  it("com <4 players, o gatilho manual (dev_event) NÃO dispara — elegibilidade vale pra ele também", () => {
    const room = makeRoom();
    const c = openCell(room);
    ["A", "B", "C"].forEach((id, i) => addPlayer(room, id, c.x + i, c.z));

    const res = room.director.forceTrigger("battle_royale", room, Date.now());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("not_eligible");
    expect(room.state.event.phase).toBe("idle");
  });

  it("warning: zona escrita no schema, centro snapado em célula walkable/alcançável, raio no clamp", () => {
    const room = makeRoom();
    startEvent(room, Date.now());

    const ev = room.state.event;
    expect(ev.phase).toBe("warning");
    expect(ev.id).toBe("battle_royale");
    expect(ev.zoneRadius).toBeGreaterThanOrEqual(BR_ZONE_RADIUS_MIN);
    expect(ev.zoneRadius).toBeLessThanOrEqual(BR_ZONE_RADIUS_MAX);
    const tx = Math.floor(ev.zoneX);
    const tz = Math.floor(ev.zoneZ);
    expect(isWall(room.map, tx, tz)).toBe(false);
    expect(room.reachable[tz * room.map.w + tx]).toBe(1);

    const warn = room.debugEvents.find((e: any) => e.type === "event_warning");
    expect(warn).toBeTruthy();
  });

  it("morte no warning renasce DENTRO do raio, em célula walkable", () => {
    const room = makeRoom();
    const { players } = startEvent(room, Date.now());

    players[0].hp = 0;
    room.update(0.05);

    const ev = room.state.event;
    expect(players[0].hp).toBe(players[0].maxHp);
    expect(players[0].waitingRespawn).toBe(false);
    expect(Math.hypot(players[0].x - ev.zoneX, players[0].z - ev.zoneZ)).toBeLessThanOrEqual(ev.zoneRadius + 1e-6);
    expect(isWall(room.map, Math.floor(players[0].x), Math.floor(players[0].z))).toBe(false);
  });

  it("dano de zona ignora escudo (damageTakenMult), spawn protection e zona safe — e segue a curva", () => {
    const room = makeRoom();
    const t0 = Date.now();
    const { players } = startEvent(room, t0);
    room.director.tick(room, 0.05, t0 + BR_WARNING_MS); // → active
    expect(room.state.event.phase).toBe("active");
    const tActive = t0 + BR_WARNING_MS;

    // fora da zona, com TODAS as proteções que o dano de zona deve ignorar
    const outsider = players[0];
    outsider.x = room.state.event.zoneX + BR_ZONE_RADIUS_MAX + 10;
    outsider.z = room.state.event.zoneZ;
    outsider.damageTakenMult = 0.1; // escudo temporário forte
    outsider.spawnProtectedUntil = tActive + 60_000; // invulnerabilidade de nascimento ativa
    // (zona safe: o dano nem consulta zoneAt — coberto por aplicar direto em p.hp abaixo)

    // dentro da zona: intocado
    const insider = players[1];
    insider.x = room.state.event.zoneX;
    insider.z = room.state.event.zoneZ;

    const dt = 0.1;
    const t = 1; // 1s de active → dps = 15
    room.director.tick(room, dt, tActive + t * 1000);
    expect(outsider.hp).toBeCloseTo(100 - outsideDps(t) * dt, 5); // dano CHEIO, sem multiplicadores
    expect(insider.hp).toBe(100);
  });

  it("raio interpola linearmente até 0 ao longo de BR_DURATION_MS", () => {
    const room = makeRoom();
    const t0 = Date.now();
    startEvent(room, t0);
    room.director.tick(room, 0.05, t0 + BR_WARNING_MS); // → active
    const tActive = t0 + BR_WARNING_MS;
    const radiusStart = room.state.event.zoneRadius;

    room.director.tick(room, 0.05, tActive + BR_DURATION_MS / 2);
    expect(room.state.event.zoneRadius).toBeCloseTo(radiusStart / 2, 5);
  });

  it("morte no active → hold (waitingRespawn); ending libera TODOS juntos; sobrevivente único full-heal no lugar + bônus", () => {
    const room = makeRoom();
    const t0 = Date.now();
    const { players } = startEvent(room, t0);
    room.director.tick(room, 0.05, t0 + BR_WARNING_MS); // → active

    const [a, b, c, survivor] = players;
    survivor.x = room.state.event.zoneX;
    survivor.z = room.state.event.zoneZ;
    survivor.hp = 40; // fim do evento deve devolver vida CHEIA sem mover
    const sx = survivor.x;
    const sz = survivor.z;
    const coinsBefore = survivor.coins;
    const xpBefore = survivor.xp;

    // 2 mortes no active seguram o respawn (política hold_until_end). `a` morre LONGE do
    // cluster pra ninguém vivo alcançar o coletável plantado no corpo logo abaixo.
    a.x = room.state.event.zoneX + 30;
    a.z = room.state.event.zoneZ;
    a.hp = 0;
    b.hp = 0;
    room.update(0.05);
    expect(a.waitingRespawn).toBe(true);
    expect(b.waitingRespawn).toBe(true);
    expect(a.hp).toBe(0);

    // segurado não coleta coletável nem mantém input/tiro
    const orb = new Collectible();
    orb.x = a.x;
    orb.z = a.z;
    orb.kind = "xp_orb";
    room.state.collectibles.set("held_orb", orb);
    room.update(0.05);
    expect(room.state.collectibles.has("held_orb")).toBe(true);
    expect(a.inputX).toBe(0);
    expect(a.firing).toBe(false);

    // 3ª morte deixa 1 vivo → early-end no MESMO tick (o director roda ANTES do pipeline de
    // morte no updateInner): a/b são liberados na entrada do ending; `c` — cuja morte ainda
    // não tinha sido processada — morre já na fase "ending" (policy default) e renasce direto.
    c.hp = 0;
    room.update(0.05);
    expect(room.state.event.phase).toBe("ending");

    const phaseEv = room.debugEvents.filter((e: any) => e.type === "event_phase").pop();
    expect(phaseEv.payload.reason).toBe("last_survivor");

    // a/b liberados JUNTOS no tick da transição, respawn default; c renasceu pelo fluxo normal
    for (const held of [a, b, c]) {
      expect(held.waitingRespawn).toBe(false);
      expect(held.hp).toBe(held.maxHp);
      expect(held.spawnProtectedUntil).toBeGreaterThan(0);
    }

    // sobrevivente: vida cheia NO LUGAR + bônus cheio (XP e coins)
    expect(survivor.hp).toBe(survivor.maxHp);
    expect(survivor.x).toBe(sx);
    expect(survivor.z).toBe(sz);
    expect(survivor.coins).toBe(coinsBefore + BR_SURVIVOR_COINS_BONUS);
    expect(survivor.level > 1 || survivor.xp > xpBefore).toBe(true);

    const endEv = room.debugEvents.find((e: any) => e.type === "event_end");
    expect(endEv.payload.reason).toBe("last_survivor");
    expect(endEv.payload.holdCount).toBe(2); // a e b; c morreu na virada e nunca foi segurado
    expect(endEv.payload.survivors).toEqual(["D"]);
  });

  it("timeout com >1 vivo: todos full-heal + bônus menor pra cada (sem coins)", () => {
    const room = makeRoom();
    const t0 = Date.now();
    const { players } = startEvent(room, t0);
    room.director.tick(room, 0.05, t0 + BR_WARNING_MS); // → active
    const tActive = t0 + BR_WARNING_MS;

    // todos dentro da zona, 2 mortos segurados + 2 vivos machucados
    const [dead1, dead2, s1, s2] = players;
    for (const p of [s1, s2]) {
      p.x = room.state.event.zoneX;
      p.z = room.state.event.zoneZ;
    }
    s1.hp = 30;
    s2.hp = 55;
    const coins1 = s1.coins;
    const xp1 = s1.xp;
    const xp2 = s2.xp;
    dead1.hp = 0;
    dead2.hp = 0;
    room.update(0.05);

    room.director.tick(room, 0.05, tActive + BR_DURATION_MS); // tempo esgotou com 2 vivos
    expect(room.state.event.phase).toBe("ending");

    expect(s1.hp).toBe(s1.maxHp);
    expect(s2.hp).toBe(s2.maxHp);
    expect(s1.coins).toBe(coins1); // coins só pro sobrevivente único
    expect(s1.level > 1 || s1.xp > xp1).toBe(true);
    expect(s2.level > 1 || s2.xp > xp2).toBe(true);

    const endEv = room.debugEvents.find((e: any) => e.type === "event_end");
    expect(endEv.payload.reason).toBe("timeout");
    expect(endEv.payload.holdCount).toBe(2);

    // ending → idle zera a zona no schema
    room.director.tick(room, 0.05, tActive + BR_DURATION_MS + BR_ENDING_MS);
    expect(room.state.event.phase).toBe("idle");
    expect(room.state.event.zoneRadius).toBe(0);
  });

  it("cooldown PRÓPRIO (120s) bloqueia reativação mesmo após o cooldown global (30s)", () => {
    const room = makeRoom();
    const t0 = Date.now();
    startEvent(room, t0);
    // ciclo completo até idle
    room.director.tick(room, 0.05, t0 + BR_WARNING_MS);
    room.director.tick(room, 0.05, t0 + BR_WARNING_MS + BR_DURATION_MS);
    const tEnd = t0 + BR_WARNING_MS + BR_DURATION_MS + BR_ENDING_MS;
    room.director.tick(room, 0.05, tEnd);
    expect(room.state.event.phase).toBe("idle");

    // global (30s) vencido, próprio (120s) não → not_eligible
    const afterGlobal = room.director.forceTrigger("battle_royale", room, tEnd + EVENT_GLOBAL_COOLDOWN_MS + 1);
    expect(afterGlobal.ok).toBe(false);
    if (!afterGlobal.ok) expect(afterGlobal.reason).toBe("not_eligible");

    // próprio vencido → dispara de novo
    const afterOwn = room.director.forceTrigger("battle_royale", room, tEnd + BR_COOLDOWN_MS + 1);
    expect(afterOwn.ok).toBe(true);
  });
});

describe("Player segurado (hp=0) é invisível pra projéteis — confirmação T-066", () => {
  it("projétil atravessa o morto segurado sem gerar hit", () => {
    // mapa plano sem paredes/props/zonas: linha de tiro garantida
    const map: GameMap = { w: 20, h: 20, seed: 0, cells: new Uint8Array(20 * 20), props: [], zones: [] };
    const state = new ArenaState();
    const shooter = new Player();
    shooter.x = 5.5;
    shooter.z = 10.5;
    shooter.dir = 0; // atira no +x
    shooter.firing = true;
    const held = new Player();
    held.x = 8.5;
    held.z = 10.5;
    held.hp = 0;
    held.waitingRespawn = true;
    state.players.set("shooter", shooter);
    state.players.set("held", held);

    const system = new ProjectileSystem();
    const effects = new EffectSystem();
    const hits: any[] = [];
    let now = 1_000;
    for (let i = 0; i < 40; i++) {
      hits.push(...system.tick(state, map, 0.05, now, effects));
      now += 50;
    }
    expect(hits.filter((h) => h.targetId === "held")).toHaveLength(0);
  });
});
