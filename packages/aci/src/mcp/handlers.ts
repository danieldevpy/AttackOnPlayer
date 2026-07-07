import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "../config.js";
import { codeStore, docsStore } from "../store/stores.js";
import { Timer, queryMetrics, type QueryMetrics } from "../metrics/metrics.js";
import { indexCode, type CodeSymbol, type SymbolKind } from "../index/code.js";
import { indexDocs, type DocKind, type DocSection } from "../index/docs.js";
import { searchCode, searchDocs, findSymbol } from "../query/search.js";
import { relatedDocs, docsReferencing, isDocId } from "../graph/links.js";
import { summarize, type DocSummary } from "../summarize/summaries.js";

/**
 * Handlers puros do ACI (F5) — mesma lógica de cli.ts, mas devolvendo dados
 * estruturados em vez de imprimir no terminal. mcp/server.ts embrulha estes
 * handlers em tools MCP; cli.ts continua formatando pra terminal. Nenhuma
 * lógica de negócio nova aqui — só reorganização pra servir dois transportes.
 */

type Cfg = ReturnType<typeof loadConfig>;

const DOC_KINDS = new Set<string>(["doc", "spec", "adr", "prompt", "proposal"]);

function readFullFiles(cfg: Cfg, files: string[]): string {
  return files
    .map((f) => {
      try {
        return readFileSync(resolve(cfg.rootAbs, f), "utf8");
      } catch {
        return "";
      }
    })
    .join("\n");
}

export interface SearchResult {
  query: string;
  code: CodeSymbol[];
  docs: DocSection[];
  metrics: QueryMetrics;
}

export interface SearchOpts {
  kind?: string;
  limit?: number;
  cfg?: Cfg;
}

/** Busca símbolo (código) e/ou seção de doc/spec/ADR — mesmo contrato do `aci search` da CLI. */
export function searchTool(query: string, opts: SearchOpts = {}): SearchResult {
  const { kind, limit, cfg = loadConfig() } = opts;
  const isDocKind = kind ? DOC_KINDS.has(kind) : false;
  const codeKind = kind && !isDocKind ? (kind as SymbolKind) : undefined;
  const docKind = isDocKind ? (kind as DocKind) : undefined;

  const t = new Timer();
  const code = docKind ? [] : searchCode(codeStore(cfg), query, { kind: codeKind, limit });
  const docs = codeKind ? [] : searchDocs(docsStore(cfg), query, { kind: docKind, limit });
  const searchMs = t.ms();

  const returnedText = [...code.map((h) => h.signature), ...docs.map((h) => `${h.heading}\n${h.snippet}`)].join("\n");
  const uniqueFiles = [...new Set([...code.map((h) => h.file), ...docs.map((h) => h.file)])];
  const metrics = queryMetrics(query, searchMs, code.length + docs.length, returnedText, readFullFiles(cfg, uniqueFiles));

  return { query, code, docs, metrics };
}

export interface FindSymbolResult {
  name: string;
  symbols: CodeSymbol[];
}

/** Busca por nome de símbolo — exato > prefixo > substring. */
export function findSymbolTool(
  name: string,
  opts: { kind?: SymbolKind; limit?: number; cfg?: Cfg } = {},
): FindSymbolResult {
  const { kind, limit, cfg = loadConfig() } = opts;
  return { name, symbols: findSymbol(codeStore(cfg), name, { kind, limit }) };
}

export interface RelatedHit {
  section: DocSection;
  matchedSymbol: string;
}

export interface RelatedResult {
  target: string;
  hits: RelatedHit[];
  metrics: QueryMetrics;
}

/** "Quem governa X?" — símbolo/arquivo → docs que o mencionam, ou docId → docs que o referenciam. */
export function relatedTool(target: string, opts: { limit?: number; cfg?: Cfg } = {}): RelatedResult {
  const { limit, cfg = loadConfig() } = opts;
  const t = new Timer();
  const hits = isDocId(target)
    ? docsReferencing(docsStore(cfg), target, { limit }).map((section) => ({ section, matchedSymbol: target }))
    : relatedDocs(codeStore(cfg), docsStore(cfg), target, { limit });
  const searchMs = t.ms();

  const returnedText = hits.map((h) => `${h.section.heading}\n${h.section.snippet}`).join("\n");
  const uniqueFiles = [...new Set(hits.map((h) => h.section.file))];
  const metrics = queryMetrics(target, searchMs, hits.length, returnedText, readFullFiles(cfg, uniqueFiles));

  return { target, hits, metrics };
}

export interface SummaryResult {
  target: string;
  summary?: DocSummary;
  metrics?: QueryMetrics;
}

/** Resumo automático de spec/ADR/prompt/proposal/doc — antes de abrir o arquivo inteiro. */
export function summaryTool(target: string, cfg: Cfg = loadConfig()): SummaryResult {
  const t = new Timer();
  const doc = summarize(docsStore(cfg), target);
  const searchMs = t.ms();
  if (!doc) return { target };

  const returnedText = `${doc.title}\n${doc.snippet}`;
  const metrics = queryMetrics(target, searchMs, 1, returnedText, readFullFiles(cfg, [doc.file]));
  return { target, summary: doc, metrics };
}

export interface StatsResult {
  cacheDir: string;
  codeFilesIndexed: number;
  symbolsIndexed: number;
  docFilesIndexed: number;
  sectionsIndexed: number;
}

/** Estado do índice/cache. */
export function statsTool(cfg: Cfg = loadConfig()): StatsResult {
  const code = codeStore(cfg);
  const docs = docsStore(cfg);
  return {
    cacheDir: cfg.cacheDir,
    codeFilesIndexed: code.keys("code:file:").length,
    symbolsIndexed: (code.get<unknown[]>("code:all") ?? []).length,
    docFilesIndexed: docs.keys("docs:file:").length,
    sectionsIndexed: (docs.get<unknown[]>("docs:all") ?? []).length,
  };
}

export interface IndexResult {
  code: ReturnType<typeof indexCode>["metrics"];
  docs: ReturnType<typeof indexDocs>["metrics"];
}

/** Reindexa código + docs/specs/ADRs/prompts/proposals (cache incremental por hash; `force` ignora o cache). */
export function indexTool(force = false, cfg: Cfg = loadConfig()): IndexResult {
  const code = codeStore(cfg);
  const codeResult = indexCode(cfg, code, { force });
  code.flush();

  const docs = docsStore(cfg);
  const docsResult = indexDocs(cfg, docs, { force });
  docs.flush();

  return { code: codeResult.metrics, docs: docsResult.metrics };
}
