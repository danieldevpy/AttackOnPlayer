import type { Store } from "../store/store.js";
import type { CodeSymbol, SymbolKind } from "../index/code.js";
import type { DocKind, DocSection } from "../index/docs.js";

export interface SearchOptions {
  kind?: SymbolKind;
  limit?: number;
}

export interface DocSearchOptions {
  kind?: DocKind;
  limit?: number;
}

/** Divide a query em palavras (só por espaço) — mantém identificadores com hífen/número intactos (ex.: "ADR-014", "RS256"). */
function tokenize(query: string): string[] {
  return query
    .split(/\s+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

function loadAllSymbols(store: Store): CodeSymbol[] {
  return store.get<CodeSymbol[]>("code:all") ?? [];
}

/** Busca por nome de símbolo — exato > prefixo > substring (case-insensitive). */
export function findSymbol(
  store: Store,
  name: string,
  opts: SearchOptions = {},
): CodeSymbol[] {
  const all = loadAllSymbols(store).filter((s) => !opts.kind || s.kind === opts.kind);
  const needle = name.toLowerCase();
  const exact: CodeSymbol[] = [];
  const prefix: CodeSymbol[] = [];
  const substring: CodeSymbol[] = [];
  for (const s of all) {
    const hay = s.name.toLowerCase();
    if (hay === needle) exact.push(s);
    else if (hay.startsWith(needle)) prefix.push(s);
    else if (hay.includes(needle)) substring.push(s);
  }
  const out = [...exact, ...prefix, ...substring];
  return opts.limit ? out.slice(0, opts.limit) : out;
}

/**
 * Busca textual (nome + assinatura) — "achar por palavra-chave". A query é
 * tokenizada por espaço (cada palavra vira um termo OR, não uma frase exata):
 * "guest link auth" acha símbolos que mencionem QUALQUER um dos termos,
 * pontuados por quantos/quais termos batem — não exige a frase inteira.
 */
export function searchCode(
  store: Store,
  query: string,
  opts: SearchOptions = {},
): CodeSymbol[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const all = loadAllSymbols(store).filter((s) => !opts.kind || s.kind === opts.kind);
  const scored: { symbol: CodeSymbol; score: number }[] = [];
  for (const s of all) {
    const name = s.name.toLowerCase();
    const sig = s.signature.toLowerCase();
    let score = 0;
    for (const t of tokens) {
      if (name.includes(t)) score += 2;
      else if (sig.includes(t)) score += 1;
    }
    if (score > 0) scored.push({ symbol: s, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const limit = opts.limit ?? 20;
  return scored.slice(0, limit).map((x) => x.symbol);
}

function loadAllDocSections(store: Store): DocSection[] {
  return store.get<DocSection[]>("docs:all") ?? [];
}

const DOC_KIND_PRIORITY: Record<DocKind, number> = {
  adr: 0,
  spec: 1,
  prompt: 2,
  proposal: 3,
  doc: 4,
};

/**
 * Busca textual sobre o corpus de documentação (docs/specs/ADRs/prompts/proposals).
 * A query é tokenizada por espaço — cada palavra é um termo OR pontuado (docId
 * > heading > corpo da seção), não uma frase exata: "guest link auth" acha
 * seções que mencionem qualquer um dos termos, rankeadas por quantos/onde
 * batem. Consultas de 1 termo (ex.: "facing", "ADR-014") continuam se
 * comportando como antes.
 */
export function searchDocs(
  store: Store,
  query: string,
  opts: DocSearchOptions = {},
): DocSection[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const all = loadAllDocSections(store).filter((s) => !opts.kind || s.kind === opts.kind);
  const scored: { section: DocSection; score: number }[] = [];
  for (const s of all) {
    const docId = s.docId?.toLowerCase();
    const heading = s.heading.toLowerCase();
    const snippet = s.snippet.toLowerCase();
    let score = 0;
    for (const t of tokens) {
      if (docId && docId.includes(t)) score += 3;
      else if (heading.includes(t)) score += 2;
      else if (snippet.includes(t)) score += 1;
    }
    if (score > 0) scored.push({ section: s, score });
  }
  scored.sort((a, b) => b.score - a.score || DOC_KIND_PRIORITY[a.section.kind] - DOC_KIND_PRIORITY[b.section.kind]);
  const limit = opts.limit ?? 20;
  return scored.slice(0, limit).map((x) => x.section);
}
