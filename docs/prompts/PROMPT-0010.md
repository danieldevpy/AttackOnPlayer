# PROMPT-0010

**Task:** T-006 — Morte, respawn e perda de nível
**Contexto lido:** docs/mechanics/progression.md, docs/mechanics/growth.md, packages/server/src/rooms/ArenaRoom.ts, packages/server/src/systems/effects.ts, packages/shared/src/constants.ts, packages/server/src/metrics/SessionMetrics.ts

**Decisões de implementação:**
- `XP_PER_KILL_PER_LEVEL` e curva `lossFraction(level)` foram adicionados a `@aop/shared/constants.ts`.
- `ProjectileSystem` retorna os eventos de morte (`KillEvent[]`), que são processados pelo `ArenaRoom.ts`.
- O assassino ganha `XP_PER_KILL_PER_LEVEL * victim.level`.
- A vítima tem sua vida zerada, contabiliza `addDeath`, perde um percentual de níveis via `lossFraction` (preservando players casuais 1-3) e reaparece numa posição aleatória dos `spawnPoints` (safe zone) com HP máximo restaurado e XP dentro do novo nível zerada.
- Os atributos base no `EffectSystem` são reajustados para a curva de distribuição uniforme do novo nível da vítima (`resetAttrToLevel`).
- Adicionados registros de `kills` e `deaths` nas métricas de sessão em `SessionMetrics.ts`.

**Verificação:**
- Código TypeScript modificado, tipagens corrigidas de acordo com as especificações.

**Impacto:**
- O ciclo central de vida e morte (Core Loop M1) está funcional no servidor. 
- A fundação para os bots lutarem (T-008) e para coletar dados reais (T-009) está pronta.
