import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { estimateTokens, queryMetrics } from "./metrics/metrics.js";
import { resolveGlobs } from "./util/glob.js";
import { loadConfig } from "./config.js";

describe("aci · fundação F0", () => {
  it("config carrega e resolve o root do repo", () => {
    const cfg = loadConfig();
    expect(cfg.version).toBe(1);
    // Não assume o nome literal da pasta do checkout — o repo pode viver em
    // qualquer diretório (ex.: worktrees isolados como .claude/worktrees/aci).
    // Confirma-se o root real pela presença de arquivos do próprio monorepo.
    expect(existsSync(resolve(cfg.rootAbs, "AGENTS.md"))).toBe(true);
    expect(existsSync(resolve(cfg.rootAbs, "packages/aci/package.json"))).toBe(true);
    expect(cfg.budget.defaultMaxTokens).toBeGreaterThan(0);
  });

  it("estima tokens ~4 chars/token", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("a".repeat(400))).toBe(100);
  });

  it("calcula economia de tokens vs arquivo inteiro", () => {
    const m = queryMetrics("q", 3, 1, "a".repeat(100), "a".repeat(1000));
    expect(m.savedPct).toBe(90);
    expect(m.savedTokens).toBe(225);
    expect(m.hits).toBe(1);
  });

  it("glob encontra os fontes .ts do próprio pacote aci", () => {
    const cfg = loadConfig();
    const files = resolveGlobs(cfg.rootAbs, ["packages/aci/src/**/*.ts"], ["**/*.test.ts"]);
    expect(files.length).toBeGreaterThan(3);
    expect(files.every((f) => f.endsWith(".ts"))).toBe(true);
    expect(files.some((f) => f.endsWith("cli.ts"))).toBe(true);
  });

  it("NÃO indexa arquivos de teste quando excluídos", () => {
    const cfg = loadConfig();
    const files = resolveGlobs(cfg.rootAbs, ["packages/aci/src/**/*.ts"], ["**/*.test.ts"]);
    expect(files.some((f) => f.endsWith(".test.ts"))).toBe(false);
  });
});
