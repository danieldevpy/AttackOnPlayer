# Backlog de tasks — desenvolvimento por prompts

**Como usar (controle de tokens):** cada prompt seu = `Executar T-0XX do docs/BACKLOG.md`. A IA lê SOMENTE o "contexto" listado na task + AGENTS.md, implementa, testa com bots, registra (DEVLOG + PROMPT-NNNN) e commita. Uma task por prompt. Ordem sugerida = numérica, dependências anotadas.

---

## T-001 — Pivô: mapa campo aberto com props e zonas 〔M〕 ✅ (PROMPT-0004)
**Objetivo:** substituir labirinto por campo aberto (ADR-010): props colidíveis esparsos (~4%) + zonas safe/guerra/campo derivadas do seed. Zonas sincronizadas (cliente pinta o chão), sem região fechada.
**Contexto:** docs/mechanics/world.md · packages/shared/src/map.ts · packages/server/src/rooms/ArenaRoom.ts · packages/client/src/main.ts
**Aceite:** bots BFS continuam coletando; chão muda de cor por zona; nenhum prop bloqueia spawn.

## T-002 — Pré-modelos de props (fase F2) 〔P〕 · depende: T-001
**Objetivo:** pedra/árvore/caixa/muro/bandeira compostos de primitivas em visuals.ts, renderizados por tipo do grid.
**Contexto:** docs/mechanics/world.md (tabela) · instrucoes/FASES_VISUAIS.md · packages/client/src/visuals.ts · packages/client/src/main.ts
**Aceite:** cada tipo visualmente distinto; draw calls sob controle (instancing por tipo).

## T-003 — Crescimento: XP, nível, atributos múltiplos 〔M〕
**Objetivo:** xp/coins no Player, curva `XP_BASE × n^XP_EXP`, pontos por nível, atributos força/velocidade/vitalidade com auto-distribuição, integrados ao EffectSystem como camada permanente do round.
**Contexto:** docs/mechanics/growth.md · packages/server/src/systems/effects.ts · packages/server/src/state/ArenaState.ts · packages/shared/src/constants.ts
**Aceite:** coletar dá XP e sobe nível pela curva; atributos refletem no estado; teste unitário da curva.

## T-004 — Coletáveis expandidos + spawn por zona 〔M〕 · depende: T-001, T-003
**Objetivo:** xp_orb, farm_event, coin_buff, box (conforme growth.md); pesos de spawn por zona (guerra = raros). Box: bônus forte no round + soma no acumulador persistente por playerToken (ADR-012, painel visível só em T-007/DEV_MODE). Coins: reroll de atributo (COIN_REROLL_COST).
**Contexto:** docs/mechanics/growth.md · docs/DECISION_LOG.md (ADR-012) · packages/server/src/rooms/ArenaRoom.ts · packages/client/src/visuals.ts
**Aceite:** box só nasce em zona de guerra; farm_event anunciado no HUD; métricas registram por kind; reroll consome coins e reaplica preset de atributo.

## T-004b — Scaffold de progressão persistente (ADR-012) 〔P〕 · depende: T-004
**Objetivo:** playerToken gerado/persistido no cliente (localStorage), enviado no join; servidor guarda PersistentProgress em memória por token, alimentado pela box.
**Contexto:** docs/DECISION_LOG.md (ADR-012) · packages/server/src/rooms/ArenaRoom.ts · packages/client/src/main.ts
**Aceite:** reconectar com o mesmo token mantém o acumulador; não afeta poder dentro do round; visível só com DEV_MODE (painel real chega em T-007).

## T-005 — Lançadores v1: tiro reto 〔G〕
**Objetivo:** LauncherDef registry (shared), ProjectileSystem no servidor, input fire com cooldown, vida/dano (dano × força), projétil some em prop/alcance, feedback de hit no cliente.
**Contexto:** docs/mechanics/combat.md · packages/server/src/rooms/ArenaRoom.ts · packages/server/src/systems/effects.ts · packages/shared/src/constants.ts · packages/client/src/main.ts
**Aceite:** bot atinge bot e a vida cai; projétil respeita alcance; zona safe bloqueia dano.

## T-006 — Morte, respawn e perda de nível 〔M〕 · depende: T-005
**Objetivo:** vida 0 → morte, respawn em zona safe, perda de nível por curva que escala com o nível (piso 1–3, cresce depois — ver progression.md) + flag `fullResetOnDeath` (por room/default global), kill dá XP escalado pelo nível da vítima.
**Contexto:** docs/mechanics/progression.md · docs/mechanics/growth.md · packages/server/src/rooms/ArenaRoom.ts
**Aceite:** morrer aplica a curva de perda (baixo nível quase não perde, alto nível perde muito); toggle de reset total funciona por room; métricas de kill/death.

## T-007 — Modo debug dinâmico 〔M〕
**Objetivo:** overlay F3 (zonas, entidades, timers, feed de eventos), canal debug no servidor, /debug/rooms, ring buffer, BOT_VERBOSE.
**Contexto:** docs/mechanics/debug-mode.md · packages/server/src/rooms/ArenaRoom.ts · packages/client/src/main.ts · packages/bots/src/bot.ts
**Aceite:** F3 mostra eventos ao vivo; /debug/rooms responde; sem custo quando desligado.

## T-008 — Bots de combate 〔M〕 · depende: T-005, T-006
**Objetivo:** bots miram e atiram (com erro proposital parametrizado), fogem quando com pouca vida, avaliam risco de zona de guerra.
**Contexto:** docs/ai/bots.md · packages/bots/src/bot.ts
**Aceite:** 4 bots geram kills entre si; skill parametrizável (fraco/médio/forte).

## T-009 — Passe de balance + métricas de combate 〔P〕 · depende: T-006
**Objetivo:** métricas TTK, XP/min, dano por arma; ajustar curvas com dados de 10 partidas de bots.
**Contexto:** docs/observability/metrics.md · packages/server/src/metrics/SessionMetrics.ts
**Aceite:** relatório em docs/ai/ com números reais e ajustes aplicados.

---
Concluiu tudo? Reler `docs/VISAO-ATUAL.md` e abrir nova sessão de ideias (PROMPT-0004).
