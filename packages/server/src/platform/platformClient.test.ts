import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformClient, DEFAULT_CONFIG, EffectiveConfig } from "./platformClient";

const SAMPLE_CONFIG: EffectiveConfig = {
  flagEnabled: false,
  xpMultiplier: 2,
  coinMultiplier: 1.5,
  mapRotation: ["arena-teste", "arena-live-capture"],
  expectedPlayers: 6,
};

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response;
}

describe("PlatformClient (T-027g)", () => {
  let client: PlatformClient;

  beforeEach(() => {
    client = new PlatformClient();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    client.stopFlushTimer();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("busca a config na primeira chamada e usa o header de service token", async () => {
    (fetch as any).mockResolvedValueOnce(jsonResponse(SAMPLE_CONFIG));
    process.env.SERVICE_TOKEN = "tok-123";

    const config = await client.getConfig();

    expect(config).toEqual(SAMPLE_CONFIG);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toContain("/api/v1/gameops/config/");
    expect(init.headers.Authorization).toBe("ServiceToken tok-123");
  });

  it("usa o cache dentro do TTL — não refaz a chamada de rede", async () => {
    (fetch as any).mockResolvedValueOnce(jsonResponse(SAMPLE_CONFIG));

    const t0 = 1_000_000;
    await client.getConfig(t0);
    const second = await client.getConfig(t0 + 5_000); // dentro do TTL de 30s

    expect(second).toEqual(SAMPLE_CONFIG);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("refaz a chamada de rede depois que o TTL expira", async () => {
    (fetch as any)
      .mockResolvedValueOnce(jsonResponse(SAMPLE_CONFIG))
      .mockResolvedValueOnce(jsonResponse({ ...SAMPLE_CONFIG, xpMultiplier: 3 }));

    const t0 = 1_000_000;
    await client.getConfig(t0);
    const refreshed = await client.getConfig(t0 + 31_000); // fora do TTL de 30s

    expect(refreshed.xpMultiplier).toBe(3);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("cai nos defaults quando o Django está fora do ar e nunca buscou com sucesso", async () => {
    (fetch as any).mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const config = await client.getConfig();

    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it("cai no ÚLTIMO cache bom quando o Django cai depois de já ter respondido uma vez", async () => {
    (fetch as any)
      .mockResolvedValueOnce(jsonResponse(SAMPLE_CONFIG))
      .mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const t0 = 1_000_000;
    await client.getConfig(t0);
    const afterCrash = await client.getConfig(t0 + 31_000); // TTL expirado, força nova tentativa

    expect(afterCrash).toEqual(SAMPLE_CONFIG); // não regride pros defaults
  });

  it("trata status HTTP não-ok como falha (mantém cache/defaults)", async () => {
    (fetch as any).mockResolvedValueOnce(jsonResponse({}, false, 503));

    const config = await client.getConfig();

    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it("queueTelemetry + flush envia o batch e esvazia o buffer", async () => {
    (fetch as any).mockResolvedValueOnce(jsonResponse({ ingested: 2 }));
    const event = { v: 1, ts: 1, tick: 1, matchId: "m1", type: "match_start" } as any;

    client.queueTelemetry(event);
    client.queueTelemetry(event);
    await client.flush();

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toContain("/api/v1/telemetry/batch/");
    const body = JSON.parse(init.body);
    expect(body.events).toHaveLength(2);

    // buffer esvaziado — um segundo flush não deve gerar nova chamada de rede
    await client.flush();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reportProgress (T-029) posta o delta com o account_id no corpo", async () => {
    (fetch as any).mockResolvedValueOnce(jsonResponse({}, true, 200));
    process.env.SERVICE_TOKEN = "tok-123";

    await client.reportProgress("acc-1", { forca: 3, agilidade: 3, vitalidade: 3 });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toContain("/api/v1/accounts/progress");
    expect(init.headers.Authorization).toBe("ServiceToken tok-123");
    const body = JSON.parse(init.body);
    expect(body).toEqual({ account_id: "acc-1", forca: 3, agilidade: 3, vitalidade: 3 });
  });

  it("reportProgress trata 204 (conta/stats inexistente) como sucesso, não erro", async () => {
    (fetch as any).mockResolvedValueOnce(jsonResponse({}, true, 204));

    await expect(
      client.reportProgress("acc-inexistente", { forca: 1, agilidade: 1, vitalidade: 1 })
    ).resolves.toBeUndefined();
  });

  it("reportProgress nunca lança em falha de rede (degradação graciosa)", async () => {
    (fetch as any).mockRejectedValueOnce(new Error("ECONNREFUSED"));

    await expect(
      client.reportProgress("acc-1", { forca: 1, agilidade: 1, vitalidade: 1 })
    ).resolves.toBeUndefined();
  });

  it("descarta o batch em falha de rede em vez de acumular sem teto (degradação graciosa)", async () => {
    (fetch as any).mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const event = { v: 1, ts: 1, tick: 1, matchId: "m1", type: "match_start" } as any;

    client.queueTelemetry(event);
    await expect(client.flush()).resolves.toBeUndefined();

    // buffer já foi esvaziado antes do POST (splice acontece antes do fetch) — flush seguinte é no-op
    (fetch as any).mockClear();
    await client.flush();
    expect(fetch).not.toHaveBeenCalled();
  });
});
