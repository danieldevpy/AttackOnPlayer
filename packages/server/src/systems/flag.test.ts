import { describe, it, expect } from "vitest";
import { MapSchema } from "@colyseus/schema";
import { Flag, Player } from "../state/ArenaState";
import { FlagSystem } from "./flag";
import { FLAG_ABANDON_RETURN_MS } from "@aop/shared";

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

  it("bandeira abandonada volta ao centro só depois de FLAG_ABANDON_RETURN_MS", () => {
    const flag = new Flag();
    const sys = new FlagSystem();
    sys.initAt(flag, 0, 0);
    const players = new MapSchema<Player>();
    sys.drop(flag, 20, 20, 1000);
    const center = { x: 30, z: 25 };

    sys.tick(flag, players, center, 1000 + FLAG_ABANDON_RETURN_MS - 1);
    expect(flag.x).toBe(20); // ainda não passou o tempo

    sys.tick(flag, players, center, 1000 + FLAG_ABANDON_RETURN_MS);
    expect(flag.x).toBe(30);
    expect(flag.z).toBe(25);
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
