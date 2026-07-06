import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { relative, sep } from "node:path";
import type { AciConfig } from "../config.js";
import type { Store } from "../store/store.js";
import { resolveGlobs } from "../util/glob.js";

/**
 * Índice de documentação/corpus (F2).
 *
 * Mesma filosofia da F1 (código): trechos cirúrgicos, não arquivos inteiros.
 * Em vez de símbolos, a unidade é a **seção de heading** — cada `#`..`######`
 * fecha a seção anterior e abre uma nova. Isso já isola cada ADR do
 * DECISION_LOG.md (um `## ADR-NNN` por seção) sem regra especial de parsing;
 * só a classificação de `kind`/`docId` por arquivo muda por tipo de corpus.
 */
export type DocKind = "doc" | "spec" | "adr" | "prompt" | "proposal";

export interface DocSection {
  /** Chave única: `${file}#${line}`. */
  id: string;
  kind: DocKind;
  /** Identificador do documento (ex.: "SPEC-0008", "ADR-014", "PROMPT-0028"). Ausente para docs genéricos. */
  docId?: string;
  /** Caminho relativo ao root do repo, separadores "/". */
  file: string;
  /** Texto do heading (sem os `#`). */
  heading: string;
  /** Nível do heading (1-6). */
  level: number;
  /** Linha 1-based do heading. */
  line: number;
  /** Corpo da seção, truncado ao orçamento de tokens configurado. */
  snippet: string;
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;

function classifyDocFile(relPath: string): DocKind {
  if (relPath === "docs/DECISION_LOG.md") return "adr";
  if (/^specs\/SPEC-\d+.*\.md$/.test(relPath)) return "spec";
  if (/^docs\/prompts\/PROMPT-\d+.*\.md$/.test(relPath)) return "prompt";
  if (/^docs\/proposals\/PROPOSAL-\d+.*\.md$/.test(relPath)) return "proposal";
  return "doc";
}

/** docId ao nível do arquivo (specs/prompts/proposals) — undefined para doc/adr (adr é por seção). */
function fileDocId(relPath: string, kind: DocKind): string | undefined {
  const base = relPath.slice(relPath.lastIndexOf("/") + 1);
  if (kind === "spec") return base.match(/^(SPEC-\d+)/)?.[1];
  if (kind === "prompt") return base.match(/^(PROMPT-\d+)/)?.[1];
  if (kind === "proposal") return base.match(/^(PROPOSAL-\d+)/)?.[1];
  return undefined;
}

function truncate(text: string, maxChars: number): string {
  const clean = text.trim().replace(/\n{3,}/g, "\n\n");
  return clean.length > maxChars ? clean.slice(0, maxChars - 1) + "…" : clean;
}

/** Extrai seções por heading de um markdown. Não desce em sub-seções — flat, cada heading fecha a anterior. */
export function extractDocSections(
  text: string,
  relPath: string,
  opts: { snippetMaxChars?: number } = {},
): DocSection[] {
  const kind = classifyDocFile(relPath);
  const maxChars = opts.snippetMaxChars ?? 480;
  const lines = text.split("\n");
  const out: DocSection[] = [];

  let current: { heading: string; level: number; line: number; body: string[] } | null = null;
  const close = () => {
    if (!current) return;
    const snippet = truncate(current.body.join("\n"), maxChars);
    const docId =
      kind === "adr"
        ? current.heading.match(/(ADR-\d+)/)?.[1]
        : fileDocId(relPath, kind);
    out.push({
      id: `${relPath}#${current.line}`,
      kind,
      docId,
      file: relPath,
      heading: current.heading,
      level: current.level,
      line: current.line,
      snippet,
    });
  };

  lines.forEach((raw, idx) => {
    const m = raw.match(HEADING_RE);
    if (m) {
      close();
      current = { heading: m[2], level: m[1].length, line: idx + 1, body: [] };
    } else if (current) {
      current.body.push(raw);
    }
  });
  close();

  return out;
}

export interface IndexDocsMetrics {
  filesTotal: number;
  filesParsed: number;
  filesSkipped: number;
  sectionsIndexed: number;
  indexMs: number;
}

export interface IndexDocsResult {
  metrics: IndexDocsMetrics;
  sections: DocSection[];
}

interface FileCacheEntry {
  hash: string;
  sections: DocSection[];
}

const FILE_PREFIX = "docs:file:";

function toRel(rootAbs: string, abs: string): string {
  return relative(rootAbs, abs).split(sep).join("/");
}

/** Resolve o corpus de docs configurado: docs (inclui AGENTS.md/instrucoes/ROADMAP/BACKLOG), specs, prompts, proposals. */
function resolveDocFiles(cfg: AciConfig & { rootAbs: string }): string[] {
  const { docs, specs, prompts, proposals } = cfg.sources;
  const groups = [docs, specs, prompts, proposals].filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const g of groups) {
    for (const abs of resolveGlobs(cfg.rootAbs, g.include ?? [], g.exclude ?? [])) {
      if (seen.has(abs)) continue;
      seen.add(abs);
      out.push(abs);
    }
  }
  return out.sort();
}

/** Indexa o corpus de documentação configurado, com cache incremental por hash de conteúdo. */
export function indexDocs(
  cfg: AciConfig & { rootAbs: string },
  store: Store,
  opts: { force?: boolean } = {},
): IndexDocsResult {
  const start = Date.now();
  const files = resolveDocFiles(cfg);
  const currentRel = new Set(files.map((f) => toRel(cfg.rootAbs, f)));
  const snippetMaxChars = (cfg.budget?.summaryMaxTokens ?? 120) * 4;

  for (const key of store.keys(FILE_PREFIX)) {
    if (!currentRel.has(key.slice(FILE_PREFIX.length))) store.delete(key);
  }

  const allSections: DocSection[] = [];
  let parsed = 0;
  let skipped = 0;

  for (const abs of files) {
    const relPath = toRel(cfg.rootAbs, abs);
    const text = readFileSync(abs, "utf8");
    const hash = createHash("sha1").update(text).digest("hex");
    const cacheKey = FILE_PREFIX + relPath;
    const cached = store.get<FileCacheEntry>(cacheKey);
    if (!opts.force && cached && cached.hash === hash) {
      allSections.push(...cached.sections);
      skipped++;
      continue;
    }
    const sections = extractDocSections(text, relPath, { snippetMaxChars });
    store.set(cacheKey, { hash, sections } satisfies FileCacheEntry);
    allSections.push(...sections);
    parsed++;
  }

  store.set("docs:all", allSections);

  return {
    metrics: {
      filesTotal: files.length,
      filesParsed: parsed,
      filesSkipped: skipped,
      sectionsIndexed: allSections.length,
      indexMs: Date.now() - start,
    },
    sections: allSections,
  };
}
