import { describe, it, expect } from "vitest";
import {
  xpToNext,
  XP_BASE,
  XP_EXP,
  pickWeighted,
  upgradeCardsForLevel,
  UPGRADE_CARD_POOL,
  UPGRADE_CARD_POINTS,
  UPGRADE_AUTO_PICK,
  killHealFraction,
  KILL_HEAL_MISSING_FRAC_BASE,
  KILL_HEAL_MISSING_FRAC_MAX,
  KILL_HEAL_MISSING_FRAC_PER_EXTRA,
} from "./constants";

describe("xpToNext (curva de XP, T-003)", () => {
  it("bate com a fórmula XP_BASE × nível^XP_EXP", () => {
    expect(xpToNext(1)).toBe(Math.round(XP_BASE * Math.pow(1, XP_EXP)));
    expect(xpToNext(10)).toBe(Math.round(XP_BASE * Math.pow(10, XP_EXP)));
    expect(xpToNext(25)).toBe(Math.round(XP_BASE * Math.pow(25, XP_EXP)));
  });

  it("nunca diminui com o nível (pacing sempre mais caro ou igual)", () => {
    let prev = 0;
    for (let level = 1; level <= 50; level++) {
      const need = xpToNext(level);
      expect(need).toBeGreaterThanOrEqual(prev);
      prev = need;
    }
  });

  it("nunca é zero ou negativo", () => {
    for (let level = 1; level <= 50; level++) expect(xpToNext(level)).toBeGreaterThan(0);
  });
});

describe("upgradeCardsForLevel (cards de level-up, T-016 + variedade sorteada 2026-07-06)", () => {
  it("sempre devolve 3 cards distintos do pool", () => {
    for (let level = 1; level <= 40; level++) {
      const offer = upgradeCardsForLevel(level);
      expect(offer.length).toBe(3);
      expect(new Set(offer.map((c) => c.id)).size).toBe(3);
      for (const card of offer) expect(UPGRADE_CARD_POOL.some((p) => p.id === card.id)).toBe(true);
    }
  });

  it("é sorteada — repetir a chamada produz ofertas variadas (não sempre a mesma tripla)", () => {
    const offers = Array.from({ length: 30 }, () => upgradeCardsForLevel(1).map((c) => c.id).sort().join(","));
    expect(new Set(offers).size).toBeGreaterThan(1);
  });

  it("todo card do pool vale exatamente UPGRADE_CARD_POINTS pontos", () => {
    for (const card of UPGRADE_CARD_POOL) {
      const total = Object.values(card.points).reduce((s, v) => s + (v ?? 0), 0);
      expect(total).toBe(UPGRADE_CARD_POINTS);
    }
  });

  it("auto-pick é o preset equilibrado (timeout nunca pune quem ignora o menu)", () => {
    expect(UPGRADE_AUTO_PICK.points).toEqual({ forca: 2, vitalidade: 2, agilidade: 2 });
  });
});

describe("killHealFraction (recompensa de kill contextual, SPEC-0010/T-033)", () => {
  it("duelo (0 inimigos por perto) não cura — recompensa vira XP", () => {
    expect(killHealFraction(0)).toBe(0);
  });

  it("1 inimigo por perto = fração base", () => {
    expect(killHealFraction(1)).toBeCloseTo(KILL_HEAL_MISSING_FRAC_BASE, 10);
  });

  it("escala com o nº de inimigos, +PER_EXTRA por ameaça adicional", () => {
    expect(killHealFraction(2)).toBeCloseTo(KILL_HEAL_MISSING_FRAC_BASE + KILL_HEAL_MISSING_FRAC_PER_EXTRA, 10);
  });

  it("nunca ultrapassa o teto anti-snowball, por mais inimigos que haja", () => {
    for (let n = 1; n <= 30; n++) expect(killHealFraction(n)).toBeLessThanOrEqual(KILL_HEAL_MISSING_FRAC_MAX);
    expect(killHealFraction(30)).toBe(KILL_HEAL_MISSING_FRAC_MAX);
  });

  it("é monotônica não-decrescente no nº de inimigos", () => {
    let prev = 0;
    for (let n = 1; n <= 20; n++) {
      const f = killHealFraction(n);
      expect(f).toBeGreaterThanOrEqual(prev);
      prev = f;
    }
  });
});

describe("pickWeighted (spawn por zona, T-004)", () => {
  it("respeita os extremos do rolamento (determinístico com rnd fixo)", () => {
    const weights: Array<["a" | "b" | "c", number]> = [["a", 0.5], ["b", 0.3], ["c", 0.2]];
    expect(pickWeighted(() => 0, weights)).toBe("a");
    expect(pickWeighted(() => 0.999999, weights)).toBe("c");
  });

  it("nunca retorna um kind fora da lista de pesos", () => {
    const weights: Array<["x" | "y", number]> = [["x", 0.9], ["y", 0.1]];
    for (let i = 0; i < 200; i++) {
      const kind = pickWeighted(Math.random, weights);
      expect(["x", "y"]).toContain(kind);
    }
  });
});
