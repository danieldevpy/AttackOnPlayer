# Como continuar o desenvolvimento

## Rodar o jogo (3 terminais)

```bash
cd ~/Desenvolvimento/AttakOnPlayer
npm install               # só na 1ª vez ou quando package.json mudar
npm run dev:server        # terminal 1 — ws://localhost:2567
npm run dev:client        # terminal 2 — http://localhost:5173
npm run bots -- 3 0       # terminal 3 — 3 bots; 0 = ficam para sempre
```

`npm run bots -- <qtd> <segundos>` — segundos 0 = infinito. Sem bots rodando, você fica sozinho no mapa (o bot NÃO nasce automático ainda; isso é o Guardian, M3).

## Continuar com a IA (mesma sessão)
Só mandar o próximo prompt. O contexto já está carregado.

## Continuar em NOVA sessão (importante)
A IA não lembra nada entre sessões — os **arquivos** lembram. Comece a nova sessão com:

> Projeto AttackOnPlayer em ~/Desenvolvimento/AttakOnPlayer. Leia AGENTS.md,
> docs/SESSAO_ATUAL.md, docs/DEVLOG.md (última entrada) e o último
> docs/prompts/PROMPT-NNNN.md. Depois me diga em que ponto estamos.

Isso recarrega o estúdio em ~4 leituras. Mapa completo de docs: `docs/DOC_MAP.md`.

- **`SESSAO_ATUAL.md`** — onde paramos *agora* (substituído a cada sessão)
- **`VISAO-ATUAL.md`** — retrato estável do jogo (atualizar só quando mudar fase do marco)
- **`PLAYER_LOOP.md`** — FAQ de gameplay (reroll, escalar, combate)
- **`QA.md`** — o que testes/bots cobrem vs. smoke manual

Nunca comece pedindo feature direto: a IA precisa reidratar o contexto primeiro.

## Fluxo por TASKS (vigente desde PROMPT-0003 — controle de tokens)
O trabalho agora está fatiado em `docs/BACKLOG.md`. Seu prompt de implementação é só:

> Executar T-001 do docs/BACKLOG.md

A IA lê apenas o contexto listado na task, implementa, testa com bots, registra e commita. Uma task por prompt, no seu tempo. Tasks com ⚠️ pedem uma decisão sua ANTES — decida no mesmo prompt ("Executar T-004; decisão: box vale só no round").

## Fluxo de pedido de feature nova (fora do backlog)
1. Você descreve o que quer (ver `REGRAS_DE_PROMPT.md`).
2. A IA escreve/atualiza a SPEC e aponta riscos ANTES de codar.
3. Implementa com placeholders, testa com bots headless.
4. Registra: DEVLOG + docs/prompts/PROMPT-NNNN.md + commit.
5. Você testa no navegador e dá o veredito — que também vira registro.

## Se algo quebrar
- Servidor não sobe → `npm install` de novo; conferir Node >= 20.
- Cliente conecta mas não vê mapa → servidor e cliente em versões diferentes (recarregar os dois).
- Dúvida sobre uma decisão antiga → procurar em docs/DECISION_LOG.md.
