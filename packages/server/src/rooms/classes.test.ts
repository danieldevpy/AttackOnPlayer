import { describe, it, expect } from "vitest";
import { ArenaRoom } from "./ArenaRoom";
import { CLASS_REGISTRY, DEFAULT_CLASS_ID } from "@aop/shared";

/**
 * T-052 (SPEC-0014): join valida classId/skinId contra CLASS_REGISTRY — nunca rejeita,
 * inválido/ausente cai pro default. Mesmo harness sem transporte Colyseus da weapon.test.ts.
 */
function makeRoom(): any {
  const room: any = new ArenaRoom();
  room.clients = [];
  room.onCreate({ flagEnabled: false });
  return room;
}

function fakeClient(sessionId: string): any {
  return { sessionId, send: () => {} };
}

describe("onJoin — classId/skinId (T-052)", () => {
  it("classe e skin válidas são aplicadas ao player", async () => {
    const room = makeRoom();
    const client = fakeClient("A");
    await room.onJoin(client, { name: "tester", classId: "archer", skinId: "default" });
    const p = room.state.players.get("A");
    expect(p.classId).toBe("archer");
    expect(p.skinId).toBe("default");
  });

  it("classe inválida cai pro default sem rejeitar o join", async () => {
    const room = makeRoom();
    const client = fakeClient("B");
    await room.onJoin(client, { name: "tester", classId: "guerreiro", skinId: "default" });
    const p = room.state.players.get("B");
    expect(p).toBeDefined();
    expect(p.classId).toBe(DEFAULT_CLASS_ID);
    expect(p.skinId).toBe(CLASS_REGISTRY[DEFAULT_CLASS_ID].skinIds[0]);
  });

  it("classId/skinId ausentes (join sem escolha) caem pro default", async () => {
    const room = makeRoom();
    const client = fakeClient("C");
    await room.onJoin(client, { name: "tester" });
    const p = room.state.players.get("C");
    expect(p.classId).toBe(DEFAULT_CLASS_ID);
    expect(p.skinId).toBe(CLASS_REGISTRY[DEFAULT_CLASS_ID].skinIds[0]);
  });

  it("bot (sem classId/skinId no join) recebe a classe default — sem regressão", async () => {
    const room = makeRoom();
    const client = fakeClient("bot1");
    await room.onJoin(client, { name: "bot", bot: true });
    const p = room.state.players.get("bot1");
    expect(p.isBot).toBe(true);
    expect(p.classId).toBe(DEFAULT_CLASS_ID);
  });
});
