# Métricas & Observabilidade

## Camadas
1. **M0 (feito):** eventos de sessão por jogador em `packages/server/logs/sessions.jsonl` + `GET /metrics/summary` (agregado em memória do arquivo).
2. **M4:** Prometheus + Grafana na VPS; dashboards por sessão, jogador e coletivo.

## Por sessão de jogador (M0)
`sessionId, playerId, name, isBot, joinedAt, leftAt, durationS, distance, pickups, levelStart, levelEnd`

## Evoluções planejadas
- **Combate (M1):** kills, deaths, dano dado/recebido, accuracy, TTK médio.
- **Aura (M2):** dodge_perfect, hit_streak, contested_pickup, aura ganha/gasta — insumo para "famar" aura de quem tem mecânica pronta.
- **Coletivo (M4):** duração média de round (alvo 2–3 min), retenção "mais um round" (% que joga round seguinte), heatmap de posições, distribuição de níveis no fim.
- **Rede:** ping p50/p95 por jogador e por região; tick time do servidor (alerta se > 40ms).

## Princípio
Toda mudança de balanceamento deve apontar para uma métrica. Se não dá para medir, não dá para balancear.
