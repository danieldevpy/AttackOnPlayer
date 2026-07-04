# Devlog

## 2026-07-04 — Sessão 1: fundação
- Framework do estúdio criado (AGENTS.md, constituição, ADRs 001–006, roadmap, specs, notas CD/IA).
- Monorepo TS: `shared` (mapa, constantes, protocolo), `server` (Colyseus, tick 20Hz, autoritativo), `client` (Three.js top-down, HUD ping/nível), `bots` (headless).
- M0: arena 15×13 com pilares estilo Bomberman, movimento com colisão no servidor, coletáveis spawnam longe de jogadores (ADR-006), coleta sobe nível, métricas de sessão em `packages/server/logs/sessions.jsonl`.
- Verificação ✅: 3 bots headless em 1 sala por 12s — movimento ok (~26u de distância média), coletas ok (bot-1 chegou ao nível 4), `sessions.jsonl` gravado, `/metrics/summary` agregando. Cliente compila em 145KB gzip.

**Aberto:** combate (M1), regra final de perda de nível, controle touch.
