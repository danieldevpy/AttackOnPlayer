#!/usr/bin/env tsx
import { existsSync, mkdirSync } from "node:fs";
import { relative } from "node:path";
import { loadConfig } from "./config.js";
import { JsonStore } from "./store/store.js";
import { resolveGlobs } from "./util/glob.js";
import { Timer } from "./metrics/metrics.js";

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
  doctor            Diagnóstico do ambiente e da configuração (F0)
  stats             Estado do índice e cache
  index [--force]   (F1+) Reindexa código/docs — stub em F0
  search <query>    (F1+) Busca símbolo/doc/spec — stub em F0
  context <feature> (F4+) Pacote de contexto mínimo — stub em F0
  summary <id>      (F3+) Resumo de spec/doc/pacote — stub em F0
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

  console.log("\nResumo:", ok ? "ambiente OK ✔ (pronto para F1)" : "há pendências ✗");
  return ok ? 0 : 1;
}

function stats(): number {
  const cfg = loadConfig();
  const store = new JsonStore(cfg.cacheAbs);
  const keys = store.keys();
  console.log("ACI stats");
  console.log("  cache:", cfg.cacheDir);
  console.log("  entradas no índice:", keys.length);
  console.log("  (F1+ preencherá símbolos, docs e métricas de busca)");
  return 0;
}

function stub(name: string, phase: string): number {
  console.log(`[${name}] ainda não implementado — chega na ${phase}.`);
  console.log("F0 entrega apenas scaffold + doctor. Ver docs/proposals/PROPOSAL-0003.");
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
      code = stub("index", "F1");
      break;
    case "search":
      code = stub("search", "F1");
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
