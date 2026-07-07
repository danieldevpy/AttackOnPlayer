import { describe, it, expect, vi, afterEach } from "vitest";
import { ArenaRoom } from "./ArenaRoom";
import { platformClient, DEFAULT_CONFIG } from "../platform/platformClient";

/**
 * T-061 (SPEC-0008): um evento/config novo criado no admin passa a valer NA SALA JÁ ABERTA
 * (não só na próxima) — `updateInner` reconsulta `platformClient.getConfig()` periodicamente.
 * `PLATFORM_ENABLED` fica OFF na criação da room (harness sem transporte, igual classes.test.ts)
 * pra não disparar rede de verdade no `onCreate`; cada teste liga a flag só depois, com o
 * `getConfig` já mockado.
 */
function makeRoom(): any {
  const room: any = new ArenaRoom();
  room.clients = [];
  room.onCreate({ flagEnabled: false });
  return room;
}

describe("Config de plataforma ao vivo (T-061)", () => {
  afterEach(() => {
    delete process.env.PLATFORM_ENABLED;
    vi.restoreAllMocks();
  });

  it("aplica xpMultiplier/coinMultiplier/flagEnabled na sala já aberta", async () => {
    const room = makeRoom();
    const getConfigSpy = vi.spyOn(platformClient, "getConfig").mockResolvedValue({
      flagEnabled: true,
      xpMultiplier: 3,
      coinMultiplier: 2,
      mapRotation: [],
      expectedPlayers: 4,
    });
    process.env.PLATFORM_ENABLED = "1";

    room.update(0.05);
    await Promise.resolve();
    await Promise.resolve();

    expect(getConfigSpy).toHaveBeenCalled();
    expect(room.xpMultiplier).toBe(3);
    expect(room.coinMultiplier).toBe(2);
    expect(room.state.flagEnabled).toBe(true);
  });

  it("não reconsulta antes do intervalo de sync (barato mesmo em tick alto)", async () => {
    const room = makeRoom();
    const getConfigSpy = vi.spyOn(platformClient, "getConfig").mockResolvedValue(DEFAULT_CONFIG);
    process.env.PLATFORM_ENABLED = "1";

    room.update(0.05);
    await Promise.resolve();
    const callsAfterFirst = getConfigSpy.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    room.update(0.05); // mesmo instante — dentro do intervalo de 5s
    await Promise.resolve();

    expect(getConfigSpy.mock.calls.length).toBe(callsAfterFirst);
  });

  it("fica inerte quando PLATFORM_ENABLED está off (comportamento de sempre)", async () => {
    const room = makeRoom();
    const getConfigSpy = vi.spyOn(platformClient, "getConfig");

    room.update(0.05);
    await Promise.resolve();

    expect(getConfigSpy).not.toHaveBeenCalled();
  });
});
