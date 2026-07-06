import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { relative, sep } from "node:path";
import * as ts from "typescript";
import type { AciConfig } from "../config.js";
import type { Store } from "../store/store.js";
import { resolveGlobs } from "../util/glob.js";

/**
 * Índice de código (F1).
 *
 * Usa o TypeScript Compiler API (`typescript`, já devDependency do pacote,
 * usada pelo próprio build) em vez de tree-sitter: mesmo resultado (parse
 * estrutural exato de .ts/.tsx) sem acrescentar dependência nativa/WASM nova,
 * mantendo a leveza que a F0 já escolheu (JsonStore em vez de better-sqlite3).
 * Ver PROPOSAL-0003 §4 (nota da F1).
 */
export type SymbolKind =
  | "function"
  | "class"
  | "interface"
  | "type"
  | "enum"
  | "const";

export interface CodeSymbol {
  name: string;
  kind: SymbolKind;
  /** Caminho relativo ao root do repo, separadores "/". */
  file: string;
  /** Linha 1-based. */
  line: number;
  /** Declaração até antes do corpo/valor — não o arquivo inteiro. */
  signature: string;
  exported: boolean;
}

function hasExportModifier(node: ts.Node): boolean {
  return (
    (ts.canHaveModifiers(node) &&
      ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) ??
    false
  );
}

function buildSignature(text: string, maxLen = 160): string {
  const braceIdx = text.indexOf("{");
  let sig = braceIdx >= 0 ? text.slice(0, braceIdx) : text;
  sig = sig.replace(/\s+/g, " ").trim();
  return sig.length > maxLen ? sig.slice(0, maxLen - 1) + "…" : sig;
}

/** Extrai símbolos de topo-de-arquivo (não desce em métodos/nested). */
export function extractSymbols(
  text: string,
  relPath: string,
  kinds: string[],
): CodeSymbol[] {
  const scriptKind = relPath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(relPath, text, ts.ScriptTarget.Latest, true, scriptKind);
  const want = new Set(kinds);
  const out: CodeSymbol[] = [];
  const lineOf = (pos: number) => sourceFile.getLineAndCharacterOfPosition(pos).line + 1;

  ts.forEachChild(sourceFile, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && want.has("function")) {
      out.push({
        name: node.name.text,
        kind: "function",
        file: relPath,
        line: lineOf(node.getStart(sourceFile)),
        signature: buildSignature(node.getText(sourceFile)),
        exported: hasExportModifier(node),
      });
    } else if (ts.isClassDeclaration(node) && node.name && want.has("class")) {
      out.push({
        name: node.name.text,
        kind: "class",
        file: relPath,
        line: lineOf(node.getStart(sourceFile)),
        signature: buildSignature(node.getText(sourceFile)),
        exported: hasExportModifier(node),
      });
    } else if (ts.isInterfaceDeclaration(node) && want.has("interface")) {
      out.push({
        name: node.name.text,
        kind: "interface",
        file: relPath,
        line: lineOf(node.getStart(sourceFile)),
        signature: buildSignature(node.getText(sourceFile)),
        exported: hasExportModifier(node),
      });
    } else if (ts.isTypeAliasDeclaration(node) && want.has("type")) {
      out.push({
        name: node.name.text,
        kind: "type",
        file: relPath,
        line: lineOf(node.getStart(sourceFile)),
        signature: buildSignature(node.getText(sourceFile)),
        exported: hasExportModifier(node),
      });
    } else if (ts.isEnumDeclaration(node) && want.has("enum")) {
      out.push({
        name: node.name.text,
        kind: "enum",
        file: relPath,
        line: lineOf(node.getStart(sourceFile)),
        signature: buildSignature(node.getText(sourceFile)),
        exported: hasExportModifier(node),
      });
    } else if (ts.isVariableStatement(node) && want.has("const")) {
      const isConst = (node.declarationList.flags & ts.NodeFlags.Const) !== 0;
      if (!isConst) return;
      const exported = hasExportModifier(node);
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue;
        const prefixText = (exported ? "export " : "") + "const " + decl.getText(sourceFile);
        out.push({
          name: decl.name.text,
          kind: "const",
          file: relPath,
          line: lineOf(decl.getStart(sourceFile)),
          signature: buildSignature(prefixText),
          exported,
        });
      }
    }
  });

  return out;
}

export interface IndexCodeMetrics {
  filesTotal: number;
  filesParsed: number;
  filesSkipped: number;
  symbolsIndexed: number;
  indexMs: number;
}

export interface IndexCodeResult {
  metrics: IndexCodeMetrics;
  symbols: CodeSymbol[];
}

interface FileCacheEntry {
  hash: string;
  symbols: CodeSymbol[];
}

const FILE_PREFIX = "code:file:";

function toRel(rootAbs: string, abs: string): string {
  return relative(rootAbs, abs).split(sep).join("/");
}

/** Indexa o código-fonte configurado, com cache incremental por hash de conteúdo. */
export function indexCode(
  cfg: AciConfig & { rootAbs: string },
  store: Store,
  opts: { force?: boolean } = {},
): IndexCodeResult {
  const start = Date.now();
  const { include = [], exclude = [], kinds = [] } = cfg.sources.code;
  const files = resolveGlobs(cfg.rootAbs, include, exclude);
  const currentRel = new Set(files.map((f) => toRel(cfg.rootAbs, f)));

  // limpa entradas de arquivos removidos/renomeados do corpus
  for (const key of store.keys(FILE_PREFIX)) {
    if (!currentRel.has(key.slice(FILE_PREFIX.length))) store.delete(key);
  }

  const allSymbols: CodeSymbol[] = [];
  let parsed = 0;
  let skipped = 0;

  for (const abs of files) {
    const relPath = toRel(cfg.rootAbs, abs);
    const text = readFileSync(abs, "utf8");
    const hash = createHash("sha1").update(text).digest("hex");
    const cacheKey = FILE_PREFIX + relPath;
    const cached = store.get<FileCacheEntry>(cacheKey);
    if (!opts.force && cached && cached.hash === hash) {
      allSymbols.push(...cached.symbols);
      skipped++;
      continue;
    }
    const symbols = extractSymbols(text, relPath, kinds);
    store.set(cacheKey, { hash, symbols } satisfies FileCacheEntry);
    allSymbols.push(...symbols);
    parsed++;
  }

  store.set("code:all", allSymbols);

  return {
    metrics: {
      filesTotal: files.length,
      filesParsed: parsed,
      filesSkipped: skipped,
      symbolsIndexed: allSymbols.length,
      indexMs: Date.now() - start,
    },
    symbols: allSymbols,
  };
}
