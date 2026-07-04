# Mapa de documentação — quando ler o quê

> **Camada opcional de continuidade** (commit isolado, só docs + ponteiros em AGENTS/instrucoes).  
> Para remover: `git revert <hash-do-commit-docs>` — não altera código de gameplay.  
> O fluxo legado continua válido: `AGENTS.md` → `DEVLOG.md` (topo) → `BACKLOG.md` → último `PROMPT-NNNN.md`.

Este arquivo orienta **humanos e agentes de IA** sobre qual doc seguir em cada situação. Objetivo: continuidade entre sessões e modelos diferentes **sem** reler o repositório inteiro.

## Hierarquia (do mais volátil ao mais estável)

| Doc | Atualiza quando | Confiança | Para quê |
|---|---|---|---|
| **`docs/SESSAO_ATUAL.md`** | Fim de **cada** sessão de trabalho | Alta para “onde paramos agora” | Ponteiro imediato: branch, última task, próximo passo, veredito do CD |
| **`docs/DEVLOG.md`** (topo) | Fim de cada sessão / task entregue | Alta para histórico recente | O que foi feito, como foi verificado, aprendizados |
| **`docs/prompts/PROMPT-NNNN.md`** | Cada prompt de desenvolvimento | Alta para aquela leva | Pedido, decisões, resultado, pendências |
| **`docs/BACKLOG.md`** | Task concluída ou repriorizada | Alta para execução | Próxima task, contexto mínimo, critérios de aceite |
| **`docs/mechanics/PLAYER_LOOP.md`** | Mudança em XP/atributos/combate/economia | Alta para gameplay FAQ | “O que reroll faz?”, “como escalar?”, números de referência |
| **`docs/QA.md`** | Nova camada de teste ou fluxo crítico | Alta para merge/validação | O que é automático vs manual |
| **`docs/VISAO-ATUAL.md`** | Marco ou conjunto de features muda de fase | Média-alta para direção | Snapshot do jogo e do milestone — **não** substitui SESSAO_ATUAL |
| **`docs/ROADMAP.md`** | Marco fecha ou escopo muda | Média para planejamento | M0..M5, status por marco |
| **`docs/DECISION_LOG.md`** | Decisão arquitetural nova (ADR) | Permanente | Por quê algo foi feito assim |

## Regra de conflito

Se dois docs discordarem:

1. **Comportamento do jogo** → código em `packages/shared/src/constants.ts` + servidor (`ArenaRoom`, `EffectSystem`) vencem.
2. **“O que fazer agora”** → `SESSAO_ATUAL.md` vence `VISAO-ATUAL.md`.
3. **Detalhe de uma task recente** → último `PROMPT-NNNN.md` + topo do `DEVLOG.md` vencem `VISAO-ATUAL.md`.
4. **Direção de produto / marco** → `ROADMAP.md` + `VISAO-ATUAL.md` vencem um DEVLOG antigo.

## Fluxo de reidratação (nova sessão de IA)

Ordem mínima (~6 leituras):

1. `AGENTS.md`
2. `docs/SESSAO_ATUAL.md`
3. `docs/DEVLOG.md` (só a primeira entrada)
4. Último `docs/prompts/PROMPT-NNNN.md`
5. Se for implementar: contexto da task em `docs/BACKLOG.md`
6. Se for dúvida de gameplay/balance: `docs/mechanics/PLAYER_LOOP.md`

**Não ler por padrão:** DEVLOG inteiro, todos os PROMPTs, todo o código.

## Fluxo por tipo de pedido

| Pedido do CD | Ler |
|---|---|
| “Executar T-00X” | BACKLOG (task) + contexto listado na task |
| “Onde estamos?” | SESSAO_ATUAL → DEVLOG (topo) → ROADMAP |
| “Como funciona X no jogo?” | PLAYER_LOOP → mechanics específico → constants.ts |
| “Posso mergear?” | QA.md |
| “Por que decidimos Y?” | DECISION_LOG → PROMPT da época |
| Feature fora do backlog | specs/TEMPLATE.md + AGENTS processo |

## Obrigações da IA ao encerrar sessão

1. Entrada nova no topo de `docs/DEVLOG.md`
2. **Substituir** `docs/SESSAO_ATUAL.md` (não append — é ponteiro único)
3. Atualizar `docs/VISAO-ATUAL.md` **só se** mudou fase do milestone (ex.: T-008 concluída → marcar combate de bots pronto)
4. `docs/QA.md` / `PLAYER_LOOP.md` — atualizar se nasceu mecânica ou fluxo de teste novo
5. `PROMPT-NNNN.md` se houve prompt de desenvolvimento

## Por que dois arquivos: VISAO vs SESSAO?

- **`VISAO-ATUAL.md`** = retrato estável do produto (“o jogo tem combate, debug F3, falta bots atirarem”). Muda pouco.
- **`SESSAO_ATUAL.md`** = “acabamos de commitar T-007, branch X, CD ainda não testou Y”. Muda toda sessão.

Ter os dois evita reescrever a visão inteira a cada commit e evita perder o fio da meada entre sessões.
