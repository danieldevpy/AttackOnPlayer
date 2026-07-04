# PROMPT-0011

**Task:** T-007 — Modo debug dinâmico
**Contexto lido:** AGENTS.md, docs/BACKLOG.md, docs/DEVLOG.md, docs/mechanics/debug-mode.md, docs/prompts/PROMPT-0008.md, docs/prompts/PROMPT-0009.md, docs/prompts/PROMPT-0010.md, packages/server/src/index.ts, packages/server/src/rooms/ArenaRoom.ts, packages/client/src/main.ts, packages/bots/src/bot.ts

**Pedido:**
- Retomar a sessão anterior, entender onde o desenvolvimento parou e deixar o jogo pronto para Daniel testar as novas mudanças.

**Decisões de implementação:**
- Mantido o T-005 e T-006 como base já commitada: lançadores, dano, morte, respawn e perda de nível.
- Fechado o T-007 no estado testável: overlay F3 no cliente com snapshot de sala, player local, todos os players, contadores de entidades, token local e feed de eventos.
- O servidor mantém `activeRooms`, ring buffer de 200 eventos por sala e endpoint `GET /debug/rooms`.
- Eventos de debug são sempre armazenados para inspeção HTTP, mas só são transmitidos ao cliente via WebSocket quando `DEBUG=1`.
- `BOT_VERBOSE=1` mostra a decisão de alvo/caminho dos bots no terminal; bots também registram um handler no-op para `debug_event`, evitando logs de warning quando o servidor está com `DEBUG=1`.
- Corrigido um detalhe do overlay: abrir/fechar F3 agora redesenha o histórico sem duplicar eventos no buffer local.

**Resultado verificado:**
- `tsc --noEmit` passou em `packages/server`, `packages/client` e `packages/bots`.
- Testes do shared passaram: 10/10.
- Bateria curta de bots headless com `BOT_VERBOSE=1` conectou, reconstruiu mapa por seed e rodou sem warnings de `debug_event`.

**Próximo passo sugerido:**
- Daniel testar manualmente no navegador com servidor em `DEBUG=1`.
- Depois, executar T-008 para bots mirarem/atirarem e gerar kills automaticamente.
