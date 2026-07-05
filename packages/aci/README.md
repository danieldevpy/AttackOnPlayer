# @aop/aci — AI Context Infrastructure

Camada **isolada** de indexação e busca de contexto para agentes de IA (Claude, Codex, Gemini, Cursor). Reduz consumo de tokens entregando **trechos e resumos cirúrgicos** em vez de arquivos inteiros.

> **Isolamento garantido:** nenhum outro pacote (`client`, `server`, `shared`, `bots`) importa `@aop/aci`. O jogo compila e roda idêntico com ou sem este pacote. Remover = deletar `packages/aci` + a entrada MCP. Ver ADR-017 e `docs/proposals/PROPOSAL-0003`.

## Estado

Em construção por fases (PROPOSAL-0003). **F0 (scaffold) entregue:** config, store, métricas, CLI com `doctor`.

## Uso

```bash
# na raiz do monorepo
npm install
npm run aci -- doctor      # diagnóstico do ambiente (F0)
npm run aci -- stats       # estado do índice
npm test -w @aop/aci       # testes da fundação
```

Comandos `index`, `search`, `context`, `summary` chegam nas fases F1–F4 (stubs hoje).

## Arquitetura (alvo)

```
src/
  config.ts        carga de aci.config.json
  util/glob.ts     resolução de fontes (zero deps)
  store/store.ts   Store (JSON em F0 → SQLite em F1+)
  metrics/         tempo, tokens, economia, hit-rate
  index/           (F1) tree-sitter código · (F2) markdown/corpus
  graph/           (F3) arestas doc↔código↔spec↔ADR
  summarize/       (F3) resumos de spec/doc/pacote
  query/           (F1/F4) search + context_for_feature
  mcp/             (F5) servidor MCP stdio
  cli.ts           entrada de linha de comando
```

## Decisão técnica

Sem embeddings/banco vetorial na V1 do ACI — o corpus (~3.8k linhas de código, ~2.6k de docs) não justifica. Núcleo estrutural (tree-sitter) + lexical + resumos. Embeddings ficam como plugin da Fase 5+ se o repo crescer. Racional completo em PROPOSAL-0003 §4.
