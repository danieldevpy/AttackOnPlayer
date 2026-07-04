# PROMPT-0009

**Task:** T-005 — Lançadores v1: tiro reto
**Contexto lido:** docs/mechanics/combat.md, packages/server/src/rooms/ArenaRoom.ts, packages/server/src/systems/effects.ts, packages/shared/src/constants.ts, packages/client/src/main.ts

**Decisões de implementação:**
- Criado `LauncherDef` em `@aop/shared/launchers` e registrado `basic_shot` (tiro reto, range 8, speed 12, damage 10).
- Adicionadas propriedades de combate ao `Player` no `ArenaState` (`hp`, `maxHp`, `launcher`, e inputs para tiro `fireDirX`, `fireDirZ`).
- Criado `Projectile` no `ArenaState`.
- Criado `ProjectileSystem` no servidor. Ele é chamado a cada `update` da `ArenaRoom`, gerenciando cooldown de tiro, colisão com paredes, limites do mapa, props (`map.props` com simples caixa delimitadora contra raio do projétil) e jogadores, causando dano baseado em `força`. Disparos e danos em `safe zone` são bloqueados.
- Cliente envia `fx`, `fz` via raycaster ao segurar o botão do mouse.
- Cliente renderiza projéteis usando esferas temporárias e os interpola suavemente.
- O HUD agora exibe o HP atual e máximo do player.

**Verificação:**
- Typecheck limpo em `server`, `client`, `shared` e `bots` (incluindo correção de tipagem em `bots/src/bot.ts`).

**Impacto:**
- O servidor agora simula combate básico, essencial para T-006 (perda de nível e respawn) e T-008 (Bots de combate).
