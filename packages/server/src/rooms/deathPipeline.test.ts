import { describe, it, expect } from "vitest";
import { ArenaRoom } from "./ArenaRoom";
import { Player } from "../state/ArenaState";
import { spawnPoints, DEFAULT_LAUNCHER } from "@aop/shared";

/**
 * T-065 (SPEC-0016): refactor do pipeline de morte (`handleDeath`/`respawnPlayer`). Com o
 * `EVENT_REGISTRY` vazio, `director.respawnPolicyFor` sempre devolve "default" — o objetivo
 * central destes testes é provar que o comportamento "default" ficou byte-a-byte idêntico ao
 * bloco antigo. Os testes de "hold_until_end"/"inside_zone" forçam a política via monkey-patch
 * de `room.director.respawnPolicyFor` (sem precisar de um evento real — isso é T-066) só pra
 * provar que os branches novos, hoje inalcançáveis em produção, já funcionam.
 */
function makeRoom(): any {
  const room: any = new ArenaRoom();
  room.clients = [];
  room.onCreate({ flagEnabled: false });
  return room;
}

function addPlayer(room: any, id: string, x = 50, z = 50): Player {
  const p = new Player();
  p.x = x;
  p.z = z;
  p.hp = 100;
  p.maxHp = 100;
  p.level = 5;
  p.xp = 10;
  p.launcher = "heavy_shot";
  room.state.players.set(id, p);
  return p;
}

describe("Pipeline de morte — refactor T-065 (SPEC-0016)", () => {
  it('sem evento ativo (policy "default"), morte+respawn reproduz o comportamento anterior', () => {
    const room = makeRoom();
    const p = addPlayer(room, "A");
    p.hp = 0;

    room.update(0.05);

    expect(p.level).toBe(1);
    expect(p.xp).toBe(0);
    expect(p.launcher).toBe(DEFAULT_LAUNCHER);
    expect(p.hp).toBe(p.maxHp);
    expect(p.waitingRespawn).toBe(false);
    expect(p.spawnProtectedUntil).toBeGreaterThan(0);

    const deathEv = room.debugEvents.find((e: any) => e.type === "death" && e.payload.playerId === "A");
    const respawnEv = room.debugEvents.find((e: any) => e.type === "respawn" && e.payload.playerId === "A");
    expect(deathEv).toBeTruthy();
    expect(respawnEv).toBeTruthy();
  });

  it('política "hold_until_end": segura o respawn (waitingRespawn=true, hp=0) e processa a morte só 1×', () => {
    const room = makeRoom();
    const p = addPlayer(room, "A");
    room.director.respawnPolicyFor = () => "hold_until_end";
    p.hp = 0;

    room.update(0.05);
    expect(p.waitingRespawn).toBe(true);
    expect(p.hp).toBe(0);
    expect(p.level).toBe(1); // morte já processada (build/nível zerados) mesmo segurando o respawn

    const deathCount = () => room.debugEvents.filter((e: any) => e.type === "death" && e.payload.playerId === "A").length;
    expect(deathCount()).toBe(1);

    // ticks seguintes NÃO reprocessam a morte enquanto o player está held
    room.update(0.05);
    room.update(0.05);
    expect(deathCount()).toBe(1);
    expect(p.hp).toBe(0);
  });

  it('política "inside_zone": respawna dentro do raio da zona, em célula alcançável', () => {
    const room = makeRoom();
    const p = addPlayer(room, "A");
    room.director.respawnPolicyFor = () => "inside_zone";
    const seed = spawnPoints(room.state.mapW, room.state.mapH)[0];
    room.state.event.zoneX = seed.x;
    room.state.event.zoneZ = seed.z;
    room.state.event.zoneRadius = 3;
    p.hp = 0;

    room.update(0.05);

    expect(p.hp).toBe(p.maxHp);
    expect(p.waitingRespawn).toBe(false);
    const dist = Math.hypot(p.x - seed.x, p.z - seed.z);
    expect(dist).toBeLessThanOrEqual(3 + 1e-6);
  });
});
