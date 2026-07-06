# PROMPT-0032 — QA do teste manual: tank controls no keyboard + bots que simulam players · 2026-07-05

## Pedido (resumo fiel do CD)
Primeiro teste manual do CD sobre as levas T-019/T-019b/T-020/T-008b/T-021, com lista de bugs/ajustes para resolver um a um (com intervalo de teste). Num segundo prompt, o CD refinou a direção dos bots: *"a ideia é que os bots simulem players — ataca, vai pra cima, às vezes corre, às vezes volta a atacar, quando encurralado para de correr e volta a atacar"*; não quer todos focando o portador da bandeira — quer conflitos entre si, com o portador como um alvo possível, "compartilhando" alvos para dividir a jogatina.

Anotações do teste manual:
1. Keyboard: WASD absoluto ficou estranho — quer W/S andando pela rotação do jogador.
2. Bots só perseguem o portador da bandeira e param de atirar.
3. Bots empilham uns nos outros ao perseguir o portador.
4. Bots todos iguais (fogem infinitamente com vida baixa, esfregam na borda, param de atirar encurralados) — quer comportamento específico por bot + dosagem de características.
5. Bandeira: instância única com o portador; ao perder, disputável no local; sem pickup em 5s volta ao centro.
6. `npm run bots` com 10 só entra ~6; conferir perfil aleatório por bot.
7. Logs: `colyseus.js: onMessage() not registered for type 'announce'`.

## Decisões tomadas (e por quem)
- **Keyboard vira tank controls (CD):** `keyboardProfile.ts` — W/S avançam/recuam na direção da rotação, A/D strafe lateral relativo a ela, setas giram. A mira passa a ser enviada **todo tick** (rotação é o estado central do perfil; sem ela o facing-por-movimento do servidor viraria o boneco ao recuar com S). Nasce olhando para "cima" da tela (−z). Dica do HUD agora é por perfil ativo (`CONTROL_HINTS` em `hud.ts` + `getProfileId` no `HudCtx`).
- **Disputa de bandeira É engage (CD/IA):** bandeira **carregada por inimigo** deixou de ser a ação `flag` — o portador vira candidato de `engage` com bônus `× (1 + objective)` e alcance estendido (`engageRange × 1.6`), então o bot mira/orbita/atira nele. A ação `flag` fica só para bandeira **no chão** (corrida de pickup). `PerceivedFlag`/`RawFlag` ganharam `carrierId`.
- **Alvos "compartilhados" (CD):** `decide()` ganhou `DecideOptions` com `targetBias` (viés determinístico por (bot, inimigo), hash estável 0.8..1.2 injetado por `bot.ts`) e `stickyTargetId` (hysteresis ×1.15 por candidato). Engage avalia os 4 inimigos mais próximos fora de safe (não só o primeiro) — bots diferentes elegem alvos diferentes e o portador não é monopolizado.
- **Encurralado → vira e luta (CD):** se a decisão seria `flee` mas `nearestBorderDist < 3` e há inimigo no raio, troca por `engage` no mais próximo. `hpFrac` não pesa de propósito — é briga de desespero.
- **Kite (CD):** no ramo `flee` da atuação, com o perseguidor dentro do alcance do launcher (fora de safe), o bot mira e atira enquanto corre — player não foge de costas calado.
- **Dosagem individual (CD):** `withIndividualDosage()` em `personality.ts` — ±25% nos pesos (clamp 0..1), ±20–30% nos knobs (ranges jitterados com fator único para nunca inverter), aplicada sempre (mesmo com `BOT_PROFILE` fixo). Log de entrada mostra a dosagem.
- **Separação (IA):** vizinhos a <1.8u empurram o vetor de movimento pós-steering para fora (peso linear) — caçadas em grupo não empilham.
- **Bots na mesma sala + `MAX_PLAYERS` 8→16 (CD):** o primeiro bot fixa a sala (`joinOrCreate`), os demais entram por `joinById`; sala lotada gera erro explícito (antes o `joinOrCreate` criava outra sala silenciosamente — era o "10 viram 6"). 16 acomoda ~10 bots + humanos nas sessões de teste.
- **`FLAG_ABANDON_RETURN_MS` 15000→5000 (CD):** o resto do fluxo pedido (instância única, drop no local, retorno ao centro) já estava correto no `FlagSystem` da T-021 — só o tempo mudou.
- **Warning `announce`:** handler no-op no cliente dos bots (o servidor faz broadcast de `farm_event` para todos; só o cliente humano exibe).

## Resultado verificado
- **Gates:** shared 13/13 · server 25/25 · bots 24/24 (20 anteriores + 4 novos em `decision.test.ts`: portador→engage, não-monopólio do portador, targetBias espalhando alvos, encurralado→engage) · `tsc --noEmit` limpo em server/bots/client.
- **Tank controls verificados no browser real** (preview + eventos sintéticos): girar com seta muda o facing (−90°→87°), W move na direção do facing (z 2.5→8.9), S recua sem virar o boneco, dica do HUD por perfil correta, console limpo.
- **Smoke 10 bots:** todos na MESMA sala, perfis sorteados com dosagens todas distintas (dois `cacador` com agr 0.95/0.89 etc.), combate real (até 23 tiros/bot), zero warnings `announce`.
- **Ciclo da bandeira observado ao vivo** (observador colyseus.js + 5 bots): pickup no centro aos 29.6s → portador caçado e **morto** aos 40.7s (`flag_drop reason: death` longe do centro) — a disputa agora mata o portador, antes só o seguia.
- **Veredito do CD:** *"está melhor agora"* — aprovado, pediu commits + docs.

## Veredito CD (preencher após teste no browser)
- Testado em: 2026-07-05
- Fluxos: keyboard tank controls / bots disputando bandeira / variedade de bots / 10 bots
- Resultado: **aprovado** (após 2 iterações — a 1ª leva de bots ainda perseguia sem atirar)
- Observações: direção reforçada — bots devem *simular players* (alvos distribuídos, briga entre si, encurralado luta).

## Regras que nascem daqui
- **Objetivo móvel carregado por um inimigo não é uma ação própria — é bônus de engage no carregador.** Perseguição sem tiro é exatamente o anti-padrão que o CD rejeitou; qualquer objetivo futuro do tipo "roubar X de alguém" entra como viés de alvo, não como nova ação de perseguição.
- **Variedade de bot = preset (identidade) × dosagem (indivíduo).** Novos arquétipos continuam sendo presets nomeados; a individualidade dentro do preset vem de jitter aplicado uma vez no nascimento, nunca de aleatoriedade por tick.
- **Ferramenta de teste nunca degrada silenciosamente:** bot que não consegue entrar na sala alvo loga erro alto e sai — não cria sala paralela onde ninguém está olhando.

## Pendências para o próximo prompt
- Retomar a fila da V1: **T-022** (VFX nomeados + backlog vivo `docs/mechanics/vfx-juice-backlog.md`).
- Calibração fina dos novos knobs (bônus do portador `1+objective`, faixa do `targetBias` 0.8..1.2, `SEPARATION_DIST` 1.8, `CORNERED_BORDER_DIST` 3) é chute inicial validado por sensação — T-026/telemetria confirma com dados.
- `MAX_PLAYERS = 16` vale para as salas de teste; quando o matchmaking real existir (pós-V1), revisitar se sala pública usa outro teto.
