/**
 * T-026 (SPEC-0008): funções puras de análise sobre uma lista de `TelemetryEvent` de UMA
 * partida. Separado do CLI (`cli/analyze.ts`) pra ser testável sem tocar disco — mesmo padrão
 * de `mapFile.ts`/`mapCli.ts` da T-025 (lógica testável + CLI fina por cima).
 */
import { TelemetryEvent } from "./events";

export function computeFunnel(events: TelemetryEvent[]): Record<string, number> {
  const funnel: Record<string, number> = {};
  for (const e of events) funnel[e.type] = (funnel[e.type] ?? 0) + 1;
  return funnel;
}

export interface CardStat {
  cardId: string;
  offered: number;
  chosen: number;
  declined: number;
  declineRate: number; // declined / offered
}

/** "Qual card é mais recusado?" — junta upgrade_offer (quantas vezes apareceu) com
 * upgrade_choice (quantas vezes foi escolhido vs recusado quando ofertado). */
export function computeCardStats(events: TelemetryEvent[]): CardStat[] {
  const offered = new Map<string, number>();
  const chosen = new Map<string, number>();
  const declined = new Map<string, number>();

  for (const e of events) {
    if (e.type === "upgrade_offer") {
      for (const id of e.offeredCardIds) offered.set(id, (offered.get(id) ?? 0) + 1);
    }
    if (e.type === "upgrade_choice") {
      chosen.set(e.chosenCardId, (chosen.get(e.chosenCardId) ?? 0) + 1);
      for (const id of e.declinedCardIds) declined.set(id, (declined.get(id) ?? 0) + 1);
    }
  }

  const ids = new Set([...offered.keys(), ...chosen.keys(), ...declined.keys()]);
  const stats: CardStat[] = [];
  for (const cardId of ids) {
    const o = offered.get(cardId) ?? 0;
    const c = chosen.get(cardId) ?? 0;
    const d = declined.get(cardId) ?? 0;
    stats.push({ cardId, offered: o, chosen: c, declined: d, declineRate: o > 0 ? d / o : 0 });
  }
  return stats.sort((a, b) => b.declineRate - a.declineRate || b.declined - a.declined);
}

/** Heatmap ASCII (grid `cols`x`rows`, default 20x12) das posições de VÍTIMA — "onde as mortes
 * se concentram?". Bucketiza pela proporção da posição no tamanho do mapa (de match_start). */
export function computeDeathHeatmap(
  events: TelemetryEvent[],
  mapW: number,
  mapH: number,
  cols = 20,
  rows = 12
): string {
  const grid: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
  let total = 0;
  for (const e of events) {
    if (e.type !== "kill") continue;
    const gx = Math.min(cols - 1, Math.max(0, Math.floor((e.victimPos.x / mapW) * cols)));
    const gz = Math.min(rows - 1, Math.max(0, Math.floor((e.victimPos.z / mapH) * rows)));
    grid[gz][gx] += 1;
    total += 1;
  }
  if (total === 0) return "(nenhuma morte registrada)";
  const maxCell = Math.max(...grid.flat());
  const shades = " .:-=+*#%@";
  const lines = grid.map((row) =>
    row.map((n) => (n === 0 ? " " : shades[Math.min(shades.length - 1, Math.ceil((n / maxCell) * (shades.length - 1)))])).join("")
  );
  return [`#`.repeat(cols + 2), ...lines.map((l) => `#${l}#`), `#`.repeat(cols + 2), `(${total} mortes, pico ${maxCell} na mesma célula)`].join("\n");
}

export function computeTickStats(events: TelemetryEvent[]): { slowTicks: number; maxDtMs: number } {
  const slow = events.filter((e): e is Extract<TelemetryEvent, { type: "tick_slow" }> => e.type === "tick_slow");
  return { slowTicks: slow.length, maxDtMs: slow.reduce((m, e) => Math.max(m, e.dtMs), 0) };
}

export function computeErrors(events: TelemetryEvent[]): Array<{ context: string; message: string }> {
  return events.filter((e): e is Extract<TelemetryEvent, { type: "error" }> => e.type === "error").map((e) => ({ context: e.context, message: e.message }));
}

/** Relatório em texto simples — legível por humano E por IA (critério de aceite da spec). */
export function formatReport(events: TelemetryEvent[]): string {
  const start = events.find((e): e is Extract<TelemetryEvent, { type: "match_start" }> => e.type === "match_start");
  const end = events.find((e): e is Extract<TelemetryEvent, { type: "match_end" }> => e.type === "match_end");
  const lines: string[] = [];

  lines.push(`Partida: ${events[0]?.matchId ?? "?"}${start?.mapId ? ` (mapa curado: ${start.mapId})` : ""}`);
  if (start) lines.push(`Mapa: ${start.mapW}x${start.mapH} seed ${start.mapSeed}`);
  if (end) lines.push(`Duração: ${end.durationS}s · jogadores no fim: ${end.playerCount}`);
  lines.push("");

  lines.push("== Funil de eventos ==");
  const funnel = computeFunnel(events);
  for (const [type, count] of Object.entries(funnel).sort((a, b) => b[1] - a[1])) lines.push(`  ${type.padEnd(18)} ${count}`);
  lines.push("");

  lines.push("== Cards de level-up (mais recusado primeiro) ==");
  const cardStats = computeCardStats(events);
  if (!cardStats.length) lines.push("  (nenhuma oferta de card registrada)");
  for (const c of cardStats) {
    lines.push(`  ${c.cardId.padEnd(20)} ofertado:${c.offered} escolhido:${c.chosen} recusado:${c.declined} (${Math.round(c.declineRate * 100)}% recusa)`);
  }
  lines.push("");

  lines.push("== Heatmap de mortes (posição da vítima) ==");
  lines.push(start ? computeDeathHeatmap(events, start.mapW, start.mapH) : "(sem match_start, não dá pra escalar o grid)");
  lines.push("");

  const tickStats = computeTickStats(events);
  lines.push(`== Watchdog de tick ==`);
  lines.push(`  ticks lentos: ${tickStats.slowTicks}${tickStats.slowTicks ? ` (pior: ${tickStats.maxDtMs.toFixed(0)}ms)` : ""}`);
  lines.push("");

  const errors = computeErrors(events);
  lines.push(`== Erros (${errors.length}) ==`);
  for (const e of errors.slice(0, 20)) lines.push(`  [${e.context}] ${e.message}`);

  return lines.join("\n");
}
