import { describe, expect, it } from "vitest";
import { decide } from "./decision";
import type { Perception, Personality } from "./types";

const BASE_PERSONALITY: Personality = {
  aggression: 0.8,
  caution: 0.5,
  greed: 0.5,
  wander: 0.4,
  objective: 0.5,
  engageRange: 20,
  fleeHpFrac: 0.35,
  aimErrorRad: 0.1,
  aimLerp: 0.4,
  reactionMsRange: [200, 300],
  fireIntervalMsRange: [500, 900],
  giveUpMs: 5000,
};

function perception(overrides: Partial<Perception> = {}): Perception {
  return {
    self: { x: 0, z: 0, hp: 100, maxHp: 100, level: 3, zone: "field" },
    enemies: [],
    collectibles: [],
    nearestBorderDist: 20,
    ...overrides,
  };
}

describe("decide (utility AI, T-020)", () => {
  it("escolhe engajar com vida cheia, inimigo perto e mais fraco", () => {
    const p = perception({
      enemies: [{ id: "e1", x: 3, z: 0, hp: 50, maxHp: 100, level: 1, dist: 3, zone: "field" }],
    });
    const result = decide(p, BASE_PERSONALITY, null);
    expect(result.action).toBe("engage");
    expect(result.targetId).toBe("e1");
    expect(result.scores.engage).toBeGreaterThan(0);
  });

  it("escolhe fugir com vida baixa e ameaça perto, mesmo com aggression alta", () => {
    const cautious: Personality = { ...BASE_PERSONALITY, caution: 0.9 };
    const p = perception({
      self: { x: 0, z: 0, hp: 10, maxHp: 100, level: 3, zone: "field" },
      enemies: [{ id: "e1", x: 2, z: 0, hp: 100, maxHp: 100, level: 5, dist: 2, zone: "field" }],
    });
    const result = decide(p, cautious, null);
    expect(result.action).toBe("flee");
  });

  it("inimigo em zona safe não é alvo de engajar (só conta pra fuga/ameaça)", () => {
    const p = perception({
      enemies: [{ id: "e1", x: 1, z: 0, hp: 100, maxHp: 100, level: 1, dist: 1, zone: "safe" }],
    });
    const result = decide(p, BASE_PERSONALITY, null);
    expect(result.action).not.toBe("engage");
  });

  it("sem inimigos, com coletável perto e greed alto, escolhe coletar", () => {
    const greedy: Personality = { ...BASE_PERSONALITY, greed: 0.9, wander: 0.1 };
    const p = perception({ collectibles: [{ id: "c1", x: 1, z: 0, dist: 1 }] });
    const result = decide(p, greedy, null);
    expect(result.action).toBe("collect");
    expect(result.targetId).toBe("c1");
  });

  it("sem nada por perto, cai no fallback de perambular", () => {
    const result = decide(perception(), BASE_PERSONALITY, null);
    expect(result.action).toBe("wander");
  });

  it("inércia: escores próximos não fazem o bot oscilar de ação a cada tick", () => {
    // engage (~0.2) e collect (~0.227) ficam a menos de SWITCH_MARGIN de distância —
    // sem inércia o collect venceria; com "engage" como ação anterior, a margem o mantém.
    const p = perception({
      collectibles: [{ id: "c1", x: 8, z: 0, dist: 8 }],
      enemies: [{ id: "e1", x: 10, z: 0, hp: 100, maxHp: 100, level: 3, dist: 10, zone: "field" }],
    });
    const baseline = decide(p, BASE_PERSONALITY, null);
    const withInertia = decide(p, BASE_PERSONALITY, "engage");
    expect(baseline.action).toBe("collect"); // sem histórico, o escore bruto decide
    expect(withInertia.action).toBe("engage"); // com inércia, a ação anterior resiste a uma vantagem pequena
  });

  it("T-021: sem nada mais por perto e objective alto, disputa a bandeira", () => {
    const objective: Personality = { ...BASE_PERSONALITY, objective: 0.9, wander: 0.1 };
    const p = perception({ flag: { x: 2, z: 0, dist: 2, zone: "field", carriedBySelf: false } });
    const result = decide(p, objective, null);
    expect(result.action).toBe("flag");
    expect(result.targetId).toBe("flag");
    expect(result.scores.flag).toBeGreaterThan(0);
  });

  it("T-021: já carregando a própria bandeira não gera escore de disputa", () => {
    const objective: Personality = { ...BASE_PERSONALITY, objective: 0.9, wander: 0.1 };
    const p = perception({ flag: { x: 0, z: 0, dist: 0, zone: "field", carriedBySelf: true } });
    const result = decide(p, objective, null);
    expect(result.scores.flag).toBe(0);
  });

  it("T-021: sem bandeira na percepção (toggle off), escore de disputa é zero", () => {
    const result = decide(perception(), BASE_PERSONALITY, null);
    expect(result.scores.flag).toBe(0);
  });

  it("bandeira carregada por inimigo: portador vira alvo de ENGAGE (atira, não só persegue)", () => {
    const p = perception({
      enemies: [{ id: "carrier", x: 12, z: 0, hp: 100, maxHp: 100, level: 3, dist: 12, zone: "field" }],
      flag: { x: 12, z: 0, dist: 12, zone: "field", carriedBySelf: false, carrierId: "carrier" },
    });
    const result = decide(p, BASE_PERSONALITY, null);
    expect(result.action).toBe("engage");
    expect(result.targetId).toBe("carrier");
    expect(result.scores.flag).toBe(0); // disputa carregada não é mais a ação `flag`
  });

  it("portador não monopoliza: outro inimigo bem mais perto ainda vence sem objective alto", () => {
    const calm: Personality = { ...BASE_PERSONALITY, objective: 0.2 };
    const p = perception({
      enemies: [
        { id: "duel", x: 2, z: 0, hp: 100, maxHp: 100, level: 3, dist: 2, zone: "field" },
        { id: "carrier", x: 15, z: 0, hp: 100, maxHp: 100, level: 3, dist: 15, zone: "field" },
      ],
      flag: { x: 15, z: 0, dist: 15, zone: "field", carriedBySelf: false, carrierId: "carrier" },
    });
    const result = decide(p, calm, null);
    expect(result.action).toBe("engage");
    expect(result.targetId).toBe("duel");
  });

  it("targetBias espalha alvos: viés alto num inimigo levemente mais longe o elege", () => {
    const p = perception({
      enemies: [
        { id: "e1", x: 3, z: 0, hp: 100, maxHp: 100, level: 3, dist: 3, zone: "field" },
        { id: "e2", x: 4, z: 0, hp: 100, maxHp: 100, level: 3, dist: 4, zone: "field" },
      ],
    });
    const result = decide(p, BASE_PERSONALITY, null, { targetBias: (id) => (id === "e2" ? 1.2 : 0.8) });
    expect(result.action).toBe("engage");
    expect(result.targetId).toBe("e2");
  });

  it("encurralado na borda com ameaça no raio: para de fugir e vira pra lutar", () => {
    const cautious: Personality = { ...BASE_PERSONALITY, caution: 0.9 };
    const p = perception({
      self: { x: 0, z: 0, hp: 10, maxHp: 100, level: 3, zone: "field" },
      nearestBorderDist: 1,
      enemies: [{ id: "e1", x: 2, z: 0, hp: 100, maxHp: 100, level: 5, dist: 2, zone: "field" }],
    });
    const result = decide(p, cautious, null);
    expect(result.action).toBe("engage");
    expect(result.targetId).toBe("e1");
  });
});
