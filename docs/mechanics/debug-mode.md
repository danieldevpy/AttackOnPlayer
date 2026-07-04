# Modo Debug (T-007)

Objetivo: debugar eventos e respostas DINAMICAMENTE, sem parar o jogo.

## Cliente — overlay F3
- Tecla F3 alterna overlay: zonas pintadas no chão, contagem de entidades, tick do servidor, timers de efeito por player, últimos N eventos.
- Feed de eventos ao vivo (canto inferior): `pickup`, `spawn`, `hit`, `death`, `zone_event` com timestamp.

## Servidor
- Canal `debug` na sala: quando `DEBUG=1`, o servidor emite cada evento de jogo pelo WebSocket (mesma conexão, zero infra nova).
- `GET /debug/rooms`: salas ativas, players, mapa, orçamento do spawner, projéteis vivos.
- Ring buffer dos últimos 200 eventos por sala (inspecionável via HTTP).

## Bots
- `BOT_VERBOSE=1`: bots logam decisão (alvo, caminho, motivo) — "por que o bot fez isso?" respondível.

## Regra
Todo sistema novo DEVE emitir seus eventos no canal debug desde o primeiro commit (custo ~zero, visibilidade total). Métricas (metrics.md) consomem os mesmos eventos — uma fonte, dois usos.
