import type { Store } from "../store/store.js";
import type { CodeSymbol, SymbolKind } from "../index/code.js";

export interface SearchOptions {
  kind?: SymbolKind;
  limit?: number;
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

/** Busca textual (nome + assinatura) — o caso "achar por palavra-chave". */
export function searchCode(
  store: Store,
  query: string,
  opts: SearchOptions = {},
): CodeSymbol[] {
  const q = query.toLowerCase();
  const all = loadAllSymbols(store).filter((s) => !opts.kind || s.kind === opts.kind);
  const nameHits: CodeSymbol[] = [];
  const sigHits: CodeSymbol[] = [];
  for (const s of all) {
    if (s.name.toLowerCase().includes(q)) nameHits.push(s);
    else if (s.signature.toLowerCase().includes(q)) sigHits.push(s);
  }
  const limit = opts.limit ?? 20;
  return [...nameHits, ...sigHits].slice(0, limit);
}
