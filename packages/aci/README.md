# @aop/aci — AI Context Infrastructure

Camada **isolada** de indexação e busca de contexto para agentes de IA (Claude, Codex, Gemini, Cursor). Reduz consumo de tokens entregando **trechos e resumos cirúrgicos** em vez de arquivos inteiros.

> **Isolamento garantido:** nenhum outro pacote (`client`, `server`, `shared`, `bots`) importa `@aop/aci`. O jogo compila e roda idêntico com ou sem este pacote. Remover = deletar `packages/aci` + a entrada MCP. Ver ADR-018 e `docs/proposals/PROPOSAL-0003`.

## Estado

Em construção por fases (PROPOSAL-0003).
- **F0 (scaffold):** config, store, métricas, CLI com `doctor`.
- **F1 (índice de código):** símbolos (`function`/`class`/`interface`/`type`/`enum`/`const` exportados) de todo `packages/*/src`, com cache incremental por hash e busca por nome/assinatura.
- **F2 (índice de docs/corpus):** seções por heading de `docs/**` (inclui `AGENTS.md`, `instrucoes/**`, `docs/DECISION_LOG.md`), `specs/SPEC-*`, `docs/prompts/PROMPT-*`, `docs/proposals/PROPOSAL-*`. `docs/DECISION_LOG.md` vira uma entrada `adr` por `## ADR-NNN`. Cache incremental por hash; busca por docId/heading/conteúdo com filtro por kind.
- **F3 (grafo de relações + resumos):** `relatedDocs`/`docsReferencing` (menção lexical de símbolo/docId nas seções da F2, sem armazenamento novo) + `summarize` (reaproveita a seção de nível 1 da F2 como resumo). CLI `related`/`summary`.

## Uso

```bash
# na raiz do monorepo
npm install
npm run aci -- doctor           # diagnóstico do ambiente
npm run aci -- index            # (re)indexa código + docs/specs/ADRs/prompts/proposals (só reparseia o que mudou)
npm run aci -- index --force    # ignora o cache e reparseia tudo
npm run aci -- search <query>   # busca símbolo (código) e seção (docs) — ex.: EffectKind, ArenaRoom, facing
                                # Múltiplos termos = OR implícito (ex.: KDA ranking, T-060 stats)
                                # Tokenização: por espaço apenas. Pipes (|), regex e AND não são suportados.
npm run aci -- search <query> --kind=interface   # kinds de código: function|class|interface|type|enum|const
npm run aci -- search <query> --kind=adr         # kinds de doc: doc|spec|adr|prompt|proposal
npm run aci -- related <símbolo|arquivo|docId>   # "quem governa X?" — ex.: ProjectileSystem, ADR-009
npm run aci -- summary <id|arquivo>              # resumo antes de abrir o arquivo — ex.: SPEC-0004, ADR-014
npm run aci -- stats            # estado do índice
npm test -w @aop/aci            # suíte de testes
```

Comando `context` chega na fase F4 (stub hoje).

## Arquitetura (alvo)

```
src/
  config.ts        carga de aci.config.json
  util/glob.ts     resolução de fontes (zero deps)
  store/store.ts   Store (JSON em F0 → SQLite se o volume justificar)
  metrics/         tempo, tokens, economia, hit-rate
  index/code.ts    (F1) símbolos de código via TypeScript Compiler API
  index/docs.ts    (F2) seções de markdown (docs/specs/ADRs/prompts/proposals) por heading
  graph/links.ts   (F3) arestas doc↔código↔spec↔ADR por menção lexical, sob demanda
  summarize/       (F3) resumos de spec/ADR/prompt/proposal/doc (reaproveita seção nível 1 da F2)
  query/search.ts  (F1/F2) busca por símbolo/nome/assinatura e por doc/heading/conteúdo
  query/context.ts (F4) context_for_feature
  mcp/             (F5) servidor MCP stdio
  cli.ts           entrada de linha de comando
```

## Decisões técnicas

- **Sem embeddings/banco vetorial na V1** — o corpus (~3.8k linhas de código, ~2.6k de docs) não justifica. Núcleo estrutural + lexical + resumos. Embeddings ficam como plugin da Fase 5+ se o repo crescer. Racional completo em PROPOSAL-0003 §4.
- **Índice de código via TypeScript Compiler API, não tree-sitter** (desvio da PROPOSAL-0003 original, documentado em §4-nota): a `typescript` já é devDependency do pacote (usada pelo `tsc`); usar `ts.createSourceFile`/AST evita adicionar uma dependência nativa/WASM nova (tree-sitter + grammar) só para obter o mesmo parse estrutural de `.ts`/`.tsx` — mantém a leveza que a F0 já escolheu (`JsonStore` em vez de `better-sqlite3`).
- **Índice de docs por heading, sem front-matter YAML** (desvio documentado na PROPOSAL-0003, nota F2): o corpus real não usa blocos `---`; cada heading (`#`..`######`) já isola uma seção — a mesma técnica estrutural da F1, aplicada a markdown. Isso classifica `docs/DECISION_LOG.md` automaticamente por ADR sem parser dedicado.
- **Grafo por menção lexical, sem banco de grafo** (nota F3): arestas são calculadas sob demanda varrendo `code:all`/`docs:all` já indexados — nenhuma estrutura/cache nova. "Resumo automático" também não é uma sumarização nova: reaproveita a seção de nível 1 já extraída na F2 (ADR: a própria seção já é o resumo).
