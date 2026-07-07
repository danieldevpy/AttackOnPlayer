#!/usr/bin/env tsx
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { loadConfig } from "./config.js";
import { JsonStore } from "./store/store.js";
import { resolveGlobs } from "./util/glob.js";
import { Timer, queryMetrics } from "./metrics/metrics.js";
import { indexCode, type SymbolKind } from "./index/code.js";
import { indexDocs, type DocKind } from "./index/docs.js";
import { searchCode, searchDocs } from "./query/search.js";
import { relatedDocs, docsReferencing, isDocId } from "./graph/links.js";
import { summarize } from "./summarize/summaries.js";

const DOC_KINDS = new Set<string>(["doc", "spec", "adr", "prompt", "proposal"]);

const COMMANDS = [
  "doctor",
  "index",
  "search",
  "related",
  "summary",
  "context",
  "stats",
] as const;

function help(): void {
  console.log(`ACI — AI Context Infrastructure (packages/aci)

Uso: npm run aci -- <comando> [args]

Comandos:
  doctor              Diagnóstico do ambiente e da configuração (F0)
  stats               Estado do índice e cache
  index [--force]     Reindexa símbolos de código (F1); --force ignora cache
  search <query>      Busca símbolo (F1) e/ou seção de doc/spec/ADR (F2) por
                       nome/assinatura/heading/conteúdo.
                       Múltiplos termos separados por espaço = OR implícito.
                       Exemplos: KDA, "guest link auth", T-060 KDA ranking
                       [--kind=function|class|interface|type|enum|const
                               |doc|spec|adr|prompt|proposal]
                       Nota: pipes (|), regex e AND lógico NÃO são suportados
  related <alvo>      (F3) Grafo de relações — símbolo/arquivo → docs que o
                       mencionam (ex.: ProjectileSystem), ou docId → docs que
                       o referenciam (ex.: ADR-009)
  summary <id>        (F3) Resumo automático de spec/ADR/prompt/proposal/doc
                       (ex.: SPEC-0004, ADR-014, AGENTS.md)
  context <feature>   (F4+) Pacote de contexto mínimo — stub
`);
}

/** Diagnóstico: confirma que a fundação está sã e mede o corpus-alvo. */
function doctor(): number {
  const cfg = loadConfig();
  let ok = true;
  const line = (label: string, good: boolean, extra = "") => {
    console.log(`  ${good ? "✔" : "✗"} ${label}${extra ? " — " + extra : ""}`);
    if (!good) ok = false;
  };

  console.log("ACI doctor\n");
  line("config carregada", true, "aci.config.json v" + cfg.version);
  line("root do repo existe", existsSync(cfg.rootAbs), relative(cfg.rootAbs, cfg.rootAbs) || cfg.rootAbs);

  // Cache gravável
  try {
    mkdirSync(cfg.cacheAbs, { recursive: true });
    const store = new JsonStore(cfg.cacheAbs, "doctor.json");
    store.set("ping", Date.now());
    store.flush();
    line("cache gravável", true, cfg.cacheDir);
  } catch (e) {
    line("cache gravável", false, String(e));
  }

  // Corpus-alvo (o que F1/F2 vão indexar)
  const code = cfg.sources.code;
  const codeFiles = resolveGlobs(cfg.rootAbs, code.include, code.exclude);
  line("fontes de código encontradas", codeFiles.length > 0, codeFiles.length + " arquivos .ts");

  const docs = cfg.sources.docs;
  const docFiles = resolveGlobs(cfg.rootAbs, docs.include, docs.exclude);
  line("fontes de documentação encontradas", docFiles.length > 0, docFiles.length + " arquivos .md");

  const specFiles = resolveGlobs(cfg.rootAbs, cfg.sources.specs.include);
  line("specs encontradas", specFiles.length > 0, specFiles.length + " specs");

  console.log("\nResumo:", ok ? "ambiente OK ✔" : "há pendências ✗");
  return ok ? 0 : 1;
}

function codeStore(cfg: ReturnType<typeof loadConfig>): JsonStore {
  return new JsonStore(cfg.cacheAbs, "code.json");
}

function docsStore(cfg: ReturnType<typeof loadConfig>): JsonStore {
  return new JsonStore(cfg.cacheAbs, "docs.json");
}

function stats(): number {
  const cfg = loadConfig();
  const code = codeStore(cfg);
  const docs = docsStore(cfg);
  const symbols = code.get<unknown[]>("code:all") ?? [];
  const sections = docs.get<unknown[]>("docs:all") ?? [];
  console.log("ACI stats");
  console.log("  cache:", cfg.cacheDir);
  console.log("  arquivos de código indexados:", code.keys("code:file:").length);
  console.log("  símbolos indexados:", symbols.length);
  console.log("  arquivos de doc indexados:", docs.keys("docs:file:").length);
  console.log("  seções de doc indexadas:", sections.length);
  console.log("  (grafo/resumos da F3 são computados sob demanda — sem cache próprio)");
  console.log("  (F4+ somará orçamento de contexto por feature)");
  return 0;
}

function indexCmd(args: string[]): number {
  const force = args.includes("--force");
  const cfg = loadConfig();

  const code = codeStore(cfg);
  const codeResult = indexCode(cfg, code, { force });
  code.flush();

  const docs = docsStore(cfg);
  const docsResult = indexDocs(cfg, docs, { force });
  docs.flush();

  console.log("ACI index\n");
  console.log("  código:");
  console.log("    arquivos encontrados:", codeResult.metrics.filesTotal);
  console.log("    reparseados:", codeResult.metrics.filesParsed);
  console.log("    do cache (hash igual):", codeResult.metrics.filesSkipped);
  console.log("    símbolos indexados:", codeResult.metrics.symbolsIndexed);
  console.log("    tempo:", codeResult.metrics.indexMs + "ms");
  console.log("  documentação (docs/specs/ADRs/prompts/proposals):");
  console.log("    arquivos encontrados:", docsResult.metrics.filesTotal);
  console.log("    reparseados:", docsResult.metrics.filesParsed);
  console.log("    do cache (hash igual):", docsResult.metrics.filesSkipped);
  console.log("    seções indexadas:", docsResult.metrics.sectionsIndexed);
  console.log("    tempo:", docsResult.metrics.indexMs + "ms");
  return 0;
}

function searchCmd(args: string[]): number {
  const kindFlag = args.find((a) => a.startsWith("--kind="));
  const kindArg = kindFlag ? kindFlag.split("=")[1] : undefined;
  const isDocKind = kindArg ? DOC_KINDS.has(kindArg) : false;
  const codeKind = kindArg && !isDocKind ? (kindArg as SymbolKind) : undefined;
  const docKind = isDocKind ? (kindArg as DocKind) : undefined;
  const query = args.filter((a) => !a.startsWith("--")).join(" ");
  if (!query) {
    console.error(
      "Uso: npm run aci -- search <query> [--kind=function|class|interface|type|enum|const|doc|spec|adr|prompt|proposal]",
    );
    return 1;
  }

  const cfg = loadConfig();
  const t = new Timer();
  const codeHits = docKind ? [] : searchCode(codeStore(cfg), query, { kind: codeKind });
  const docHits = codeKind ? [] : searchDocs(docsStore(cfg), query, { kind: docKind });
  const searchMs = t.ms();

  if (codeHits.length === 0 && docHits.length === 0) {
    console.log(`Nada encontrado para "${query}". Rode "npm run aci -- index" primeiro?`);
    return 0;
  }

  console.log(`ACI search — "${query}"\n`);
  if (codeHits.length > 0) {
    console.log("  Código:");
    for (const h of codeHits) {
      console.log(`    ${h.file}:${h.line}  [${h.kind}${h.exported ? "" : ", interno"}]  ${h.signature}`);
    }
  }
  if (docHits.length > 0) {
    console.log("  Documentação:");
    for (const h of docHits) {
      const label = h.docId ? `${h.docId} — ${h.heading}` : h.heading;
      console.log(`    ${h.file}:${h.line}  [${h.kind}]  ${label}`);
    }
  }

  const returnedText = [
    ...codeHits.map((h) => h.signature),
    ...docHits.map((h) => `${h.heading}\n${h.snippet}`),
  ].join("\n");
  const uniqueFiles = [...new Set([...codeHits.map((h) => h.file), ...docHits.map((h) => h.file)])];
  const fullFilesText = uniqueFiles
    .map((f) => {
      try {
        return readFileSync(resolve(cfg.rootAbs, f), "utf8");
      } catch {
        return "";
      }
    })
    .join("\n");
  const hitCount = codeHits.length + docHits.length;
  const m = queryMetrics(query, searchMs, hitCount, returnedText, fullFilesText);
  console.log(
    `\n  ${hitCount} resultado(s) em ${m.searchMs}ms — ~${m.tokensReturned} tokens (vs ~${m.tokensIfFullFiles} lendo os arquivos inteiros; economia ~${m.savedPct}%)`,
  );
  return 0;
}

function stub(name: string, phase: string): number {
  console.log(`[${name}] ainda não implementado — chega na ${phase}.`);
  console.log("Ver docs/proposals/PROPOSAL-0003.");
  return 0;
}

function relatedCmd(args: string[]): number {
  const target = args.filter((a) => !a.startsWith("--")).join(" ");
  if (!target) {
    console.error("Uso: npm run aci -- related <símbolo|arquivo|docId>  — ex.: ProjectileSystem, ADR-009");
    return 1;
  }

  const cfg = loadConfig();
  const t = new Timer();
  const hits = isDocId(target)
    ? docsReferencing(docsStore(cfg), target).map((section) => ({ section, matchedSymbol: target }))
    : relatedDocs(codeStore(cfg), docsStore(cfg), target);
  const searchMs = t.ms();

  if (hits.length === 0) {
    console.log(`Nada referencia/menciona "${target}". Rode "npm run aci -- index" primeiro?`);
    return 0;
  }

  console.log(`ACI related — "${target}"\n`);
  for (const { section, matchedSymbol } of hits) {
    const label = section.docId ? `${section.docId} — ${section.heading}` : section.heading;
    console.log(`  ${section.file}:${section.line}  [${section.kind}]  ${label}  (menciona "${matchedSymbol}")`);
  }

  const returnedText = hits.map((h) => `${h.section.heading}\n${h.section.snippet}`).join("\n");
  const uniqueFiles = [...new Set(hits.map((h) => h.section.file))];
  const fullFilesText = uniqueFiles
    .map((f) => {
      try {
        return readFileSync(resolve(cfg.rootAbs, f), "utf8");
      } catch {
        return "";
      }
    })
    .join("\n");
  const m = queryMetrics(target, searchMs, hits.length, returnedText, fullFilesText);
  console.log(
    `\n  ${hits.length} resultado(s) em ${m.searchMs}ms — ~${m.tokensReturned} tokens (vs ~${m.tokensIfFullFiles} lendo os arquivos inteiros; economia ~${m.savedPct}%)`,
  );
  return 0;
}

function summaryCmd(args: string[]): number {
  const target = args.filter((a) => !a.startsWith("--")).join(" ");
  if (!target) {
    console.error("Uso: npm run aci -- summary <id|arquivo>  — ex.: SPEC-0004, ADR-014, AGENTS.md");
    return 1;
  }

  const cfg = loadConfig();
  const t = new Timer();
  const doc = summarize(docsStore(cfg), target);
  const searchMs = t.ms();

  if (!doc) {
    console.log(`Nenhum doc/spec/ADR encontrado para "${target}". Rode "npm run aci -- index" primeiro?`);
    return 0;
  }

  console.log(`ACI summary — ${doc.docId ? doc.docId + " — " : ""}${doc.title}\n`);
  console.log(`  [${doc.kind}] ${doc.file}`);
  console.log(`\n${doc.snippet}\n`);

  const returnedText = `${doc.title}\n${doc.snippet}`;
  let fullFileText = "";
  try {
    fullFileText = readFileSync(resolve(cfg.rootAbs, doc.file), "utf8");
  } catch {
    fullFileText = "";
  }
  const m = queryMetrics(target, searchMs, 1, returnedText, fullFileText);
  console.log(
    `  ~${m.tokensReturned} tokens (vs ~${m.tokensIfFullFiles} lendo o arquivo inteiro; economia ~${m.savedPct}%)`,
  );
  return 0;
}

function main(): void {
  const [cmd, ...args] = process.argv.slice(2);
  const t = new Timer();
  let code = 0;
  switch (cmd) {
    case "doctor":
      code = doctor();
      break;
    case "stats":
      code = stats();
      break;
    case "index":
      code = indexCmd(args);
      break;
    case "search":
      code = searchCmd(args);
      break;
    case "related":
      code = relatedCmd(args);
      break;
    case "summary":
      code = summaryCmd(args);
      break;
    case "context":
      code = stub("context", "F4");
      break;
    case undefined:
    case "help":
    case "-h":
    case "--help":
      help();
      break;
    default:
      console.error(`Comando desconhecido: ${cmd}. Comandos: ${COMMANDS.join(", ")}`);
      code = 1;
  }
  if (cmd && cmd !== "help") console.log(`\n(${t.ms()}ms)`);
  process.exit(code);
}

main();
