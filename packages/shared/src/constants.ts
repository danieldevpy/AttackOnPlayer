// Fonte única de verdade para servidor, cliente e bots.

// Mapa (ADR-007: dinâmico, mínimo 5x o base)
export const BASE_MAP_W = 15;
export const BASE_MAP_H = 13;
export const MAP_MIN_SCALE = 5;
export const TILE = 1; // 1 tile = 1 unidade de mundo

export const TICK_RATE = 20; // simulações/s no servidor
export const PLAYER_SPEED = 4; // unidades/s (base — ver mechanics/skills.md)
export const PLAYER_RADIUS = 0.35;
export const PLAYER_BASE_HP = 100;

export const MAX_PLAYERS = 8;

// Coletáveis (ADR-006: nascem longe de jogadores)
export type CollectibleKind = "xp_orb" | "speed_up" | "coin_buff" | "farm_event" | "box";
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

// Coletáveis expandidos + spawn por zona (T-004, docs/mechanics/growth.md)
// A raridade de farm_event/box já vem de graça do tamanho da zona de guerra (pequena
// perto da área total do mapa) — os pesos abaixo só decidem QUAL kind nasce ali dentro.
export const SAFE_ZONE_SPAWN_CHANCE = 0.3; // maioria das tentativas em zona safe é descartada (rara)
export const FIELD_WEIGHTS: Array<[CollectibleKind, number]> = [
  ["xp_orb", 0.6],
  ["speed_up", 0.25],
  ["coin_buff", 0.15],
];
export const SAFE_WEIGHTS: Array<[CollectibleKind, number]> = [
  ["xp_orb", 0.7],
  ["speed_up", 0.3],
];
export const WAR_WEIGHTS: Array<[CollectibleKind, number]> = [
  ["farm_event", 0.85],
  ["box", 0.15],
];

export const COIN_BUFF_AMOUNT = 10;
export const XP_BOOST_MULT = 2; // farm_event: XP em dobro
export const XP_BOOST_MS = 20000;
export const BOX_ATTR_BONUS_EACH = 3; // box: bônus forte no round (vs. 1 do level-up normal)

/** Sorteio ponderado — usado para escolher o kind do coletável dentro da zona. */
export function pickWeighted<T extends string>(rnd: () => number, weights: Array<[T, number]>): T {
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let roll = rnd() * total;
  for (const [kind, w] of weights) {
    roll -= w;
    if (roll <= 0) return kind;
  }
  return weights[weights.length - 1][0];
}

// Crescimento — XP, nível, atributos (T-003, docs/mechanics/growth.md)
export const XP_BASE = 20;
export const XP_EXP = 1.35; // as 2 constantes controlam todo o pacing (balance por dados, T-009)
export const XP_PICKUP_AMOUNT = 8; // XP de um coletável comum (xp_orb)
export const ATTR_POINTS_PER_LEVEL_EACH = 1; // preset equilibrado: 1 pt em cada atributo-base por nível
export const COIN_REROLL_COST = 15; // T-004: coins compram reroll do preset de atributo do último nível

// Atributos data-driven (SPEC-0004/ADR-013, T-015) — valor por ponto e teto PRÓPRIOS
// por atributo (substitui o ATTR_POINT_VALUE único de 4%). Escala assimétrica: dano
// cresce mais rápido que HP ⇒ especializar em força derruba o TTK (5 → 3-4 tiros);
// tetos individuais são o guardrail anti-snowball (ADR-013 §9).
export type AttrKey = "forca" | "vitalidade" | "agilidade" | "cadencia" | "alcance";
export interface AttrDef {
  perPoint: number; // contribuição de cada ponto no multiplicador (negativo = reduz, ex.: cooldown)
  min: number; // piso do multiplicador efetivo
  max: number; // teto do multiplicador efetivo (anti-snowball)
}
export const ATTR_DEFS: Record<AttrKey, AttrDef> = {
  forca: { perPoint: 0.06, min: 1, max: 3.0 }, // × dano do lançador
  vitalidade: { perPoint: 0.04, min: 1, max: 2.5 }, // × maxHp
  agilidade: { perPoint: 0.03, min: 1, max: 2.0 }, // × velocidade (teto = SPEED_MAX_MULT, ADR-009)
  cadencia: { perPoint: -0.04, min: 0.55, max: 1 }, // × cooldown do lançador (mín. 55% ⇒ 600→330ms)
  alcance: { perPoint: 0.05, min: 1, max: 1.75 }, // × range do projétil (8u → máx. 14u)
};
/** Atributos-base do preset equilibrado (level-up automático); cadência/alcance só via escolha (T-016). */
export const BASE_ATTRS: AttrKey[] = ["forca", "vitalidade", "agilidade"];
/** Multiplicador efetivo de um atributo para N pontos, já com piso/teto aplicados. */
export function attrMult(key: AttrKey, points: number): number {
  const d = ATTR_DEFS[key];
  return Math.min(d.max, Math.max(d.min, 1 + points * d.perPoint));
}

// Cards de level-up (T-016, SPEC-0004) — escolha do jogador a cada nível.
// DETERMINÍSTICOS por nível (nunca sorteio): quem conhece a tabela planeja a build
// (pilar habilidade > sorte). Todo card vale UPGRADE_CARD_POINTS pontos.
export interface UpgradeCard {
  id: string;
  label: string;
  points: Partial<Record<AttrKey, number>>;
  skill?: string; // T-017: card de marco — concede uma skill (SKILLS) em vez de pontos
}
export const UPGRADE_CARD_POINTS = 3; // mesma soma do preset antigo (1 pt × 3 atributos-base)
export const UPGRADE_CHOICE_TIMEOUT_MS = 5000; // sem escolha → auto-pick; o jogo NUNCA pausa
export const UPGRADE_CARD_POOL: UpgradeCard[] = [
  { id: "forca_bruta", label: "+3 Força", points: { forca: 3 } },
  { id: "casca_grossa", label: "+3 Vitalidade", points: { vitalidade: 3 } },
  { id: "pes_ligeiros", label: "+3 Agilidade", points: { agilidade: 3 } },
  { id: "gatilho_rapido", label: "+2 Cadência  +1 Alcance", points: { cadencia: 2, alcance: 1 } },
  { id: "olhar_de_aguia", label: "+2 Alcance  +1 Cadência", points: { alcance: 2, cadencia: 1 } },
  { id: "equilibrado", label: "+1 Força  +1 Vitalidade  +1 Agilidade", points: { forca: 1, vitalidade: 1, agilidade: 1 } },
];
/** Timeout/AFK e bots sem política: o preset equilibrado de sempre. */
export const UPGRADE_AUTO_PICK: UpgradeCard = UPGRADE_CARD_POOL[5];
/** 3 cards da oferta do nível — janela determinística sobre o pool (offsets 0/2/4 são sempre distintos mod 6). */
export function upgradeCardsForLevel(level: number): UpgradeCard[] {
  const n = UPGRADE_CARD_POOL.length;
  const base = ((level % n) + n) % n;
  return [UPGRADE_CARD_POOL[base], UPGRADE_CARD_POOL[(base + 2) % n], UPGRADE_CARD_POOL[(base + 4) % n]];
}

/** XP necessário para sair de `level` e chegar ao próximo — curva de pacing (T-003). */
export function xpToNext(level: number): number {
  return Math.round(XP_BASE * Math.pow(level, XP_EXP));
}

// Progressão e Morte (T-006)
export const XP_PER_KILL_PER_LEVEL = 15;
export const MAX_LEVEL_LOSS_FRACTION = 0.6; // teto de perda (60% do nível em níveis altos)
export const MIN_LOSS_FRACTION = 0.1; // piso (10% do nível)

/** Fração do nível atual que o jogador perde ao morrer. (T-006) */
export function lossFraction(level: number): number {
  if (level <= 3) return MIN_LOSS_FRACTION;
  // escala linear a partir do nível 4 até o teto
  return Math.min(MAX_LEVEL_LOSS_FRACTION, MIN_LOSS_FRACTION + (level - 3) * 0.05);
}

// Efeitos (ADR-009)
export const SPEED_BOOST_MULT = 1.5;
export const SPEED_BOOST_MS = 8000;
export const SPEED_MAX_MULT = 2; // teto anti-snowball

export const ROOM_NAME = "arena";
export const SERVER_PORT = 2567;
