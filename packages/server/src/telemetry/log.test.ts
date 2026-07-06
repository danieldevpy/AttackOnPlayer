import { describe, expect, it, afterEach } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { TelemetryLog } from "./log";
import { TELEMETRY_SCHEMA_VERSION } from "./events";

function tmpDir(): string {
  return mkdtempSync(join(tmpdir(), "aop-telemetry-"));
}

describe("TelemetryLog (T-026)", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it("grava eventos em NDJSON — 1 linha por evento, na ordem", () => {
    const dir = tmpDir();
    dirs.push(dir);
    const log = new TelemetryLog("match-1", dir);
    log.write({ v: TELEMETRY_SCHEMA_VERSION, ts: 1, tick: 0, matchId: "match-1", type: "match_start", mapW: 10, mapH: 10, mapSeed: 42 });
    log.write({ v: TELEMETRY_SCHEMA_VERSION, ts: 2, tick: 1, matchId: "match-1", type: "match_end", durationS: 1, playerCount: 2 });

    const raw = readFileSync(join(dir, "match-1.ndjson"), "utf-8").trim().split("\n");
    expect(raw.length).toBe(2);
    expect(JSON.parse(raw[0]).type).toBe("match_start");
    expect(JSON.parse(raw[1]).type).toBe("match_end");
  });

  it("cria o diretório se não existir", () => {
    const dir = join(tmpDir(), "nested", "telemetry");
    dirs.push(join(tmpDir())); // best-effort cleanup do pai (mkdtemp já cria um dir vazio de qualquer forma)
    const log = new TelemetryLog("match-2", dir);
    log.write({ v: TELEMETRY_SCHEMA_VERSION, ts: 1, tick: 0, matchId: "match-2", type: "match_start", mapW: 5, mapH: 5, mapSeed: 1 });
    expect(existsSync(join(dir, "match-2.ndjson"))).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it("nunca lança mesmo se o append falhar (ex.: caminho inválido)", () => {
    const log = new TelemetryLog("match-3", "/dev/null/impossivel");
    expect(() =>
      log.write({ v: TELEMETRY_SCHEMA_VERSION, ts: 1, tick: 0, matchId: "match-3", type: "match_start", mapW: 1, mapH: 1, mapSeed: 0 })
    ).not.toThrow();
  });

  it("rotaciona pra .1 quando o arquivo passa do teto (injetável via monkeypatch de tamanho)", () => {
    const dir = tmpDir();
    dirs.push(dir);
    const filePath = join(dir, "match-4.ndjson");
    // pré-popula um arquivo "grande o suficiente" simulando uma sessão de teste anormalmente longa
    writeFileSync(filePath, "x".repeat(6 * 1024 * 1024));
    const log = new TelemetryLog("match-4", dir);
    log.write({ v: TELEMETRY_SCHEMA_VERSION, ts: 1, tick: 0, matchId: "match-4", type: "match_start", mapW: 1, mapH: 1, mapSeed: 0 });

    expect(existsSync(`${filePath}.1`)).toBe(true); // arquivo antigo (grande) foi deslocado
    const newContent = readFileSync(filePath, "utf-8").trim().split("\n");
    expect(newContent.length).toBe(1); // arquivo novo só tem o evento recém-gravado
  });
});
