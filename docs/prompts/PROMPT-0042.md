# PROMPT-0042 — T-026: telemetria estruturada (abre F4/SPEC-0008) · 2026-07-06

## Pedido (resumo fiel do CD)
Depois de aprovar as 3 correções da sessão anterior ("estou de acordo com tudo"), pediu pra
documentar/atualizar o que faltava e prosseguir — próximo item da fila era T-026 (SPEC-0008),
retomando a fila V1 original.

## Decisões tomadas (e por quem)
- **Um arquivo NDJSON por partida, não um arquivo global (IA):** partidas são curtas (2–3 min,
  pilar de design) — 1 arquivo por `roomId` em `packages/server/logs/telemetry/` já bounda o
  tamanho naturalmente; "rotação" da spec virou uma rede de segurança (5MB → desloca pra `.1`)
  só pra sessões de teste/smoke anormalmente longas, não um esquema de retenção de produção.
- **Reusa a pasta `packages/server/logs/` já gitignored (IA):** primeira tentativa colocou os
  logs na raiz do repo (`<repo>/logs/telemetry/`, mesmo padrão de `maps/` da T-025) — mas
  telemetria é um artefato de execução (como `sessions.jsonl`), não conteúdo versionável como
  mapas. Corrigido pra `packages/server/logs/telemetry/`, sem precisar de entrada nova no
  `.gitignore`.
- **`tick` como campo de todo evento, não só `ts` (IA, seguindo a spec):** a spec citava
  `matchId/roomId/mapId/playerToken/tick/posições` explicitamente — `ArenaRoom` ganhou um
  `tickCount` incrementado a cada `update()`, incluído em todo evento (`telemetryBase()`).
  Ordena eventos do mesmo `ts` (`Date.now()` tem resolução de 1ms, tick não).
- **Watchdog usa o próprio `dt` do `setSimulationInterval`, sem medir de novo (IA):** o `dt`
  passado ao `update()` já é o tempo real decorrido (Colyseus mede e passa em ms, convertido pra
  segundos antes da chamada) — não precisei de outro `Date.now()` pra comparar. Limiar
  `TICK_WATCHDOG_MS = 100` (2× o intervalo nominal de `TICK_RATE=20` = 50ms); fica no módulo de
  telemetria, não em `shared/constants.ts`, porque é observabilidade (detecta o servidor
  engasgando), não um número de gameplay/sensação.
- **Erro de tick vira evento + log, nunca derruba a sala (IA):** `update()` virou um wrapper fino
  que mede o watchdog e chama `updateInner()` dentro de um `try/catch` — uma exceção num tick
  agora é um evento `error` (contexto + mensagem + stack) em vez de crashar o processo pra todo
  mundo na sala. Efeito colateral positivo de resiliência, não só telemetria.
- **`upgrade_choice` carrega os recusados, não só o escolhido (IA, direto do texto da spec):**
  "upgrades (card escolhido E recusados)" — calculado como `pending.cards` (a oferta real enviada)
  menos o `chosenCardId`, no mesmo ponto onde `resolveUpgrade` já valida a escolha.
- **Lógica de análise separada do CLI (IA, reaproveitando o padrão da T-025):** `telemetry/
  analyze.ts` tem só funções puras (`computeFunnel`, `computeCardStats`, `computeDeathHeatmap`,
  `computeTickStats`, `computeErrors`, `formatReport`) — testáveis sem tocar disco.
  `cli/analyze.ts` é só leitura de arquivo + print, mesma separação de `mapFile.ts`/`mapCli.ts`.

## Resultado verificado
- **Testes:** shared **30/30** · server **62/62** (+13: 4 em `telemetry/log.test.ts` cobrindo
  escrita NDJSON, criação de diretório, falha silenciosa e rotação por tamanho; 9 em
  `telemetry/analyze.test.ts` cobrindo cada função pura + o relatório formatado) · bots **35/35**.
  `tsc --noEmit` limpo em server/client/bots.
- **Smoke real ponta a ponta:** servidor isolado (porta 2605) + 8 bots por 60s → `npm run
  analyze` (sem argumento, pega a partida mais recente) devolveu:
  - Funil: `upgrade_offer 21 · upgrade_choice 21 · kill 9 · quit 8 · flag_possession 4 ·
    match_start 1 · match_end 1`.
  - Cards mais recusados: todos os 12 do pool novo (T-041 desta mesma leva de sessões)
    apareceram, com taxas de recusa de 100% (`equilibrado`, pouco preferido pelos perfis de bot)
    a 25% (`pes_ligeiros`) — responde de fato "qual card é mais recusado".
  - Heatmap ASCII de 9 mortes espalhadas pelo mapa 75x65 — responde "onde as mortes se
    concentram".
  - Watchdog: 0 ticks lentos. Erros: 0.
  - `match_end`/`quit` só aparecem depois que a sala fecha de verdade (Colyseus dispõe a sala ao
    ficar vazia) — confirmado esperando o "[arena] Sala X fechada." no log antes de rodar o
    `analyze` de novo.
- **Achado durante o smoke (não é bug de telemetria):** dois erros de operação nesta sessão,
  registrados aqui pra não repetir — (1) `npm run dev:server` executado com o cwd errado
  (herdado de um `cd` anterior pra dentro de `packages/bots`) fez o npm resolver o script errado
  local ao workspace; (2) resolvido rodando com `npm --prefix <repo>` em vez de depender do cwd
  persistido entre comandos do Bash tool.

## Regras que nascem daqui
- **Telemetria por evento vive em `packages/server/logs/telemetry/` (gitignored), não na raiz do
  repo** — diferente de `maps/` (T-025), que é conteúdo versionável. Runtime artifacts vs.
  conteúdo curado usam pastas diferentes por design.
- **Um tick que lança exceção não derruba mais a sala** — vira evento `error` na telemetria. Se
  uma sala começar a "sumir" silenciosamente em produção, `npm run analyze -- <roomId>` (ou o
  arquivo bruto) é o primeiro lugar a olhar.

## Pendências para o próximo prompt
- **T-027** — Backend Django + admin (ADR-016, fronteira Node×Django) — escopo bem maior que as
  tasks anteriores (novo serviço, novo stack, novos gates de QA). Recomendo alinhar com o CD
  antes de começar (confirmar hospedagem/infra da VPS, se já há Django instalado, etc.) em vez de
  simplesmente começar a codar.
- Sem pendências de veredito do CD nesta task — telemetria é infraestrutura, não gameplay
  observável em sensação de jogo.
