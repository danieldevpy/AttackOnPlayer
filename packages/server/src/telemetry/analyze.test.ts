import { describe, expect, it } from "vitest";
import { computeCardStats, computeDeathHeatmap, computeErrors, computeFunnel, computeTickStats, formatReport } from "./analyze";
import { TelemetryEvent } from "./events";

function ev<T extends TelemetryEvent["type"]>(type: T, extra: any, matchId = "m1"): TelemetryEvent {
  return { v: 1, ts: Date.now(), tick: 0, matchId, type, ...extra } as TelemetryEvent;
}

describe("computeFunnel (T-026)", () => {
  it("conta eventos por tipo", () => {
    const events = [ev("match_start", { mapW: 10, mapH: 10, mapSeed: 1 }), ev("kill", killPayload()), ev("kill", killPayload())];
    expect(computeFunnel(events)).toEqual({ match_start: 1, kill: 2 });
  });
});

function killPayload(over: Partial<any> = {}) {
  return {
    killerToken: "a",
    killerPos: { x: 1, z: 1 },
    killerLevel: 2,
    victimToken: "b",
    victimPos: { x: 5, z: 5 },
    victimLevel: 1,
    threats: 0,
    ...over,
  };
}

describe("computeCardStats (T-026)", () => {
  it("junta oferta + escolha e calcula taxa de recusa", () => {
    const events: TelemetryEvent[] = [
      ev("upgrade_offer", { playerToken: "a", level: 2, offeredCardIds: ["forca_bruta", "casca_grossa", "equilibrado"] }),
      ev("upgrade_choice", { playerToken: "a", level: 2, chosenCardId: "equilibrado", declinedCardIds: ["forca_bruta", "casca_grossa"], autoPick: false }),
      ev("upgrade_offer", { playerToken: "b", level: 2, offeredCardIds: ["forca_bruta", "pes_ligeiros", "equilibrado"] }),
      ev("upgrade_choice", { playerToken: "b", level: 2, chosenCardId: "pes_ligeiros", declinedCardIds: ["forca_bruta", "equilibrado"], autoPick: false }),
    ];
    const stats = computeCardStats(events);
    const forcaBruta = stats.find((s) => s.cardId === "forca_bruta")!;
    expect(forcaBruta.offered).toBe(2);
    expect(forcaBruta.chosen).toBe(0);
    expect(forcaBruta.declined).toBe(2);
    expect(forcaBruta.declineRate).toBe(1);
    // mais recusado primeiro
    expect(stats[0].declineRate).toBeGreaterThanOrEqual(stats[stats.length - 1].declineRate);
  });

  it("sem eventos de upgrade devolve lista vazia", () => {
    expect(computeCardStats([ev("match_start", { mapW: 1, mapH: 1, mapSeed: 0 })])).toEqual([]);
  });
});

describe("computeDeathHeatmap (T-026)", () => {
  it("sem mortes devolve mensagem clara", () => {
    expect(computeDeathHeatmap([], 10, 10)).toBe("(nenhuma morte registrada)");
  });

  it("bucketiza mortes dentro dos limites do grid", () => {
    const events = [ev("kill", killPayload({ victimPos: { x: 0, z: 0 } })), ev("kill", killPayload({ victimPos: { x: 9.9, z: 9.9 } }))];
    const heatmap = computeDeathHeatmap(events, 10, 10, 4, 4);
    expect(heatmap).toContain("2 mortes");
    const lines = heatmap.split("\n");
    expect(lines.length).toBeGreaterThan(4); // borda + grid + rodapé
  });
});

describe("computeTickStats (T-026)", () => {
  it("conta ticks lentos e o pior valor", () => {
    const events = [ev("tick_slow", { dtMs: 120, thresholdMs: 100 }), ev("tick_slow", { dtMs: 250, thresholdMs: 100 })];
    expect(computeTickStats(events)).toEqual({ slowTicks: 2, maxDtMs: 250 });
  });

  it("sem eventos: zero ticks lentos", () => {
    expect(computeTickStats([])).toEqual({ slowTicks: 0, maxDtMs: 0 });
  });
});

describe("computeErrors (T-026)", () => {
  it("extrai contexto e mensagem", () => {
    const events = [ev("error", { context: "update", message: "boom" })];
    expect(computeErrors(events)).toEqual([{ context: "update", message: "boom" }]);
  });
});

describe("formatReport (T-026)", () => {
  it("produz um relatório não vazio com as seções esperadas", () => {
    const events: TelemetryEvent[] = [
      ev("match_start", { mapW: 20, mapH: 20, mapSeed: 7 }),
      ev("kill", killPayload()),
      ev("upgrade_offer", { playerToken: "a", level: 2, offeredCardIds: ["forca_bruta", "casca_grossa", "equilibrado"] }),
      ev("upgrade_choice", { playerToken: "a", level: 2, chosenCardId: "equilibrado", declinedCardIds: ["forca_bruta", "casca_grossa"], autoPick: false }),
      ev("match_end", { durationS: 120, playerCount: 4 }),
    ];
    const report = formatReport(events);
    expect(report).toContain("Funil de eventos");
    expect(report).toContain("Cards de level-up");
    expect(report).toContain("Heatmap de mortes");
    expect(report).toContain("Watchdog de tick");
    expect(report).toContain("Erros (0)");
  });
});
