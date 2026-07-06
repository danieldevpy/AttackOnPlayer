import { describe, expect, it } from "vitest";
import { extractDocSections } from "./docs.js";

const SPEC_SAMPLE = `# SPEC-0004 — Skills e atributos

**Status:** aprovada · **Data:** 2026-07-04

## Problema / objetivo
Skills de projétil precisam ser data-driven.

## Comportamento esperado
Multishot, spread e pierce configuráveis por launcher.
`;

const ADR_SAMPLE = `# Decision Log (ADRs)

Formato: contexto → decisão → consequência.

## ADR-014 — Presença viva, facing por movimento (SPEC-0005)
Facing deriva do movimento (WASD), não do mouse.

## ADR-002 — Servidor autoritativo
Cliente nunca decide resultado.
`;

const PROMPT_SAMPLE = `# PROMPT-0028 — T-019b: perfis keyboard/touch

## Pedido (resumo fiel do CD)
Continuação da execução autônoma.
`;

describe("aci · index/docs (F2)", () => {
  it("classifica specs pelo caminho e extrai docId do nome do arquivo", () => {
    const sections = extractDocSections(SPEC_SAMPLE, "specs/SPEC-0004-skills-atributos-escala.md");
    expect(sections.every((s) => s.kind === "spec")).toBe(true);
    expect(sections.every((s) => s.docId === "SPEC-0004")).toBe(true);
  });

  it("cada heading vira uma seção com corpo isolado (não o arquivo inteiro)", () => {
    const sections = extractDocSections(SPEC_SAMPLE, "specs/SPEC-0004-skills-atributos-escala.md");
    const byHeading = Object.fromEntries(sections.map((s) => [s.heading, s]));
    expect(byHeading["Problema / objetivo"].snippet).toContain("data-driven");
    expect(byHeading["Problema / objetivo"].snippet).not.toContain("Multishot");
    expect(byHeading["Comportamento esperado"].snippet).toContain("Multishot");
  });

  it("classifica docs/DECISION_LOG.md como adr, um docId por seção (não por arquivo)", () => {
    const sections = extractDocSections(ADR_SAMPLE, "docs/DECISION_LOG.md");
    expect(sections.every((s) => s.kind === "adr")).toBe(true);
    const byDocId = Object.fromEntries(sections.map((s) => [s.docId, s]));
    expect(byDocId["ADR-014"].heading).toContain("facing por movimento");
    expect(byDocId["ADR-014"].snippet).toContain("WASD");
    expect(byDocId["ADR-002"].snippet).toContain("decide resultado");
  });

  it("classifica prompts pelo caminho docs/prompts/PROMPT-NNNN.md", () => {
    const sections = extractDocSections(PROMPT_SAMPLE, "docs/prompts/PROMPT-0028.md");
    expect(sections.every((s) => s.kind === "prompt")).toBe(true);
    expect(sections.every((s) => s.docId === "PROMPT-0028")).toBe(true);
  });

  it("trata arquivo fora dos padrões conhecidos como doc genérico, sem docId", () => {
    const sections = extractDocSections("# AGENTS.md\n\n## Papéis\nConteúdo.\n", "AGENTS.md");
    expect(sections.every((s) => s.kind === "doc")).toBe(true);
    expect(sections.every((s) => s.docId === undefined)).toBe(true);
  });

  it("linha do heading é 1-based e corresponde à posição real no texto", () => {
    const sections = extractDocSections(SPEC_SAMPLE, "specs/SPEC-0004-skills-atributos-escala.md");
    const expected = SPEC_SAMPLE.split("\n").findIndex((l) => l.startsWith("## Comportamento esperado")) + 1;
    const s = sections.find((x) => x.heading === "Comportamento esperado");
    expect(s?.line).toBe(expected);
  });

  it("trunca snippets muito longos respeitando o orçamento de chars", () => {
    const long = `# Doc\n\n## Seção\n${"a".repeat(1000)}\n`;
    const sections = extractDocSections(long, "docs/x.md", { snippetMaxChars: 50 });
    const s = sections.find((x) => x.heading === "Seção")!;
    expect(s.snippet.length).toBeLessThanOrEqual(50);
    expect(s.snippet.endsWith("…")).toBe(true);
  });
});
