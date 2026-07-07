import { describe, it, expect } from "vitest";
import { ArenaRoom } from "./ArenaRoom";
import { CLASS_REGISTRY, DEFAULT_CLASS_ID, DEFAULT_NICK, NICK_MAX_LEN } from "@aop/shared";

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

  it("bot mandando classId default explícito (novo contrato T-059) segue entrando", async () => {
    const room = makeRoom();
    const client = fakeClient("bot2");
    await room.onJoin(client, { name: "bot-2", bot: true, classId: DEFAULT_CLASS_ID });
    const p = room.state.players.get("bot2");
    expect(p).toBeDefined();
    expect(p.isBot).toBe(true);
    expect(p.classId).toBe(DEFAULT_CLASS_ID);
    expect(p.name).toBe("bot-2");
  });
});

describe("onJoin — nick/seleção (T-059, SPEC-0015)", () => {
  it("nick válido do lobby vira o nome do player", async () => {
    const room = makeRoom();
    const client = fakeClient("N1");
    await room.onJoin(client, { nick: "Daniel", classId: "archer", skinId: "verde" });
    const p = room.state.players.get("N1");
    expect(p.name).toBe("Daniel");
    expect(p.classId).toBe("archer");
    expect(p.skinId).toBe("verde");
  });

  it("nick tem precedência sobre name quando ambos vêm no join", async () => {
    const room = makeRoom();
    const client = fakeClient("N2");
    await room.onJoin(client, { nick: "DoLobby", name: "legado" });
    const p = room.state.players.get("N2");
    expect(p.name).toBe("DoLobby");
  });

  it("nick ausente cai pro fallback sem rejeitar o join", async () => {
    const room = makeRoom();
    const client = fakeClient("N3");
    await room.onJoin(client, { classId: "archer" });
    const p = room.state.players.get("N3");
    expect(p).toBeDefined();
    expect(p.name).toBe(DEFAULT_NICK);
  });

  it("nick malicioso (HTML/script) cai INTEIRO pro fallback — nunca sanitiza parcial", async () => {
    const room = makeRoom();
    const client = fakeClient("N4");
    await room.onJoin(client, { nick: "<script>alert(1)</script>" });
    const p = room.state.players.get("N4");
    expect(p.name).toBe(DEFAULT_NICK);
  });

  it("nick com caracteres de controle cai pro fallback", async () => {
    const room = makeRoom();
    const client = fakeClient("N5");
    await room.onJoin(client, { nick: "nick\x00\x07" });
    const p = room.state.players.get("N5");
    expect(p.name).toBe(DEFAULT_NICK);
  });

  it("nick só de espaços cai pro fallback", async () => {
    const room = makeRoom();
    const client = fakeClient("N6");
    await room.onJoin(client, { nick: "     " });
    const p = room.state.players.get("N6");
    expect(p.name).toBe(DEFAULT_NICK);
  });

  it("nick válido mas longo é truncado no teto do servidor (autoritativo)", async () => {
    const room = makeRoom();
    const client = fakeClient("N7");
    const longNick = "A".repeat(NICK_MAX_LEN + 30);
    await room.onJoin(client, { nick: longNick });
    const p = room.state.players.get("N7");
    expect(p.name.length).toBe(NICK_MAX_LEN);
    expect(p.name).toBe("A".repeat(NICK_MAX_LEN));
  });

  it("nick com acentos é preservado (Unicode)", async () => {
    const room = makeRoom();
    const client = fakeClient("N8");
    await room.onJoin(client, { nick: "João" });
    const p = room.state.players.get("N8");
    expect(p.name).toBe("João");
  });
});
