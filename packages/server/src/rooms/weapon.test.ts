import { describe, it, expect } from "vitest";
import { ArenaRoom } from "./ArenaRoom";
import { Player } from "../state/ArenaState";
import {
  WEAPON_PICKUP_LAUNCHERS,
  WEAPON_RESPAWN_MIN_MS,
  WEAPON_RESPAWN_MAX_MS,
  weaponRespawnDelay,
  isWall,
} from "@aop/shared";

/**
 * T-039 (SPEC-0011): arma coletável única, autoritativa. A ArenaRoom roda em harness (sem
 * transporte Colyseus): `clients = []` cobre o `broadcast`/`clients.find` usados por emitDebug.
 * `update(dt)` é o loop real — os testes o dirigem e observam o state resultante.
 */
function makeRoom(): any {
  const room: any = new ArenaRoom();
  room.clients = [];
  room.onCreate({ flagEnabled: false });
  return room;
}

function weaponOf(room: any) {
  let w: any = null;
  room.state.collectibles.forEach((c: any) => {
    if (c.kind === "weapon") w = c;
  });
  return w;
}

describe("Arma coletável — spawn (T-039)", () => {
  it("nasce exatamente 1 arma, em célula walkable e alcançável, com weaponId vantajoso", () => {
    const room = makeRoom();
    room.state.collectibles.clear();
    // 30 spawns independentes: cada um sempre em célula boa, sempre 1 por vez.
    for (let i = 0; i < 30; i++) {
      room.state.collectibles.clear();
      const ok = room.spawnWeapon();
      expect(ok).toBe(true);
      const w = weaponOf(room);
      expect(w).not.toBeNull();
      // walkable: o centro do tile não é parede
      const tx = Math.floor(w.x);
      const tz = Math.floor(w.z);
      expect(isWall(room.map, tx, tz)).toBe(false);
      // alcançável: pertence ao conjunto BFS pré-computado
      expect(room.reachable[tz * room.map.w + tx]).toBe(1);
      // weaponId sorteado entre os vantajosos (nunca basic)
      expect(WEAPON_PICKUP_LAUNCHERS as readonly string[]).toContain(w.weaponId);
      expect(room.countKind("weapon")).toBe(1);
    }
  });

  it("nunca existem 2 armas ao mesmo tempo: o passe de spawn respeita WEAPON_MAX", () => {
    const room = makeRoom();
    room.state.collectibles.clear();
    // força o timer aberto e roda muitos ticks; deve haver no máximo 1 arma sempre.
    room.nextWeaponSpawnAt = 0;
    let maxSeen = 0;
    for (let i = 0; i < 50; i++) {
      room.update(0.05);
      maxSeen = Math.max(maxSeen, room.countKind("weapon"));
    }
    expect(maxSeen).toBe(1);
  });
});

describe("Arma coletável — coleta e respawn (T-039)", () => {
  it("coleta troca o lançador na hora, a arma some e agenda respawn em [15s,30s]", () => {
    const room = makeRoom();
    const before = Date.now();
    const p = new Player();
    p.x = 20;
    p.z = 20;
    p.hp = 100;
    p.maxHp = 100;
    p.launcher = "basic_shot";
    room.state.players.set("A", p);

    room.state.collectibles.clear();
    room.createCollectible(20, 20, "weapon", "heavy_shot"); // em cima do player
    room.update(0.05); // coleta acontece dentro do update (dist 0 < COLLECT_DIST)

    expect(p.launcher).toBe("heavy_shot"); // trocou na hora
    expect(room.countKind("weapon")).toBe(0); // sumiu
    const delay = room.nextWeaponSpawnAt - before;
    expect(delay).toBeGreaterThanOrEqual(WEAPON_RESPAWN_MIN_MS);
    expect(delay).toBeLessThanOrEqual(WEAPON_RESPAWN_MAX_MS + 100); // folga p/ o Date.now do update
  });

  it("depois da coleta, nenhuma arma renasce até o cooldown vencer", () => {
    const room = makeRoom();
    const p = new Player();
    p.x = 20;
    p.z = 20;
    p.hp = 100;
    p.maxHp = 100;
    room.state.players.set("A", p);
    room.state.collectibles.clear();
    room.createCollectible(20, 20, "weapon", "rapid_shot");
    room.update(0.05); // coleta
    expect(room.countKind("weapon")).toBe(0);
    // roda vários ticks ANTES do cooldown vencer: não deve renascer
    for (let i = 0; i < 20; i++) room.update(0.05);
    expect(room.countKind("weapon")).toBe(0);
    // fura o cooldown e roda de novo: renasce
    room.nextWeaponSpawnAt = 0;
    room.update(0.05);
    expect(room.countKind("weapon")).toBe(1);
  });
});

describe("Arma coletável — morte devolve basic_shot (T-039)", () => {
  it("player com arma vantajosa morre e volta ao basic_shot", () => {
    const room = makeRoom();
    const p = new Player();
    p.x = 20;
    p.z = 20;
    p.hp = 100;
    p.maxHp = 100;
    p.launcher = "heavy_shot"; // pegou a arma antes
    room.state.players.set("A", p);

    p.hp = 0; // morte
    room.update(0.05);

    expect(p.launcher).toBe("basic_shot");
    expect(p.hp).toBe(p.maxHp); // respawnou
  });
});

describe("weaponRespawnDelay — sorteio dentro da janela", () => {
  it("sempre cai em [WEAPON_RESPAWN_MIN_MS, WEAPON_RESPAWN_MAX_MS]", () => {
    for (const r of [0, 0.0001, 0.25, 0.5, 0.75, 0.9999, 1]) {
      const d = weaponRespawnDelay(() => r);
      expect(d).toBeGreaterThanOrEqual(WEAPON_RESPAWN_MIN_MS);
      expect(d).toBeLessThanOrEqual(WEAPON_RESPAWN_MAX_MS);
    }
  });
});
