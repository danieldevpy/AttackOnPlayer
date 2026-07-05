# PROMPT-0029 — T-020: arquitetura de IA dos bots em camadas (docs/ai/bot-architecture.md) · 2026-07-05

## Pedido (resumo fiel do CD)
Continuação da execução autônoma sequencial da V1 — `Executar T-020` após a T-019b, sem pausar para aprovação.

## Decisões tomadas (e por quem)
- **6 módulos novos em `packages/bots/src/ai/`**, um por camada do doc teórico: `types.ts` (contrato), `perception.ts` (snapshot filtrado + ruído de distância), `memory.ts` (hysteresis de alvo + desistência), `decision.ts` (**Utility AI, função pura**), `steering.ts` (**context steering, função pura**), `humanizer.ts` (reação/mira com lerp+erro decrescente/cadência com jitter/pausas — estado local, não precisa ser puro) e `personality.ts` (`PERSONALITY_BY_SKILL`).
- **`decision.ts`** implementa os 4 scores viáveis nesta task (`engage/flee/collect/wander`) com inércia (margem `SWITCH_MARGIN=0.08` — só troca de ação se a nova superar a atual por essa margem). `disputar_bandeira`/`manter_posição` do doc teórico ficam **de fora até a T-021 existir** (Gameplay First: sem bandeira no jogo, não há dado para decidir sobre ela).
- **`steering.ts`** resolve o esbarrão na borda (P1): 12 direções candidatas, interesse = cosseno do ângulo até o alvo desejado (ou uniforme leve sem alvo), perigo amostrado via callback injetado (mantém a camada desacoplada do mapa); `lateralBias` acrescenta um componente perpendicular para o strafe orbital em duelo (sinal estável por alvo via hash do id, evita trocar de lado a cada tick).
- **`personality.ts`** é uma ponte temporária: deriva `Personality` dos 3 níveis de skill que já existiam (T-008), não presets nomeados novos — isso é explicitamente o escopo da **T-008b** ("perfis de bot... sorteados por sessão"), e construir os dois juntos seria antecipar uma task que ainda não rodou.
- **`bot.ts`** foi reescrito para orquestrar as 6 camadas por tick (percepção → memória → decisão → reação do humanizador → steering → anti-stuck como rede de segurança → atuação), preservando 100% do comportamento observável (BFS para coleta distante, chumbo/lead na mira, telemetria de shots/engagedTicks/minDist, logs de level_up/speed_up/fugindo/preso).
- **Achado técnico durante a implementação:** um `import` estático de `@aop/shared` em `perception.ts` quebrava em runtime (`tsx`) com "does not provide an export named 'zoneAt'", embora o mesmo pacote funcione com `import()` dinâmico em `bot.ts` (padrão que já existia ali, aparentemente por esse motivo). Resolvido desacoplando `perception.ts` do shared por completo: em vez de receber `GameMap`+`zoneAt`, a função passou a receber `MapBounds{w,h}` e uma função `zoneOf(x,z)` injetada por quem chama — deixa a camada de percepção genérica de verdade (nem precisa saber que existe um "mapa" concreto), e evita o problema de resolução do zero.

## Resultado verificado
- **Gates:** shared 13/13 · server 19/19 · **bots 11/11 (novo)** · `tsc --noEmit` limpo ×3 (client/server/bots) · guarda `.js` órfão sem saída.
- **Testes puros (decision.test.ts, 6 casos):** engajar com vida cheia + inimigo fraco perto; fugir com vida baixa + ameaça perto mesmo com aggression alta; inimigo em zona safe nunca é alvo de engajar; coletar sem inimigos e greed alto; perambular como fallback sem nada por perto; **inércia comprovada com números** (cenário onde `collect` venceria por escore bruto, mas com `prevAction="engage"` a margem mantém o bot engajando).
- **Testes puros (steering.test.ts, 5 casos):** segue o vetor desejado sem perigo; desvia de um perigo bem na direção desejada (resolve o esbarrão na borda); não empurra o bot sem alvo e com perigo em toda direção; `lateralBias` produz componente perpendicular (orbital) e inverte de lado com o sinal.
- **Smoke `BOT_VERBOSE=1 npm run bots -- 4 20`:** engajar/fugir/coletar/level_up/speed_up todos observados no log; `"preso — escapando lateralmente"` disparou só 1 vez em 20s com 4 bots — confirma a promessa do doc ("anti-stuck vira rede de segurança raramente acionada").
- Adicionado `vitest` como devDependency + script `test` em `packages/bots/package.json` (mesmo padrão de shared/server); `docs/QA.md` ganhou o gate `cd packages/bots && npx vitest run`.

## Regras que nascem daqui
- **`decision.ts` e `steering.ts` são funções puras e proibidas de importar `@aop/shared` (ou qualquer coisa com estado/rede)** — tudo que precisam vem por parâmetro. Isso não é só estilo: foi literalmente a causa do bug de import acima, e é o que permite testar as duas camadas com `vitest` puro, sem servidor nem mapa de verdade.
- **Comportamento novo de bot = entrada em `personality.ts` (ou uma nova consideração de score documentada), nunca um novo `if` em `bot.ts`.** A T-008b é o teste real dessa promessa.
- **Ação nova na decisão exige que o dado dela já exista no jogo** (ex.: bandeira antes de `disputar_bandeira`) — não se constrói consideração de utility para algo hipotético.

## Pendências para o próximo prompt
- Próxima task da fila: **T-008b** — personalidade, atributos e boss (presets nomeados substituindo `PERSONALITY_BY_SKILL`, política de escolha de cards por perfil, boss nível 6–8).
- Telemetria de decisão/escores por tick (T-026) ainda não existe — quando entrar, é o que permite calibrar as curvas de `decision.ts` com dados reais em vez de números estimados.
