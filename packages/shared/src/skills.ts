// Skills de projétil (T-017, SPEC-0004/ADR-013) — modificadores DATA-DRIVEN aplicados
// POR PLAYER sobre o lançador equipado. Regra ADR-011 mantida: skill nova = 1 entrada
// aqui; pattern de disparo novo = 1 função no ProjectileSystem. NUNCA lógica no Room.
//
// Multishot/pierce são skills DISCRETAS (nunca atributo linear): o custo embutido
// (damageFactor/cooldownMult) balanceia o ganho — ver SPEC-0004 §Notas.

export interface SkillDef {
  id: string;
  name: string;
  desc: string;
  mods: {
    projectilesPerShot?: number; // multishot — combina por MAX (não soma entre skills)
    spreadRad?: number; // ângulo entre projéteis vizinhos — combina por MAX
    damageFactor?: number; // × dano por projétil — combina por PRODUTO
    pierce?: number; // atravessa N alvos — combina por SOMA
    rangeMult?: number; // × range — PRODUTO (empilha com atributo alcance)
    projSpeedMult?: number; // × velocidade do projétil — PRODUTO
    cooldownMult?: number; // × cooldown — PRODUTO (empilha com cadência)
    onKill?: "impulso"; // gancho de evento: kill reseta cooldown + boost curto
  };
}

export const SKILLS: Record<string, SkillDef> = {
  tiro_duplo: {
    id: "tiro_duplo",
    name: "Tiro Duplo",
    desc: "2 projéteis (±6°), 65% de dano cada",
    mods: { projectilesPerShot: 2, spreadRad: 0.21, damageFactor: 0.65 },
  },
  leque: {
    id: "leque",
    name: "Leque",
    desc: "3 projéteis em cone (±20°), 50% de dano cada",
    mods: { projectilesPerShot: 3, spreadRad: 0.35, damageFactor: 0.5 },
  },
  perfurante: {
    id: "perfurante",
    name: "Perfurante",
    desc: "Atravessa 1 alvo; cooldown +25%",
    mods: { pierce: 1, cooldownMult: 1.25 },
  },
  folego: {
    id: "folego",
    name: "Fôlego",
    desc: "+35% alcance, +20% velocidade do projétil",
    mods: { rangeMult: 1.35, projSpeedMult: 1.2 },
  },
  impulso: {
    id: "impulso",
    name: "Impulso",
    desc: "Kill reseta o cooldown e dá +30% velocidade por 2s",
    mods: { onKill: "impulso" },
  },
};

/**
 * Níveis que trocam 1 dos 3 cards de atributo por uma skill (oferta vira 2 atributo + 1
 * skill) — mais frequentes que o marco original (4/8/12): 1 por skill existente, para que
 * dê pra conseguir as 5 sem depender de sorte de nível alto (feedback CD).
 */
export const SKILL_MILESTONE_LEVELS = [3, 6, 9, 12, 15];
/** Skill concedida em cada marco; se já possuída, `buildCards` substitui pela próxima que falte. */
export const SKILL_MILESTONE_SKILL: Record<number, string> = {
  3: "tiro_duplo",
  6: "folego",
  9: "leque",
  12: "perfurante",
  15: "impulso",
};

// Impulso (onKill) — constantes do efeito kill_rush
export const KILL_RUSH_MULT = 1.3;
export const KILL_RUSH_MS = 2000;

export interface CombinedSkillMods {
  projectilesPerShot: number;
  spreadRad: number;
  damageFactor: number;
  pierce: number;
  rangeMult: number;
  projSpeedMult: number;
  cooldownMult: number;
  onKillImpulso: boolean;
}

/**
 * Agrega os modificadores das skills do player (regras de combinação no comentário de
 * cada campo). Aceita `undefined` na lista porque o iterator do ArraySchema (Colyseus)
 * tipa itens como possivelmente undefined — ids inválidos são ignorados de qualquer forma.
 */
export function combinedSkillMods(skillIds: readonly (string | undefined)[]): CombinedSkillMods {
  const out: CombinedSkillMods = {
    projectilesPerShot: 1,
    spreadRad: 0,
    damageFactor: 1,
    pierce: 0,
    rangeMult: 1,
    projSpeedMult: 1,
    cooldownMult: 1,
    onKillImpulso: false,
  };
  for (const id of skillIds) {
    const m = id ? SKILLS[id]?.mods : undefined;
    if (!m) continue;
    if (m.projectilesPerShot) out.projectilesPerShot = Math.max(out.projectilesPerShot, m.projectilesPerShot);
    if (m.spreadRad) out.spreadRad = Math.max(out.spreadRad, m.spreadRad);
    if (m.damageFactor) out.damageFactor *= m.damageFactor;
    if (m.pierce) out.pierce += m.pierce;
    if (m.rangeMult) out.rangeMult *= m.rangeMult;
    if (m.projSpeedMult) out.projSpeedMult *= m.projSpeedMult;
    if (m.cooldownMult) out.cooldownMult *= m.cooldownMult;
    if (m.onKill === "impulso") out.onKillImpulso = true;
  }
  return out;
}
