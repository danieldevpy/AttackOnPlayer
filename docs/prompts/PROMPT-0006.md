# PROMPT-0006 — T-003: XP, nível, atributos múltiplos · 2026-07-04

## Pedido (resumo fiel do CD)
Continuação da sequência de tasks do backlog (mesmo prompt do PROMPT-0005): "execute sequencialmente as tarefas até terminar essa spec".

## Decisões tomadas
- IA: `xpToNext(level) = round(XP_BASE × level^XP_EXP)` em `constants.ts` — 2 constantes controlam todo o pacing, como growth.md pedia. `Player.xp`/`Player.coins` entram no schema; XP acumulado dispara level-up em loop (cobre XP suficiente para vários níveis de uma vez, ex.: farm_event no futuro).
- Atributos (velocidade/força/vitalidade) viram uma segunda camada dentro do `EffectSystem` já existente — **mesma função `recompute()`**, sem pipeline novo (era o pedido explícito do growth.md e o que LEAD_DESIGNER_NOTES já elogiava como arquitetura saudável). Preset v1 é literalmente equilibrado: cada nível soma 1 ponto em CADA atributo (`ATTR_POINTS_PER_LEVEL_EACH=1`), cada ponto vale +4% (`ATTR_POINT_VALUE`).
- Velocidade por atributo empilha multiplicativamente com o speed_up temporário e respeita o mesmo teto (`SPEED_MAX_MULT=2`) — um único lugar decide o cap.
- Primeiro teste unitário do projeto: `packages/shared/src/constants.test.ts` (vitest) cobre a curva (fórmula bate, nunca decresce, nunca ≤0). Adicionado `vitest` como devDependency de `@aop/shared` + `npm run test` na raiz.

## Resultado verificado
- `npm run test`: 3/3 passando.
- `tsc --noEmit` limpo em server e client.
- Bots headless (2 bots, 12s): nível subiu pela curva (não mais +1 fixo por coleta); estado refletiu atributo (bot-1 chegou a `speed=1.04` só por ponto de velocidade, sem ter pego speed_up — confirma que o atributo soma independente do efeito temporário); bot-0 pegou speed_up de verdade e mostrou `x1.5` empilhando por cima da base.

## Regras que nascem daqui
- Atributo novo (ex.: crítico, defesa) nunca ganha pipeline próprio — entra em `AttrPoints`/`recompute()` do EffectSystem, igual força/velocidade/vitalidade.
- Curva de XP só muda via `XP_BASE`/`XP_EXP`; nunca hardcode de "nível tal precisa de tanto".
- A partir daqui, lógica pura e testável (curvas, fórmulas) ganha teste em `*.test.ts` — não é mais opcional (dívida registrada em LEAD_DESIGNER_NOTES está sendo paga).

## Nota lateral (não bloqueia)
`bots/src/bot.ts` loga "speed_up!" olhando só `me.speed > 1`, então agora também dispara quando é só o atributo de velocidade (sem ter pego o coletável). É só rótulo de log, não afeta a mecânica — ajuste natural quando T-008 (bots de combate) mexer no bot.

## Pendências para o próximo prompt
T-004 (coletáveis expandidos + spawn por zona) — decisões de CD já registradas em CREATIVE_DIRECTOR_NOTES/growth.md, pode seguir.
