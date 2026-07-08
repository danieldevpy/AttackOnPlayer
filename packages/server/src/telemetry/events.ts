/**
 * T-026 (SPEC-0008): schema versionado da telemetria por partida. Um arquivo NDJSON por
 * `matchId` (roomId) em `logs/telemetry/<matchId>.ndjson` — cada linha é um destes eventos.
 * Complementa (não substitui) `metrics/SessionMetrics.ts` (M0, resumo por jogador): aqui o grão
 * é o EVENTO (kill, escolha de card, posse de bandeira, saída, erro), pensado pra uma IA ler o
 * arquivo inteiro e responder "onde as mortes se concentram?"/"qual card é mais recusado?".
 */
export const TELEMETRY_SCHEMA_VERSION = 1;

export interface Pos {
  x: number;
  z: number;
}

interface BaseEvent {
  v: typeof TELEMETRY_SCHEMA_VERSION;
  ts: number; // Date.now() no instante do evento
  tick: number; // contador de ticks do servidor desde o onCreate da sala (ordenação fina sem depender só de ts)
  matchId: string; // roomId
  mapId?: string; // presente só em mapa curado (T-024/T-025)
}

export type MatchStartEvent = BaseEvent & {
  type: "match_start";
  mapW: number;
  mapH: number;
  mapSeed: number;
  expectedPlayers?: number;
};

export type MatchEndEvent = BaseEvent & {
  type: "match_end";
  durationS: number;
  playerCount: number;
};

export type KillEvent = BaseEvent & {
  type: "kill";
  killerToken: string;
  killerPos: Pos;
  killerLevel: number;
  victimToken: string;
  victimPos: Pos;
  victimLevel: number;
  threats: number; // SPEC-0010: inimigos vivos perto do matador (0 = duelo)
};

export type UpgradeOfferEvent = BaseEvent & {
  type: "upgrade_offer";
  playerToken: string;
  level: number;
  offeredCardIds: string[];
};

export type UpgradeChoiceEvent = BaseEvent & {
  type: "upgrade_choice";
  playerToken: string;
  level: number;
  chosenCardId: string;
  declinedCardIds: string[];
  autoPick: boolean; // timeout — nenhuma escolha ativa do jogador
};

export type FlagPossessionEvent = BaseEvent & {
  type: "flag_possession";
  playerToken: string;
  action: "pickup" | "drop";
  pos: Pos;
};

export type QuitEvent = BaseEvent & {
  type: "quit";
  playerToken: string;
  reason: "disconnect";
  durationS: number;
  finalLevel: number;
};

export type TickSlowEvent = BaseEvent & {
  type: "tick_slow";
  dtMs: number;
  thresholdMs: number;
};

export type TelemetryErrorEvent = BaseEvent & {
  type: "error";
  context: string;
  message: string;
  stack?: string;
};

// SPEC-0016 (T-066): ciclo de vida dos eventos de sessão (Event Director + Battle Royale).
// Métricas pra balancear duração/dano da zona com dados reais (spec §Interações).
export type EventWarningEvent = BaseEvent & {
  type: "event_warning";
  eventId: string;
  zone: Pos & { radius: number };
  livingCount: number;
};

export type EventStartEvent = BaseEvent & {
  type: "event_start";
  eventId: string;
  zone: Pos & { radius: number };
  livingCount: number;
};

export type EventZoneDeathEvent = BaseEvent & {
  type: "event_zone_death";
  eventId: string;
  playerToken: string;
  pos: Pos;
  elapsedS: number; // segundos de "active" no instante da morte — calibra a curva de dps
};

export type EventEndEvent = BaseEvent & {
  type: "event_end";
  eventId: string;
  reason: string; // "timeout" | "last_survivor"
  survivorTokens: string[];
  holdCount: number; // quantos `waitingRespawn` foram liberados juntos no fim
};

export type TelemetryEvent =
  | MatchStartEvent
  | MatchEndEvent
  | KillEvent
  | UpgradeOfferEvent
  | UpgradeChoiceEvent
  | FlagPossessionEvent
  | QuitEvent
  | TickSlowEvent
  | TelemetryErrorEvent
  | EventWarningEvent
  | EventStartEvent
  | EventZoneDeathEvent
  | EventEndEvent;
