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

// Mundo aberto — props e zonas (ADR-010, T-001)
export const PROP_DENSITY = 0.04; // ~4% dos tiles internos viram prop colidível
export const SAFE_ZONE_RADIUS = 6; // tiles ao redor de cada spawn (também afasta props)
export const WAR_ZONE_RADIUS = 10; // tiles ao redor do(s) ponto(s) quente(s)

// Crescimento — XP, nível, atributos (T-003, docs/mechanics/growth.md)
export const XP_BASE = 20;
export const XP_EXP = 1.35; // as 2 constantes controlam todo o pacing (balance por dados, T-009)
export const XP_PICKUP_AMOUNT = 8; // XP de um coletável comum (xp_orb)
export const ATTR_POINTS_PER_LEVEL_EACH = 1; // preset equilibrado v1: mesmo tanto em cada atributo por nível
export const ATTR_POINT_VALUE = 0.04; // cada ponto = +4% no multiplicador do atributo
export const COIN_REROLL_COST = 15; // T-004: coins compram reroll do preset de atributo do último nível

/** XP necessário para sair de `level` e chegar ao próximo — curva de pacing (T-003). */
export function xpToNext(level: number): number {
  return Math.round(XP_BASE * Math.pow(level, XP_EXP));
}

// Efeitos (ADR-009)
export const SPEED_BOOST_MULT = 1.5;
export const SPEED_BOOST_MS = 8000;
export const SPEED_MAX_MULT = 2; // teto anti-snowball

export const ROOM_NAME = "arena";
export const SERVER_PORT = 2567;
