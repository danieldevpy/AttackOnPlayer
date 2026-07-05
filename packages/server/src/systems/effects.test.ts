import { describe, it, expect } from "vitest";
import { ArenaState, Player } from "../state/ArenaState";
import { ProjectileSystem } from "./projectiles";
import { EffectSystem } from "./effects";
import { LAUNCHERS, ATTR_DEFS, attrMult } from "@aop/shared";

/**
 * T-015 (SPEC-0004/ADR-013): atributos data-driven com escala assimétrica.
 * Estes testes são as GUARDAS dos números da spec — mudou balance, muda spec+ADR junto.
 */
function fieldMap(w = 40, h = 40): any {
  return { w, h, seed: 1, cells: new Uint8Array(w * h), props: [], zones: [] };
}

describe("ATTR_DEFS / attrMult (T-015)", () => {
  it("aplica valor por ponto de cada atributo (escala assimétrica da spec)", () => {
    expect(attrMult("forca", 10)).toBeCloseTo(1.6, 5); // +6%/pt
    expect(attrMult("vitalidade", 10)).toBeCloseTo(1.4, 5); // +4%/pt
    expect(attrMult("agilidade", 10)).toBeCloseTo(1.3, 5); // +3%/pt
    expect(attrMult("cadencia", 5)).toBeCloseTo(0.8, 5); // −4%/pt (multiplica cooldown)
    expect(attrMult("alcance", 10)).toBeCloseTo(1.5, 5); // +5%/pt
  });

  it("respeita teto e piso de cada atributo (guardrail anti-snowball)", () => {
    expect(attrMult("forca", 1000)).toBe(ATTR_DEFS.forca.max); // 3.0
    expect(attrMult("vitalidade", 1000)).toBe(ATTR_DEFS.vitalidade.max); // 2.5
    expect(attrMult("agilidade", 1000)).toBe(ATTR_DEFS.agilidade.max); // 2.0
    expect(attrMult("cadencia", 1000)).toBe(ATTR_DEFS.cadencia.min); // 0.55 — nunca metralhadora
    expect(attrMult("alcance", 1000)).toBe(ATTR_DEFS.alcance.max); // 1.75
    expect(attrMult("forca", 0)).toBe(1); // sem pontos = neutro
  });

  it("guarda da spec: full-Força nível 8 (42 pts) mata equilibrado nível 8 em 3 tiros", () => {
    // atacante: 7 level-ups × 6 pts concentrados em força (cards, T-016/addendum)
    const dmg = LAUNCHERS.basic_shot.damage * attrMult("forca", 42);
    // defensor: preset equilibrado nível 8 (14 pts em vitalidade — ATTR_POINTS_PER_LEVEL_EACH=2)
    const hp = Math.round(100 * attrMult("vitalidade", 14));
    expect(Math.ceil(hp / dmg)).toBe(3);
    // e o equilibrado vs equilibrado continua 5 tiros (TTK alvo)
    const dmgEq = LAUNCHERS.basic_shot.damage * attrMult("forca", 14);
    expect(Math.ceil(hp / dmgEq)).toBe(5);
  });
});

describe("EffectSystem — recompute com 5 atributos (T-015)", () => {
  it("addAttrPoints reflete nos multiplicadores sincronizados (inclui cadência/alcance)", () => {
    const effects = new EffectSystem();
    const p = new Player();
    effects.addAttrPoints("A", p, { forca: 10, vitalidade: 5, agilidade: 4, cadencia: 5, alcance: 10 });
    expect(p.strength).toBeCloseTo(1.6, 5);
    expect(p.vitality).toBeCloseTo(1.2, 5);
    expect(p.maxHp).toBe(120);
    expect(p.speed).toBeCloseTo(1.12, 5);
    expect(p.attackSpeed).toBeCloseTo(0.8, 5);
    expect(p.reach).toBeCloseTo(1.5, 5);
  });

  it("rerollAttrPoints preserva a soma total redistribuindo entre os 5 atributos", () => {
    const effects = new EffectSystem();
    const p = new Player();
    effects.addAttrPoints("A", p, { forca: 7, vitalidade: 7, agilidade: 7 });
    for (let i = 0; i < 20; i++) {
      effects.rerollAttrPoints("A", p);
      const attr = effects.attrPointsFor("A");
      const total = attr.forca + attr.vitalidade + attr.agilidade + attr.cadencia + attr.alcance;
      expect(total).toBe(21);
      (Object.values(attr) as number[]).forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
    }
  });

  it("escudo temporário (damage_reduction) ativa/expira o damageTakenMult (SPEC-0010/T-035)", () => {
    const effects = new EffectSystem();
    const state = new ArenaState();
    const p = new Player();
    state.players.set("A", p);
    expect(p.damageTakenMult).toBe(1); // default = sem redução

    effects.apply("A", p, "damage_reduction", 0);
    expect(p.damageTakenMult).toBe(0.5); // SHIELD_TEMP_DAMAGE_MULT

    // passa da duração (SHIELD_TEMP_MS=3000) → expira sozinho no tick e volta a 1
    effects.tick(state.players, 3001);
    expect(p.damageTakenMult).toBe(1);
  });

  it("resetAttrToLevel volta ao preset equilibrado — cadência/alcance zeram (morte apaga build)", () => {
    const effects = new EffectSystem();
    const p = new Player();
    effects.addAttrPoints("A", p, { cadencia: 10, alcance: 10, forca: 2 });
    effects.resetAttrToLevel("A", p, 5); // nível 5 → 8 pts em cada atributo-base (ATTR_POINTS_PER_LEVEL_EACH=2)
    expect(p.attackSpeed).toBe(1);
    expect(p.reach).toBe(1);
    expect(p.strength).toBeCloseTo(1.48, 5);
    expect(p.vitality).toBeCloseTo(1.32, 5);
    expect(p.speed).toBeCloseTo(1.24, 5);
  });
});

describe("ProjectileSystem — cadência e alcance efetivos (T-015)", () => {
  it("cadência reduz o intervalo real entre tiros no servidor", () => {
    const map = fieldMap();
    const state = new ArenaState();
    const shooter = new Player();
    shooter.x = 10; shooter.z = 10; shooter.dir = 0; shooter.firing = true;
    state.players.set("A", shooter);
    const sys = new ProjectileSystem();
    const effects = new EffectSystem();
    effects.addAttrPoints("A", shooter, { cadencia: 5 }); // attackSpeed 0.8 → cooldown 600→480ms

    // lastFireAt = 0; aos 479ms ainda em cooldown, aos 480ms dispara
    shooter.lastFireAt = 0;
    sys.tick(state, map, 0.001, 479, effects);
    expect(state.projectiles.size).toBe(0);
    sys.tick(state, map, 0.001, 480, effects);
    expect(state.projectiles.size).toBe(1);
  });

  it("alcance estende o range do projétil (congelado no disparo)", () => {
    const map = fieldMap();
    const state = new ArenaState();
    const sniper = new Player();
    sniper.x = 2; sniper.z = 20; sniper.dir = 0; sniper.firing = true;
    state.players.set("A", sniper);
    const sys = new ProjectileSystem();
    const effects = new EffectSystem();
    effects.addAttrPoints("A", sniper, { alcance: 10 }); // reach 1.5 → range 8→12

    let now = LAUNCHERS.basic_shot.fire.cooldownMs;
    sys.tick(state, map, 0.001, now, effects); // dispara
    expect(state.projectiles.size).toBe(1);
    sniper.firing = false;

    // 12 u/s × 0.05s = 0.6u por tick → some entre 12u e 12.6u percorridos (ticks 20–21)
    let ticksAlive = 0;
    while (state.projectiles.size > 0 && ticksAlive < 40) {
      now += 50;
      sys.tick(state, map, 0.05, now, effects);
      ticksAlive++;
    }
    expect(ticksAlive).toBeGreaterThanOrEqual(18); // sem alcance (range 8) morreria em ~14 ticks
    expect(ticksAlive).toBeLessThanOrEqual(22);
  });
});
