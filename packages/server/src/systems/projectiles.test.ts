import { describe, it, expect } from "vitest";
import { ArenaState, Player } from "../state/ArenaState";
import { ProjectileSystem } from "./projectiles";
import { EffectSystem } from "./effects";
import { LAUNCHERS } from "@aop/shared";

/**
 * T-008: prova determinística da cadeia de combate que os bots alimentam —
 * disparo -> projétil -> colisão -> dano -> morte -> evento de kill.
 * Mapa sintético: sem paredes/props e sem zonas (tudo "field", combate liberado).
 */
function fieldMap(w = 40, h = 40): any {
  return { w, h, seed: 1, cells: new Uint8Array(w * h), props: [], zones: [] };
}

describe("ProjectileSystem (T-008)", () => {
  it("fogo sustido reduz a vida, mata o alvo e emite kill com o atirador correto", () => {
    const map = fieldMap();
    const state = new ArenaState();

    const shooter = new Player();
    shooter.x = 10; shooter.z = 10; shooter.hp = 100; shooter.maxHp = 100; shooter.launcher = "basic_shot";
    const target = new Player();
    target.x = 13; target.z = 10; target.hp = 100; target.maxHp = 100; target.launcher = "basic_shot";
    state.players.set("A", shooter);
    state.players.set("B", target);

    const sys = new ProjectileSystem();
    const effects = new EffectSystem();
    let now = 0;
    let totalHits = 0;
    let kill: any = null;

    for (let i = 0; i < 400 && target.hp > 0; i++) {
      shooter.dir = 0; // facing aponta direto para B (13 > 10 no eixo x)
      shooter.firing = true;
      const hits = sys.tick(state, map, 0.05, now, effects);
      for (const h of hits) {
        if (h.targetId === "B" && !h.blockedBySafeZone) {
          totalHits++;
          if (h.killed) kill = h;
        }
      }
      now += 50;
    }

    expect(totalHits).toBeGreaterThan(0);
    expect(target.hp).toBeLessThanOrEqual(0);
    expect(kill).not.toBeNull();
    expect(kill.killerId).toBe("A");
    // T-014: acertos necessários derivados dos dados reais (vida 100, dano do basic_shot)
    // — o teste acompanha passes de balance futuros sem reescrita (TTK alvo: 5 tiros).
    const expectedHits = Math.ceil(100 / LAUNCHERS.basic_shot.damage);
    expect(totalHits).toBeGreaterThanOrEqual(expectedHits);
    expect(expectedHits).toBe(5); // guarda do TTK alvo da SPEC-0004 — mudou? atualizar spec/ADR-013
  });

  it("zona safe bloqueia o dano (projétil consumido, sem morte)", () => {
    const map = fieldMap();
    map.zones = [{ kind: "safe", cx: 13, cz: 10, radius: 3 }]; // alvo dentro de safe
    const state = new ArenaState();

    const shooter = new Player();
    shooter.x = 6; shooter.z = 10; shooter.launcher = "basic_shot"; // atirador no field
    const target = new Player();
    target.x = 13; target.z = 10; target.hp = 100; target.maxHp = 100;
    state.players.set("A", shooter);
    state.players.set("B", target);

    const sys = new ProjectileSystem();
    const effects = new EffectSystem();
    let now = 0;
    let blocked = 0;
    for (let i = 0; i < 200; i++) {
      shooter.dir = 0; shooter.firing = true;
      const hits = sys.tick(state, map, 0.05, now, effects);
      blocked += hits.filter((h) => h.targetId === "B" && h.blockedBySafeZone).length;
      now += 50;
    }
    expect(blocked).toBeGreaterThan(0);
    expect(target.hp).toBe(100);
  });
});

describe("ProjectileSystem — ganchos de mobilidade por lançador (T-012)", () => {
  it("heavy_shot_dev reduz a velocidade do atirador ao disparar e expira sozinho", () => {
    const map = fieldMap();
    const state = new ArenaState();
    const shooter = new Player();
    shooter.x = 10; shooter.z = 10; shooter.launcher = "heavy_shot_dev"; shooter.dir = 0; shooter.firing = true;
    state.players.set("A", shooter);

    const sys = new ProjectileSystem();
    const effects = new EffectSystem();
    const movement = LAUNCHERS.heavy_shot_dev.movement!;
    let now = LAUNCHERS.heavy_shot_dev.fire.cooldownMs; // já fora do cooldown inicial (lastFireAt começa em 0)

    expect(shooter.speed).toBe(1);

    effects.tick(state.players, now);
    sys.tick(state, map, 0.05, now, effects);
    expect(shooter.speed).toBeCloseTo(movement.selfSlowFactor!, 5);

    // avança além da duração do slow — some sozinho, sem intervenção manual
    now += movement.selfSlowMs! + 50;
    effects.tick(state.players, now);
    expect(shooter.speed).toBeCloseTo(1, 5);
  });

  it("basic_shot permanece inalterado (sem gancho de mobilidade — default neutro)", () => {
    const map = fieldMap();
    const state = new ArenaState();
    const shooter = new Player();
    shooter.x = 10; shooter.z = 10; shooter.launcher = "basic_shot"; shooter.dir = 0; shooter.firing = true;
    state.players.set("A", shooter);

    const sys = new ProjectileSystem();
    const effects = new EffectSystem();
    const now = LAUNCHERS.basic_shot.fire.cooldownMs;

    effects.tick(state.players, now);
    sys.tick(state, map, 0.05, now, effects);
    expect(shooter.speed).toBe(1);
  });
});
