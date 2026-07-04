import { describe, it, expect } from "vitest";
import { combinedSkillMods, SKILLS, SKILL_MILESTONE_CHOICES, SKILL_MILESTONE_LEVELS } from "./skills";

describe("combinedSkillMods (T-017)", () => {
  it("sem skills = totalmente neutro (basic_shot não muda em nada)", () => {
    const m = combinedSkillMods([]);
    expect(m.projectilesPerShot).toBe(1);
    expect(m.spreadRad).toBe(0);
    expect(m.damageFactor).toBe(1);
    expect(m.pierce).toBe(0);
    expect(m.rangeMult).toBe(1);
    expect(m.projSpeedMult).toBe(1);
    expect(m.cooldownMult).toBe(1);
    expect(m.onKillImpulso).toBe(false);
  });

  it("aplica os números da spec por skill", () => {
    expect(combinedSkillMods(["tiro_duplo"])).toMatchObject({ projectilesPerShot: 2, damageFactor: 0.65 });
    expect(combinedSkillMods(["leque"])).toMatchObject({ projectilesPerShot: 3, damageFactor: 0.5 });
    expect(combinedSkillMods(["perfurante"])).toMatchObject({ pierce: 1, cooldownMult: 1.25 });
    expect(combinedSkillMods(["folego"])).toMatchObject({ rangeMult: 1.35, projSpeedMult: 1.2 });
    expect(combinedSkillMods(["impulso"]).onKillImpulso).toBe(true);
  });

  it("combina por MAX (multishot), PRODUTO (fatores) e SOMA (pierce) — sem explosão multiplicativa", () => {
    const m = combinedSkillMods(["tiro_duplo", "leque", "perfurante", "folego"]);
    expect(m.projectilesPerShot).toBe(3); // max(2,3) — nunca 2×3=6
    expect(m.damageFactor).toBeCloseTo(0.325, 5); // 0.65 × 0.5
    expect(m.pierce).toBe(1);
    expect(m.cooldownMult).toBeCloseTo(1.25, 5);
    expect(m.rangeMult).toBeCloseTo(1.35, 5);
  });

  it("ids desconhecidos são ignorados (estado velho não derruba o servidor)", () => {
    expect(combinedSkillMods(["nao_existe"])).toMatchObject({ projectilesPerShot: 1, damageFactor: 1 });
  });

  it("todo marco aponta para skills que existem no registro", () => {
    for (const level of SKILL_MILESTONE_LEVELS) {
      const pair = SKILL_MILESTONE_CHOICES[level];
      expect(pair).toBeDefined();
      pair.forEach((s) => expect(SKILLS[s]).toBeDefined());
    }
  });
});
