import { describe, it, expect, vi, afterEach } from "vitest";
import { ArenaRoom } from "./ArenaRoom";
import { Collectible } from "../state/ArenaState";
import { platformClient } from "../platform/platformClient";
import { BOX_ATTR_BONUS_EACH } from "@aop/shared";

/**
 * T-029 (ADR-012 → conta): pickup de "box" soma no acumulador em memória (T-004b, já coberto
 * por bots/smoke) E, quando a plataforma está ligada e o player tem `accountId` (JWT verificado
 * no join, T-028b), reporta o MESMO delta pro Django via `platformClient.reportProgress`.
 * Harness sem transporte Colyseus, igual `classes.test.ts`/`platformSync.test.ts`.
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

describe("Progresso persistente da box reporta pra conta (T-029)", () => {
  afterEach(() => {
    delete process.env.PLATFORM_ENABLED;
    vi.restoreAllMocks();
  });

  it("chama platformClient.reportProgress com o accountId e o mesmo delta do memDB", async () => {
    const room = makeRoom();
    const client = fakeClient("A");
    await room.onJoin(client, { name: "tester" });
    const p = room.state.players.get("A");
    p.accountId = "acc-123"; // simula join com JWT válido (T-028b)

    const box = new Collectible();
    box.kind = "box";
    box.x = p.x;
    box.z = p.z;
    room.state.collectibles.set("box-1", box);

    const reportSpy = vi.spyOn(platformClient, "reportProgress").mockResolvedValue(undefined);
    process.env.PLATFORM_ENABLED = "1";

    room.update(0.05);

    expect(reportSpy).toHaveBeenCalledWith("acc-123", {
      forca: BOX_ATTR_BONUS_EACH,
      agilidade: BOX_ATTR_BONUS_EACH,
      vitalidade: BOX_ATTR_BONUS_EACH,
    });
  });

  it("não reporta quando o player não tem accountId (guest sem JWT)", () => {
    const room = makeRoom();
    const client = fakeClient("B");
    room.onJoin(client, { name: "tester" });
    const p = room.state.players.get("B");
    expect(p.accountId).toBe("");

    const box = new Collectible();
    box.kind = "box";
    box.x = p.x;
    box.z = p.z;
    room.state.collectibles.set("box-1", box);

    const reportSpy = vi.spyOn(platformClient, "reportProgress");
    process.env.PLATFORM_ENABLED = "1";

    room.update(0.05);

    expect(reportSpy).not.toHaveBeenCalled();
  });

  it("não reporta quando PLATFORM_ENABLED está off, mesmo com accountId", async () => {
    const room = makeRoom();
    const client = fakeClient("C");
    await room.onJoin(client, { name: "tester" });
    const p = room.state.players.get("C");
    p.accountId = "acc-456";

    const box = new Collectible();
    box.kind = "box";
    box.x = p.x;
    box.z = p.z;
    room.state.collectibles.set("box-1", box);

    const reportSpy = vi.spyOn(platformClient, "reportProgress");

    room.update(0.05);

    expect(reportSpy).not.toHaveBeenCalled();
  });
});
