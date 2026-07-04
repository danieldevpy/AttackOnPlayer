# PROMPT-0012

**Task:** Bugfix pós-teste manual — respawn e hitbox após morte
**Contexto lido:** AGENTS.md, docs/mechanics/combat.md, docs/mechanics/progression.md, docs/mechanics/world.md, docs/mechanics/debug-mode.md, packages/server/src/rooms/ArenaRoom.ts, packages/server/src/systems/projectiles.ts, packages/server/src/systems/effects.ts, packages/server/src/state/ArenaState.ts, packages/shared/src/constants.ts, packages/shared/src/map.ts

**Relato do Creative Director:**
- Após matar outro player e ele respawnar, surgiu dúvida se o nascimento era aleatório ou estratégico.
- Ao voltar a atirar no player renascido, o acerto pareceu não funcionar adequadamente.

**Diagnóstico:**
- O respawn estava escolhendo aleatoriamente um dos pontos de spawn, todos em safe zone, sem avaliar distância de inimigos ou projéteis.
- A safe zone bloqueava dano silenciosamente. No teste manual, isso podia parecer falha de hitbox, porque o projétil simplesmente não causava dano no alvo protegido.
- A colisão do projétil com player testava apenas a posição final do tick. Em movimento rápido relativo, isso é menos robusto que testar o segmento percorrido.
- Vitalidade recalculava o multiplicador, mas `maxHp` não era derivado dela; isso podia deixar morte/respawn com valores de vida inconsistentes.

**Mudanças implementadas:**
- Respawn agora escolhe o melhor ponto entre os spawns por pontuação de risco: distância de players vivos e distância de projéteis recentes.
- Input de movimento e direção de tiro são zerados ao respawnar.
- Projéteis agora testam colisão de segmento contra círculo do player.
- Acerto em player protegido por safe zone consome o projétil e emite evento `safe_block` no debug.
- Hits comuns emitem evento `hit` com dano, HP final e flag de kill.
- Vitalidade agora recalcula `maxHp` com base em `PLAYER_BASE_HP`.

**Resultado verificado:**
- `tsc --noEmit` passou em `packages/server`, `packages/client` e `packages/bots`.
- Testes do shared passaram: 10/10.
- Artefatos `.js` rastreados foram sincronizados com os `.ts`.

**Observação para teste:**
- Se o alvo acabou de respawnar e ainda está dentro da safe zone, ele continua protegido. Com `F3` aberto, o evento esperado é `safe_block`; fora da safe zone, o evento esperado é `hit` e o HP deve cair.
