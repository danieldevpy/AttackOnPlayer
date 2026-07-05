import { describe, expect, it } from "vitest";
import { steer } from "./steering";

describe("steer (context steering, T-020)", () => {
  it("sem perigo, segue o vetor desejado (leste)", () => {
    const result = steer({ desired: { x: 1, z: 0 }, danger: () => 0 });
    expect(result.x).toBeGreaterThan(0.9);
    expect(Math.abs(result.z)).toBeLessThan(0.35);
  });

  it("desvia de um perigo bem na direção desejada (resolve o esbarrão na borda)", () => {
    const result = steer({
      desired: { x: 1, z: 0 },
      danger: (dir) => (dir.x > 0.8 ? 1 : 0), // "parede" a leste
    });
    // não pode escolher ir reto pra leste com perigo máximo lá
    expect(result.x).toBeLessThan(0.9);
  });

  it("sem alvo e perigo em todas as direções, não empurra o bot (evita reforçar o perigo)", () => {
    const result = steer({ desired: { x: 0, z: 0 }, danger: () => 1 });
    expect(result.x).toBe(0);
    expect(result.z).toBe(0);
  });

  it("lateralBias adiciona componente perpendicular (strafe orbital em duelo)", () => {
    const straight = steer({ desired: { x: 1, z: 0 }, danger: () => 0 });
    const orbiting = steer({ desired: { x: 1, z: 0 }, lateralBias: 0.9, danger: () => 0 });
    expect(Math.abs(orbiting.z)).toBeGreaterThan(Math.abs(straight.z));
  });

  it("lateralBias negativo orbita para o lado oposto do positivo", () => {
    const left = steer({ desired: { x: 1, z: 0 }, lateralBias: -0.9, danger: () => 0 });
    const right = steer({ desired: { x: 1, z: 0 }, lateralBias: 0.9, danger: () => 0 });
    expect(Math.sign(left.z)).not.toBe(Math.sign(right.z));
  });
});
