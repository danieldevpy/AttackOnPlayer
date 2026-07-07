#!/usr/bin/env tsx
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  searchTool,
  findSymbolTool,
  relatedTool,
  summaryTool,
  statsTool,
  indexTool,
  type SearchResult,
  type RelatedResult,
} from "./handlers.js";

/**
 * Servidor MCP do ACI (F5, PROPOSAL-0003/ADR-018) — expõe via stdio as mesmas
 * capacidades da CLI (`npm run aci -- ...`), como tools nativas de agente em
 * vez de comandos de terminal. Progressive disclosure: cada tool devolve
 * trechos/resumos + a economia de tokens medida, nunca o arquivo inteiro.
 */

const CODE_KINDS = ["function", "class", "interface", "type", "enum", "const"] as const;
const DOC_KINDS = ["doc", "spec", "adr", "prompt", "proposal"] as const;
const SEARCH_KINDS = [...CODE_KINDS, ...DOC_KINDS] as const;

function textResult(value: string) {
  return { content: [{ type: "text" as const, text: value }] };
}

function economyLine(m: { searchMs: number; hits: number; tokensReturned: number; tokensIfFullFiles: number; savedPct: number }): string {
  return `${m.hits} resultado(s) em ${m.searchMs}ms — ~${m.tokensReturned} tokens (vs ~${m.tokensIfFullFiles} lendo os arquivos inteiros; economia ~${m.savedPct}%)`;
}

function formatSearch(r: SearchResult): string {
  if (r.code.length === 0 && r.docs.length === 0) {
    return `Nada encontrado para "${r.query}". Rode a tool aci_index primeiro?`;
  }
  const lines: string[] = [];
  if (r.code.length > 0) {
    lines.push("Código:");
    for (const h of r.code) {
      lines.push(`  ${h.file}:${h.line}  [${h.kind}${h.exported ? "" : ", interno"}]  ${h.signature}`);
    }
  }
  if (r.docs.length > 0) {
    lines.push("Documentação:");
    for (const h of r.docs) {
      const label = h.docId ? `${h.docId} — ${h.heading}` : h.heading;
      lines.push(`  ${h.file}:${h.line}  [${h.kind}]  ${label}\n    ${h.snippet.replace(/\n/g, "\n    ")}`);
    }
  }
  lines.push("", economyLine(r.metrics));
  return lines.join("\n");
}

function formatRelated(r: RelatedResult): string {
  if (r.hits.length === 0) {
    return `Nada referencia/menciona "${r.target}". Rode a tool aci_index primeiro?`;
  }
  const lines: string[] = [];
  for (const { section, matchedSymbol } of r.hits) {
    const label = section.docId ? `${section.docId} — ${section.heading}` : section.heading;
    lines.push(`${section.file}:${section.line}  [${section.kind}]  ${label}  (menciona "${matchedSymbol}")`);
  }
  lines.push("", economyLine(r.metrics));
  return lines.join("\n");
}

const server = new McpServer(
  { name: "aop-aci", version: "0.1.0" },
  {
    instructions:
      "AI Context Infrastructure do AttackOnPlayer (packages/aci) — devolve trechos/resumos cirúrgicos de código e documentação (specs/ADRs/DECISION_LOG/prompts/proposals) em vez de arquivos inteiros. Fluxo recomendado: aci_summary/aci_search/aci_related ANTES de ler um arquivo por inteiro; só use Read se o trecho devolvido não bastar. Rode aci_index depois de editar código/docs para o índice refletir as mudanças (cache incremental por hash — rápido).",
  },
);

server.registerTool(
  "aci_search",
  {
    title: "Buscar símbolo de código ou seção de doc/spec/ADR",
    description:
      'Busca símbolos exportados (função/classe/interface/type/enum/const) de packages/*/src e seções de docs/specs/ADRs/prompts/proposals por nome/assinatura/heading/conteúdo. Múltiplos termos separados por espaço = OR implícito (ex.: "KDA ranking" acha qualquer um dos termos, pontuado). Pipes, regex e AND lógico não são suportados. Devolve trechos cirúrgicos, não arquivos inteiros.',
    inputSchema: {
      query: z.string().min(1).describe('Termo(s) de busca, ex.: "EffectKind", "ADR-014", "guest link auth"'),
      kind: z.enum(SEARCH_KINDS).optional().describe("Filtra por tipo de símbolo de código ou tipo de doc"),
      limit: z.number().int().positive().max(50).optional().describe("Máximo de resultados por lado código/docs (padrão 20)"),
    },
  },
  async ({ query, kind, limit }) => {
    const result = searchTool(query, { kind, limit });
    return textResult(formatSearch(result));
  },
);

server.registerTool(
  "aci_find_symbol",
  {
    title: "Achar símbolo de código pelo nome",
    description:
      "Busca por NOME de símbolo exportado (função/classe/interface/type/enum/const) — ranking exato > prefixo > substring. Mais preciso que aci_search quando já se sabe o nome exato ou aproximado do símbolo.",
    inputSchema: {
      name: z.string().min(1).describe('Nome do símbolo, ex.: "EffectKind", "ArenaRoom"'),
      kind: z.enum(CODE_KINDS).optional(),
      limit: z.number().int().positive().max(50).optional(),
    },
  },
  async ({ name, kind, limit }) => {
    const { symbols } = findSymbolTool(name, { kind, limit });
    if (symbols.length === 0) {
      return textResult(`Nenhum símbolo encontrado para "${name}". Rode a tool aci_index primeiro?`);
    }
    const lines = symbols.map((h) => `${h.file}:${h.line}  [${h.kind}${h.exported ? "" : ", interno"}]  ${h.signature}`);
    return textResult(lines.join("\n"));
  },
);

server.registerTool(
  "aci_related",
  {
    title: "Grafo de relações — quem governa/menciona X",
    description:
      'Dado um símbolo de código, caminho de arquivo, ou docId (ADR-NNN/SPEC-NNNN/PROMPT-NNNN/PROPOSAL-NNNN), acha as seções de doc que o mencionam (ou, para docId, os docs que o referenciam) — responde "quem governa ProjectileSystem?" ou "quem referencia ADR-009?".',
    inputSchema: {
      target: z.string().min(1).describe('Símbolo, caminho de arquivo (ex.: "packages/server/src/rooms/ArenaRoom.ts") ou docId (ex.: "ADR-009")'),
      limit: z.number().int().positive().max(50).optional(),
    },
  },
  async ({ target, limit }) => {
    const result = relatedTool(target, { limit });
    return textResult(formatRelated(result));
  },
);

server.registerTool(
  "aci_summary",
  {
    title: "Resumo automático de spec/ADR/prompt/proposal/doc",
    description:
      "Resumo de uma spec/ADR/prompt/proposal/doc — a seção de nível 1 (specs/prompts/proposals) ou a própria seção do ADR (contexto→decisão→consequência já compacto). Use antes de abrir o arquivo inteiro.",
    inputSchema: {
      target: z.string().min(1).describe('docId (ex.: "SPEC-0004", "ADR-014", "PROMPT-0028") ou caminho de arquivo (ex.: "AGENTS.md")'),
    },
  },
  async ({ target }) => {
    const { summary, metrics } = summaryTool(target);
    if (!summary || !metrics) {
      return textResult(`Nenhum doc/spec/ADR encontrado para "${target}". Rode a tool aci_index primeiro?`);
    }
    const header = `${summary.docId ? summary.docId + " — " : ""}${summary.title}  [${summary.kind}]  ${summary.file}`;
    return textResult(`${header}\n\n${summary.snippet}\n\n${economyLine({ ...metrics, hits: 1 })}`);
  },
);

server.registerTool(
  "aci_stats",
  {
    title: "Estado do índice ACI",
    description: "Nº de arquivos/símbolos de código e de seções de doc indexados, e onde fica o cache. Útil pra diagnosticar índice desatualizado ou vazio.",
    inputSchema: {},
  },
  async () => {
    const s = statsTool();
    return textResult(
      [
        `cache: ${s.cacheDir}`,
        `arquivos de código indexados: ${s.codeFilesIndexed}`,
        `símbolos indexados: ${s.symbolsIndexed}`,
        `arquivos de doc indexados: ${s.docFilesIndexed}`,
        `seções de doc indexadas: ${s.sectionsIndexed}`,
      ].join("\n"),
    );
  },
);

server.registerTool(
  "aci_index",
  {
    title: "Reindexar código + documentação",
    description:
      "Reindexa packages/*/src e docs/specs/ADRs/prompts/proposals. Cache incremental por hash de conteúdo — só reparseia o que mudou (rápido); force=true ignora o cache e reparseia tudo. Rode depois de editar código/docs para as próximas buscas refletirem as mudanças.",
    inputSchema: {
      force: z.boolean().optional().describe("Ignora o cache e reparseia tudo (padrão false)"),
    },
  },
  async ({ force }) => {
    const r = indexTool(force ?? false);
    return textResult(
      [
        `código: ${r.code.filesParsed} reparseado(s), ${r.code.filesSkipped} do cache, ${r.code.symbolsIndexed} símbolo(s), ${r.code.indexMs}ms`,
        `docs: ${r.docs.filesParsed} reparseado(s), ${r.docs.filesSkipped} do cache, ${r.docs.sectionsIndexed} seção(ões), ${r.docs.indexMs}ms`,
      ].join("\n"),
    );
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("[aci mcp] falha ao iniciar:", err);
  process.exit(1);
});
