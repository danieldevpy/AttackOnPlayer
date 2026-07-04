# Arquitetura multiplayer

## Topologia
```
Navegador (Three.js + colyseus.js)
        │ WebSocket (input 20Hz / estado delta)
        ▼
Servidor Node (Colyseus) — AUTORITATIVO
  ├─ ArenaRoom: simulação 20 ticks/s, colisão, coleta, níveis
  ├─ Spawner: coletáveis longe de jogadores (ADR-006)
  ├─ Métricas: eventos por sessão → JSONL (M4: Prometheus)
  └─ HTTP: /health, /metrics/summary
```

## Regras
- Cliente envia apenas intenção (`input {x,z}` normalizado). Servidor valida tudo.
- Estado sincronizado por delta (@colyseus/schema) — só o que mudou trafega.
- Ping: cliente manda `ping` a cada 2s, servidor responde `pong`; HUD mostra RTT.
- Interpolação no cliente; predição client-side entra com o combate (M1) se necessário.

## Leveza / mobile
- Payload de estado mínimo (floats de posição, ints de nível).
- Sem física de engine; colisão AABB própria contra grid — barata e determinística.
- Render: geometrias primitivas instanciáveis, uma luz, sem sombras dinâmicas em M0.

## Produção (M5)
- 1 VPS por região (começar com 1 bem localizada p/ público-alvo, ex. São Paulo).
- Docker compose: server + caddy (TLS) + client estático. Deploy = `git pull && docker compose up -d --build`.
- Instância dev e prod separadas por porta/subdomínio.
