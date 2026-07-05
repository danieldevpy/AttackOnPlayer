#!/usr/bin/env tsx
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { loadConfig } from "./config.js";
import { JsonStore } from "./store/store.js";
import { resolveGlobs } from "./util/glob.js";
import { Timer, queryMetrics } from "./metrics/metrics.js";
import { indexCode, type SymbolKind } from "./index/code.js";
import { searchCode } from "./query/search.js";

const COMMANDS = [
  "doctor",
  "index",
  "search",
  "context",
  "summary",
  "stats",
] as const;

function help(): void {
  console.log(`ACI — AI Context Infrastructure (packages/aci)

Uso: npm run aci -- <comando> [args]

Comandos:
  doctor              Diagnóstico do ambiente e da configuração (F0)
  stats               Estado do índice e cache
  index [--force]     Reindexa símbolos de código (F1); --force ignora cache
  search <query>      Busca símbolo por nome/assinatura (F1)
                       [--kind=function|class|interface|type|enum|const]
  context <feature>   (F4+) Pacote de contexto mínimo — stub
  summary <id>        (F3+) Resumo de spec/doc/pacote — stub
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

function stats(): number {
  const cfg = loadConfig();
  const store = codeStore(cfg);
  const symbols = store.get<unknown[]>("code:all") ?? [];
  console.log("ACI stats");
  console.log("  cache:", cfg.cacheDir);
  console.log("  arquivos indexados:", store.keys("code:file:").length);
  console.log("  símbolos indexados:", symbols.length);
  console.log("  (F2+ somará docs/specs/ADRs às métricas)");
  return 0;
}

function indexCmd(args: string[]): number {
  const force = args.includes("--force");
  const cfg = loadConfig();
  const store = codeStore(cfg);
  const result = indexCode(cfg, store, { force });
  store.flush();
  console.log("ACI index (código)\n");
  console.log("  arquivos encontrados:", result.metrics.filesTotal);
  console.log("  reparseados:", result.metrics.filesParsed);
  console.log("  do cache (hash igual):", result.metrics.filesSkipped);
  console.log("  símbolos indexados:", result.metrics.symbolsIndexed);
  console.log("  tempo:", result.metrics.indexMs + "ms");
  return 0;
}

function searchCmd(args: string[]): number {
  const kindFlag = args.find((a) => a.startsWith("--kind="));
  const kind = kindFlag ? (kindFlag.split("=")[1] as SymbolKind) : undefined;
  const query = args.filter((a) => !a.startsWith("--")).join(" ");
  if (!query) {
    console.error(
      "Uso: npm run aci -- search <query> [--kind=function|class|interface|type|enum|const]",
    );
    return 1;
  }

  const cfg = loadConfig();
  const store = codeStore(cfg);
  const t = new Timer();
  const hits = searchCode(store, query, { kind });
  const searchMs = t.ms();

  if (hits.length === 0) {
    console.log(`Nenhum símbolo encontrado para "${query}". Rode "npm run aci -- index" primeiro?`);
    return 0;
  }

  console.log(`ACI search — "${query}"\n`);
  for (const h of hits) {
    console.log(`  ${h.file}:${h.line}  [${h.kind}${h.exported ? "" : ", interno"}]  ${h.signature}`);
  }

  const returnedText = hits.map((h) => h.signature).join("\n");
  const uniqueFiles = [...new Set(hits.map((h) => h.file))];
  const fullFilesText = uniqueFiles
    .map((f) => {
      try {
        return readFileSync(resolve(cfg.rootAbs, f), "utf8");
      } catch {
        return "";
      }
    })
    .join("\n");
  const m = queryMetrics(query, searchMs, hits.length, returnedText, fullFilesText);
  console.log(
    `\n  ${hits.length} resultado(s) em ${m.searchMs}ms — ~${m.tokensReturned} tokens (vs ~${m.tokensIfFullFiles} lendo os arquivos inteiros; economia ~${m.savedPct}%)`,
  );
  return 0;
}

function stub(name: string, phase: string): number {
  console.log(`[${name}] ainda não implementado — chega na ${phase}.`);
  console.log("Ver docs/proposals/PROPOSAL-0003.");
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
    case "context":
      code = stub("context", "F4");
      break;
    case "summary":
      code = stub("summary", "F3");
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
