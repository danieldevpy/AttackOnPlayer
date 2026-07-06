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

describe("ProjectileSystem — invulnerabilidade de nascimento (SPEC-0005)", () => {
  it("alvo protegido não toma dano (projétil consumido, evento blockedByShield)", () => {
    const map = fieldMap();
    const state = new ArenaState();

    const shooter = new Player();
    shooter.x = 6; shooter.z = 10; shooter.launcher = "basic_shot";
    const target = new Player();
    target.x = 13; target.z = 10; target.hp = 100; target.maxHp = 100;
    state.players.set("A", shooter);
    state.players.set("B", target);

    const sys = new ProjectileSystem();
    const effects = new EffectSystem();
    const now = 100000;
    target.spawnProtectedUntil = now + 3000; // escudo ativo

    let shielded = 0;
    let anyDamage = false;
    for (let i = 0; i < 200; i++) {
      shooter.dir = 0; shooter.firing = true;
      const hits = sys.tick(state, map, 0.05, now, effects);
      for (const h of hits) {
        if (h.targetId !== "B") continue;
        if (h.blockedByShield) shielded++;
        if (h.damage > 0) anyDamage = true;
      }
    }
    expect(shielded).toBeGreaterThan(0);
    expect(anyDamage).toBe(false);
    expect(target.hp).toBe(100);
  });

  it("atirar encerra a própria invulnerabilidade do atirador", () => {
    const map = fieldMap();
    const state = new ArenaState();
    const shooter = new Player();
    shooter.x = 10; shooter.z = 10; shooter.launcher = "basic_shot"; shooter.dir = 0; shooter.firing = true;
    state.players.set("A", shooter);

    const sys = new ProjectileSystem();
    const effects = new EffectSystem();
    const now = 100000;
    shooter.spawnProtectedUntil = now + 3000;

    sys.tick(state, map, 0.05, now, effects); // dispara (fora de cooldown: lastFireAt=0)
    expect(shooter.spawnProtectedUntil).toBe(0);
  });
});

describe("ProjectileSystem — escudo temporário reduz dano (SPEC-0010/T-035)", () => {
  it("com damageTakenMult<1 o hit acontece (não bloqueia) mas o dano chega reduzido", () => {
    const map = fieldMap();
    const state = new ArenaState();
    const shooter = new Player();
    shooter.x = 6; shooter.z = 10; shooter.launcher = "basic_shot";
    const target = new Player();
    target.x = 13; target.z = 10; target.hp = 100; target.maxHp = 100;
    target.damageTakenMult = 0.5; // escudo ativo (SHIELD_TEMP_DAMAGE_MULT)
    state.players.set("A", shooter);
    state.players.set("B", target);

    const sys = new ProjectileSystem();
    const effects = new EffectSystem();
    let now = 0;
    let firstHit: any = null;
    for (let i = 0; i < 200 && !firstHit; i++) {
      shooter.dir = 0; shooter.firing = true;
      const hits = sys.tick(state, map, 0.05, now, effects);
      firstHit = hits.find((h) => h.targetId === "B") ?? null;
      now += 50;
    }
    expect(firstHit).not.toBeNull();
    expect(firstHit.blockedByShield).toBe(false); // reduz, não bloqueia — distinto do nascimento
    expect(firstHit.damage).toBeCloseTo(LAUNCHERS.basic_shot.damage * 0.5, 5);
  });

  it("dano cheio quando não há escudo (damageTakenMult=1, default)", () => {
    const map = fieldMap();
    const state = new ArenaState();
    const shooter = new Player();
    shooter.x = 6; shooter.z = 10; shooter.launcher = "basic_shot";
    const target = new Player();
    target.x = 13; target.z = 10; target.hp = 100; target.maxHp = 100;
    state.players.set("A", shooter);
    state.players.set("B", target);

    const sys = new ProjectileSystem();
    const effects = new EffectSystem();
    let now = 0;
    let firstHit: any = null;
    for (let i = 0; i < 200 && !firstHit; i++) {
      shooter.dir = 0; shooter.firing = true;
      const hits = sys.tick(state, map, 0.05, now, effects);
      firstHit = hits.find((h) => h.targetId === "B") ?? null;
      now += 50;
    }
    expect(firstHit).not.toBeNull();
    expect(firstHit.damage).toBeCloseTo(LAUNCHERS.basic_shot.damage, 5);
  });
});

/**
 * T-038 (SPEC-0011): projétil fino contra o cenário. Dois props colidíveis adjacentes na
 * diagonal (um tile livre entre eles) formam um vão diagonal. Com o raio de HIT cheio (0.4)
 * o projétil batia no canto do prop e morria; com o raio de CENÁRIO fino (basic_shot
 * sceneryRadius = 0.22) ele atravessa o vão. Um tiro reto contra um prop continua colidindo.
 */
describe("ProjectileSystem — colisão diagonal com o cenário (T-038)", () => {
  // props em `map.props` (não no grid de cells) — a colisão contra props usa AABB×círculo.
  function propsMap(props: any[]): any {
    return { w: 40, h: 40, seed: 1, cells: new Uint8Array(40 * 40), props, zones: [] };
  }

  it("atravessa o vão diagonal entre dois props colidíveis na diagonal", () => {
    // A(5,5) e B(7,7): adjacentes na diagonal com o tile (6,6) livre entre eles.
    const map = propsMap([
      { x: 5, z: 5, w: 1, h: 1, type: "caixa" },
      { x: 7, z: 7, w: 1, h: 1, type: "caixa" },
    ]);
    const state = new ArenaState();
    const shooter = new Player();
    shooter.x = 3;
    shooter.z = 4.5;
    shooter.launcher = "basic_shot";
    shooter.dir = Math.PI / 4; // 45° para nordeste, mirando o vão
    shooter.firing = true;
    state.players.set("A", shooter);

    const sys = new ProjectileSystem();
    const effects = new EffectSystem();
    let now = LAUNCHERS.basic_shot.fire.cooldownMs; // fora do cooldown inicial (lastFireAt=0)
    sys.tick(state, map, 0.05, now, effects); // dispara
    shooter.firing = false;
    const proj = Array.from(state.projectiles.values())[0]!;
    expect(proj).toBeDefined();

    // simula o voo: se atravessar, o projétil chega ao outro lado dos props (x,z > 7) antes de sumir.
    let passedThrough = false;
    for (let i = 0; i < 60 && state.projectiles.size > 0; i++) {
      now += 50;
      sys.tick(state, map, 0.05, now, effects);
      if (proj.x > 7.2 && proj.z > 7.2) passedThrough = true;
    }
    expect(passedThrough).toBe(true); // atravessou o vão — o raio fino (0.22) não bateu no canto
  });

  it("mesmo vão, mas o raio de HIT cheio (0.4) teria colidido — prova de que o raio fino é o que passa", () => {
    // Repete a geometria acima mas colide contra o raio de HIT (radius, 0.4) para confirmar
    // que sem o raio fino o projétil morreria no canto (justifica separar cenário × hit).
    const map = propsMap([
      { x: 5, z: 5, w: 1, h: 1, type: "caixa" },
      { x: 7, z: 7, w: 1, h: 1, type: "caixa" },
    ]);
    const dx = Math.cos(Math.PI / 4);
    const dz = Math.sin(Math.PI / 4);
    const PLAYER_RADIUS = 0.35;
    let x = 3 + dx * PLAYER_RADIUS;
    let z = 4.5 + dz * PLAYER_RADIUS;
    const fatRadius = LAUNCHERS.basic_shot.projectile.radius; // 0.4
    let fatHit = false;
    for (let i = 0; i < 60; i++) {
      x += dx * 12 * 0.05;
      z += dz * 12 * 0.05;
      for (const p of map.props as any[]) {
        const px = Math.max(p.x, Math.min(x, p.x + p.w));
        const pz = Math.max(p.z, Math.min(z, p.z + p.h));
        if (Math.hypot(x - px, z - pz) < fatRadius) fatHit = true;
      }
    }
    expect(fatHit).toBe(true); // com 0.4 bateria no canto — daí a necessidade do sceneryRadius (0.22)
  });

  it("tiro reto contra um prop continua colidindo (raio fino não fura parede)", () => {
    const map = propsMap([{ x: 9, z: 10, w: 1, h: 1, type: "caixa" }]);
    const state = new ArenaState();
    const shooter = new Player();
    shooter.x = 5;
    shooter.z = 10.5;
    shooter.launcher = "basic_shot";
    shooter.dir = 0; // reto para +x, direto no prop
    shooter.firing = true;
    state.players.set("A", shooter);

    const sys = new ProjectileSystem();
    const effects = new EffectSystem();
    let now = LAUNCHERS.basic_shot.fire.cooldownMs; // fora do cooldown inicial (lastFireAt=0)
    sys.tick(state, map, 0.05, now, effects);
    shooter.firing = false;
    const proj = Array.from(state.projectiles.values())[0]!;
    let maxX = proj.x;
    for (let i = 0; i < 60 && state.projectiles.size > 0; i++) {
      now += 50;
      sys.tick(state, map, 0.05, now, effects);
      maxX = Math.max(maxX, proj.x);
    }
    // o projétil foi removido ANTES de passar do prop (x < 9): colidiu, não atravessou.
    expect(state.projectiles.size).toBe(0);
    expect(maxX).toBeLessThan(9.2);
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
