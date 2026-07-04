// Fonte única de verdade para servidor, cliente e bots.

export const MAP_W = 15; // tiles (x)
export const MAP_H = 13; // tiles (z)
export const TILE = 1; // 1 tile = 1 unidade de mundo

export const TICK_RATE = 20; // simulações/s no servidor
export const PLAYER_SPEED = 4; // unidades/s
export const PLAYER_RADIUS = 0.35;

export const MAX_PLAYERS = 8;

// Coletáveis (ADR-006: nascem longe de jogadores)
export const MAX_COLLECTIBLES = 5;
export const COLLECT_DIST = 0.6; // distância para coletar
export const SPAWN_MIN_PLAYER_DIST = 4; // tiles (Manhattan)
export const RESPAWN_DELAY_MIN_MS = 2000;
export const RESPAWN_DELAY_MAX_MS = 5000;

export const ROOM_NAME = "arena";
export const SERVER_PORT = 2567;
