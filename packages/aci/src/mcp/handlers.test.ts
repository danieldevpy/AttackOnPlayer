import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "../config.js";
import {
  searchTool,
  findSymbolTool,
  relatedTool,
  summaryTool,
  statsTool,
  indexTool,
} from "./handlers.js";

/**
 * Handlers do servidor MCP (F5) — mesma cobertura de contrato que query/search.test.ts
 * e graph/links.test.ts, agora validando a camada que mcp/server.ts embrulha em tools.
 * Cache isolado (dir temporário) pra não colidir com `npm run aci -- index`.
 */
describe("aci · mcp/handlers (F5)", () => {
  const cacheDir = mkdtempSync(join(tmpdir(), "aci-mcp-test-"));
  const cfg = { ...loadConfig(), cacheAbs: cacheDir };

  beforeAll(() => {
    indexTool(true, cfg);
  });

  afterAll(() => {
    rmSync(cacheDir, { recursive: true, force: true });
  });

  it("searchTool acha EffectKind no código com métricas de economia", () => {
    const r = searchTool("EffectKind", { cfg });
    expect(r.code.some((h) => h.name === "EffectKind" && h.file.endsWith("effects.ts"))).toBe(true);
    expect(r.metrics.savedPct).toBeGreaterThan(0);
  });

  it("searchTool respeita --kind e limit", () => {
    const r = searchTool("skills", { kind: "spec", limit: 3, cfg });
    expect(r.code.length).toBe(0);
    expect(r.docs.length).toBeLessThanOrEqual(3);
    expect(r.docs.every((h) => h.kind === "spec")).toBe(true);
  });

  it("findSymbolTool acha ArenaRoom por nome exato", () => {
    const r = findSymbolTool("ArenaRoom", { cfg });
    expect(r.symbols.some((s) => s.kind === "class" && s.file.endsWith("ArenaRoom.ts"))).toBe(true);
  });

  it("relatedTool acha ADRs/specs que mencionam ProjectileSystem", () => {
    const r = relatedTool("ProjectileSystem", { cfg });
    expect(r.hits.some((h) => h.section.docId === "ADR-011")).toBe(true);
  });

  it("relatedTool por docId acha docs que referenciam ADR-009", () => {
    const r = relatedTool("ADR-009", { cfg });
    expect(r.hits.length).toBeGreaterThan(0);
    expect(r.hits.every((h) => h.section.docId !== "ADR-009")).toBe(true);
  });

  it("summaryTool resume ADR-018 (o próprio ACI)", () => {
    const r = summaryTool("ADR-018", cfg);
    expect(r.summary?.kind).toBe("adr");
    expect(r.summary?.snippet).toContain("packages/aci");
  });

  it("summaryTool devolve undefined pra alvo inexistente", () => {
    const r = summaryTool("NAO-EXISTE-9999", cfg);
    expect(r.summary).toBeUndefined();
    expect(r.metrics).toBeUndefined();
  });

  it("statsTool reflete o índice recém-construído", () => {
    const s = statsTool(cfg);
    expect(s.symbolsIndexed).toBeGreaterThan(0);
    expect(s.sectionsIndexed).toBeGreaterThan(0);
  });

  it("indexTool com force reparseia tudo; sem force pula pelo cache", () => {
    const forced = indexTool(true, cfg);
    expect(forced.code.filesSkipped).toBe(0);
    expect(forced.docs.filesSkipped).toBe(0);

    const cached = indexTool(false, cfg);
    expect(cached.code.filesParsed).toBe(0);
    expect(cached.docs.filesParsed).toBe(0);
  });
});
