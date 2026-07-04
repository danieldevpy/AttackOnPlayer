// Fonte única de verdade para servidor, cliente e bots.

// Mapa (ADR-007: dinâmico, mínimo 5x o base)
export const BASE_MAP_W = 15;
export const BASE_MAP_H = 13;
export const MAP_MIN_SCALE = 5;
export const TILE = 1; // 1 tile = 1 unidade de mundo

export const TICK_RATE = 20; // simulações/s no servidor
export const PLAYER_SPEED = 4; // unidades/s (base — ver mechanics/skills.md)
export const PLAYER_RADIUS = 0.35;

export const MAX_PLAYERS = 8;

// Coletáveis (ADR-006: nascem longe de jogadores)
export type CollectibleKind = "level_up" | "speed_up";
export const SPEED_UP_CHANCE = 0.3; // 30% speed_up / 70% level_up
export const COLLECT_DIST = 0.6;
export const SPAWN_MIN_PLAYER_DIST = 4; // tiles (Manhattan)
export const RESPAWN_DELAY_MIN_MS = 2000;
export const RESPAWN_DELAY_MAX_MS = 5000;
export const RESPAWN_FAST_MS = 300; // quando abaixo de metade do orçamento

/** Orçamento de coletáveis escala com a área (mapa grande não vira deserto). */
export function collectibleBudget(w: number, h: number): number {
  return Math.max(5, Math.floor((w * h) / 160));
}

// Efeitos (ADR-009)
export const SPEED_BOOST_MULT = 1.5;
export const SPEED_BOOST_MS = 8000;
export const SPEED_MAX_MULT = 2; // teto anti-snowball

export const ROOM_NAME = "arena";
export const SERVER_PORT = 2567;
