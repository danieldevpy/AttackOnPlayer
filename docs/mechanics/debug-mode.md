# Modo Debug (T-007)

Objetivo: debugar eventos e respostas DINAMICAMENTE, sem parar o jogo.

## Cliente — overlay F3
- Tecla F3 alterna overlay: zonas pintadas no chão, contagem de entidades, tick do servidor, timers de efeito por player, últimos N eventos.
- Feed de eventos ao vivo (canto inferior): `pickup`, `spawn`, `hit`, `death`, `respawn`, `safe_block`, `zone_event` com timestamp.

## Servidor
- Canal `debug` na sala: o servidor sempre emite cada evento de jogo pelo WebSocket (mesma conexão, zero infra nova) — **não depende de nenhuma env var**. Bugfix pós-teste manual: antes exigia `DEBUG=1` no servidor além de abrir o F3 no cliente; era um segundo interruptor escondido que fazia o feed parecer quebrado ("F3 não mostra logs").
- `GET /debug/rooms`: salas ativas, players, mapa, orçamento do spawner, projéteis vivos. Sempre disponível.
- Ring buffer dos últimos 200 eventos por sala (inspecionável via HTTP). Sempre populado.
- `DEBUG=1` continua existindo só para o `dev_launcher` (T-012) — troca de lançador em dev, não tem relação com o feed de eventos.

## Bots
- `BOT_VERBOSE=1`: bots logam decisão (alvo, caminho, motivo) — "por que o bot fez isso?" respondível.

## Regra
Todo sistema novo DEVE emitir seus eventos no canal debug desde o primeiro commit (custo ~zero, visibilidade total). Métricas (metrics.md) consomem os mesmos eventos — uma fonte, dois usos.
