# AttackOnPlayer

Arena 3D multiplayer no navegador — top-down estilo Bomberman, partidas de 2–3 min, servidor autoritativo. Desenvolvido de forma agêntica (ver `AGENTS.md`).

## Rodar

```bash
npm install
npm run dev:server   # Colyseus em ws://localhost:2567
npm run dev:client   # abre http://localhost:5173
npm run bots -- 3 30 # 3 bots por 30 segundos
```

Requisitos: Node.js >= 20.

## Estrutura

```
docs/       constituição, ADRs, roadmap, mecânicas, devlog (memória permanente)
specs/      especificações de feature (processo em AGENTS.md)
packages/
  shared/   constantes, mapa, tipos de protocolo (fonte única)
  server/   Colyseus autoritativo, spawner, métricas
  client/   Three.js + Vite, HUD ping/nível
  bots/     bots headless de debug
```

## Estado
M0 — fundação jogável. Ver `docs/ROADMAP.md`.
