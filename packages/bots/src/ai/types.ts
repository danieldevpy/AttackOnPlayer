// Tipos da arquitetura de IA em camadas (docs/ai/bot-architecture.md, T-020).
// Percepção → Memória → Decisão (utility) → Steering contextual → Humanizador → Atuação.

export interface Vec2 {
  x: number;
  z: number;
}

export type Zone = "safe" | "war" | "field";

/**
 * Vetor de personalidade (bot-architecture.md §3): pesos que multiplicam os escores da
 * decisão + knobs do humanizador. Comportamento novo = novos valores, não novo código.
 */
export interface Personality {
  aggression: number; // W_agressao
  caution: number; // W_cautela
  greed: number; // W_ganancia (coleta)
  wander: number; // piso de perambulação
  objective: number; // W_objetivo (T-021: disputa da bandeira)
  engageRange: number; // raio de detecção/caça
  fleeHpFrac: number; // fração de HP abaixo da qual a fuga pesa mais
  aimErrorRad: number; // erro sistemático inicial (decai enquanto rastreia o mesmo alvo)
  aimLerp: number; // 0..1 — fração de correção da mira por tick de humanização
  reactionMsRange: [number, number]; // atraso entre perceber e agir
  fireIntervalMsRange: [number, number]; // cadência com jitter
  giveUpMs: number; // desiste do alvo atual sem progresso após isto
}

export interface PerceivedEnemy {
  id: string;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  level: number;
  dist: number;
  zone: Zone;
}

export interface PerceivedCollectible {
  id: string;
  x: number;
  z: number;
  dist: number;
}

/** T-021: bandeira "rei do mapa" — visível o mapa inteiro (não filtrada por raio). */
export interface PerceivedFlag {
  x: number;
  z: number;
  dist: number;
  zone: Zone;
  carriedBySelf: boolean;
  /** id do portador atual; vazio/ausente = bandeira no chão (disputável por pickup). */
  carrierId?: string;
}

/** Snapshot filtrado (camada 1) — nunca o estado inteiro do servidor. */
export interface Perception {
  self: { x: number; z: number; hp: number; maxHp: number; level: number; zone: Zone };
  enemies: PerceivedEnemy[]; // ordenados por distância (com ruído)
  collectibles: PerceivedCollectible[]; // ordenados por distância
  nearestBorderDist: number;
  flag?: PerceivedFlag; // ausente quando a room desliga o toggle (T-021)
}

export type ActionKind = "engage" | "flee" | "collect" | "wander" | "flag";

export interface DecisionResult {
  action: ActionKind;
  targetId?: string;
  scores: Record<ActionKind, number>;
}
