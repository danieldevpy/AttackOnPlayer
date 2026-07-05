# PROPOSAL-0003 — ACI: Infraestrutura de Contexto para Agentes de IA

> **Status:** 🟡 rascunho — **aguardando aprovação do CD** (nenhuma implementação começa antes).
> **Origem:** pedido do CD (Daniel) por uma camada de infraestrutura que reduza consumo de tokens, acelere a compreensão do projeto e sirva qualquer agente (Claude, Codex, GPT, Gemini).
> **Restrição-mãe:** construir **em paralelo** ao desenvolvimento da V1 (T-019b em diante) **sem quebrar o fluxo** — módulo isolado, aditivo, zero mudança em gameplay/rede.
> **Referências:** AGENTS.md · DOC_MAP.md · DECISION_LOG (ADR-004, ADR-009..011) · PROPOSAL-0002 · metrics.md

---

## 1. Diagnóstico — o que o projeto já é

Análise read-only feita sobre o repositório inteiro (sem alterar nada).

**Escala real (o dado mais importante para a decisão técnica):**

| Corpus | Tamanho |
|---|---|
| Código TS (fonte, sem node_modules/dist) | **27 arquivos, ~3.783 linhas** |
| Maior arquivo | `server/rooms/ArenaRoom.ts` (540 linhas) |
| Pacotes | 4 (`shared`, `server`, `client`, `bots`) |
| Documentação | **58 arquivos .md, ~2.586 linhas** |
| Specs | 9 (SPEC-0001..0009) + template |
| ADRs | 16 (ADR-001..016) no DECISION_LOG |
| Prompts | 27 (PROMPT-0001..0027) |

**Como o contexto já é gerenciado hoje (isto é maduro e funciona):**

- `AGENTS.md` — contrato de trabalho + roteamento por papel ("agente de balance lê só X, Y, Z").
- `DOC_MAP.md` — hierarquia de docs (volátil → estável) + regra de conflito + fluxo de reidratação em ~6 leituras.
- `SESSAO_ATUAL.md` (ponteiro único, substituído a cada sessão) + `DEVLOG.md` (histórico) + `PROMPT-NNNN.md` (por leva).
- Convenções firmes: **docs em PT-BR, código/identificadores em inglês**; servidor autoritativo; data-driven (`ATTR_DEFS`, `LauncherDef`, `EffectKind`).
- **ADR-004 já rejeitou ferramentas externas pesadas** (Spec Kit/Dotcontext) em favor de processo leve in-repo, citando explicitamente "menos tokens por leitura".
- Princípio #6 do AGENTS.md: **"Token economy — agentes leem só o contexto do seu papel; nunca o repo inteiro."**

**Conclusão do diagnóstico:** o projeto **já pratica context engineering manual** via convenção humana. As dores reais não são "falta de busca semântica num codebase gigante" — são:

1. **Roteamento é manual e estático.** O mapa "papel → arquivos" no AGENTS.md é mantido à mão e envelhece. Um agente ainda precisa *ler* o AGENTS.md + DOC_MAP + abrir arquivos inteiros para achar um símbolo.
2. **Localizar símbolo/decisão/spec exige abrir arquivos inteiros.** Não há "onde está `EffectKind`?" ou "qual ADR fala de facing?" sem `grep` manual + leitura de arquivos de 500 linhas para pegar 15 linhas relevantes.
3. **Cross-referência doc↔código é humana.** "Qual spec/ADR governa `ProjectileSystem`?" está na cabeça de quem escreveu, não indexado.
4. **Cada modelo novo (Codex/Gemini) recomeça do zero** relendo os mesmos 6 arquivos.

Ou seja: o alvo certo **não** é um RAG semântico pesado — é **formalizar e automatizar o que o DOC_MAP/AGENTS.md já fazem à mão**, entregando trechos cirúrgicos em vez de arquivos inteiros.

---

## 2. Pesquisa — o que a indústria faz hoje (2026) e o que se aplica aqui

Pesquisa sobre MCP, RTK, tree-sitter, LSP, embeddings, RAG-para-código, Aider/Cursor/Claude Code/Codex/Gemini CLI.

**Achados que importam para a decisão:**

- **MCP virou o padrão universal** de acesso a contexto/ferramentas — adotado por Claude Code, Cursor, Codex, Copilot, Gemini, Windsurf, Zed, Cline. É o jeito certo de expor a camada a *qualquer* agente. (fonte: DEV/Anthropic abaixo)
- **Tree-sitter "repo map" (estilo Aider)** — parseia cada arquivo, extrai assinaturas de funções/classes/símbolos e produz um mapa compacto do codebase inteiro, priorizando por PageRank. Explora **estrutura**, não similaridade semântica. É a técnica dominante para agentes navegarem sem ler tudo.
- **Embeddings/RAG vetorial (Qdrant, estilo Roo Code/Cursor)** — vale a pena em codebases **grandes** e para consulta em linguagem natural. Pesquisa recente ("RAG still wins on large docs", "coding agents skipped RAG") converge em: **com janelas de 200k tokens, para codebases pequenos o agente lê direto + busca exata (BM25/ripgrep) + repo map estruturado; RAG vetorial é overhead desnecessário.**
- **Anthropic "code execution with MCP"** — a fronteira de eficiência de tokens é **progressive disclosure**: expor ferramentas que retornam *resumos e trechos*, não payloads inteiros; o agente só "desce" no detalhe quando precisa.
- **LSP** dá "go to definition/references" precisos, mas exige servidor de linguagem rodando e é pesado para o ganho aqui (o tsserver já existe no editor humano; um agente headless não precisa dele para 3.8k linhas).

**Leitura para este projeto:** dado o tamanho (3.8k LOC / 2.6k linhas de doc), **embeddings + banco vetorial seriam engenharia excessiva** — violariam ADR-004 e o princípio de leveza, adicionando dependência pesada (modelo de embedding, Qdrant/sqlite-vss) para um corpus que cabe folgado em memória. A relação custo/benefício aponta para: **índice estrutural (tree-sitter) + índice lexical + resumos com front-matter, servidos por MCP.** Embeddings ficam como **extensão opcional plugável na Fase 5**, se e quando o corpus crescer o suficiente para justificar.

---

## 3. Arquitetura proposta — módulo `packages/aci`

Novo pacote no monorepo (workspace), **totalmente isolado**, sem nenhum import a partir de `client/server/shared/bots`. Ele *lê* o repo; ninguém depende dele para rodar o jogo. Remover = deletar a pasta + a entrada MCP.

```
packages/aci/
  src/
    index/
      code.ts        # tree-sitter (ts/tsx) → símbolos: fn, class, interface, type, enum, const exportado
      docs.ts        # parser de markdown → headings, front-matter, seções, links
      corpus.ts      # specs, ADRs, prompts, roadmap, backlog, AGENTS, instrucoes
      lexical.ts     # índice invertido (tokens/identificadores) p/ busca exata rápida
    graph/
      links.ts       # arestas doc↔código↔spec↔ADR (ex.: "EffectSystem ← ADR-009 ← SPEC-0004")
    summarize/
      summaries.ts   # resumo de cada spec/doc/pacote (front-matter first; fallback heurístico)
    query/
      search.ts      # símbolo | função | classe | tipo | arquivo | feature | doc | palavra-chave | conceito
      context.ts     # "dado uma feature X, retorne SÓ: arquivos+trechos+resumo doc+ADRs+deps"
    store/
      db.ts          # SQLite (índice + cache); mtime/hash por arquivo → reindex incremental
    metrics/
      metrics.ts     # tempo de index, tempo de busca, nº arquivos, tokens retornados, economia estimada, hit-rate
    mcp/
      server.ts      # servidor MCP (stdio) expondo as tools abaixo
    cli.ts           # `npm run aci -- index|search|context|summary|stats|doctor`
  aci.config.json    # o que indexar, pesos, limites de tokens por resposta
  README.md
```

**Tecnologias escolhidas (todas leves, justificadas em §4):** tree-sitter (`web-tree-sitter` ou `tree-sitter` + grammar TS), SQLite (`better-sqlite3`), BM25/índice invertido próprio (poucas dezenas de linhas), MCP SDK (`@modelcontextprotocol/sdk`), TypeScript. **Sem** embeddings/vetores/serviço externo na V1 do ACI.

**Tools MCP expostas (contrato para os agentes):**

| Tool | Entrada | Retorna (só o essencial) |
|---|---|---|
| `aci_find_symbol` | nome ou padrão | arquivo, linha, assinatura, tipo de símbolo, doc-ref |
| `aci_search` | query + filtro (kind: fn/class/type/doc/spec/adr…) | ranking de trechos, não arquivos inteiros |
| `aci_context_for_feature` | descrição/feature/spec | **pacote de contexto mínimo**: arquivos relevantes, trechos, resumo dos docs ligados, ADRs relacionados, dependências |
| `aci_summary` | id de spec/doc/pacote | resumo curto (usado *antes* de ler o arquivo inteiro) |
| `aci_related_docs` | símbolo ou arquivo | specs/ADRs/mechanics que governam aquele código |
| `aci_stats` | — | métricas do índice + economia estimada de tokens |

Cada resposta respeita um **orçamento de tokens** configurável (progressive disclosure): resumo primeiro, trecho depois, arquivo inteiro só sob pedido explícito.

**Como os agentes usam (documentado no AGENTS.md via um único ponteiro aditivo):** em vez de "leia AGENTS.md → DOC_MAP → abra 6 arquivos", o fluxo vira "chame `aci_context_for_feature('T-020 IA dos bots')` → receba o pacote mínimo → só então leia o que faltar". O fluxo legado **continua válido** (o ACI é opcional, igual o DOC_MAP se declarou "camada opcional de continuidade").

---

## 4. Justificativa técnica das escolhas

| Decisão | Por quê | Alternativa descartada |
|---|---|---|
| **Índice estrutural (tree-sitter) como núcleo** | Precisão exata de símbolos/assinaturas; é o que Aider/Cursor usam de base; casa com o estilo data-driven do projeto | LSP/tsserver: peso e processo vivo desnecessários para 3.8k LOC |
| **Lexical/BM25 próprio** | Busca exata de identificador é o caso 80%; trivial, sem deps | ElasticSearch/serviço externo: absurdo nesta escala |
| **SQLite (`better-sqlite3`)** | Índice + cache num arquivo; reindex incremental por mtime/hash; zero servidor | Banco vetorial (Qdrant): infra e modelo de embedding para um corpus que cabe em RAM |
| **Sem embeddings na V1** | Corpus pequeno; janelas de 200k tornam RAG vetorial custo>benefício; respeita ADR-004 e princípio de leveza | RAG vetorial completo: reintroduzível na Fase 5 como plugin se o repo crescer |
| **MCP como interface** | Padrão universal 2026 → serve Claude, Codex, Gemini, Cursor sem código por agente | Tool proprietária por agente: retrabalho e lock-in |
| **Módulo isolado `packages/aci`** | Baixo acoplamento, alta coesão, remoção trivial, não toca o loop paralelo | Espalhar no `shared`: violaria "não espalhar responsabilidades" |
| **Resumos com front-matter + progressive disclosure** | Formaliza o que o DOC_MAP já faz; máxima economia de token | Retornar arquivos inteiros: o problema que estamos resolvendo |

Isto **estende** a ADR-004 (fica coerente): continua sendo processo leve in-repo, agora com uma camada de *automação da busca* que a ADR-004 não tinha. Proponho registrar como **ADR-017** na aprovação.

---

## 5. Estimativa de ganho

Modelo conservador, medido depois pelas próprias métricas do ACI (§métricas do pedido):

- **Reidratação de sessão hoje:** ~6 arquivos abertos inteiros (AGENTS 70 linhas + SESSAO ~60 + DEVLOG topo + PROMPT ~80 + spec ~60 + mechanics ~120) ≈ **1.500–2.500 tokens** só para "onde estamos", antes de qualquer trabalho.
- **Com `aci_context_for_feature`:** resumo + trechos cirúrgicos ≈ **300–600 tokens** para o mesmo entendimento inicial → **~70–80% de economia na fase de orientação**.
- **Localizar um símbolo:** de "grep + abrir arquivo de 540 linhas" (~2.000 tokens) para "assinatura + 10 linhas de contexto" (~150 tokens) → **~90%**.
- **Ganho composto:** numa sessão típica de 1 feature, estimativa de **40–60% menos tokens de leitura** e menos idas ao disco, com o benefício maior sendo **consistência entre modelos** (Codex/Gemini chegam ao mesmo contexto que o Claude sem reaprender a convenção).

Estes números são **hipóteses a validar** — a Fase 6 entrega as métricas reais (`aci_stats`) para confirmar/ajustar. Nada de exagero: a economia real depende do padrão de uso.

---

## 6. Plano de execução — 6 fases pequenas e independentes

Cada fase é entregável sozinha, testada, e **não bloqueia o desenvolvimento da V1**. Sugestão: branch dedicada `aci` (ou `infra/aci`), merges pequenos; como não toca gameplay, roda em paralelo às tasks T-019b+.

| Fase | Entrega | Depende de | Testável por |
|---|---|---|---|
| **F0 — Scaffold** | `packages/aci` no workspace, `aci.config.json`, CLI vazia, README, SQLite store, esqueleto de métricas. Zero import do jogo. | — | `npm run aci -- doctor` verde |
| **F1 — Índice de código** | tree-sitter parseia os 4 pacotes; `aci_find_symbol` + `aci search`; cache incremental por hash | F0 | achar `EffectKind`, `ArenaRoom`, `LauncherDef` com linha+assinatura |
| **F2 — Índice de docs/corpus** | markdown/front-matter: specs, ADRs, prompts, roadmap, backlog, AGENTS, instrucoes; busca por doc/spec/ADR/conceito | F0 | achar "ADR sobre facing", "spec de skills" |
| **F3 — Grafo de relações + resumos** | arestas doc↔código↔spec↔ADR; `aci_related_docs`; resumo automático de cada spec/doc/pacote | F1, F2 | "quem governa `ProjectileSystem`?" → ADR-011, SPEC-0004 |
| **F4 — Contexto por feature (a joia)** | `aci_context_for_feature` com orçamento de tokens + progressive disclosure | F1–F3 | "T-020 IA dos bots" retorna só arquivos+trechos+ADR+deps |
| **F5 — Servidor MCP + integração agentes** | `mcp/server.ts` (stdio); ponteiro aditivo no AGENTS.md; config para Claude Code/Codex/Gemini/Cursor. (Slot opcional p/ embeddings fica documentado, não implementado.) | F4 | agente externo chama as tools |
| **F6 — Métricas, testes e docs** | métricas reais (tempo index/busca, nº arquivos, tokens, economia, hit-rate); suíte de testes; `docs/ai/aci.md` (arquitetura, fluxo, como atualizar índices, como adicionar docs, como agentes usam) | F5 | `aci_stats` + cobertura + doc completa |

Cada fase fecha com o ritual do projeto (DEVLOG + PROMPT-NNNN + atualização de ponteiros). ADR-017 entra junto da F0/aprovação.

**Guarda de não-regressão do fluxo paralelo:** o pacote `aci` fica fora do `npm test`/gates do jogo (ou num gate próprio), não altera `tsconfig` dos outros pacotes, e não entra no bundle do cliente/servidor. O jogo compila e roda idêntico com ou sem ele.

---

## 7. Critérios de qualidade (checklist de aceite do CD)

- [ ] Baixo acoplamento: `packages/aci` não é importado por nenhum outro pacote.
- [ ] Alta coesão / modular: cada subpasta uma responsabilidade.
- [ ] Extensível: novo tipo de índice (ex.: embeddings) entra como plugin sem tocar o núcleo.
- [ ] Manutenível: reindex incremental; `doctor` diagnostica índice sujo.
- [ ] Documentação completa em `docs/ai/aci.md` (PT-BR) + README do pacote.
- [ ] Cobertura de testes das queries e do cache.
- [ ] Compatível com a arquitetura existente e com ADR-004 (estende, não contradiz).
- [ ] Não quebra o desenvolvimento paralelo da V1 (jogo roda idêntico sem o ACI).

---

## 8. Decisão do Creative Director

(aguardando — aprovar / ajustar / rejeitar)

Perguntas abertas para o CD decidir antes da F0:
1. **Escopo da V1 do ACI:** confirmar **sem embeddings** agora (recomendação da IA), deixando como plugin da Fase 5+? 
2. **Branch:** paralela dedicada `aci` (recomendado) ou direto na de trabalho?
3. **Prioridade vs V1:** encaixar entre tasks da V1 (não bloqueia) ou concentrar num bloco?

## 9. Notas da IA (riscos e alternativas)

- **Risco de over-engineering:** o maior. Mitigado escolhendo estrutural+lexical em vez de vetorial — a solução é proporcional ao corpus. Se em 6 meses o codebase triplicar, a Fase 5 abre o slot de embeddings sem retrabalho.
- **Risco de índice envelhecer:** mitigado por reindex incremental por hash + `doctor` + (opcional) hook de git.
- **Alternativa considerada e descartada:** adotar um MCP de terceiros pronto (ex.: servidores de "codebase context" da registry). Descartado para a V1 porque nenhum entende o *corpus de docs PT-BR + specs/ADRs/prompts* deste projeto — que é metade do valor aqui. Um MCP genérico indexaria só código. Podemos reavaliar na F5.
- **Sinergia:** o `aci_context_for_feature` pode um dia alimentar o próprio AGENTS.md/DOC_MAP (gerar o roteamento "papel→arquivos" automaticamente em vez de à mão).
