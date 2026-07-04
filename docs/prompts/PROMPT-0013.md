# PROMPT-0013 — T-008: bots de combate (mínimo) · 2026-07-04

## Pedido (resumo fiel do CD)
- Backlog implementado até T-007; falta T-008. Antes de mexer, avaliar se os "frameworks" (spec-kit e dotcontext) estão sendo usados corretamente e como retomar o projeto.
- Após a análise, decisões do CD: **arrumar a base primeiro** (commit/docs) e implementar a T-008 no **mínimo do aceite** (personalidade/atributos/boss ficam para T-008b).

## Análise entregue (frameworks)
- spec-kit/dotcontext **não são usados como ferramentas** — o ADR-004 os substituiu por processo leve in-repo, e essa réplica está sendo seguida bem. Equivalente spec-kit: GAME_CONSTITUTION → specs/ (TEMPLATE) → BACKLOG (tasks) → 1 commit/task. Equivalente dotcontext: docs/ como memória (DOC_MAP, SESSAO_ATUAL, DEVLOG, DECISION_LOG, prompts/).
- Desvios apontados: (1) specs pararam no SPEC-0002 — T-003..T-008 vivem só como task/ADR/prompt (aceitável pelo ADR-004, mas é lacuna vs spec-kit puro); (2) `SESSAO_ATUAL` apontava branch defasada (`continuar_antrigravity`) enquanto o repo estava em `task_008`; (3) edição não commitada em BACKLOG redefinindo T-008; (4) `bots.md` e o "Contexto" da T-008 não refletiam o escopo novo.

## Decisões tomadas (e por quem)
- CD: base primeiro; escopo mínimo. IA: dividir T-008 (mínimo) de T-008b (personalidade/atributos/boss), com a estrutura de skill como gancho.
- IA: **ignorar alvos em zona safe** na seleção de inimigo — evita o bot travar mirando alguém intocável no próprio spawn (causa-raiz observada: dois bots congelavam a 3.1 tiles dentro de safe, 0 tiros).
- IA: mira com **chumbo/lead** (prevê a posição do alvo pelo tempo de voo do projétil) para elevar a taxa de acerto de alvos em movimento.
- IA: perfis de skill `fraco|medio|forte` via `SKILLS` (erro de mira, raio de caça, limiar de fuga). `forte` = caçador que persegue pelo mapa todo. Env `BOT_SKILL` fixa a skill; ausente = sorteada por bot.

## Resultado verificado
- Typecheck limpo em `packages/shared` (via testes), `server`, `client` e `bots`.
- Suíte shared: **10/10**.
- Novo teste determinístico `packages/server/src/systems/projectiles.test.ts` (**2/2**): prova a cadeia tiro→dano→morte→evento de kill e o bloqueio de dano em zona safe.
- Corrida ao vivo (servidor `DEBUG=1` + bots `BOT_SKILL=forte`): bots miram, atiram e se acertam; sessão de 6 bots registrou **18 hits, 1 kill e 1 death** (payload de kill com shooter/victim e `hpAfter:0`). Confirma o aceite "geram kills entre si". Kills têm variância alta em janelas curtas por causa da fuga a 25% de HP (candidato a ajuste no passe de balance, T-OPTIONAL).

## Veredito CD (preencher após teste no browser)
- Testado em: —
- Fluxos: combate bot×bot / fuga / skill (fraco/médio/forte)
- Resultado: pendente
- Observações:

## Regras que nascem daqui
- Bot nunca engaja alvo em zona safe (desperdício — servidor bloquearia o tiro).
- Números de combate do bot saem só de `packages/shared/src/launchers.ts` e de `zoneAt`; nada de constante de arma hardcoded no bot.
- Camada de skill é o único ponto de extensão para personalidade/boss (T-008b).

## Pendências para o próximo prompt
- CD testar no navegador (2 abas ou bots) e dar veredito.
- T-008b: perfis de personalidade/atributos sorteados + modo boss.
- Merge de `continuar_antrigravity`/`task_008` → `main` (checklist em `docs/QA.md`); `main` está defasado.
- Balance (T-OPTIONAL): TTK real e ajuste do limiar de fuga para kills menos raros.
