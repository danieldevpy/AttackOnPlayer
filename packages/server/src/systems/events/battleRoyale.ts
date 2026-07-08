// SPEC-0016 (T-066): Battle Royale relâmpago — primeiro evento concreto do Event Director.
// Ciclo: warning (zona nasce sobre o cluster mais denso) → active (zona encolhe até 0, fora
// dela dano VERDADEIRO crescente) → ending (sobrevivente premiado, segurados renascem juntos).
// Tudo server-authoritative; o cliente só desenha `state.event` (T-067/T-068).
import {
  BR_MIN_PLAYERS,
  BR_COOLDOWN_MS,
  BR_WARNING_MS,
  BR_DURATION_MS,
  BR_ENDING_MS,
  BR_ZONE_RADIUS_MIN,
  BR_ZONE_RADIUS_MAX,
  BR_OUTSIDE_DPS_BASE,
  BR_OUTSIDE_DPS_GROWTH,
  BR_SURVIVOR_XP_BONUS,
  BR_SURVIVOR_COINS_BONUS,
  BR_TIMEOUT_XP_BONUS,
  GameMap,
  nearestReachableCell,
} from "@aop/shared";
import { EventDefinition, EventRoom } from "./types";
import { Player } from "../../state/ArenaState";

const BR_ID = "battle_royale";

/** Lado (em tiles, ímpar) da janela deslizante da varredura de densidade — o "cluster" é o
 * conjunto de players vivos dentro da janela vencedora. Número de implementação (não dial):
 * muda onde a zona nasce, não a sensação de jogo. */
const DENSITY_WINDOW = 9;
/** Folga (tiles) além do player mais distante ao envolver o cluster (spec: "com folga"). */
const ZONE_RADIUS_SLACK = 2;

/** Curva do dano de zona: dps = base × (1 + growth × t), t = segundos de "active" (spec §BR). */
export function outsideDps(tSeconds: number): number {
  return BR_OUTSIDE_DPS_BASE * (1 + BR_OUTSIDE_DPS_GROWTH * tSeconds);
}

/**
 * Centro da zona = centro da janela DENSITY_WINDOW×DENSITY_WINDOW com mais players vivos
 * (varredura em grade via imagem integral — soma de qualquer janela em O(1); empate = a
 * primeira encontrada, spec permite qualquer). Devolve coordenadas de mundo SEM snap — o
 * chamador snapa em célula alcançável (`nearestReachableCell`). Exportada pura pra teste.
 */
export function pickZoneCenter(
  positions: Array<{ x: number; z: number }>,
  map: GameMap
): { x: number; z: number } {
  const { w, h } = map;
  if (positions.length === 0) return { x: w / 2, z: h / 2 }; // inalcançável (elegibilidade exige ≥4)

  const counts = new Uint16Array(w * h);
  for (const pos of positions) {
    const tx = Math.max(0, Math.min(w - 1, Math.floor(pos.x)));
    const tz = Math.max(0, Math.min(h - 1, Math.floor(pos.z)));
    counts[tz * w + tx] += 1;
  }

  // imagem integral: integ[(z+1)*(w+1)+(x+1)] = soma de counts[0..z][0..x]
  const integ = new Uint32Array((w + 1) * (h + 1));
  for (let z = 0; z < h; z++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += counts[z * w + x];
      integ[(z + 1) * (w + 1) + (x + 1)] = integ[z * (w + 1) + (x + 1)] + rowSum;
    }
  }

  const win = Math.min(DENSITY_WINDOW, w, h);
  let best = -1;
  let bestX = 0;
  let bestZ = 0;
  for (let z0 = 0; z0 + win <= h; z0++) {
    for (let x0 = 0; x0 + win <= w; x0++) {
      const sum =
        integ[(z0 + win) * (w + 1) + (x0 + win)] -
        integ[z0 * (w + 1) + (x0 + win)] -
        integ[(z0 + win) * (w + 1) + x0] +
        integ[z0 * (w + 1) + x0];
      if (sum > best) {
        best = sum;
        bestX = x0;
        bestZ = z0;
      }
    }
  }
  return { x: bestX + win / 2, z: bestZ + win / 2 };
}

/**
 * Raio inicial: envolve com folga os players vivos que a zona consegue abraçar (dist ao centro
 * ≤ BR_ZONE_RADIUS_MAX), clamp [BR_ZONE_RADIUS_MIN, BR_ZONE_RADIUS_MAX]. Exportada pura pra teste.
 */
export function zoneStartRadius(
  center: { x: number; z: number },
  positions: Array<{ x: number; z: number }>
): number {
  let maxDist = 0;
  for (const pos of positions) {
    const dist = Math.hypot(pos.x - center.x, pos.z - center.z);
    if (dist > BR_ZONE_RADIUS_MAX) continue; // longe demais pra envolver — fica de fora
    maxDist = Math.max(maxDist, dist);
  }
  return Math.min(BR_ZONE_RADIUS_MAX, Math.max(BR_ZONE_RADIUS_MIN, maxDist + ZONE_RADIUS_SLACK));
}

/** Estado runtime por SALA — a definição no registry é um singleton compartilhado entre salas,
 * então nada mutável pode viver no objeto do evento (duas salas com BR simultâneo colidiriam). */
interface BattleRoyaleRuntime {
  radiusStart: number;
  activeStartedAt: number; // 0 = ainda em warning
  zoneDeaths: number;
}
const runtimeByRoom = new WeakMap<EventRoom, BattleRoyaleRuntime>();

function livingPositions(room: EventRoom): Array<{ x: number; z: number }> {
  const positions: Array<{ x: number; z: number }> = [];
  room.state.players.forEach((p) => {
    if (p.hp > 0) positions.push({ x: p.x, z: p.z });
  });
  return positions;
}

export const BattleRoyaleEvent: EventDefinition = {
  id: BR_ID,
  weight: 1,
  warningMs: BR_WARNING_MS,
  durationMs: BR_DURATION_MS,
  endingMs: BR_ENDING_MS,

  // ≥4 vivos (bots contam) + cooldown PRÓPRIO de 120s (o global de 30s é do Director).
  // `lastEndedAt === 0` = nunca rodou nesta sala. `enabled` vem do painel Django (T-071).
  checkEligibility(ctx) {
    if (!ctx.enabled) return false;
    if (ctx.livingCount < BR_MIN_PLAYERS) return false;
    if (ctx.lastEndedAt !== 0 && ctx.now - ctx.lastEndedAt < BR_COOLDOWN_MS) return false;
    return true;
  },

  // Warning: zona nasce sobre o cluster mais denso, snapada em célula alcançável; morte
  // nesta fase renasce DENTRO da zona (respawnPolicy abaixo) — ninguém começa o active longe.
  onWarningStart(room, _now) {
    const positions = livingPositions(room);
    const raw = pickZoneCenter(positions, room.map);
    const center = nearestReachableCell(room.map, raw.x, raw.z, room.reachable);
    const radius = zoneStartRadius(center, positions);

    room.state.event.zoneX = center.x;
    room.state.event.zoneZ = center.z;
    room.state.event.zoneRadius = radius;
    runtimeByRoom.set(room, { radiusStart: radius, activeStartedAt: 0, zoneDeaths: 0 });

    room.emitDebug("event_warning", {
      id: BR_ID,
      zoneX: center.x,
      zoneZ: center.z,
      radius,
      living: positions.length,
    });
    room.emitTelemetry({
      ...room.telemetryBase(),
      type: "event_warning",
      eventId: BR_ID,
      zone: { x: center.x, z: center.z, radius },
      livingCount: positions.length,
    });
  },

  onStart(room, now) {
    const rt = runtimeByRoom.get(room);
    if (!rt) return; // impossível no ciclo do Director; guarda contra uso fora de ordem
    rt.activeStartedAt = now;
    rt.radiusStart = room.state.event.zoneRadius;

    room.emitDebug("event_start", {
      id: BR_ID,
      zoneX: room.state.event.zoneX,
      zoneZ: room.state.event.zoneZ,
      radius: rt.radiusStart,
      living: livingPositions(room).length,
    });
    room.emitTelemetry({
      ...room.telemetryBase(),
      type: "event_start",
      eventId: BR_ID,
      zone: { x: room.state.event.zoneX, z: room.state.event.zoneZ, radius: rt.radiusStart },
      livingCount: livingPositions(room).length,
    });
  },

  // Active: raio interpola linear até 0; fora da zona, dano VERDADEIRO direto em `p.hp` —
  // ignora zona safe do mapa, escudo (`damageTakenMult`) e `spawnProtectedUntil` de propósito
  // (spec: senão vira camping). NÃO passa pelo ProjectileSystem: o bloco `hp <= 0` do
  // `updateInner` (que roda DEPOIS do director.tick, no mesmo tick) processa a morte sem killer.
  onTick(room, dt, now) {
    const rt = runtimeByRoom.get(room);
    if (!rt || rt.activeStartedAt === 0) return;

    const frac = Math.min(1, Math.max(0, (now - rt.activeStartedAt) / BR_DURATION_MS));
    const ev = room.state.event;
    ev.zoneRadius = rt.radiusStart * (1 - frac);

    const elapsedS = Math.max(0, (now - rt.activeStartedAt) / 1000);
    const dps = outsideDps(elapsedS);
    room.state.players.forEach((p, id) => {
      if (p.hp <= 0) return; // morto/segurado não toma dano de zona
      if (Math.hypot(p.x - ev.zoneX, p.z - ev.zoneZ) <= ev.zoneRadius) return;
      p.hp -= dps * dt;
      if (p.hp <= 0) {
        rt.zoneDeaths += 1;
        room.emitDebug("event_zone_death", { playerId: id, elapsedS });
        room.emitTelemetry({
          ...room.telemetryBase(),
          type: "event_zone_death",
          eventId: BR_ID,
          playerToken: p.playerToken,
          pos: { x: p.x, z: p.z },
          elapsedS,
        });
      }
    });
  },

  // Pedido explícito do CD: sobrou ≤1 vivo → direto pro ending (quem espera renasce já).
  earlyEndCondition(room, _now) {
    let living = 0;
    room.state.players.forEach((p) => {
      if (p.hp > 0) living += 1;
    });
    return living <= 1 ? "last_survivor" : false;
  },

  // Resultado resolvido NA ENTRADA do ending (timeout ou early-end): sobrevivente(s) com vida
  // cheia NO LUGAR (sem teleporte, gameplay não interrompe) + bônus; todos os `waitingRespawn`
  // renascem juntos no MESMO tick. A fase ending em si é só o destaque visual (T-067).
  onEndingStart(room, reason, now) {
    const rt = runtimeByRoom.get(room);
    const survivors: Array<{ id: string; p: Player }> = [];
    room.state.players.forEach((p, id) => {
      if (p.hp > 0) survivors.push({ id, p });
    });

    // 1 vivo = bônus cheio; timeout com vários = bônus menor pra cada; 0 vivos = ninguém.
    for (const { id, p } of survivors) {
      p.hp = p.maxHp;
      if (survivors.length === 1) {
        room.grantXp(id, p, BR_SURVIVOR_XP_BONUS);
        p.coins += BR_SURVIVOR_COINS_BONUS;
      } else {
        room.grantXp(id, p, BR_TIMEOUT_XP_BONUS);
      }
    }

    const holdCount = room.releaseHeldRespawns(now);

    // T-067 exibe o destaque de resultado com isto (tolera ausência — mas aqui sempre emite).
    room.broadcast("event_result", {
      survivorNames: survivors.map(({ p }) => p.name),
      reason,
    });
    room.emitDebug("event_end", {
      id: BR_ID,
      reason,
      survivors: survivors.map(({ p }) => p.name),
      holdCount,
      zoneDeaths: rt?.zoneDeaths ?? 0,
    });
    room.emitTelemetry({
      ...room.telemetryBase(),
      type: "event_end",
      eventId: BR_ID,
      reason,
      survivorTokens: survivors.map(({ p }) => p.playerToken),
      holdCount,
    });
  },

  // Fim do ciclo (ending→idle): só cleanup — zona no schema é zerada pelo `goIdle` do Director,
  // cooldowns (próprio + global) registrados por ele também.
  onEnd(room, _reason, _now) {
    runtimeByRoom.delete(room);
  },

  // Warning: renasce DENTRO da zona (célula walkable sorteada no raio — core, T-065).
  // Active: morte segurada até o fim ("hold_until_end"). Ending/idle: fluxo normal.
  respawnPolicy(_room, _playerId, phase) {
    if (phase === "warning") return "inside_zone";
    if (phase === "active") return "hold_until_end";
    return "default";
  },
};
