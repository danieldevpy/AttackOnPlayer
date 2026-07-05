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

// 16 acomoda sessões de teste com ~10 bots + humanos (era 8; bots excedentes caíam
// silenciosamente em outra sala via joinOrCreate — QA do teste manual da T-021).
export const MAX_PLAYERS = 16;

// Coletáveis (ADR-006: nascem longe de jogadores)
export type CollectibleKind =
  | "xp_orb"
  | "speed_up"
  | "coin_buff"
  | "farm_event"
  | "box"
  | "hp_orb" // SPEC-0010: orbe de vida escasso
  | "shield_temp"; // SPEC-0010: escudo temporário
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
export const BOX_ATTR_BONUS_EACH = 3; // box: bônus forte no round (vs. 2 do level-up normal)

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
export const ATTR_POINTS_PER_LEVEL_EACH = 2; // preset equilibrado: 2 pts em cada atributo-base por nível (T-016 addendum: progressão mais sentida)
export const COIN_REROLL_COST = 15; // T-004: coins compram reroll do preset de atributo do último nível
// SPEC-0005: presença viva. Todo player conectado ganha XP por segundo só por estar na sala —
// o mapa nunca "esfria" e quem foi zerado na morte volta a subir sem depender de drop.
export const XP_PER_SECOND = 1;
// SPEC-0005: reroll (R) além de redistribuir atributos também injeta XP — a tecla vira uma
// alavanca de progressão ativa, não só de reorganização de build.
export const REROLL_XP_REWARD = 20;

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
export const UPGRADE_CARD_POINTS = 6; // dobro do valor original (feedback CD: progressão pouco sentida entre marcos de skill)
export const UPGRADE_CHOICE_TIMEOUT_MS = 5000; // sem escolha → auto-pick; o jogo NUNCA pausa
export const UPGRADE_CARD_POOL: UpgradeCard[] = [
  { id: "forca_bruta", label: "+6 Força", points: { forca: 6 } },
  { id: "casca_grossa", label: "+6 Vitalidade", points: { vitalidade: 6 } },
  { id: "pes_ligeiros", label: "+6 Agilidade", points: { agilidade: 6 } },
  { id: "gatilho_rapido", label: "+4 Cadência  +2 Alcance", points: { cadencia: 4, alcance: 2 } },
  { id: "olhar_de_aguia", label: "+4 Alcance  +2 Cadência", points: { alcance: 4, cadencia: 2 } },
  { id: "equilibrado", label: "+2 Força  +2 Vitalidade  +2 Agilidade", points: { forca: 2, vitalidade: 2, agilidade: 2 } },
];
/** Timeout/AFK e bots sem política: o preset equilibrado de sempre. */
export const UPGRADE_AUTO_PICK: UpgradeCard = UPGRADE_CARD_POOL[5];
/** 3 cards da oferta do nível — janela determinística sobre o pool (offsets 0/2/4 são sempre distintos mod 6). */
export function upgradeCardsForLevel(level: number): UpgradeCard[] {
  const n = UPGRADE_CARD_POOL.length;
  const base = ((level % n) + n) % n;
  return [UPGRADE_CARD_POOL[base], UPGRADE_CARD_POOL[(base + 2) % n], UPGRADE_CARD_POOL[(base + 4) % n]];
}

// Boss de bot (T-008b, SPEC-0004 addendum): nasce alto e com build concentrada — o
// servidor decide de verdade (autoridade), o bot só pede `boss: true` no join.
export const BOSS_LEVEL_MIN = 6;
export const BOSS_LEVEL_MAX = 8;

/** XP necessário para sair de `level` e chegar ao próximo — curva de pacing (T-003). */
export function xpToNext(level: number): number {
  return Math.round(XP_BASE * Math.pow(level, XP_EXP));
}

// Progressão e Morte (T-006)
export const XP_PER_KILL_PER_LEVEL = 15;
export const MAX_LEVEL_LOSS_FRACTION = 0.6; // teto de perda (60% do nível em níveis altos)
export const MIN_LOSS_FRACTION = 0.1; // piso (10% do nível)

/**
 * Fração do nível atual que o jogador perde ao morrer. (T-006)
 * SPEC-0005: NÃO é mais usada no loop — a morte agora zera o nível (volta ao 1). Mantida
 * exportada porque os testes/curva de balance ainda a referenciam e por possível reintrodução.
 */
export function lossFraction(level: number): number {
  if (level <= 3) return MIN_LOSS_FRACTION;
  // escala linear a partir do nível 4 até o teto
  return Math.min(MAX_LEVEL_LOSS_FRACTION, MIN_LOSS_FRACTION + (level - 3) * 0.05);
}

// SPEC-0005: invulnerabilidade de nascimento/renascimento. Substitui a antiga zona safe
// (removida do mapa): ao nascer/renascer o player fica imune por este tempo. A imunidade
// cai no instante em que ele dispara — não dá para "camperar" atirando invulnerável.
export const SPAWN_PROTECTION_MS = 3000;

// SPEC-0010 (ADR-017): Sobrevivência por habilidade — recompensa de kill contextual +
// recursos de vida escassos. Todos os números aqui são calibráveis (sensação, não lógica):
// mover uma constante move o comportamento. Referência de balance: TTK 5 tiros × 20 dano
// em 100 HP (T-014). Anti-snowball (pilar 4): cura só onde há risco, e da vida FALTANTE.

// --- Recompensa de kill contextual (T-033) ---
export const COMBAT_THREAT_RADIUS = 6; // unidades: inimigos vivos neste raio do matador = "a briga"
export const KILL_HEAL_MISSING_FRAC_BASE = 0.25; // 1 ameaça por perto: cura 25% da vida FALTANTE
export const KILL_HEAL_MISSING_FRAC_PER_EXTRA = 0.1; // +10% por ameaça adicional
export const KILL_HEAL_MISSING_FRAC_MAX = 0.5; // teto anti-snowball: 50% da vida faltante
export const KILL_DUEL_XP_BONUS_PER_LEVEL = 8; // duelo (0 ameaças): XP extra por nível da vítima

/** Fração da vida FALTANTE curada ao matar em briga, dado o nº de inimigos por perto (≥1). */
export function killHealFraction(threats: number): number {
  if (threats < 1) return 0;
  return Math.min(KILL_HEAL_MISSING_FRAC_MAX, KILL_HEAL_MISSING_FRAC_BASE + (threats - 1) * KILL_HEAL_MISSING_FRAC_PER_EXTRA);
}

// --- Orbe de vida escasso (T-034) ---
export const HP_ORB_AMOUNT = 5; // +5 HP ao coletar (clampa em maxHp)
export const HP_ORB_MAX = 3; // teto simultâneo no mapa
export const HP_ORB_MIN_PLAYER_DIST = 7; // tiles Manhattan de qualquer player (mais rígido que o comum)
export const HP_ORB_MIN_SELF_DIST = 9; // tiles de outro hp_orb — nunca "chove vida" num canto
export const HP_ORB_RESPAWN_MS = 12000; // reposição lenta

// --- Escudo temporário (T-035) ---
export const SHIELD_TEMP_MAX = 2; // no máximo 2 no mapa ao mesmo tempo
export const SHIELD_TEMP_MIN_PLAYER_DIST = 7;
export const SHIELD_TEMP_MIN_SELF_DIST = 9;
export const SHIELD_TEMP_RESPAWN_MS = 15000;
export const SHIELD_TEMP_MS = 3000; // dura 3s ao coletar
export const SHIELD_TEMP_DAMAGE_MULT = 0.5; // recebe 50% do dano enquanto ativo (reduz, não bloqueia)

// T-023 (SPEC-0006): reveal-on-hit autoritativo — inimigo é só skin até trocar dano com ele
// (vítima OU atirador); então nameplate+HP aparecem por este tempo, renovado a cada novo hit.
export const REVEAL_ON_HIT_MS = 4000;

// Faixas de poder (T-018, SPEC-0004): só FEEDBACK visual/leitura tática — nunca lógica de jogo.
// nível 1–3: nada · 4–7: aro fraco · 8+: aro forte pulsante. Alimenta o "famar aura" do M2.
export const POWER_BAND_MID = 4;
export const POWER_BAND_HIGH = 8;

// Efeitos (ADR-009)
export const SPEED_BOOST_MULT = 1.5;
export const SPEED_BOOST_MS = 8000;
export const SPEED_MAX_MULT = 2; // teto anti-snowball

// Bandeira "rei do mapa" (T-021, SPEC-0006): objetivo de mapa — default ON por room.
// Nasce no centro (T-024/SPEC-0007 vai deixá-la ler a posição do formato de mapa versionado;
// até lá o centro calculado em runtime é o default). Portador ganha XP passivo em dobro e
// fica visível globalmente (glow); morre e derruba no local; sem dono por tempo demais, volta.
export const FLAG_XP_MULT = 2;
export const FLAG_PICKUP_DIST = COLLECT_DIST;
export const FLAG_ABANDON_RETURN_MS = 5000; // caída e não disputada em 5s → volta ao centro (CD, teste manual T-021)

export const ROOM_NAME = "arena";
export const SERVER_PORT = 2567;
