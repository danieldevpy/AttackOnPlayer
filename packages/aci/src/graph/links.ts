import type { Store } from "../store/store.js";
import type { CodeSymbol } from "../index/code.js";
import type { DocSection } from "../index/docs.js";

/**
 * Grafo de relações (F3) — arestas doc↔código↔spec↔ADR.
 *
 * Mesma filosofia lexical/estrutural do resto do ACI (nada semântico): uma
 * aresta existe quando um identificador de código (nome de símbolo) ou um
 * docId (ADR-NNN/SPEC-NNNN/...) aparece como palavra isolada no texto de uma
 * seção de doc já indexada pela F2. Suficiente para "quem governa X?" neste
 * corpus, onde toda referência cruzada é feita por nome/crase em prosa.
 */
export interface RelatedDoc {
  section: DocSection;
  matchedSymbol: string;
}

const KIND_PRIORITY: Record<DocSection["kind"], number> = {
  adr: 0,
  spec: 1,
  prompt: 2,
  proposal: 3,
  doc: 4,
};

const DOC_ID_RE = /^(ADR|SPEC|PROMPT|PROPOSAL)-\d+$/i;

/** true se `symbolOrFile` já é um docId (ADR-NNN/SPEC-NNNN/...) em vez de um símbolo/arquivo de código. */
export function isDocId(value: string): boolean {
  return DOC_ID_RE.test(value);
}

function loadCodeSymbols(store: Store): CodeSymbol[] {
  return store.get<CodeSymbol[]>("code:all") ?? [];
}

function loadDocSections(store: Store): DocSection[] {
  return store.get<DocSection[]>("docs:all") ?? [];
}

/** Escapa regex e casa `name` como identificador isolado (evita "Foo" casar dentro de "FooBar"). */
function mentions(haystack: string, name: string): boolean {
  if (!name) return false;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![A-Za-z0-9_])${escaped}(?![A-Za-z0-9_])`).test(haystack);
}

/** Símbolo isolado → ele mesmo; caminho de arquivo → todos os símbolos exportados daquele arquivo. */
function resolveSymbolNames(codeStore: Store, symbolOrFile: string): string[] {
  if (!symbolOrFile.includes("/") && !symbolOrFile.endsWith(".ts") && !symbolOrFile.endsWith(".tsx")) {
    return [symbolOrFile];
  }
  const symbols = loadCodeSymbols(codeStore);
  const names = symbols
    .filter((s) => s.file === symbolOrFile || s.file.endsWith("/" + symbolOrFile))
    .map((s) => s.name);
  return [...new Set(names)];
}

/**
 * Dado um símbolo de código ou caminho de arquivo, acha as seções de doc
 * (ADRs/specs/prompts/proposals/docs) que o mencionam — "quem governa
 * ProjectileSystem?" → ADR-011, ADR-013, ADR-014, SPEC-0003..0005.
 * Ranking: ADR > spec > prompt > proposal > doc genérico.
 */
export function relatedDocs(
  codeStore: Store,
  docsStore: Store,
  symbolOrFile: string,
  opts: { limit?: number } = {},
): RelatedDoc[] {
  const names = resolveSymbolNames(codeStore, symbolOrFile);
  const sections = loadDocSections(docsStore);
  const out: RelatedDoc[] = [];
  for (const section of sections) {
    const haystack = `${section.heading}\n${section.snippet}`;
    const hit = names.find((name) => mentions(haystack, name));
    if (hit) out.push({ section, matchedSymbol: hit });
  }
  out.sort((a, b) => KIND_PRIORITY[a.section.kind] - KIND_PRIORITY[b.section.kind]);
  return out.slice(0, opts.limit ?? 20);
}

/** Aresta doc↔doc: quais seções mencionam um docId (ex.: "ADR-009", "SPEC-0004"), exceto ele mesmo. */
export function docsReferencing(
  docsStore: Store,
  docId: string,
  opts: { limit?: number } = {},
): DocSection[] {
  const sections = loadDocSections(docsStore);
  const out = sections.filter((s) => {
    if (s.docId?.toLowerCase() === docId.toLowerCase()) return false;
    return mentions(`${s.heading}\n${s.snippet}`, docId);
  });
  out.sort((a, b) => KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind]);
  return out.slice(0, opts.limit ?? 20);
}
