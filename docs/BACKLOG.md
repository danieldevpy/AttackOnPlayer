# Backlog de tasks — desenvolvimento por prompts

**Como usar (controle de tokens):** cada prompt seu = `Executar T-0XX do docs/BACKLOG.md`. A IA lê SOMENTE o "contexto" listado na task + AGENTS.md, implementa, testa com bots, registra (DEVLOG + PROMPT-NNNN) e commita. Uma task por prompt. Ordem sugerida = numérica, dependências anotadas.

---

## T-001 — Pivô: mapa campo aberto com props e zonas 〔M〕 ✅ (PROMPT-0004)
**Objetivo:** substituir labirinto por campo aberto (ADR-010): props colidíveis esparsos (~4%) + zonas safe/guerra/campo derivadas do seed. Zonas sincronizadas (cliente pinta o chão), sem região fechada.
**Contexto:** docs/mechanics/world.md · packages/shared/src/map.ts · packages/server/src/rooms/ArenaRoom.ts · packages/client/src/main.ts
**Aceite:** bots BFS continuam coletando; chão muda de cor por zona; nenhum prop bloqueia spawn.

## T-002 — Pré-modelos de props (fase F2) 〔P〕 ✅ (PROMPT-0005) · depende: T-001
**Objetivo:** pedra/árvore/caixa/muro/bandeira compostos de primitivas em visuals.ts, renderizados por tipo do grid.
**Contexto:** docs/mechanics/world.md (tabela) · instrucoes/FASES_VISUAIS.md · packages/client/src/visuals.ts · packages/client/src/main.ts
**Aceite:** cada tipo visualmente distinto; draw calls sob controle (instancing por tipo).

## T-003 — Crescimento: XP, nível, atributos múltiplos 〔M〕 ✅ (PROMPT-0006)
**Objetivo:** xp/coins no Player, curva `XP_BASE × n^XP_EXP`, pontos por nível, atributos força/velocidade/vitalidade com auto-distribuição, integrados ao EffectSystem como camada permanente do round.
**Contexto:** docs/mechanics/growth.md · packages/server/src/systems/effects.ts · packages/server/src/state/ArenaState.ts · packages/shared/src/constants.ts
**Aceite:** coletar dá XP e sobe nível pela curva; atributos refletem no estado; teste unitário da curva.

## T-004 — Coletáveis expandidos + spawn por zona 〔M〕 ✅ (PROMPT-0007) · depende: T-001, T-003
**Objetivo:** xp_orb, farm_event, coin_buff, box (conforme growth.md); pesos de spawn por zona (guerra = raros). Box: bônus forte no round + soma no acumulador persistente por playerToken (ADR-012, painel visível só em T-007/DEV_MODE). Coins: reroll de atributo (COIN_REROLL_COST).
**Contexto:** docs/mechanics/growth.md · docs/DECISION_LOG.md (ADR-012) · packages/server/src/rooms/ArenaRoom.ts · packages/client/src/visuals.ts
**Aceite:** box só nasce em zona de guerra; farm_event anunciado no HUD; métricas registram por kind; reroll consome coins e reaplica preset de atributo.

## T-004b — Scaffold de progressão persistente (ADR-012) 〔P〕 ✅ (PROMPT-0008) · depende: T-004
**Objetivo:** playerToken gerado/persistido no cliente (localStorage), enviado no join; servidor guarda PersistentProgress em memória por token, alimentado pela box.
**Contexto:** docs/DECISION_LOG.md (ADR-012) · packages/server/src/rooms/ArenaRoom.ts · packages/client/src/main.ts
**Aceite:** reconectar com o mesmo token mantém o acumulador; não afeta poder dentro do round; visível só com DEV_MODE (painel real chega em T-007).

## T-005 — Lançadores v1: tiro reto 〔G〕 ✅ (PROMPT-0009)
**Objetivo:** LauncherDef registry (shared), ProjectileSystem no servidor, input fire com cooldown, vida/dano (dano × força), projétil some em prop/alcance, feedback de hit no cliente.
**Contexto:** docs/mechanics/combat.md · packages/server/src/rooms/ArenaRoom.ts · packages/server/src/systems/effects.ts · packages/shared/src/constants.ts · packages/client/src/main.ts
**Aceite:** bot atinge bot e a vida cai; projétil respeita alcance; zona safe bloqueia dano.

## T-006 — Morte, respawn e perda de nível 〔M〕 ✅ (PROMPT-0010) · depende: T-005
**Objetivo:** vida 0 → morte, respawn em zona safe, perda de nível por curva que escala com o nível (piso 1–3, cresce depois — ver progression.md) + flag `fullResetOnDeath` (por room/default global), kill dá XP escalado pelo nível da vítima.
**Contexto:** docs/mechanics/progression.md · docs/mechanics/growth.md · packages/server/src/rooms/ArenaRoom.ts
**Aceite:** morrer aplica a curva de perda (baixo nível quase não perde, alto nível perde muito); toggle de reset total funciona por room; métricas de kill/death.

## T-007 — Modo debug dinâmico 〔M〕 ✅ (PROMPT-0011)
**Objetivo:** overlay F3 (zonas, entidades, timers, feed de eventos), canal debug no servidor, /debug/rooms, ring buffer, BOT_VERBOSE.
**Contexto:** docs/mechanics/debug-mode.md · packages/server/src/rooms/ArenaRoom.ts · packages/client/src/main.ts · packages/bots/src/bot.ts
**Aceite:** F3 mostra eventos ao vivo; /debug/rooms responde; sem custo quando desligado.

## T-008 — Bots de combate 〔M〕 ✅ (PROMPT-0013) · depende: T-005, T-006
**Objetivo:** bots miram e atiram (com erro proposital parametrizado), fogem quando com pouca vida, avaliam risco de zona de guerra. Consegue ter um nível de "personalidade" e atributos para o bot, podendo ter um modo default com algumas coisas sortidas para diferenciar na sessão, como também criar um bem "personalizado" como um boss.

**Escopo desta entrega (mínimo do aceite):** combate funcional + skill parametrizável (fraco/médio/forte). Personalidade/atributos sorteados e modo "boss" ficam para **T-008b** (a base de skill já deixa o gancho pronto).
**Contexto:** docs/ai/bots.md · packages/bots/src/bot.ts · packages/shared/src/launchers.ts (alcance/cooldown) · packages/shared/src/map.ts (zoneAt)
**Aceite:** 4 bots geram kills entre si; skill parametrizável (fraco/médio/forte).

## T-008b — Personalidade, atributos e boss 〔M〕 · depende: T-008, T-016
**Objetivo:** perfis de bot (agressivo/cauteloso/caçador…) sorteados por sessão via a base de skill da T-008; atributos iniciais por perfil; um modo "boss" personalizado (skill alta, HP/atributos elevados, comportamento distinto). Gancho para futuramente o cérebro do bot ser acionado por um modelo (Guardian, M3).
**Adendo SPEC-0004:** perfis ganham **política de escolha de cards** (bruto = Força/Cadência, tanque = Vitalidade/Agilidade, caçador = Alcance/Agilidade, equilibrado = auto-pick) — determinística e explorável pelo player (habilidade > sorte). Boss nasce nível 6–8 com build concentrada + 1 skill de marco + combate `forte`.
**Contexto:** docs/ai/bots.md · specs/SPEC-0004-skills-atributos-escala.md · packages/bots/src/bot.ts
**Aceite:** perfis visivelmente diferentes numa mesma sessão; boss sobrevive/ameaça mais que bots comuns; políticas de card por perfil observáveis no F3.

## T-OPTIONAL 1 — Passe de balance + métricas de combate 〔P〕 · depende: T-006
**Objetivo:** métricas TTK, XP/min, dano por arma; ajustar curvas com dados de 10 partidas de bots.
**Contexto:** docs/observability/metrics.md · packages/server/src/metrics/SessionMetrics.ts
**Aceite:** relatório em docs/ai/ com números reais e ajustes aplicados.
**Adendo SPEC-0004:** o relatório da T-014 é a primeira metade deste passe; re-rodar após T-017 (skills mudam o DPS efetivo).

---

# M1.5 — Escala de poder & builds (SPEC-0004, ADR-013)

> Origem: `docs/proposals/PROPOSAL-0001-skills-atributos-escala.md` (diagnóstico: TTK constante de 10 tiros — força e vitalidade escalam na mesma taxa). Spec: `specs/SPEC-0004-skills-atributos-escala.md`. Cada task é jogável e testável sozinha (Debug First); executar em ordem.

## T-014 — Rebalance TTK: dano base e relatório 〔P〕 ✅ (PROMPT-0020 · TTK medido com bots, ver docs/ai/balance-T014-ttk.md)
**Objetivo:** `basic_shot.damage` 10→20 (TTK base 5 tiros, ver TTK alvo na spec); rodada de bots medindo TTK/kills por round antes/depois; relatório curto em `docs/ai/`. Ajustar testes existentes.
**Contexto:** specs/SPEC-0004-skills-atributos-escala.md · packages/shared/src/launchers.ts · packages/server/src/metrics/SessionMetrics.ts · docs/observability/metrics.md
**Aceite:** kills por partida de bots sobem visivelmente; TTK médio cai ~metade; relatório com números reais em docs/ai/.

## T-015 — ATTR_DEFS: tabela de atributos + Cadência e Alcance 〔M〕 ✅ (PROMPT-0021) · depende: T-014
**Objetivo:** substituir `ATTR_POINT_VALUE` único pela tabela `ATTR_DEFS` (valor/pt + teto por atributo, escala assimétrica: Força +6%/×3.0, Vitalidade +4%/×2.5, Agilidade +3%/×2.0, Cadência −4%/mín. 55% cd, Alcance +5%/×1.75); `Player` ganha `attackSpeed` e `reach`; `EffectSystem.recompute()` calcula os 5; `ProjectileSystem` usa cooldown e range efetivos; reroll redistribui entre 5 (4 cortes). Atualizar `docs/mechanics/skills.md` e `growth.md`.
**Contexto:** specs/SPEC-0004-skills-atributos-escala.md · packages/shared/src/constants.ts · packages/server/src/systems/effects.ts · packages/server/src/systems/projectiles.ts · packages/server/src/state/ArenaState.ts
**Aceite:** testes unitários de valores/tetos e do caso "full-Força n8 mata equilibrado n8 em 3 tiros"; cadência/alcance visíveis no F3.

## T-016 — Cards de level-up (escolha manual v2) 〔G〕 ✅ (PROMPT-0022) · depende: T-015
**Objetivo:** level-up gera oferta determinística de 3 cards (3 pts cada, tabela por nível em shared); mensagem `choose_upgrade` validada no servidor (escolha inválida ignorada); timeout 5s → auto-pick equilibrado (jogo nunca pausa); HUD de cards (teclas 1/2/3) — extrair `hud.ts` do `main.ts` nesta task (dívida LEAD_DESIGNER_NOTES); bots respondem com auto-pick. Morte reseta para preset do novo nível. Atualizar `docs/mechanics/growth.md` e `PLAYER_LOOP.md`.
**Contexto:** specs/SPEC-0004-skills-atributos-escala.md · packages/shared/src/constants.ts · packages/server/src/rooms/ArenaRoom.ts · packages/server/src/systems/effects.ts · packages/client/src/main.ts · packages/bots/src/bot.ts
**Aceite:** escolha inválida ignorada; timeout aplica auto-pick; morrer reseta build; bots sem regressão de kills.

## T-017 — Skills de projétil: patterns, marcos e box 〔G〕 ✅ (PROMPT-0023) · depende: T-016
**Objetivo:** `LauncherDef.fire` ganha `projectilesPerShot/spreadRad/damageFactor` + `pierce`; função de pattern `spread`; pierce no `ProjectileSystem`; 5 skills iniciais data-driven (Tiro Duplo, Leque, Perfurante, Fôlego, Impulso — tabela na spec) como modificadores por player; marcos (`SKILL_MILESTONE_LEVELS`, default 4/8/12) trocam 1 card por escolha de skill (1 de 2); box sorteia skill (fecha decisão do CD em growth.md). Atualizar `docs/mechanics/combat.md`.
**Contexto:** specs/SPEC-0004-skills-atributos-escala.md · packages/shared/src/launchers.ts · packages/server/src/systems/projectiles.ts · packages/server/src/rooms/ArenaRoom.ts · docs/mechanics/growth.md
**Aceite:** Tiro Duplo spawna 2 projéteis com dano reduzido; Perfurante atravessa exatamente 1 alvo; skill aparece no card do marco e no F3; box concede skill em zona de guerra.

## T-018 — Juice de poder 〔P〕 ✅ (PROMPT-0024 · screenshot pendente do teste do CD no browser) · depende: T-016
**Objetivo:** glow/aro por faixa de nível (1–3 nada, 4–7 fraco, 8+ forte + trail), números de dano com escala visual, kill streak no HUD, flash do card escolhido. Só `visuals.ts`/`hud.ts`, respeitando a fase visual atual.
**Contexto:** specs/SPEC-0004-skills-atributos-escala.md · instrucoes/FASES_VISUAIS.md · packages/client/src/visuals.ts
**Aceite:** glow por faixa visível; screenshot comparando faixas de nível; sem custo de draw calls perceptível.

---
Concluiu tudo? Reler `docs/VISAO-ATUAL.md` e abrir nova sessão de ideias (PROMPT-0004).
