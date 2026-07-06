import { describe, expect, it } from "vitest";
import { buildPerception } from "./perception";
import type { RawEntity, RawSelf } from "./perception";
import { AURA_PERCEPTION_MULT_HIGH, AURA_PERCEPTION_MULT_MID } from "./personality";

const MAP = { w: 200, h: 200 };
const SELF: RawSelf = { x: 100, z: 100, hp: 100, maxHp: 100, level: 3 };
const noNoise = () => 0.5; // rng() = 0.5 → fator de ruído neutro (1.0)
const allField = () => "field" as const;

function enemyAt(id: string, dist: number, level: number): RawEntity {
  return { id, x: 100 + dist, z: 100, hp: 100, maxHp: 100, level };
}

describe("buildPerception — aura estende a percepção (T-037)", () => {
  it("inimigo comum (banda none) some além do raio de percepção", () => {
    const radius = 20;
    const p = buildPerception(MAP, SELF, [enemyAt("weak", 25, 1)], [], radius, allField, noNoise);
    expect(p.enemies).toHaveLength(0);
  });

  it("inimigo banda MID é percebido além do raio base (× mult mid)", () => {
    const radius = 20;
    // 25 > 20 (raio base) mas < 20 × 1.6 = 32 (raio de aura mid)
    const withinAura = 20 * AURA_PERCEPTION_MULT_MID - 1;
    const p = buildPerception(MAP, SELF, [enemyAt("mid", withinAura, 4)], [], radius, allField, noNoise);
    expect(p.enemies.map((e) => e.id)).toContain("mid");
  });

  it("inimigo banda HIGH é percebido ainda mais longe que o MID", () => {
    const radius = 20;
    const beyondMid = 20 * AURA_PERCEPTION_MULT_MID + 2; // fora do alcance mid, dentro do high
    expect(beyondMid).toBeLessThan(20 * AURA_PERCEPTION_MULT_HIGH);
    const p = buildPerception(MAP, SELF, [enemyAt("high", beyondMid, 8)], [], radius, allField, noNoise);
    expect(p.enemies.map((e) => e.id)).toContain("high");
  });

  it("carrega o kind do coletável na percepção (rota de cura)", () => {
    const p = buildPerception(
      MAP,
      SELF,
      [],
      [{ id: "cura", x: 105, z: 100, kind: "hp_orb" }],
      20,
      allField,
      noNoise
    );
    expect(p.collectibles[0]?.kind).toBe("hp_orb");
  });
});
