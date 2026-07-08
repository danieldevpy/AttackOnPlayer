# PROMPT-0070 — T-069: Cliente: espera de respawn como arquibancada (SPEC-0016)

**Pedido:** "Executar T-069" — executar a task do `docs/BACKLOG.md` respeitando escopo
rigoroso (agente worker, execução automatizada via skill `attackonplayer-executor`).

## Contexto lido (via ACI antes de abrir arquivos inteiros)

- `npm run aci -- search T-069` → `docs/BACKLOG.md:243`.
- `docs/BACKLOG.md` (T-069, T-066/T-067 — dependências já concluídas).
- `packages/server/src/state/ArenaState.ts` (`Player.waitingRespawn`), `ArenaRoom.ts`
  (`handleDeath` l.962–975 — política `hold_until_end` prende o respawn e zera
  input/firing no local da morte; `releaseHeldRespawns` l.987–995 — libera TODOS no MESMO
  tick chamando `respawnPlayer`, que bota `spawnProtectedUntil` num novo valor futuro) e
  `battleRoyale.ts` (`onEndingStart` — resolve o resultado e libera os segurados na entrada
  do `ending`, inclusive em early-end via `earlyEndCondition`).
- `packages/client/src/main.ts`: `syncWorld()` (loop por player — lerp de posição, detecção
  de (re)spawn via salto de `spawnProtectedUntil` pra um futuro novo, que já dispara
  `spawn_materialize` + `triggerSpawnFade` + `respawn_self` automaticamente, T-045);
  `followCamera()` (lerp exponencial fator 0.06, ADR-015 câmera nunca gira); `updateZoneVisual`
  (T-068 — padrão de overlay DOM criado sob demanda, mesma técnica reaproveitada aqui).
- `packages/client/src/visuals.ts` (`createPlayerVisual`/`updateNameplate` — nameplate é
  sprite filho do `Group` do player, então `group.visible=false` já esconde os dois juntos).
- `packages/client/src/events.ts` (T-067 — countdown sempre derivado de `phaseEndsAt -
  Date.now()` a cada frame, nunca timer próprio; `alive` já filtra `waitingRespawn`).

## Entregue

- **`packages/client/src/main.ts`**:
  - Overlay "arquibancada" (`getRespawnWaitEls`/`updateRespawnWait`) — DOM criado sob demanda
    (mesmo padrão da vinheta/seta do T-068): texto "☠ Você caiu! Renascendo quando o evento
    acabar" + barra de progresso. `respawnHoldStartedAt` (epoch ms, mesma base de
    `phaseEndsAt`) marca o instante em que ESTE cliente observa `waitingRespawn` virar `true`;
    a cada frame a barra recalcula `frac = (Date.now() - holdStartedAt) / (phaseEndsAt -
    holdStartedAt)` — sem timer próprio, então um `phaseEndsAt` que mude (early-end) já
    reflete na próxima leitura em vez de travar. Fecha com o mesmo fade de opacidade CSS
    (`.3s`) dos outros overlays de evento; a materialização de verdade (scale-in + fade de
    tela + som) já dispara sozinha via o mecanismo existente de `spawnProtectedUntil`
    (`respawnPlayer()` sempre bota um valor novo ao liberar) — nada duplicado.
  - `followCamera()`: quando o PRÓPRIO player tem `waitingRespawn=true`, o alvo do lerp passa
    de "posição do jogador + offset de mira" para `zoneX/zoneZ` numa altura elevada
    (`CAMERA_HOLD_Y=30`); mesmo fator de lerp exponencial (0.06/frame) já usado pro
    seguimento normal — converge em ~1s sozinho, sem tween novo, e nunca corta porque é a
    MESMA função rodando todo frame (a troca de alvo é só uma leitura de estado a mais).
  - `syncWorld()`: qualquer player (próprio, outro ou bot) com `waitingRespawn=true` recebe
    `vis.visible=false` e é pulado no resto do frame (posição/animação/nameplate/buffs) —
    esconde mesh+nameplate juntos (nameplate é filho do group). Ao liberar, `waitingRespawn`
    e o novo `spawnProtectedUntil` chegam no MESMO patch de estado, então no frame seguinte
    o player já está fora do ramo "segurado" e cai direto na detecção de (re)spawn existente
    (materializa normalmente, sem código novo).

## Decisões

- **Nenhuma mudança em `events.ts`:** a espera de respawn precisa de `scene`/`camera`/
  `playerVisuals`, que só existem em `main.ts` — mesmo raciocínio do T-068 (zona também ficou
  fora de `events.ts`).
- **Esconder TODOS os segurados pelo mesmo código (sem `if (id !== mySessionId)`):** a task só
  pede isso explicitamente para "outros", mas aplicar a mesma regra pro próprio player é mais
  simples (um `if` a menos) e não muda nada visível — a câmera do dono já está olhando pra
  zona, não pro próprio cadáver.
- **Reuso literal do T-045 pra materialização/fade, zero duplicação:** a liberação do respawn
  (`respawnPlayer`) já bota um `spawnProtectedUntil` novo; o `syncWorld` já detecta esse salto
  e dispara `spawn_materialize`+fade de tela+som — a task pede explicitamente "reusar, não
  duplicar", então a única coisa nova é abrir/fechar o overlay e mudar o alvo da câmera.
- **Barra ancorada em `respawnHoldStartedAt` local, recalculada com `phaseEndsAt` ao vivo:**
  evita timer próprio (que travaria/dessincronizaria); um evento futuro que encurte
  `phaseEndsAt` antes de liberar já acelera a barra sozinha no próximo frame (spec).
- **Câmera espectador seguindo outros players: fora de escopo** (a task exclui
  explicitamente) — a vista elevada é sempre centrada na zona, nunca em outro jogador.

## Gates

- `tsc --noEmit` em `packages/{client,server,bots}` — limpo (server/bots não tocados).
- `vite build` (`packages/client`) — OK, sem warning novo além do chunk >500kB pré-existente.
- Testes: shared 49/49, server 129/129, bots 35/35 (nenhum editado — T-069 é client-only, sem
  cobertura Vitest no client neste projeto, igual T-067/T-068).
- Smoke: servidor de dev + `npm run bots -- 3 15` — 0 erros no tick.
- **Preview de browser: tentado nesta sessão (diferente do T-068), sem sucesso.** Com
  `preview_start` (`server-verify` DEBUG=1 na porta 2604 + `client-verify` na 5299) e um
  script standalone via `colyseus.js` disparando `dev_event battle_royale` (3 bots + o
  cliente do preview = 4 vivos, satisfaz `BR_MIN_PLAYERS`), o servidor confirmou o evento
  rodando e um bot preso (`"bot-0 morreu e aguarda o fim do evento"` no log). Do lado do
  cliente, porém, `preview_screenshot` sempre expirou (timeout) e o HUD nunca saiu do estado
  inicial (`0/100`, ping `···`) mesmo minutos depois — sinal de que o loop `requestAnimationFrame`
  nunca chega a rodar nesse ambiente (sem superfície de renderização real por trás do
  `preview_*`), não um bug do código novo. **Critérios de aceite visuais (overlay+barra+câmera
  na zona, players segurados invisíveis, materialização ao liberar) ficam pendentes de
  confirmação manual** — mesma pendência já registrada pelo T-067/T-068.

## Próximo passo

Validar visualmente esta task (pendência acima) — idealmente junto de T-067/T-068, já que as
três dependem do mesmo fluxo `dev_event battle_royale` com ≥4 vivos. T-070/T-071 continuam
liberadas em paralelo. T-072 (polish som/VFX) agora tem as duas dependências (T-068+T-069)
completas no código, mas com a mesma verificação visual pendente.
