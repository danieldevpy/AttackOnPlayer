# PROMPT-0008

**Task:** T-004b — Scaffold de progressão persistente (ADR-012)
**Contexto lido:** docs/DECISION_LOG.md, packages/server/src/rooms/ArenaRoom.ts, packages/client/src/main.ts, packages/server/src/state/ArenaState.ts

**Decisões de implementação:**
- `playerToken` gerado localmente via `Math.random` e salvo no `localStorage` do cliente como `aop_token`.
- Token é enviado nas opções do `joinOrCreate`.
- Servidor mapeia token no objeto Player no `ArenaState` (`inputX`, `inputZ`, `playerToken` marcados apenas para uso interno, sem sincronizar com Colyseus).
- `ArenaRoom` mantém um `memDB` (um Map global ao módulo) indexado por `playerToken` contendo a interface `PersistentProgress` (força, velocidade, vitalidade).
- Ao coletar a "box", o bot ganha os status normais, mas se for um player real, os mesmos valores da box são acumulados no progresso contido no `memDB`. O console registra a persistência (para dev mode).

**Verificação:**
- `npx tsc --noEmit` de todos os pacotes: passou com sucesso (0 erros).
- Código não toca a interface ou lógica visível do jogo (apenas log em console e localStorage), mantendo a estabilidade exigida.

**Impacto:** A fundação de persistência está pronta para o T-007 (Modo Debug), onde o progresso poderá ser consultado visualmente via F3 overlay, satisfazendo a diretiva do CD sem ferir a progressão temporária do round em si.
