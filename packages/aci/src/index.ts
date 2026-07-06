/**
 * @aop/aci — AI Context Infrastructure.
 *
 * Camada isolada de indexação/busca de contexto para agentes de IA.
 * NÃO é importada por client/server/shared/bots — o jogo roda idêntico sem ela.
 * Ver docs/proposals/PROPOSAL-0003 e (a partir de F6) docs/ai/aci.md.
 */
export { loadConfig, type AciConfig } from "./config.js";
export { JsonStore, type Store } from "./store/store.js";
export { resolveGlobs } from "./util/glob.js";
export {
  estimateTokens,
  queryMetrics,
  Timer,
  type QueryMetrics,
} from "./metrics/metrics.js";
export {
  extractSymbols,
  indexCode,
  type CodeSymbol,
  type SymbolKind,
  type IndexCodeMetrics,
  type IndexCodeResult,
} from "./index/code.js";
export {
  extractDocSections,
  indexDocs,
  type DocSection,
  type DocKind,
  type IndexDocsMetrics,
  type IndexDocsResult,
} from "./index/docs.js";
export {
  findSymbol,
  searchCode,
  searchDocs,
  type SearchOptions,
  type DocSearchOptions,
} from "./query/search.js";
