import { beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "../config.js";
import { JsonStore } from "../store/store.js";
import { indexCode } from "../index/code.js";
import { indexDocs } from "../index/docs.js";
import { findSymbol, searchCode, searchDocs } from "./search.js";

/**
 * Integração com o repo real — valida o critério de aceite da F1
 * (PROPOSAL-0003 §6): achar EffectKind/LauncherDef/ArenaRoom com linha+assinatura.
 * Usa um arquivo de cache dedicado para não colidir com `npm run aci -- index`.
 */
describe("aci · query/search (F1)", () => {
  const cfg = loadConfig();
  const store = new JsonStore(cfg.cacheAbs, "code.test.json");

  beforeAll(() => {
    indexCode(cfg, store, { force: true });
  });

  it("acha EffectKind (type, server/systems/effects.ts) com arquivo e linha", () => {
    const hits = findSymbol(store, "EffectKind");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].file).toBe("packages/server/src/systems/effects.ts");
    expect(hits[0].kind).toBe("type");
    expect(hits[0].line).toBeGreaterThan(0);
    expect(hits[0].exported).toBe(true);
  });

  it("acha LauncherDef (interface, shared/launchers.ts) exportada", () => {
    const hits = findSymbol(store, "LauncherDef");
    expect(
      hits.some(
        (h) => h.kind === "interface" && h.exported && h.file === "packages/shared/src/launchers.ts",
      ),
    ).toBe(true);
  });

  it("acha ArenaRoom (class, server/rooms/ArenaRoom.ts) por busca textual", () => {
    const hits = searchCode(store, "ArenaRoom");
    expect(
      hits.some(
        (h) => h.name === "ArenaRoom" && h.kind === "class" && h.file.endsWith("ArenaRoom.ts"),
      ),
    ).toBe(true);
  });

  it("busca por nome tem prioridade sobre busca por assinatura", () => {
    const hits = findSymbol(store, "arenaroom"); // case-insensitive
    expect(hits[0]?.name).toBe("ArenaRoom");
  });

  it("reindexação incremental pula arquivos sem alteração de hash", () => {
    const r1 = indexCode(cfg, store, {});
    expect(r1.metrics.filesParsed).toBe(0);
    expect(r1.metrics.filesSkipped).toBe(r1.metrics.filesTotal);
    expect(r1.metrics.symbolsIndexed).toBeGreaterThan(0);
  });

  it("query multi-termo é OR por palavra, não frase exata (regressão: query inteira não achava nada)", () => {
    const hits = searchCode(store, "ArenaRoom termoQueNaoExisteEmLugarNenhum12345");
    expect(hits.some((h) => h.name === "ArenaRoom")).toBe(true);
  });
});

/**
 * Integração com o repo real — valida o critério de aceite da F2
 * (PROPOSAL-0003 §6): "ADR sobre facing" e "spec de skills" acham a seção
 * certa (não o arquivo inteiro) via docs/DECISION_LOG.md e specs/SPEC-*.md.
 */
describe("aci · query/search — docs (F2)", () => {
  const cfg = loadConfig();
  const docsStore = new JsonStore(cfg.cacheAbs, "docs.test.json");

  beforeAll(() => {
    indexDocs(cfg, docsStore, { force: true });
  });

  it('acha "ADR sobre facing" na seção ADR-014 do DECISION_LOG', () => {
    const hits = searchDocs(docsStore, "facing");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.kind === "adr" && h.docId === "ADR-014")).toBe(true);
  });

  it('acha "spec de skills" na SPEC-0004', () => {
    const hits = searchDocs(docsStore, "skills", { kind: "spec" });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.docId === "SPEC-0004")).toBe(true);
  });

  it("busca por docId exato tem prioridade sobre heading/corpo", () => {
    const hits = searchDocs(docsStore, "ADR-014");
    expect(hits[0]?.docId).toBe("ADR-014");
  });

  it("filtro por kind restringe a apenas prompts/proposals/docs quando pedido", () => {
    const hits = searchDocs(docsStore, "T-019b", { kind: "prompt" });
    expect(hits.every((h) => h.kind === "prompt")).toBe(true);
  });

  it("reindexação incremental de docs pula arquivos sem alteração de hash", () => {
    const r1 = indexDocs(cfg, docsStore, {});
    expect(r1.metrics.filesParsed).toBe(0);
    expect(r1.metrics.filesSkipped).toBe(r1.metrics.filesTotal);
    expect(r1.metrics.sectionsIndexed).toBeGreaterThan(0);
  });

  it('regressão: "guest link auth" (multi-termo) acha SPEC-0008, mesmo sem a frase exata no texto', () => {
    const hits = searchDocs(docsStore, "guest link auth");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.docId === "SPEC-0008")).toBe(true);
  });

  it('regressão: "JWT RS256 guest jwks" acha SPEC-0008 via OR (rs256/jwks não estão no corpus, jwt/guest sim)', () => {
    const hits = searchDocs(docsStore, "JWT RS256 guest jwks");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.docId === "SPEC-0008")).toBe(true);
  });
});
