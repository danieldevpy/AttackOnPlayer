import { describe, it, expect } from "vitest";
import { xpToNext, XP_BASE, XP_EXP } from "./constants";

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
