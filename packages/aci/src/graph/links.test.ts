import { beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "../config.js";
import { JsonStore } from "../store/store.js";
import { indexCode } from "../index/code.js";
import { indexDocs } from "../index/docs.js";
import type { CodeSymbol } from "../index/code.js";
import type { DocSection } from "../index/docs.js";
import { relatedDocs, docsReferencing, isDocId } from "./links.js";

describe("aci · graph/links (F3) — unidade (dados sintéticos)", () => {
  it("isDocId reconhece ADR/SPEC/PROMPT/PROPOSAL, não símbolos de código", () => {
    expect(isDocId("ADR-009")).toBe(true);
    expect(isDocId("SPEC-0004")).toBe(true);
    expect(isDocId("PROMPT-0028")).toBe(true);
    expect(isDocId("PROPOSAL-0003")).toBe(true);
    expect(isDocId("ProjectileSystem")).toBe(false);
  });

  function fixtureStores() {
    const codeStore = new JsonStore("/tmp/nao-usado-mem", "unused.json");
    const docsStore = new JsonStore("/tmp/nao-usado-mem", "unused2.json");
    const symbols: CodeSymbol[] = [
      { name: "Effect", kind: "type", file: "packages/shared/src/effect.ts", line: 1, signature: "export type Effect", exported: true },
    ];
    const sections: DocSection[] = [
      { id: "docs/DECISION_LOG.md#1", kind: "adr", docId: "ADR-011", file: "docs/DECISION_LOG.md", heading: "ADR-011 — Lançadores", level: 2, line: 56, snippet: "Servidor simula projéteis (`ProjectileSystem`)." },
      { id: "specs/SPEC-0004-x.md#1", kind: "spec", docId: "SPEC-0004", file: "specs/SPEC-0004-x.md", heading: "Comportamento esperado", level: 2, line: 10, snippet: "testes de `ProjectileSystem`." },
      { id: "docs/mechanics/combat.md#1", kind: "doc", file: "docs/mechanics/combat.md", heading: "Combate", level: 1, line: 1, snippet: "EffectSystem calcula os atributos — sem menção à palavra isolada aqui." },
    ];
    codeStore.set("code:all", symbols);
    docsStore.set("docs:all", sections);
    return { codeStore, docsStore };
  }

  it('"quem governa ProjectileSystem?" acha ADR e spec que o mencionam, ADR primeiro', () => {
    const { codeStore, docsStore } = fixtureStores();
    const hits = relatedDocs(codeStore, docsStore, "ProjectileSystem");
    expect(hits.map((h) => h.section.docId)).toEqual(["ADR-011", "SPEC-0004"]);
  });

  it('busca por "Effect" não casa dentro de "EffectSystem" (word boundary)', () => {
    const { codeStore, docsStore } = fixtureStores();
    const hits = relatedDocs(codeStore, docsStore, "Effect");
    expect(hits).toEqual([]);
  });

  it("caminho de arquivo resolve para os símbolos exportados daquele arquivo", () => {
    const { codeStore, docsStore } = fixtureStores();
    // "Effect" é o único símbolo de effect.ts; nenhuma seção da fixture o menciona isolado.
    const hits = relatedDocs(codeStore, docsStore, "packages/shared/src/effect.ts");
    expect(hits).toEqual([]);
  });

  it("aresta doc↔doc: docsReferencing acha seções que citam um docId, exceto ele mesmo", () => {
    const { docsStore } = fixtureStores();
    docsStore.set("docs:all", [
      ...(docsStore.get<DocSection[]>("docs:all") ?? []),
      { id: "docs/prompts/PROMPT-0028.md#1", kind: "prompt", docId: "PROMPT-0028", file: "docs/prompts/PROMPT-0028.md", heading: "Pedido", level: 2, line: 3, snippet: "Ver ADR-011 para o contrato de lançadores." },
    ]);
    const hits = docsReferencing(docsStore, "ADR-011");
    expect(hits.some((h) => h.docId === "PROMPT-0028")).toBe(true);
    expect(hits.every((h) => h.docId !== "ADR-011")).toBe(true);
  });
});

/**
 * Integração com o repo real — confirma o mesmo critério de aceite contra o
 * corpus de verdade (não só a fixture sintética acima).
 */
describe("aci · graph/links (F3) — integração com o repo real", () => {
  const cfg = loadConfig();
  const codeStore = new JsonStore(cfg.cacheAbs, "links.code.test.json");
  const docsStore = new JsonStore(cfg.cacheAbs, "links.docs.test.json");

  beforeAll(() => {
    indexCode(cfg, codeStore, { force: true });
    indexDocs(cfg, docsStore, { force: true });
  });

  it('"quem governa ProjectileSystem?" acha ADR-011 e SPEC-0004 no repo real', () => {
    const hits = relatedDocs(codeStore, docsStore, "ProjectileSystem");
    expect(hits.some((h) => h.section.kind === "adr" && h.section.docId === "ADR-011")).toBe(true);
    expect(hits.some((h) => h.section.kind === "spec" && h.section.docId === "SPEC-0004")).toBe(true);
    expect(hits[0].section.kind).toBe("adr");
  });

  it("docsReferencing acha seções reais que citam ADR-009", () => {
    const hits = docsReferencing(docsStore, "ADR-009");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((s) => s.docId !== "ADR-009")).toBe(true);
  });
});
