# PROMPT-0071 — Bugfix: chão escurecido visível sem evento (zoneFadeDir) + verificação visual T-068/T-069

**Pedido:** o CD subiu `dev:server`+`dev:client` (`localhost:5173`) por conta própria e pediu pra
eu usar esse servidor pra checar T-068/T-069, reportando que "a iluminação está diferente,
ficou muito escura" e pedindo análise do código dessa parte.

## Investigação

- Histórico completo de `scene.add(new THREE.AmbientLight(...))`/`DirectionalLight` em
  `main.ts` (`git log -p -L`) mostra que esses valores (0.7/0.8) não mudam desde o commit de
  fundação (M0) — não é regressão de iluminação.
- Suspeita recaiu sobre o T-068 (visual da zona), a mudança mais recente que desenha algo
  cobrindo grandes áreas do chão. Leitura de `updateZoneVisual` (`main.ts`) encontrou o bug:
  - `let zoneFadeDir: 1 | -1 = 1;` (estado inicial "entrando") e `let zoneFadeStart = 0;`.
  - No 1º frame (fase `idle`, nenhum evento nunca disparou), `showZone=false` já bate com
    `zoneWasVisible=false` — o bloco que ajustaria `zoneFadeDir`/`zoneFadeStart` na transição
    nunca roda.
  - `age = now - zoneFadeStart` vira `performance.now()` inteiro (segundos desde o load).
    `fadeFrac = zoneFadeDir===1 ? min(1, age/500) : ...` trava em `1` porque `zoneFadeDir`
    ficou `1` por default.
  - O guard de "completamente desmontado" (`fadeFrac <= 0 && !showZone`) nunca é satisfeito
    (`fadeFrac=1`, não `<=0`) — o código cai no caminho normal e liga `zoneRing.visible=true`
    + `zoneDark.visible=true` com opacidade `0.85`/`0.55`, **cobrindo o mapa inteiro com um
    chão preto a 55% desde o carregamento**, sem nenhum evento ter disparado (o "furo" da
    geometria fica um círculo de raio `0.01` na origem, já que não há `zoneX/zoneZ` reais).
- Confirmado que T-069 (`waitingRespawnActive`/`respawnHoldStartedAt`) não tem o mesmo padrão
  de bug: o overlay novo começa com opacidade `0` inline no próprio `cssText` (não depende de
  um cálculo de `fadeFrac` a partir de um timestamp zerado) e só é tornado visível quando uma
  transição de verdade é detectada.

## Correção

- `packages/client/src/main.ts`: `zoneFadeDir` inicial trocado de `1` para `-1` — representa
  corretamente "já totalmente esmaecido" antes do 1º evento da sessão. Com isso, o 1º frame
  calcula `fadeFrac = 1 - min(1, age/500) = 0` (idade grande clampada em 1, `1-1=0`), o guard
  de desmontagem é satisfeito, e `zoneRing`/`zoneDark` ficam escondidos até o primeiro
  `warning` de verdade. Transições legítimas (idle→warning, active→ending, reconexão em
  active) continuam funcionando: o bloco de transição já ajustava `zoneFadeDir`/`zoneFadeStart`
  corretamente quando `showZone` muda de valor — o bug só afetava o estado *antes* da 1ª
  transição.

## Verificação

- **Gates:** `tsc --noEmit` (client) limpo; `vite build` OK.
- **Preview isolado do agente** (`server-verify`:2604 + `client-verify`:5299 via `preview_*`):
  tentativa de confirmação pixel-a-pixel não avançou — mesmo problema já registrado em
  PROMPT-0069/PROMPT-0070 (loop `requestAnimationFrame` não progride nesse ambiente headless;
  HUD trava no estado inicial mesmo com o servidor confirmando o evento rodando via log).
- **Confirmação real:** o CD rodou o evento no próprio navegador (`localhost:5173`, hot-reload
  do Vite já pegou o fix) e reportou que o evento aconteceu corretamente — T-068 (zona) e
  T-069 (espera de respawn) validadas visualmente, encerrando a pendência de verificação
  manual aberta desde o PROMPT-0068/0069/0070.

## Decisões

- **Fix mínimo, sem tocar no resto da lógica de fade:** a única linha errada era o valor
  inicial de `zoneFadeDir`; o mecanismo de transição/temporização em si (`ZONE_FADE_MS`,
  cálculo de `fadeFrac`) está correto e não precisou mudar.
- **Sem novo arquivo/teste:** bug client-only, sem cobertura Vitest no client neste projeto
  (mesma situação de T-067/068/069) — verificação ficou em `tsc`+`build`+confirmação visual
  real do CD.

## Próximo passo

T-068/T-069 têm agora confirmação visual real (pendência fechada). T-070 (bots cientes do
evento) e T-071 (painel Django) seguem liberadas. T-072 (polish som/VFX) pode avançar — as
duas dependências (T-068+T-069) estão completas E verificadas.
