# @aop/aci — AI Context Infrastructure

Camada **isolada** de indexação e busca de contexto para agentes de IA (Claude, Codex, Gemini, Cursor). Reduz consumo de tokens entregando **trechos e resumos cirúrgicos** em vez de arquivos inteiros.

> **Isolamento garantido:** nenhum outro pacote (`client`, `server`, `shared`, `bots`) importa `@aop/aci`. O jogo compila e roda idêntico com ou sem este pacote. Remover = deletar `packages/aci` + a entrada MCP. Ver ADR-017 e `docs/proposals/PROPOSAL-0003`.

## Estado

Em construção por fases (PROPOSAL-0003).
- **F0 (scaffold):** config, store, métricas, CLI com `doctor`.
- **F1 (índice de código):** símbolos (`function`/`class`/`interface`/`type`/`enum`/`const` exportados) de todo `packages/*/src`, com cache incremental por hash e busca por nome/assinatura.

## Uso

```bash
# na raiz do monorepo
npm install
npm run aci -- doctor           # diagnóstico do ambiente
npm run aci -- index            # (re)indexa símbolos de código (só reparseia o que mudou)
npm run aci -- index --force    # ignora o cache e reparseia tudo
npm run aci -- search <query>   # acha símbolo por nome/assinatura — ex.: EffectKind, ArenaRoom
npm run aci -- search <query> --kind=interface
npm run aci -- stats            # estado do índice
npm test -w @aop/aci            # suíte de testes
```

Comandos `context` e `summary` chegam nas fases F3/F4 (stubs hoje).

## Arquitetura (alvo)

```
src/
  config.ts        carga de aci.config.json
  util/glob.ts     resolução de fontes (zero deps)
  store/store.ts   Store (JSON em F0 → SQLite se o volume justificar)
  metrics/         tempo, tokens, economia, hit-rate
  index/code.ts    (F1) símbolos de código via TypeScript Compiler API
  index/docs.ts    (F2) markdown/corpus
  graph/           (F3) arestas doc↔código↔spec↔ADR
  summarize/       (F3) resumos de spec/doc/pacote
  query/search.ts  (F1) busca por símbolo/nome/assinatura
  query/context.ts (F4) context_for_feature
  mcp/             (F5) servidor MCP stdio
  cli.ts           entrada de linha de comando
```

## Decisões técnicas

- **Sem embeddings/banco vetorial na V1** — o corpus (~3.8k linhas de código, ~2.6k de docs) não justifica. Núcleo estrutural + lexical + resumos. Embeddings ficam como plugin da Fase 5+ se o repo crescer. Racional completo em PROPOSAL-0003 §4.
- **Índice de código via TypeScript Compiler API, não tree-sitter** (desvio da PROPOSAL-0003 original, documentado em §4-nota): a `typescript` já é devDependency do pacote (usada pelo `tsc`); usar `ts.createSourceFile`/AST evita adicionar uma dependência nativa/WASM nova (tree-sitter + grammar) só para obter o mesmo parse estrutural de `.ts`/`.tsx` — mantém a leveza que a F0 já escolheu (`JsonStore` em vez de `better-sqlite3`).
