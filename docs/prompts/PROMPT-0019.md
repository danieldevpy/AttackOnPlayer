# PROMPT-0019 — Bugfix pós-teste manual: F3 sem log, bot "impossível de matar", bot grudando em obstáculo · 2026-07-04

## Pedido (resumo fiel do CD)
Depois de testar a SPEC-0003 (facing/mira/gatilhos) e a jogatina com bots, o CD relatou três problemas:
1. O overlay F3 não mostrou nenhum log/evento.
2. O bot atira infinitamente e fica muito difícil de matar; quer a "velocidade de ataque" baseada na skill (`fraco | medio | forte`), mas não 100% fixa — variando de forma aleatória, tipo um "peso".
3. Quer um sistema no bot pra detectar quando ele fica preso/grudado em obstáculos, pra ficar mais natural.

## Diagnóstico
1. **F3 sem log:** o feed de eventos ao vivo (`debug_event` via WebSocket) só era transmitido quando o servidor rodava com `DEBUG=1` — um segundo interruptor que ninguém lembrava de ligar (a tecla F3 já é o "liga" do lado do cliente). O ring buffer e o `GET /debug/rooms` já eram sempre ativos; só o broadcast ao vivo estava atrás da env var. Confirmado reproduzindo: subindo o servidor sem `DEBUG=1`, abrindo F3 e vendo a seção "SALA/MEU PLAYER" preenchida (isso não depende de `DEBUG`) mas o feed de eventos vazio.
2. **Bot "impossível de matar":** o gatilho do bot (`fire = true`) era ligado em TODO tick de pensamento (100ms) em que o alvo estava no alcance — o único limite real era o cooldown do lançador (`LAUNCHERS[...].fire.cooldownMs`), que é igual pra humano e bot (ex.: 600ms pro `basic_shot`). Ou seja, todo bot engajado atirava no ritmo máximo da arma, sem relação nenhuma com a skill.
3. **Bot grudando em obstáculo:** o vetor de movimento em combate (`combatDir`) é uma linha reta até/afastando do inimigo, sem nenhum desvio de obstáculo (diferente da caça a coletável, que usa BFS). Se um prop ficava no meio do caminho, o bot continuava mandando a mesma direção bloqueada indefinidamente.

## Decisões tomadas (e por quem)
- IA: **F3** — removida a checagem `DEBUG=1` do broadcast (`ArenaRoom.emitDebug`). O feed ao vivo passa a sempre acompanhar o ring buffer e o `/debug/rooms`, que já eram sempre-on. `DEBUG=1` continua existindo só pro `dev_launcher` (T-012), que é um mecanismo separado.
- IA: **Velocidade de ataque** — cada `SkillName` ganhou `fireIntervalMs: [min, max]` em `packages/bots/src/bot.ts` (`fraco` 1000–1900ms, `medio` 550–1050ms, `forte` 280–600ms). O bot mantém seu próprio `nextFireAt`; a cada tiro sorteia o próximo intervalo dentro da faixa da skill (`lo + Math.random()*(hi-lo)` — o "peso" aleatório pedido). Esse gate é adicional ao cooldown do lançador, nunca o substitui (arma continua igual pra todo mundo — só a *disposição* do bot pra puxar o gatilho muda por skill).
- IA: **Anti-stuck** — sem tocar em raycasting/geometria: o bot compara a posição autoritativa (`me.x/me.z`, resolvida pelo servidor) entre um tick e o anterior. Se pretendia andar (`moveVec` com módulo > 0.3) e o deslocamento real ficou abaixo de `STUCK_DIST_EPS` (0.05u) por `STUCK_TICKS_THRESHOLD` ticks seguidos (5 ticks ≈ 500ms), assume que colidiu e força um desvio lateral (perpendicular ao vetor pretendido, lado sorteado) por 350–700ms antes de voltar ao comportamento normal (combate ou BFS). Escolhido em vez de detecção geométrica porque reaproveita a autoridade do servidor (`moveWithCollision`) sem duplicar conhecimento do mapa no bot — funciona igual contra qualquer prop novo, sem manutenção.
- IA: refatorado o fim do loop de decisão do bot pra computar um único `moveVec` (tanto no branch de combate quanto no de coleta) antes de aplicar o anti-stuck e mandar o input — evita duplicar a lógica de override em dois lugares.

## Resultado verificado
- Typecheck limpo em `server` e `bots` (`tsc --noEmit`); `npm run test` (shared) 5/5; suíte do server 4/4.
- **F3 sem `DEBUG=1`:** subi o servidor via `npm run dev:server` (sem a env var), conectei 2 bots na mesma sala, abri F3 no browser (preview) — feed de eventos mostrou `spawn` ao vivo normalmente. Confirma o bug corrigido.
- **Velocidade de ataque:** `npm run bots -- 3 30` (skill sorteada por bot): `fraco` 9 tiros, `medio`/`forte` 23 tiros cada, num período de ~28–29s engajado — bem abaixo do padrão anterior (200+ tiros nas mesmas condições, ver PROMPT-0017/0018), e com `fraco` visivelmente mais lento que os outros dois. Combate seguiu funcional (HP caiu pra 30/80/100 conforme o caso).
- **Anti-stuck:** `BOT_VERBOSE=1 BOT_SKILL=forte npm run bots -- 6 30` — log mostrou `"[bot-N] preso — escapando lateralmente"` disparando várias vezes ao longo da sessão (bots colidindo entre si e com props), confirmando que o sistema detecta e reage. Combate continuou normal na mesma sessão (fugas, engajamentos, dano).
- Gate padrão completo (test, tsc ×3, `npm run bots -- 3 30`, guarda de `.js` órfão): limpo.

## Veredito CD (preencher após teste no browser)
- Testado em: —
- Fluxos: [ ] F3 mostra log sem precisar de `DEBUG=1` [ ] bot fraco atira nitidamente mais devagar que forte [ ] bot não fica preso permanentemente em obstáculo
- Resultado: pendente
- Observações:

## Regras que nascem daqui
- Nenhuma feature "sempre-visível" (F3, HUD) deve depender de uma env var extra do servidor — se o cliente já tem o interruptor (F3), o servidor não deveria ter um segundo escondido. Flags de servidor (`DEBUG=1`) ficam reservadas pra coisas que o CD explicitamente não quer em produção (ex.: `dev_launcher`).
- Ritmo de ataque de bot e cooldown de arma são conceitos separados: a arma (`LauncherDef.fire.cooldownMs`) é a mesma pra todo mundo (regra de jogo); a skill do bot só decide o quão *disposto* ele está a puxar o gatilho — nunca pode fazer ele atirar mais rápido que a arma permite.
- Detecção de "preso" em IA de bot não precisa conhecer a geometria do mapa — comparar posição autoritativa tick a tick já é suficiente e mais barato de manter.

## Pendências para o próximo prompt
- Nenhuma pendência de código conhecida. Aguardando veredito do CD nos três fluxos.
