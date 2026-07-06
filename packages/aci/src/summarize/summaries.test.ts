import { beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "../config.js";
import { JsonStore } from "../store/store.js";
import { indexDocs } from "../index/docs.js";
import { summarize } from "./summaries.js";

describe("aci · summarize (F3) — integração com o repo real", () => {
  const cfg = loadConfig();
  const store = new JsonStore(cfg.cacheAbs, "summaries.test.json");

  beforeAll(() => {
    indexDocs(cfg, store, { force: true });
  });

  it("resume uma spec pela seção de nível 1 (título + metadados), não o arquivo inteiro", () => {
    const s = summarize(store, "SPEC-0004");
    expect(s).toBeDefined();
    expect(s!.kind).toBe("spec");
    expect(s!.file).toBe("specs/SPEC-0004-skills-atributos-escala.md");
    expect(s!.title).toContain("SPEC-0004");
  });

  it("resume um ADR pela própria seção (já é o resumo)", () => {
    const s = summarize(store, "ADR-014");
    expect(s).toBeDefined();
    expect(s!.kind).toBe("adr");
    expect(s!.docId).toBe("ADR-014");
    expect(s!.title).toContain("facing por movimento");
    expect(s!.snippet).toContain("XP passivo");
  });

  it("resume um doc genérico por caminho de arquivo (sem docId)", () => {
    const s = summarize(store, "AGENTS.md");
    expect(s).toBeDefined();
    expect(s!.kind).toBe("doc");
    expect(s!.docId).toBeUndefined();
  });

  it("é case-insensitive na busca por docId", () => {
    expect(summarize(store, "spec-0004")?.docId).toBe("SPEC-0004");
  });

  it("retorna undefined para alvo desconhecido", () => {
    expect(summarize(store, "SPEC-9999")).toBeUndefined();
  });
});
