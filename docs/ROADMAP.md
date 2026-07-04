# Roadmap vivo

| Marco | Conteúdo | Status |
|---|---|---|
| **M0 — Fundação jogável** | Monorepo, servidor autoritativo (Colyseus), arena grid com paredes, movimento com colisão, cliente Three.js top-down, HUD de ping, bots headless, coletáveis com spawn longe de jogadores, métricas de sessão (JSONL) | ✅ |
| **M0.5 — Mapa vivo & atributos** | Mapa dinâmico ≥5× com seed sync, câmera follow + fog, EffectSystem (speed_up), sinalização de inimigos, roster, fases visuais, bots com BFS, instrucoes/ + log de prompts | ✅ |
| **M1 — Mundo aberto, crescimento & combate** | Base via `docs/BACKLOG.md` (T-001..T-008) pronta: campo aberto, props/zonas, XP/atributos, coletáveis ricos, persistência scaffold, lançadores, morte/respawn/perda, debug F3, bots de combate. `specs/SPEC-0003-facing-mira-gatilhos.md` (T-009..T-013 — facing sincronizado, mira ≠ gatilho, ganchos de mobilidade) **completa**, mais bugfix pós-teste (ritmo de ataque por skill, anti-stuck de bot, F3 sem `DEBUG=1`). Aguardando veredito do CD + merge para `main`. Pendente: T-008b (personalidade/boss), T-OPTIONAL 1 (balance/métricas), touch | 🔄 por tasks |
| **M2 — Aura & mapa vivo** | Sistema de aura (ganha por mecânica: esquiva, streak, precisão), aura eleva qualidade de drop em células vazias, densidade de jogadores dirige o spawner | ⬜ |
| **M3 — Sessões & Guardian** | Matchmaking por nível com fallback, múltiplas salas, fechar/juntar salas, NPC único "Guardian" (melhor que 90% dos players) entra quando falta gente | ⬜ |
| **M4 — Observabilidade** | Dashboard de métricas por jogador/sessão/coletivo, funil de retenção de round, balanceamento guiado por dados | ⬜ |
| **M5 — Produção** | Deploy VPS (dev + prod), docker compose, região/ping, page de status | ⬜ |

Regra: um marco só fecha quando testado com bots + validado pelo Creative Director.
