import type { Personality } from "./types";

// T-008b (SPEC-0004 addendum): presets NOMEADOS — troca a ponte temporária da T-020
// (PERSONALITY_BY_SKILL, 3 níveis de skill) por perfis de bot de verdade, sorteados por
// sessão. Cada perfil combina um vetor de Personality (como o bot LUTA/decide) com uma
// política de escolha de cards (como o bot CONSTRÓI — determinística, explorável pelo
// player: habilidade > sorte). Zero mudança em decision.ts/steering.ts/humanizer.ts —
// é exatamente a promessa do bot-architecture.md.
export type ProfileName = "agressivo" | "cauteloso" | "cacador" | "equilibrado";
export const PROFILE_NAMES: ProfileName[] = ["agressivo", "cauteloso", "cacador", "equilibrado"];

export interface CardPolicy {
  /** ids do UPGRADE_CARD_POOL (shared/constants.ts) preferidos, em ordem de prioridade —
   * o primeiro presente na oferta do nível vence; nenhum presente cai no primeiro da oferta. */
  preferredCardIds: string[];
}

export interface BotProfile {
  name: ProfileName;
  personality: Personality;
  cardPolicy: CardPolicy;
}

export const BOT_PROFILES: Record<ProfileName, BotProfile> = {
  agressivo: {
    // build "bruto": concentra Força/Cadência — bate forte e rápido, aceita risco
    name: "agressivo",
    personality: {
      aggression: 0.9,
      caution: 0.2,
      greed: 0.5,
      wander: 0.3,
      objective: 0.6,
      engageRange: 25,
      fleeHpFrac: 0.2,
      aimErrorRad: 0.15,
      aimLerp: 0.5,
      reactionMsRange: [200, 320],
      fireIntervalMsRange: [400, 800],
      giveUpMs: 8000,
    },
    cardPolicy: { preferredCardIds: ["forca_bruta", "gatilho_rapido"] },
  },
  cauteloso: {
    // build "tanque": concentra Vitalidade/Agilidade — sobrevive, foge cedo, hostiliza pouco
    name: "cauteloso",
    personality: {
      aggression: 0.4,
      caution: 0.85,
      greed: 0.6,
      wander: 0.5,
      objective: 0.25,
      engageRange: 14,
      fleeHpFrac: 0.55,
      aimErrorRad: 0.25,
      aimLerp: 0.3,
      reactionMsRange: [300, 450],
      fireIntervalMsRange: [700, 1300],
      giveUpMs: 4000,
    },
    cardPolicy: { preferredCardIds: ["casca_grossa", "pes_ligeiros"] },
  },
  cacador: {
    // build "caçador": concentra Alcance/Agilidade — persegue o mapa todo, atira de longe
    name: "cacador",
    personality: {
      aggression: 0.85,
      caution: 0.3,
      greed: 0.35,
      wander: 0.25,
      objective: 0.7,
      engageRange: 9999,
      fleeHpFrac: 0.25,
      aimErrorRad: 0.1,
      aimLerp: 0.5,
      reactionMsRange: [180, 280],
      fireIntervalMsRange: [350, 700],
      giveUpMs: 12000,
    },
    cardPolicy: { preferredCardIds: ["olhar_de_aguia", "pes_ligeiros"] },
  },
  equilibrado: {
    // auto-pick de sempre — sem especialização, mediano em tudo
    name: "equilibrado",
    personality: {
      aggression: 0.65,
      caution: 0.5,
      greed: 0.55,
      wander: 0.4,
      objective: 0.5,
      engageRange: 20,
      fleeHpFrac: 0.35,
      aimErrorRad: 0.18,
      aimLerp: 0.35,
      reactionMsRange: [250, 380],
      fireIntervalMsRange: [550, 1050],
      giveUpMs: 6000,
    },
    cardPolicy: { preferredCardIds: ["equilibrado"] },
  },
};

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** v ± amt% (uniforme) — dosagem, não personalidade nova. */
function jitter(v: number, amt: number): number {
  return v * (1 + (Math.random() * 2 - 1) * amt);
}

/**
 * Dosagem individual: cada bot nasce com uma variação própria em torno do preset — dois
 * "agressivos" na mesma sessão não jogam idêntico (pedido do CD no teste manual da T-021).
 * O preset continua sendo a identidade (nome/cards); a dosagem só tempera os pesos.
 */
export function withIndividualDosage(profile: BotProfile): BotProfile {
  const p = profile.personality;
  const w = (v: number) => clamp01(jitter(v, 0.25));
  const reactF = 1 + (Math.random() * 2 - 1) * 0.2; // mesmo fator nos 2 extremos — nunca inverte o range
  const fireF = 1 + (Math.random() * 2 - 1) * 0.2;
  return {
    ...profile,
    personality: {
      aggression: w(p.aggression),
      caution: w(p.caution),
      greed: w(p.greed),
      wander: w(p.wander),
      objective: w(p.objective),
      engageRange: p.engageRange >= 9999 ? p.engageRange : Math.max(6, jitter(p.engageRange, 0.2)),
      fleeHpFrac: clamp01(jitter(p.fleeHpFrac, 0.3)),
      aimErrorRad: Math.max(0.02, jitter(p.aimErrorRad, 0.3)),
      aimLerp: clamp01(jitter(p.aimLerp, 0.2)),
      reactionMsRange: [p.reactionMsRange[0] * reactF, p.reactionMsRange[1] * reactF],
      fireIntervalMsRange: [p.fireIntervalMsRange[0] * fireF, p.fireIntervalMsRange[1] * fireF],
      giveUpMs: jitter(p.giveUpMs, 0.25),
    },
  };
}

/** BOT_PROFILE fixa o preset de todos; ausente = sorteado por bot. Em ambos os casos a
 * dosagem individual é aplicada — variedade dentro da sessão mesmo com preset fixo. */
export function profileFor(i: number): BotProfile {
  const env = process.env.BOT_PROFILE as ProfileName | undefined;
  const base = env && BOT_PROFILES[env] ? BOT_PROFILES[env] : BOT_PROFILES[PROFILE_NAMES[Math.floor(Math.random() * PROFILE_NAMES.length)]];
  return withIndividualDosage(base);
}

/** Escolhe 1 card da oferta seguindo a política do perfil — determinística (nunca sorteio),
 * pra combate ser explorável (habilidade > sorte). Sem nenhum card preferido na oferta
 * (ex.: marco de skill), cai no primeiro da oferta — o jogo nunca trava esperando o bot. */
export function pickCard(policy: CardPolicy, offeredCards: Array<{ id: string }>): string | undefined {
  for (const id of policy.preferredCardIds) {
    if (offeredCards.some((c) => c.id === id)) return id;
  }
  return offeredCards[0]?.id;
}

/** T-008b: preset do boss — combate quase tão afiado quanto `cacador`, mas a build
 * concentrada de verdade (nível/atributos/skill) é decidida pelo SERVIDOR (`boss: true`
 * no join, ver ArenaRoom.initBoss) — aqui é só o comportamento de decisão do bot. */
export const BOSS_PROFILE: BotProfile = {
  name: "agressivo",
  personality: {
    aggression: 0.98,
    caution: 0.15,
    greed: 0.3,
    wander: 0.15,
    objective: 0.8,
    engageRange: 9999,
    fleeHpFrac: 0.15,
    aimErrorRad: 0.05,
    aimLerp: 0.6,
    reactionMsRange: [150, 220],
    fireIntervalMsRange: [250, 500],
    giveUpMs: 15000,
  },
  cardPolicy: { preferredCardIds: ["forca_bruta", "casca_grossa", "gatilho_rapido"] },
};

/** `BOT_BOSS=1` marca o bot de índice 0 desta sessão como boss (smoke/teste manual). */
export function isBossIndex(i: number): boolean {
  return process.env.BOT_BOSS === "1" && i === 0;
}
