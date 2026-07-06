# Métricas & Observabilidade

## Camadas
1. **M0 (feito):** eventos de sessão por jogador em `packages/server/logs/sessions.jsonl` + `GET /metrics/summary` (agregado em memória do arquivo).
2. **T-026 (SPEC-0008, feito):** telemetria por EVENTO (não por sessão) — ver seção própria abaixo.
3. **M4:** Prometheus + Grafana na VPS; dashboards por sessão, jogador e coletivo.

## Por sessão de jogador (M0)
`sessionId, playerId, name, isBot, joinedAt, leftAt, durationS, distance, pickups, levelStart, levelEnd`

## Telemetria por evento (T-026, `packages/server/src/telemetry/`)
Complementa o M0: onde o M0 resume "como foi a sessão de um jogador", isto registra "o que
aconteceu, evento a evento, numa partida" — pensado pra uma IA ler e responder perguntas
específicas sem abrir o jogo.

- **1 arquivo NDJSON por partida:** `packages/server/logs/telemetry/<roomId>.ndjson` (mesma pasta
  gitignored do M0). Schema versionado (`v`, `events.ts`) — todo evento carrega `matchId`,
  `mapId` (se curado), `tick` (contador do servidor) e `ts`.
- **Eventos cobertos:** `match_start`/`match_end`, `kill` (posições e níveis de matador E vítima,
  + `threats` da SPEC-0010), `upgrade_offer`/`upgrade_choice` (cards ofertados E recusados, não só
  o escolhido), `flag_possession` (pickup/drop), `quit` (desconexão), `tick_slow` (watchdog —
  ver abaixo), `error` (contexto + mensagem, sem derrubar a sala).
- **Watchdog de tick:** cada tick mede o `dt` real desde o anterior; acima de `TICK_WATCHDOG_MS`
  (100ms — 2× o intervalo nominal de `TICK_RATE=20`) vira evento `tick_slow`. `update()` também
  captura qualquer exceção de um tick e grava como evento `error` em vez de derrubar a sala.
- **`npm run analyze -- [matchId|--list]`:** lê o NDJSON de uma partida e imprime funil de
  eventos, cards mais recusados, heatmap ASCII de mortes (posição da vítima) e o resumo do
  watchdog/erros. Lógica pura e testável em `telemetry/analyze.ts`; o CLI é só leitura de
  arquivo + print.

## Evoluções planejadas
- **Combate (M1):** kills, deaths, dano dado/recebido, accuracy, TTK médio.
- **Aura (M2):** dodge_perfect, hit_streak, contested_pickup, aura ganha/gasta — insumo para "famar" aura de quem tem mecânica pronta.
- **Coletivo (M4):** duração média de round (alvo 2–3 min), retenção "mais um round" (% que joga round seguinte), heatmap de posições, distribuição de níveis no fim.
- **Rede:** ping p50/p95 por jogador e por região; tick time do servidor (o watchdog do T-026 já cobre isto no nível de evento — Prometheus/Grafana entra no M4 pra série histórica/alerta).

## Princípio
Toda mudança de balanceamento deve apontar para uma métrica. Se não dá para medir, não dá para balancear.
