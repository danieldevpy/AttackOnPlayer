import { describe, it, expect } from "vitest";
import { ArenaState, Player } from "../state/ArenaState";
import { ProjectileSystem } from "./projectiles";
import { EffectSystem } from "./effects";
import { LAUNCHERS, KILL_RUSH_MULT, KILL_RUSH_MS } from "@aop/shared";

/** T-017: skills de projétil — multishot, pierce, fôlego e impulso no pipeline autoritativo. */
function fieldMap(w = 60, h = 40): any {
  return { w, h, seed: 1, cells: new Uint8Array(w * h), props: [], zones: [] };
}

function shooterAt(x: number, z: number): Player {
  const p = new Player();
  p.x = x;
  p.z = z;
  p.dir = 0;
  p.firing = true;
  return p;
}

describe("ProjectileSystem — skills (T-017)", () => {
  it("tiro_duplo: um gatilho spawna 2 projéteis com 65% do dano cada", () => {
    const map = fieldMap();
    const state = new ArenaState();
    const shooter = shooterAt(10, 20);
    shooter.skills.push("tiro_duplo");
    const target = new Player();
    target.x = 14; target.z = 20; target.hp = 100; target.maxHp = 100;
    state.players.set("A", shooter);
    state.players.set("B", target);

    const sys = new ProjectileSystem();
    const effects = new EffectSystem();
    const now = LAUNCHERS.basic_shot.fire.cooldownMs;

    sys.tick(state, map, 0.001, now, effects);
    expect(state.projectiles.size).toBe(2);

    // deixa voar até acertar — dano por projétil = 20 × 0.65 = 13
    shooter.firing = false;
    let t = now;
    let damages: number[] = [];
    for (let i = 0; i < 40 && state.projectiles.size > 0; i++) {
      t += 50;
      const hits = sys.tick(state, map, 0.05, t, effects);
      damages.push(...hits.filter((h) => !h.blockedBySafeZone).map((h) => h.damage));
    }
    expect(damages.length).toBeGreaterThanOrEqual(1); // com spread, ao menos 1 dos 2 conecta a 4u
    damages.forEach((d) => expect(d).toBeCloseTo(13, 5));
  });

  it("perfurante: atravessa exatamente 1 alvo (2 hits, 1 projétil) e não re-acerta o mesmo alvo", () => {
    const map = fieldMap();
    const state = new ArenaState();
    const shooter = shooterAt(10, 20);
    shooter.skills.push("perfurante");
    const first = new Player();
    first.x = 13; first.z = 20; first.hp = 100; first.maxHp = 100;
    const second = new Player();
    second.x = 16; second.z = 20; second.hp = 100; second.maxHp = 100;
    state.players.set("A", shooter);
    state.players.set("B", first);
    state.players.set("C", second);

    const sys = new ProjectileSystem();
    const effects = new EffectSystem();
    // cooldown do perfurante é 25% maior — dispara já fora do cooldown efetivo
    let now = Math.ceil(LAUNCHERS.basic_shot.fire.cooldownMs * 1.25);
    sys.tick(state, map, 0.001, now, effects);
    expect(state.projectiles.size).toBe(1);
    shooter.firing = false;

    const hitsByTarget = new Map<string, number>();
    for (let i = 0; i < 40 && state.projectiles.size > 0; i++) {
      now += 50;
      const hits = sys.tick(state, map, 0.05, now, effects);
      hits.forEach((h) => hitsByTarget.set(h.targetId, (hitsByTarget.get(h.targetId) ?? 0) + 1));
    }
    expect(hitsByTarget.get("B")).toBe(1); // primeiro alvo atingido 1x
    expect(hitsByTarget.get("C")).toBe(1); // atravessou e acertou o segundo
    expect(first.hp).toBe(100 - 20);
    expect(second.hp).toBe(100 - 20);
  });

  it("cooldown do perfurante é 25% maior (empilha com cadência)", () => {
    const map = fieldMap();
    const state = new ArenaState();
    const shooter = shooterAt(10, 20);
    shooter.skills.push("perfurante");
    state.players.set("A", shooter);
    const sys = new ProjectileSystem();
    const effects = new EffectSystem();

    shooter.lastFireAt = 0;
    sys.tick(state, map, 0.001, 749, effects); // 600 × 1.25 = 750
    expect(state.projectiles.size).toBe(0);
    sys.tick(state, map, 0.001, 750, effects);
    expect(state.projectiles.size).toBe(1);
  });

  it("fôlego: projétil vive até 35% mais longe e voa 20% mais rápido", () => {
    const map = fieldMap();
    const state = new ArenaState();
    const shooter = shooterAt(2, 20);
    shooter.skills.push("folego");
    state.players.set("A", shooter);
    const sys = new ProjectileSystem();
    const effects = new EffectSystem();

    let now = LAUNCHERS.basic_shot.fire.cooldownMs;
    sys.tick(state, map, 0.001, now, effects);
    let proj: any;
    state.projectiles.forEach((pr) => (proj = pr)); // MapSchema: forEach é a API garantida
    expect(proj.maxRange).toBeCloseTo(8 * 1.35, 5); // 10.8u
    expect(proj.speedMult).toBeCloseTo(1.2, 5);
  });

  it("impulso (kill_rush): boost aplica e expira sozinho pelo EffectSystem", () => {
    const effects = new EffectSystem();
    const p = new Player();
    const players = new Map<string, Player>([["A", p]]);
    effects.apply("A", p, "kill_rush", 1000);
    expect(p.speed).toBeCloseTo(KILL_RUSH_MULT, 5);
    effects.tick(players, 1000 + KILL_RUSH_MS + 50);
    expect(p.speed).toBe(1);
  });
});
