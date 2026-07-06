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

  it("escolhe fugir com vida baixa, ameaça perto e ROTA DE CURA (hp_orb) percebida", () => {
    const cautious: Personality = { ...BASE_PERSONALITY, caution: 0.9 };
    const p = perception({
      self: { x: 0, z: 0, hp: 10, maxHp: 100, level: 3, zone: "field" },
      enemies: [{ id: "e1", x: 2, z: 0, hp: 100, maxHp: 100, level: 5, dist: 2, zone: "field" }],
      collectibles: [{ id: "cura", x: 6, z: 0, dist: 6, kind: "hp_orb" }],
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
    // engage (~0.16) e collect (~0.227) ficam a menos de SWITCH_MARGIN de distância —
    // sem inércia o collect venceria; com "engage" como ação anterior, a margem o mantém.
    // HP 80 (abaixo do gate de coragem T-037, que forçaria engage com vida cheia): mantém
    // o cenário de escores próximos sem que a coragem sobrescreva o teste de inércia.
    const p = perception({
      self: { x: 0, z: 0, hp: 80, maxHp: 100, level: 3, zone: "field" },
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

  // ---- T-037 (SPEC-0011): caça poder + coragem com vida cheia + fuga só com plano ----

  it("T-037 aura: alvo banda HIGH ganha mais peso de engage que alvo comum equidistante", () => {
    // dois alvos à mesma distância, viés neutro — o de banda alta deve ser eleito.
    const p = perception({
      self: { x: 0, z: 0, hp: 80, maxHp: 100, level: 1, zone: "field" },
      enemies: [
        { id: "weak", x: 5, z: 0, hp: 100, maxHp: 100, level: 1, dist: 5, zone: "field" },
        { id: "strong", x: 0, z: 5, hp: 100, maxHp: 100, level: 8, dist: 5, zone: "field" },
      ],
    });
    const result = decide(p, BASE_PERSONALITY, null, { targetBias: () => 1 });
    expect(result.action).toBe("engage");
    expect(result.targetId).toBe("strong");
    // o peso extra por aura tem TETO: mesmo alvo forte não domina se estiver muito mais longe.
    expect(result.scores.engage).toBeGreaterThan(0);
  });

  it("T-037 aura: com N bots e vários alvos, a distribuição se mantém (não 100% no mesmo)", () => {
    // um alvo forte + dois comuns equidistantes; bots com targetBias distinto por par
    // (bot,alvo) não convergem todos no forte — o teto de aura preserva a distribuição.
    const enemies = [
      { id: "strong", x: 6, z: 0, hp: 100, maxHp: 100, level: 8, dist: 6, zone: "field" as const },
      { id: "a", x: 5, z: 0, hp: 100, maxHp: 100, level: 1, dist: 5, zone: "field" as const },
      { id: "b", x: 4, z: 0, hp: 100, maxHp: 100, level: 1, dist: 4, zone: "field" as const },
    ];
    const p = perception({ self: { x: 0, z: 0, hp: 80, maxHp: 100, level: 1, zone: "field" }, enemies });
    // 12 bots com hash de viés distinto por (bot,alvo)
    const chosen = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const bias = (id: string) => 0.8 + 0.4 * (((i * 31 + id.charCodeAt(0)) % 100) / 100);
      const r = decide(p, BASE_PERSONALITY, null, { targetBias: bias });
      if (r.targetId) chosen.add(r.targetId);
    }
    expect(chosen.size).toBeGreaterThan(1); // não é "todos contra um"
  });

  it("T-037 coragem: HP cheio + inimigo percebido ⇒ engage (vence coletar/perambular)", () => {
    // greed alto e coletável colado: sem coragem, escolheria coletar. Vida cheia parte pra cima.
    const greedy: Personality = { ...BASE_PERSONALITY, greed: 0.95, aggression: 0.3, wander: 0.1 };
    const p = perception({
      self: { x: 0, z: 0, hp: 100, maxHp: 100, level: 3, zone: "field" },
      enemies: [{ id: "e1", x: 12, z: 0, hp: 100, maxHp: 100, level: 3, dist: 12, zone: "field" }],
      collectibles: [{ id: "c1", x: 1, z: 0, dist: 1, kind: "xp_orb" }],
    });
    const result = decide(p, greedy, null);
    expect(result.action).toBe("engage");
    expect(result.targetId).toBe("e1");
  });

  it("T-037 coragem: inimigo só em zona safe NÃO dispara coragem (nada pra engajar)", () => {
    const greedy: Personality = { ...BASE_PERSONALITY, greed: 0.95, wander: 0.1 };
    const p = perception({
      self: { x: 0, z: 0, hp: 100, maxHp: 100, level: 3, zone: "field" },
      enemies: [{ id: "e1", x: 12, z: 0, hp: 100, maxHp: 100, level: 3, dist: 12, zone: "safe" }],
      collectibles: [{ id: "c1", x: 1, z: 0, dist: 1, kind: "xp_orb" }],
    });
    const result = decide(p, greedy, null);
    expect(result.action).toBe("collect");
  });

  it("T-037 fuga só com plano: HP baixo SEM cura percebida ⇒ flee NÃO é escolhido", () => {
    const cautious: Personality = { ...BASE_PERSONALITY, caution: 0.95 };
    const p = perception({
      self: { x: 0, z: 0, hp: 10, maxHp: 100, level: 3, zone: "field" },
      enemies: [{ id: "e1", x: 3, z: 0, hp: 100, maxHp: 100, level: 5, dist: 3, zone: "field" }],
      collectibles: [{ id: "xp", x: 2, z: 0, dist: 2, kind: "xp_orb" }], // não é cura
    });
    const result = decide(p, cautious, null);
    expect(result.action).not.toBe("flee");
    expect(result.scores.flee).toBe(0);
  });

  it("T-037 fuga só com plano: HP baixo COM hp_orb percebido ⇒ flee é viável", () => {
    const cautious: Personality = { ...BASE_PERSONALITY, caution: 0.95 };
    const p = perception({
      self: { x: 0, z: 0, hp: 10, maxHp: 100, level: 3, zone: "field" },
      enemies: [{ id: "e1", x: 3, z: 0, hp: 100, maxHp: 100, level: 5, dist: 3, zone: "field" }],
      collectibles: [{ id: "cura", x: 8, z: 0, dist: 8, kind: "hp_orb" }],
    });
    const result = decide(p, cautious, null);
    expect(result.action).toBe("flee");
    expect(result.scores.flee).toBeGreaterThan(0);
  });

  it("T-037 fuga: box também conta como rota de cura", () => {
    const cautious: Personality = { ...BASE_PERSONALITY, caution: 0.95 };
    const p = perception({
      self: { x: 0, z: 0, hp: 10, maxHp: 100, level: 3, zone: "field" },
      enemies: [{ id: "e1", x: 3, z: 0, hp: 100, maxHp: 100, level: 5, dist: 3, zone: "field" }],
      collectibles: [{ id: "caixa", x: 8, z: 0, dist: 8, kind: "box" }],
    });
    const result = decide(p, cautious, null);
    expect(result.scores.flee).toBeGreaterThan(0);
  });

  it("encurralado na borda com ameaça no raio: para de fugir e vira pra lutar", () => {
    // mesmo com rota de cura percebida (fuga viável), encurralado vira e luta.
    const cautious: Personality = { ...BASE_PERSONALITY, caution: 0.9 };
    const p = perception({
      self: { x: 0, z: 0, hp: 10, maxHp: 100, level: 3, zone: "field" },
      nearestBorderDist: 1,
      enemies: [{ id: "e1", x: 2, z: 0, hp: 100, maxHp: 100, level: 5, dist: 2, zone: "field" }],
      collectibles: [{ id: "cura", x: 6, z: 0, dist: 6, kind: "hp_orb" }],
    });
    const result = decide(p, cautious, null);
    expect(result.action).toBe("engage");
    expect(result.targetId).toBe("e1");
  });
});
