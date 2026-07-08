# PROMPT-0068 — T-067: Cliente: UI genérica de fases de evento (SPEC-0016)

**Pedido:** "T-067 sem preview test" — executar a T-067 do `docs/BACKLOG.md` sem rodar a
verificação visual em preview de browser (pedido explícito do CD nesta sessão).

## Contexto lido

- `docs/BACKLOG.md:231` (T-067) + `specs/SPEC-0016-eventos-e-modos-de-jogo.md` (§Comportamento
  esperado, l.89–137).
- `packages/server/src/state/ArenaState.ts` (`ActiveEvent`: `id`, `phase`, `phaseEndsAt`,
  `zoneX/zoneZ/zoneRadius`; `Player.waitingRespawn`).
- `packages/server/src/systems/events/battleRoyale.ts` (payload real de `event_result`:
  `{survivorNames: string[], reason: string}`, emitido em `onEndingStart`).
- `packages/client/src/hud.ts` + `packages/client/index.html` (padrão de módulo de UI: `ctx`
  injetado via `init*`, casca de DOM montada uma vez, só texto/classe muda por frame; convenção
  `mobile-layout` da T-064).

## Entregue

- **`packages/client/src/events.ts`** (novo): módulo event-agnostic. `EVENT_LABELS` (tabela
  local `id→nome`, só entrada `battle_royale` por ora — novo evento futuro só adiciona uma
  linha aqui). `updateEvents(now)` lê `state.event` a cada frame:
  - **idle** (nunca disparou nesta sessão): early-return antes de tocar em qualquer DOM — zero
    custo, zero elemento novo (critério de aceite da task).
  - **warning**: banner (`#event-banner`) com nome + contagem regressiva grande, derivada de
    `phaseEndsAt - Date.now()` a cada frame (nunca timer próprio — reconexão/atraso não
    dessincroniza, igual ao padrão da barra de oferta de upgrade em `hud.ts`).
  - **active**: HUD compacto (`#event-hud`) com tempo restante + contagem de vivos (`hp>0 &&
    !waitingRespawn`, contado local a cada 1s de UI a partir do `state.players` sincronizado —
    nenhum cálculo de jogo, só leitura).
  - **ending**: destaque de resultado (`#event-result`) a partir do broadcast `event_result`
    (`onEventResult`, registrado em `main.ts`); tolera ausência (mostra "Evento encerrado").
  - Transições de fase só trocam classe `active` (CSS cuida do fade ≤300ms); a casca de DOM só
    é montada (`buildShell`) na primeira vez que a fase deixa de ser `idle`.
- **`packages/client/index.html`**: 3 containers vazios (`#event-banner`, `#event-hud`,
  `#event-result`) + CSS (fade/translate ≤300ms, ajuste `body.mobile-layout` reduzindo o
  banner, mesmo padrão de `#hud`/`#upgrade-cards`/`.toast`).
- **`packages/client/src/main.ts`**: import + `initEvents({ getRoom: () => room })` (mesmo
  padrão de `initHud`); `room.onMessage("event_result", ...)` encaminhando pro módulo;
  `updateEvents(performance.now())` no loop `animate()`, logo após `updateHud`.

## Decisões

- **Sem estado de jogo calculado no cliente:** contagem de "vivos" em `active` é leitura direta
  de `hp`/`waitingRespawn` já sincronizados — nenhuma regra nova, só filtro de exibição (a
  task veda "lógica de jogo no cliente").
- **`event_result` tolerado ausente** por design (spec pede isso explicitamente): reconexão no
  meio do `ending`, ou evento futuro que não emita a mensagem, cai no fallback genérico.
- **Reset de `latestResult` só ao entrar em `warning`** (não em `idle`): assim o texto do
  resultado permanece estável durante toda a fase `ending` mesmo que o componente re-renderize
  várias vezes, e um `ending`→`idle` rápido não apaga o resultado antes do fade de saída
  terminar.

## Gates

- `tsc --noEmit` em `packages/{server,client,bots}` — limpo (não editei server/bots, rodado
  pelo gate da frente inteira).
- `vite build` (`packages/client`) — OK, sem warning novo além do chunk >500kB pré-existente.
- Testes: shared 49/49, bots 35/35, server 129/129 (nenhum teste editado ou criado — T-067 é
  client-only, sem cobertura Vitest no client neste projeto).
- Smoke: `npm run bots -- 4 20` contra o servidor de dev já em execução (porta 2567,
  pré-existente nesta máquina) — 0 erros no tick, 4 bots concluíram o ciclo normalmente.
- **Preview de browser explicitamente pulado nesta sessão** (pedido do CD: "T-067 sem preview
  test"). A verificação visual das 4 fases (banner/HUD/resultado, countdown batendo ±250ms com
  o servidor, legibilidade mobile) descrita no critério de aceite da task **fica pendente** —
  recomendado rodar com `DEBUG=1` + `room.send("dev_event", "battle_royale")` antes de
  prosseguir pra T-068/T-069 (que constroem em cima da mesma UI).

## Próximo passo

T-068 (visual da zona) e T-069 (espera de respawn) dependem de T-066+T-067 e podem rodar em
paralelo agora. Recomendo validar visualmente a T-067 (preview pulado aqui) antes ou junto da
T-068, já que ambas tocam nos mesmos arquivos (`events.ts`, `main.ts`).
