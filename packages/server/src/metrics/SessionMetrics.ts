import fs from "fs";
import path from "path";

export interface PlayerSession {
  sessionId: string;
  playerId: string;
  name: string;
  isBot: boolean;
  joinedAt: number;
  leftAt?: number;
  durationS?: number;
  distance: number;
  pickups: number;
  pickupsByKind: Record<string, number>; // xp_orb/speed_up/coin_buff/farm_event/box (T-004)
  kills: number;
  deaths: number;
  levelStart: number;
  levelEnd?: number;
}

const LOG_DIR = path.resolve(__dirname, "../../logs");
const LOG_FILE = path.join(LOG_DIR, "sessions.jsonl");

export class MetricsRecorder {
  private sessions = new Map<string, PlayerSession>();

  start(playerId: string, name: string, isBot: boolean, roomId: string, level: number) {
    this.sessions.set(playerId, {
      sessionId: roomId,
      playerId,
      name,
      isBot,
      joinedAt: Date.now(),
      distance: 0,
      pickups: 0,
      pickupsByKind: {},
      kills: 0,
      deaths: 0,
      levelStart: level,
    });
  }

  addDistance(playerId: string, d: number) {
    const s = this.sessions.get(playerId);
    if (s) s.distance += d;
  }

  addPickup(playerId: string, kind: string = "xp_orb") {
    const s = this.sessions.get(playerId);
    if (!s) return;
    s.pickups += 1;
    s.pickupsByKind[kind] = (s.pickupsByKind[kind] ?? 0) + 1;
  }

  addKill(playerId: string) {
    const s = this.sessions.get(playerId);
    if (s) s.kills += 1;
  }

  addDeath(playerId: string) {
    const s = this.sessions.get(playerId);
    if (s) s.deaths += 1;
  }

  end(playerId: string, levelEnd: number) {
    const s = this.sessions.get(playerId);
    if (!s) return;
    s.leftAt = Date.now();
    s.durationS = Math.round((s.leftAt - s.joinedAt) / 100) / 10;
    s.levelEnd = levelEnd;
    s.distance = Math.round(s.distance * 10) / 10;
    try {
      fs.mkdirSync(LOG_DIR, { recursive: true });
      fs.appendFileSync(LOG_FILE, JSON.stringify(s) + "\n");
    } catch (e) {
      console.error("[metrics] falha ao gravar sessão:", e);
    }
    this.sessions.delete(playerId);
  }
}

/** Agregado simples para GET /metrics/summary. */
export function summarize(): Record<string, unknown> {
  try {
    const lines = fs.readFileSync(LOG_FILE, "utf-8").trim().split("\n").filter(Boolean);
    const all = lines.map((l) => JSON.parse(l) as PlayerSession);
    const n = all.length;
    const avg = (f: (s: PlayerSession) => number) =>
      n ? Math.round((all.reduce((a, s) => a + f(s), 0) / n) * 10) / 10 : 0;
    return {
      totalSessions: n,
      bots: all.filter((s) => s.isBot).length,
      avgDurationS: avg((s) => s.durationS ?? 0),
      avgDistance: avg((s) => s.distance),
      avgPickups: avg((s) => s.pickups),
      avgKills: avg((s) => s.kills ?? 0),
      avgDeaths: avg((s) => s.deaths ?? 0),
      avgLevelEnd: avg((s) => s.levelEnd ?? 1),
    };
  } catch {
    return { totalSessions: 0 };
  }
}
