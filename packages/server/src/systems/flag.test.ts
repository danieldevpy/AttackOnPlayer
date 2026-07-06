import { describe, it, expect } from "vitest";
import { MapSchema } from "@colyseus/schema";
import { Flag, Player } from "../state/ArenaState";
import { FlagSystem } from "./flag";
import { FLAG_ABANDON_RETURN_MS, FLAG_COOLDOWN_MS } from "@aop/shared";

describe("FlagSystem (T-021)", () => {
  it("initAt nasce sem portador na posição dada", () => {
    const flag = new Flag();
    const sys = new FlagSystem();
    sys.initAt(flag, 10, 8);
    expect(flag.x).toBe(10);
    expect(flag.z).toBe(8);
    expect(flag.carrierId).toBe("");
  });

  it("pickup marca o portador; tick passa a seguir a posição dele", () => {
    const flag = new Flag();
    const sys = new FlagSystem();
    sys.initAt(flag, 0, 0);
    const players = new MapSchema<Player>();
    const p = new Player();
    p.x = 5;
    p.z = 3;
    p.hp = 100;
    players.set("p1", p);

    sys.pickup(flag, "p1");
    expect(flag.carrierId).toBe("p1");
    sys.tick(flag, players, { x: 0, z: 0 }, Date.now());
    expect(flag.x).toBe(5);
    expect(flag.z).toBe(3);

    p.x = 7;
    p.z = 9;
    sys.tick(flag, players, { x: 0, z: 0 }, Date.now());
    expect(flag.x).toBe(7);
    expect(flag.z).toBe(9);
  });

  it("drop derruba no local e limpa o portador", () => {
    const flag = new Flag();
    const sys = new FlagSystem();
    sys.initAt(flag, 0, 0);
    sys.pickup(flag, "p1");
    sys.drop(flag, 12, 4, Date.now());
    expect(flag.carrierId).toBe("");
    expect(flag.x).toBe(12);
    expect(flag.z).toBe(4);
  });

  it("portador que some do mapa (desconexão) sem passar pela morte é tratado como drop no local", () => {
    const flag = new Flag();
    const sys = new FlagSystem();
    sys.initAt(flag, 0, 0);
    const players = new MapSchema<Player>();
    sys.pickup(flag, "ghost"); // "ghost" nunca existiu no map de players
    flag.x = 3;
    flag.z = 3;
    sys.tick(flag, players, { x: 0, z: 0 }, Date.now());
    expect(flag.carrierId).toBe("");
    expect(flag.x).toBe(3);
    expect(flag.z).toBe(3);
  });

  it("T-042: abandonada por FLAG_ABANDON_RETURN_MS entra em cooldown (não volta direto ao centro)", () => {
    const flag = new Flag();
    const sys = new FlagSystem();
    sys.initAt(flag, 0, 0);
    const players = new MapSchema<Player>();
    sys.drop(flag, 20, 20, 1000);
    const center = { x: 30, z: 25 };

    let ev = sys.tick(flag, players, center, 1000 + FLAG_ABANDON_RETURN_MS - 1);
    expect(ev).toBeNull();
    expect(flag.state).toBe("active"); // ainda não passou o tempo
    expect(flag.x).toBe(20);

    ev = sys.tick(flag, players, center, 1000 + FLAG_ABANDON_RETURN_MS);
    expect(ev).toBe("flag_cooldown_start");
    expect(flag.state).toBe("cooldown");
    expect(flag.x).toBe(20); // não moveu pro centro — está fora do jogo
  });

  it("T-042: em cooldown o pickup é impossível; após FLAG_COOLDOWN_MS renasce no centro (acesa)", () => {
    const flag = new Flag();
    const sys = new FlagSystem();
    sys.initAt(flag, 0, 0);
    const players = new MapSchema<Player>();
    const center = { x: 30, z: 25 };

    sys.drop(flag, 20, 20, 1000);
    const cooldownStart = 1000 + FLAG_ABANDON_RETURN_MS;
    sys.tick(flag, players, center, cooldownStart);
    expect(flag.state).toBe("cooldown");

    // pickup durante o cooldown não faz nada (fora do jogo)
    sys.pickup(flag, "p1");
    expect(flag.carrierId).toBe("");

    // antes do fim do cooldown, nada muda
    let ev = sys.tick(flag, players, center, cooldownStart + FLAG_COOLDOWN_MS - 1);
    expect(ev).toBeNull();
    expect(flag.state).toBe("cooldown");

    // ao fim, renasce no centro, ativa
    ev = sys.tick(flag, players, center, cooldownStart + FLAG_COOLDOWN_MS);
    expect(ev).toBe("flag_respawn");
    expect(flag.state).toBe("active");
    expect(flag.x).toBe(30);
    expect(flag.z).toBe(25);
  });

  it("T-042: pickup dentro dos 5s cancela o abandono (comportamento T-021 preservado)", () => {
    const flag = new Flag();
    const sys = new FlagSystem();
    sys.initAt(flag, 0, 0);
    const players = new MapSchema<Player>();
    const p = new Player();
    p.x = 20;
    p.z = 20;
    p.hp = 100;
    players.set("p1", p);
    const center = { x: 30, z: 25 };

    sys.drop(flag, 20, 20, 1000);
    // pega antes dos 5s
    sys.pickup(flag, "p1");
    expect(flag.carrierId).toBe("p1");
    // já muito depois dos 5s: como foi pega, nunca vira cooldown
    const ev = sys.tick(flag, players, center, 1000 + FLAG_ABANDON_RETURN_MS + 10);
    expect(ev).toBeNull();
    expect(flag.state).toBe("active");
    expect(flag.carrierId).toBe("p1");
  });

  it("T-040: drop sobre célula ocupada assenta em célula walkable alcançável próxima (via settle)", () => {
    // settle simula o nearestReachableCell do ArenaRoom: a célula (5,5) é bloqueada e é
    // remapeada para (6,5); qualquer outra passa direto (identidade).
    const settle = (x: number, z: number) =>
      Math.floor(x) === 5 && Math.floor(z) === 5 ? { x: 6.5, z: 5.5 } : { x, z };
    const sys = new FlagSystem(settle);
    const flag = new Flag();
    sys.initAt(flag, 0.5, 0.5);

    // drop sobre a célula bloqueada (5,5) → assenta em (6.5, 5.5)
    sys.drop(flag, 5.2, 5.2, 1000);
    expect(flag.x).toBe(6.5);
    expect(flag.z).toBe(5.5);

    // drop em célula livre não se move
    sys.drop(flag, 8.5, 3.5, 2000);
    expect(flag.x).toBe(8.5);
    expect(flag.z).toBe(3.5);
  });

  it("T-040: respawn pós-cooldown também passa pelo settle (centro sobre prop assenta ao lado)", () => {
    const settle = (x: number, z: number) =>
      Math.floor(x) === 30 && Math.floor(z) === 25 ? { x: 31.5, z: 25.5 } : { x, z };
    const sys = new FlagSystem(settle);
    const flag = new Flag();
    const players = new MapSchema<Player>();
    sys.initAt(flag, 0.5, 0.5);
    sys.drop(flag, 20.5, 20.5, 1000);
    const center = { x: 30, z: 25 };
    const cooldownStart = 1000 + FLAG_ABANDON_RETURN_MS;
    sys.tick(flag, players, center, cooldownStart);
    sys.tick(flag, players, center, cooldownStart + FLAG_COOLDOWN_MS);
    expect(flag.x).toBe(31.5);
    expect(flag.z).toBe(25.5);
  });

  it("bandeira nunca tocada (sem drop registrado) não volta sozinha ao centro", () => {
    const flag = new Flag();
    const sys = new FlagSystem();
    sys.initAt(flag, 30, 25);
    const players = new MapSchema<Player>();
    sys.tick(flag, players, { x: 30, z: 25 }, 1_000_000);
    expect(flag.x).toBe(30);
    expect(flag.z).toBe(25);
  });
});
