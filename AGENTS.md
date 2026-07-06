# AGENTS.md — AttackOnPlayer

Este arquivo define como agentes de IA trabalham neste projeto. Leia-o SEMPRE antes de qualquer tarefa.

## Papéis

| Papel | Quem | Responsabilidade |
|---|---|---|
| Creative Director | Daniel | Decisão final. Visão criativa. |
| Lead Game Designer / Arquiteto | IA (agente principal) | Propor, discordar, registrar, alertar riscos, implementar. |

A IA tem voz própria: opina em `docs/LEAD_DESIGNER_NOTES.md`, registra decisões do Daniel em `docs/CREATIVE_DIRECTOR_NOTES.md` e nunca confunde as duas vozes. Decisões arquiteturais viram ADR em `docs/DECISION_LOG.md`. Todo fim de sessão de trabalho: entrada no `docs/DEVLOG.md` + **substituir** `docs/SESSAO_ATUAL.md`.

## Documentação — qual arquivo seguir

Mapa completo: `docs/DOC_MAP.md`. Resumo:

| Situação | Ler |
|---|---|
| Nova sessão / “onde paramos?” | `docs/SESSAO_ATUAL.md` → topo do `DEVLOG.md` |
| Visão do produto / milestone | `docs/VISAO-ATUAL.md` (estável; não substitui SESSAO) |
| Gameplay (“o que reroll faz?”) | `docs/mechanics/PLAYER_LOOP.md` |
| Merge / testes | `docs/QA.md` |

**Conflito:** SESSAO_ATUAL vence VISAO-ATUAL para “próximo passo”; código vence docs para números/comportamento.

## Camada de contexto para agentes (ACI) — use antes de abrir arquivos inteiros

`packages/aci` (PROPOSAL-0003, ADR-018) indexa código e documentação do repo e devolve **trechos/resumos cirúrgicos** em vez do arquivo inteiro — economia medida de ~80–95% de tokens nas consultas típicas. Hoje é uma **CLI** (o servidor MCP é a F5, ainda não construída), então chame via `Bash`/terminal antes de ler um arquivo por inteiro:

```bash
npm run aci -- summary <SPEC-NNNN|ADR-NNN|PROMPT-NNNN|PROPOSAL-NNNN|caminho/do/arquivo.md>
npm run aci -- search <termo> [--kind=function|class|interface|type|enum|const|doc|spec|adr|prompt|proposal]
npm run aci -- related <símbolo|caminho/arquivo.ts|ADR-NNN>   # "quem governa X?" — código→docs e doc→doc
npm run aci -- index [--force]                                # reindexa (cache incremental por hash) após editar código/docs
npm run aci -- doctor                                          # diagnóstico se a busca parecer desatualizada
```

**Fluxo recomendado:** `summary`/`related`/`search` primeiro → só abre o arquivo inteiro (`Read`) se o trecho devolvido não bastar. Cobre `packages/*/src` (símbolos exportados) e docs/specs/ADRs/prompts/proposals (por seção de heading). Isolado do jogo — `packages/aci` não é importado por nenhum outro pacote, fora dos gates do jogo, remoção trivial.

## Agentes especialistas (contexto mínimo por papel)

Para economizar tokens, cada especialista lê APENAS seus arquivos:

| Agente | Lê |
|---|---|
| Gameplay | `docs/GAME_CONSTITUTION.md`, `docs/mechanics/*` |
| Balance | `docs/mechanics/progression.md`, `docs/mechanics/aura.md`, `docs/observability/metrics.md` |
| Backend/Network | `docs/multiplayer/*`, `packages/server/`, `packages/shared/` |
| Matchmaking | `docs/multiplayer/matchmaking.md` |
| Bots/IA | `docs/ai/bots.md`, `packages/bots/` |
| Trends & Gamification | `docs/ai/trends-agent.md` (prompt completo lá) |
| QA | spec ativa em `specs/`, código da feature |

## Processo de feature (obrigatório)

1. Spec curta em `specs/` (usar `specs/TEMPLATE.md`).
2. Decisão do CD registrada (aprovado/ajustado/rejeitado).
3. Implementar com placeholders (ver Princípios).
4. Testar com bots headless.
5. DEVLOG + atualizar ROADMAP.
6. **Log de prompt:** cada prompt de desenvolvimento gera `docs/prompts/PROMPT-NNNN.md` (pedido, decisões, resultado verificado, regras novas). Ver `instrucoes/REGRAS_DE_PROMPT.md`.

O Creative Director tem sua pasta de referência em `instrucoes/` — mantê-la atualizada quando processos mudarem.

## Princípios inegociáveis

1. **Gameplay First / Debug First** — nenhuma feature nasce com arte. Cápsula, cubo, esfera, UI placeholder.
2. **Servidor autoritativo** — cliente nunca decide resultado (posição final, dano, drop, nível).
3. **Partidas curtas** — sessão alvo de 2–3 min. Toda mecânica respeita isso.
4. **Anti pay-to-win / anti snowball** — vantagem vem de habilidade; aura dá oportunidade, não sorte.
5. **Leve sempre** — roda em navegador de celular fraco. Orçamento: < 200 draw calls, geometria placeholder.
6. **Token economy** — agentes leem só o contexto do seu papel; nunca o repo inteiro. Ver §Camada de contexto para agentes (ACI) pra ferramenta concreta antes de abrir arquivos.
7. **Docs em PT-BR**, código e identificadores em inglês.

## Comandos

```bash
npm install            # raiz (workspaces)
npm run dev:server     # servidor Colyseus :2567
npm run dev:client     # cliente Vite :5173
npm run bots -- 3 30   # 3 bots por 30s
npm run aci -- doctor  # ACI: infra de contexto pra agentes — ver seção acima
```
