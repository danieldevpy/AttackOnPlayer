import { describe, it, expect } from "vitest";
import { ArenaState, Player } from "../state/ArenaState";
import { ProjectileSystem } from "./projectiles";
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
    let now = 0;
    let totalHits = 0;
    let kill: any = null;

    for (let i = 0; i < 400 && target.hp > 0; i++) {
      shooter.fireDirX = 1; // aponta direto para B (13 > 10 no eixo x)
      shooter.fireDirZ = 0;
      const hits = sys.tick(state, map, 0.05, now);
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
    // vida 100 e dano 10 => são necessários ~10 acertos
    expect(totalHits).toBeGreaterThanOrEqual(10);
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
    let now = 0;
    let blocked = 0;
    for (let i = 0; i < 200; i++) {
      shooter.fireDirX = 1; shooter.fireDirZ = 0;
      const hits = sys.tick(state, map, 0.05, now);
      blocked += hits.filter((h) => h.targetId === "B" && h.blockedBySafeZone).length;
      now += 50;
    }
    expect(blocked).toBeGreaterThan(0);
    expect(target.hp).toBe(100);
  });
});
