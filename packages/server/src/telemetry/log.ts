import fs from "fs";
import path from "path";
import { TelemetryEvent } from "./events";

/** T-026: um arquivo por partida em `packages/server/logs/telemetry/<matchId>.ndjson` — mesma
 * pasta (já no .gitignore) usada por `metrics/SessionMetrics.ts` para `sessions.jsonl`. */
const TELEMETRY_DIR = path.resolve(__dirname, "../../logs/telemetry");

/** Partidas são curtas (2–3 min, pilar de design) — na prática o arquivo nunca cresce muito.
 * Este teto é só uma rede de segurança pra sessões de teste/smoke anormalmente longas: ao
 * estourar, o arquivo atual vira `.1` (mantém só 1 rotação — não é um esquema de retenção). */
const MAX_FILE_BYTES = 5 * 1024 * 1024;

export class TelemetryLog {
  private filePath: string;

  constructor(matchId: string, dir: string = TELEMETRY_DIR) {
    this.filePath = path.join(dir, `${matchId}.ndjson`);
  }

  write(event: TelemetryEvent) {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      this.rotateIfNeeded();
      fs.appendFileSync(this.filePath, JSON.stringify(event) + "\n");
    } catch (e) {
      console.error("[telemetry] falha ao gravar evento:", e);
    }
  }

  private rotateIfNeeded() {
    let size = 0;
    try {
      size = fs.statSync(this.filePath).size;
    } catch {
      return; // arquivo ainda não existe — nada a rotacionar
    }
    if (size < MAX_FILE_BYTES) return;
    const rotated = `${this.filePath}.1`;
    try {
      fs.rmSync(rotated, { force: true });
      fs.renameSync(this.filePath, rotated);
    } catch (e) {
      console.error("[telemetry] falha ao rotacionar log:", e);
    }
  }
}
