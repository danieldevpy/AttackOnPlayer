/**
 * T-026 (SPEC-0008): `npm run analyze -- [matchId|--list]`.
 * Lê `logs/telemetry/<matchId>.ndjson` (ou o arquivo mais recente, sem argumento) e imprime um
 * relatório legível — funil de eventos, cards mais recusados, heatmap ASCII de mortes,
 * watchdog de tick e erros. Pensado pra uma IA (ou o CD) ler a saída e responder perguntas tipo
 * "onde as mortes se concentram?"/"qual card é mais recusado?" sem abrir o jogo.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { TelemetryEvent } from "../telemetry/events";
import { formatReport } from "../telemetry/analyze";

const TELEMETRY_DIR = join(__dirname, "..", "..", "logs", "telemetry");

function fail(msg: string): never {
  console.error(`Erro: ${msg}`);
  process.exit(1);
}

function listMatchFiles(): string[] {
  if (!existsSync(TELEMETRY_DIR)) return [];
  return readdirSync(TELEMETRY_DIR)
    .filter((f) => f.endsWith(".ndjson"))
    .map((f) => ({ f, mtime: statSync(join(TELEMETRY_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .map((x) => x.f);
}

function loadEvents(matchId: string): TelemetryEvent[] {
  const path = join(TELEMETRY_DIR, `${matchId}.ndjson`);
  if (!existsSync(path)) fail(`nenhuma telemetria encontrada em ${path}`);
  const lines = readFileSync(path, "utf-8").trim().split("\n").filter(Boolean);
  return lines.map((l) => JSON.parse(l) as TelemetryEvent);
}

function main() {
  const arg = process.argv[2];
  if (arg === "--list") {
    const files = listMatchFiles();
    if (!files.length) {
      console.log(`Nenhuma partida com telemetria ainda (esperado em ${TELEMETRY_DIR}).`);
      return;
    }
    console.log("Partidas com telemetria (mais recente primeiro):");
    for (const f of files) console.log(`  ${f.replace(/\.ndjson$/, "")}`);
    return;
  }

  let matchId = arg;
  if (!matchId) {
    const files = listMatchFiles();
    if (!files.length) fail(`nenhuma partida com telemetria ainda em ${TELEMETRY_DIR}`);
    matchId = files[0].replace(/\.ndjson$/, "");
    console.log(`(sem argumento — usando a partida mais recente: ${matchId})\n`);
  }

  const events = loadEvents(matchId);
  console.log(formatReport(events));
}

main();
