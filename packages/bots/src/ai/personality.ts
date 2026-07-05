import type { Personality } from "./types";

// Ponte temporária (T-020): deriva uma Personality de cada um dos 3 níveis de skill que já
// existiam (T-008). A T-008b troca isto por presets NOMEADOS (agressivo/cauteloso/caçador/
// equilibrado) sorteados por sessão + o boss — dado novo, zero mudança na pipeline abaixo
// (é exatamente a promessa do bot-architecture.md: "comportamento novo = parâmetros").
export type SkillName = "fraco" | "medio" | "forte";
export const SKILL_NAMES: SkillName[] = ["fraco", "medio", "forte"];

export const PERSONALITY_BY_SKILL: Record<SkillName, Personality> = {
  fraco: {
    // reativo: só briga quem chega perto, foge cedo, cadência lenta
    aggression: 0.5,
    caution: 0.75,
    greed: 0.6,
    wander: 0.5,
    engageRange: 12,
    fleeHpFrac: 0.5,
    aimErrorRad: 0.4,
    aimLerp: 0.25,
    reactionMsRange: [350, 500],
    fireIntervalMsRange: [1000, 1900],
    giveUpMs: 4000,
  },
  medio: {
    // caça em raio médio, equilíbrio entre risco e cautela
    aggression: 0.75,
    caution: 0.45,
    greed: 0.55,
    wander: 0.4,
    engageRange: 30,
    fleeHpFrac: 0.35,
    aimErrorRad: 0.18,
    aimLerp: 0.35,
    reactionMsRange: [250, 380],
    fireIntervalMsRange: [550, 1050],
    giveUpMs: 6000,
  },
  forte: {
    // caçador: persegue pelo mapa todo, quase não foge, reage rápido
    aggression: 0.95,
    caution: 0.25,
    greed: 0.4,
    wander: 0.3,
    engageRange: 9999,
    fleeHpFrac: 0.25,
    aimErrorRad: 0.06,
    aimLerp: 0.55,
    reactionMsRange: [180, 280],
    fireIntervalMsRange: [280, 600],
    giveUpMs: 9000,
  },
};

/** BOT_SKILL fixa a skill de todos; ausente = sorteada por bot (variedade na sessão). */
export function skillFor(i: number): SkillName {
  const env = process.env.BOT_SKILL as SkillName | undefined;
  if (env && PERSONALITY_BY_SKILL[env]) return env;
  return SKILL_NAMES[i % SKILL_NAMES.length];
}
