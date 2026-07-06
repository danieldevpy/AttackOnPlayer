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

## T-008b — Personalidade, atributos e boss 〔M〕 ✅ (PROMPT-0030) · depende: T-008, T-016
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

# V1 — Rumo ao lançamento (PROPOSAL-0002) · ✅ aprovada pelo CD (2026-07-05, com ajustes §9)

> Plano: **`docs/proposals/PROPOSAL-0002-v1-lancamento.md`** (ajustes A1/A2/A3 no §9).
> Specs por fase: F1+F2 → `SPEC-0006` · F3 → `SPEC-0007` · F4 → `SPEC-0008` · F5+F6 → `SPEC-0009`.
> ADRs: **ADR-015** (perfis de controle) · **ADR-016** (fronteira Django). Teoria dos bots: `docs/ai/bot-architecture.md`.
> Executar em ordem de fase; prompt típico: `Executar T-019 do docs/BACKLOG.md`.

**F1 — Sensação (SPEC-0006)**
- **T-019** 〔M〕 ✅ (PROMPT-0027) Camada de **perfis de controle** (ADR-015: todo perfil → `{move, aim, fire}`) + perfil `mouse` (WASD strafe, crosshair 360°, câmera com offset de mira)
- **T-019b** 〔M〕 ✅ (PROMPT-0028) Perfis `keyboard` (rotação de mira por teclas, notebook sem mouse) e `touch` v1 (twin-stick virtual) + auto-detecção e seletor · depende: T-019
- **T-020** 〔G〕 ✅ (PROMPT-0029) **Arquitetura de IA dos bots** (`docs/ai/bot-architecture.md`): percepção filtrada → memória → decisão utility → context steering (fim do esbarrão na borda; strafe orbital) → humanizador (reação/lerp de mira/pausas/desistência) → atuação; `Personality` em JSON; testes puros de decisão/steering
- **T-008b** 〔M〕 ✅ (acima, PROMPT-0030) Perfis de bot + boss = **presets de Personality** · depende: T-020

**F2 — Objetivo & leitura (SPEC-0006)**
- **T-021** 〔M〕 ✅ (PROMPT-0031) Bandeira "rei do mapa": 2× XP/s, glow global, toggle por room (default ON), derruba na morte, retorna ao centro se abandonada
- **T-022** 〔M〕 ✅ (PROMPT-0034) VFX nomeados: registry de partículas data-driven derivado de eventos existentes. **Regra de intensidade** (automático = leve; escolha manual = "aura" chamativa) + fila inicial do backlog vivo `docs/mechanics/vfx-juice-backlog.md` (speed_up_trail, buff_cooldown_ring, blood_hit, level_up_auto, upgrade_chosen_aura) — backlog é contínuo, CD alimenta quando quiser
- **T-023** 〔G〕 ✅ (PROMPT-0035) HUD dev/prod (`import.meta.env.DEV`: dev sempre mostra tudo; prod compacto, atributos só segurando [Tab], sem roster/F3) + reveal-on-hit autoritativo (`Player.revealedUntil`, ~4s renováveis, nameplate+HP só aparecem depois de trocar dano) + **toasts** (`toast_text`: mensagens com efeito personalizado, fila no canto, não invasivas) · depende: T-022

**F2.5 — Sobrevivência & recursos de vida (SPEC-0010)** — *gameplay; implementado (PROMPT-0037). Pendente: veredito de sensação/calibração do CD jogando (4 tunables).*
- **T-033** 〔M〕 ✅ (PROMPT-0037) **Recompensa de kill contextual** (ADR-017): no instante do abate, conta inimigos vivos no raio de combate (`COMBAT_THREAT_RADIUS`) do matador. Duelo (0) → bônus de XP; briga (≥1) → cura % da vida **faltante** escalando com nº de inimigos, teto `KILL_HEAL_MISSING_FRAC_MAX`, sem overheal. Server-only. Smoke com bots aglomerados: `kill_heal` (threats 1→heal 10, threats 2→heal 14) e `kill_duel_bonus` observados ao vivo. Contexto: `specs/SPEC-0010-*.md`, `packages/server/src/rooms/ArenaRoom.ts`, `constants.ts`
- **T-034** 〔M〕 ✅ (PROMPT-0037) **`hp_orb` — orbe de vida escasso**: coletável novo (+`HP_ORB_AMOUNT`, clampa em maxHp). Passe de spawn **dedicado** (fora do orçamento genérico): teto `HP_ORB_MAX`, distâncias mínimas próprias de player (`HP_ORB_MIN_PLAYER_DIST`) e de outro hp_orb (`HP_ORB_MIN_SELF_DIST`), reposição lenta. Placeholder render + coleta. Smoke: nasce e é coletado respeitando o teto. · depende: T-033
- **T-035** 〔G〕 ✅ (PROMPT-0037) **`shield_temp` — escudo temporário**: coletável novo (máx `SHIELD_TEMP_MAX`=2, espaçamento próprio). Novo `EffectKind` `damage_reduction` no EffectSystem → campo sincronizado `Player.damageTakenMult`; `projectiles.ts` multiplica o dano recebido (reduz, **não** bloqueia — distinto de `blockedByShield`). Tag HUD via `player.effects`. Smoke: nasce (teto 2), é coletado, dano reduzido em teste. · depende: T-034

**Passe visual (juice + leitura) — pedido direto do CD 2026-07-05**
- **T-036** 〔M〕 ✅ (PROMPT-0038) **Passe visual**, três frentes que complementam sistemas existentes: (1) **coletáveis reconhecíveis** — avança coletáveis de F1 (primitiva única) para **F2 composição** (ADR-008/FASES_VISUAIS), forma intuitiva por tipo: cruz=vida, domo azul=escudo, seta=velocidade, moeda em pé, seta dupla=2×XP, baú=box, gema=xp (`collectibleParts` em `visuals.ts`, geo/mat singletons — nada alocado por instância); (2) **VFX** puxados do backlog vivo (`heal_pop`, `shield_gain`) cobrindo a lacuna de feedback de cura/escudo da SPEC-0010 + popup "+X" verde; (3) **HUD gamificado** — painel com badge de nível, barras HP/XP e chips de efeito, no lugar do bloco de texto cru (mantém regra "só exibe estado" e dev/prod da T-023). Verificado: typecheck ×3, gates 25/28/24, HUD conferido em screenshot (barra de HP muda de cor por fração). Pendente: veredito visual humano do 3D (WebGL não screenshota headless).

**F2.6 — Feedback de gameplay #2 (SPEC-0011) — pedido direto do CD 2026-07-05 (2º teste) · implementada na S19 (PROMPT-0039, commit 337ae08)**

> Implementada por 4 agentes em 2 etapas paralelas; working tree resetado por acidente e **recuperado por replay dos transcripts** (85 ops, 0 falhas). Cada task abaixo tem escopo fechado — para recalibrar/refazer individualmente, prompt = `Executar T-0XX` (dimensionadas para Sonnet). Tasks da MESMA frente compartilham arquivos (rodar em série); frentes diferentes são paralelizáveis.

*Frente Bots (`packages/bots` apenas):*
- **T-037** 〔M〕 ✅ **Bots caçam poder + coragem com vida cheia**: percepção estendida por banda de poder do alvo (`AURA_PERCEPTION_MULT_MID=1.6`/`HIGH=2.5`) + peso de engage com teto (`AURA_ENGAGE_MULT_MID=1.25`/`HIGH=1.5`) + piso de `advantageConf` (0.25/0.5) — alvo forte é caçado sem virar "todos contra um" (`targetBias` intacto); HP ≥ `FULL_HP_COURAGE_FRAC=0.9` + inimigo ⇒ engage vence farm/wander; flee só com HP baixo E `hp_orb`/`box` percebido, senão luta. **Contexto:** `packages/bots/src/ai/{personality,perception,decision,types}.ts`, `bot.ts`, testes `perception.test.ts`/`decision.test.ts` · docs/ai/bots.md. **Aceite:** 35/35 verdes. **Dials:** os 6 valores acima em `personality.ts`/`decision.ts`.

*Frente Projéteis (shared/server/client):*
- **T-038** 〔M〕 ✅ **Projétil menor (diagonal)**: `sceneryRadius` separado do raio de hit (`basic_shot` 0.22 vs 0.4) — atravessa vão diagonal entre props, TTK/sensação de acerto intactos. **Contexto:** `shared/launchers.ts`, `server/systems/projectiles.ts` (+`.test.ts` com o cenário diagonal). **Dial:** `sceneryRadius` por lançador.
- **T-039** 〔G〕 ✅ **Arsenal + arma coletável única**: `heavy_shot` (28 dmg/780 ms/speed 9, +8% DPS) e `rapid_shot` (13 dmg/340 ms/speed 13, +15% DPS); kind `weapon` com `weaponId` no schema, **1 por vez** (`WEAPON_MAX=1`), spawn aleatório walkable+alcançável (`reachableCells`), respawn sorteado `WEAPON_RESPAWN_MIN/MAX_MS`=15–30 s, morte devolve `DEFAULT_LAUNCHER`; cliente: projétil/estilo por lançador, VFX `muzzle_heavy`/`muzzle_rapid`/`weapon_pickup`, chip de arma no HUD. **Contexto:** `shared/{launchers,constants,map}.ts`, `server/rooms/ArenaRoom.ts` (`spawnWeapon`), `weapon.test.ts`, `client/src/{main,vfx,visuals,hud}.ts`. **Dials:** números dos lançadores, janela de respawn, `WEAPON_MAX`.

*Frente Bandeira (server/shared/client/bots):*
- **T-040** 〔M〕 ✅ **Nunca bloqueada**: todo assentamento (init/centro/drop) snapa via `nearestReachableCell` (`shared/map.ts`) usando o conjunto `reachable` pré-computado. **Contexto:** `server/systems/flag.ts` (+`.test.ts`).
- **T-041** 〔P〕 ✅ **Acesa/desativada**: livre = emissivo pulsante (visível de longe); carregada = mesh apagado (glow no portador); cooldown = some. **Contexto:** `client/src/main.ts` (~l.784).
- **T-042** 〔M〕 ✅ **Cooldown**: drop não disputado por `FLAG_ABANDON_RETURN_MS` (5 s) ⇒ `Flag.state="cooldown"` por `FLAG_COOLDOWN_MS=60 s` (pickup impossível) ⇒ renasce no centro; eventos `flag_cooldown_start`/`flag_respawn` + toast; bots tratam cooldown como inexistente (`bot.ts` l.193). **Dials:** `FLAG_COOLDOWN_MS`, `FLAG_ABANDON_RETURN_MS`.

*Frente Feedback/UX (server + client):*
- **T-043** 〔M〕 ✅ **Combo de XP**: server-only por player (`xpComboCount`/`xpComboLimit`); a partir da 3ª coleta seguida de `xp_orb` vale `XP_COMBO_MULT=2`×; limite sorteado ∈ [`XP_COMBO_LIMIT_MIN=3`,`MAX=5`] fecha o combo; **qualquer dano real zera**; outras coletas não contam nem zeram; evento `xp_combo`. **Contexto:** `server/rooms/ArenaRoom.ts`, `combo.test.ts`.
- **T-044** 〔P〕 ✅ **Popups discretos de coleta**: `pushPopup` estendido (`opacity 0.62`, `scale 0.78`, 600 ms) para xp/speed/coin/farm_event/box — informa sem poluir; hp_orb/shield_temp mantêm o popup da T-036. **Contexto:** `client/src/main.ts` (~l.422).
- **T-045** 〔P〕 ✅ **Transição de nascimento**: materialização scale-in+fade-in `SPAWN_ANIM_MS=400 ms` + VFX `spawn_materialize` (self e inimigos) + fade de tela DOM para o próprio jogador — fim do "teletransporte". **Contexto:** `client/src/main.ts` (~l.234), `vfx.ts`.

*Pendências da F2.6 (paralelizáveis entre si — frentes disjuntas):*
- **T-046** 〔QA〕 ✅ **Smoke de integração da SPEC-0011** (2026-07-06): servidor em `PORT=2601` + 10 bots headless, duas rodadas (200 s/240 s) com polling do `/debug/rooms` a cada 16 s (1262 eventos únicos, 265 s). Confirmado: arma nunca duplicada (9 ciclos spawn→pickup, intervalos 19–30 s), ciclo completo da bandeira `flag_cooldown_start`→`flag_respawn` = 60028 ms (bate com `FLAG_COOLDOWN_MS`), `xp_combo` boosted a partir de `count≥3` (23/104), `kill_heal`+`kill_duel_bonus` coexistindo (sem monopólio de alvo). Sem mudança de código. Relatório completo: `docs/prompts/PROMPT-0039.md` §Resultado T-046. Gates 25/49/35 + tsc ×3 limpos.
- **T-047** 〔docs〕 ✅ **Doc de mecânica da bandeira** (2026-07-06): `docs/mechanics/flag.md` — ciclo completo (ativa → carregada → dropada → abandono/cooldown → renascimento), assentamento sempre válido (T-040), visual por estado (T-041), tabela de constantes-dial.

**Fora de fase — pedido direto do CD (SPEC-0012), antes de retomar T-028**
- **T-048** 〔P〕 ✅ (PROMPT-0043) **Imersão de navegador**: botão ⛶ tela cheia (Fullscreen API, ícone reflete `fullscreenchange`) no `#profile-selector`; `contextmenu`/clique-do-meio/`Ctrl+scroll`/`gesturestart`/`dragstart` suprimidos globalmente; `touch-action: none` + `overscroll-behavior: none` + `user-select: none` globais (antes só `body.touch-profile` tinha `touch-action`), overlay de debug (F3) mantém seleção de texto; `beforeunload` liga com a sala conectada (`room.onLeave`/`onError` desliga) — confirmação nativa antes de fechar/recarregar no meio de uma partida. Tudo em `packages/client/src/immersion.ts` (novo), client-only, zero mudança de contrato de rede. **Contexto:** `packages/client/src/immersion.ts`, `packages/client/index.html`, `packages/client/src/main.ts`.

**F3 — Conteúdo (SPEC-0007)**
- **T-024** 〔G〕 ✅ (PROMPT-0036) **Registry de objetos** (`ObjectDef` no shared — código agora, sistema/Django depois) + formato de mapa v1 (instâncias `{objectId, x, z, ...}`, zonas, spawns, bandeira) + loader por `mapId` com validação/flood-fill
- **T-025** 〔M〕 ✅ (PROMPT-0040) **CLI de mapas**: `npm run map -- gen|save|save-current|update|list|preview`. `gen` só imprime preview (não grava); `save`/`update` persistem (`update` regenera preservando id/name/author); `save-current` lê `/debug/rooms` (ganhou campo `mapId`) e regenera via `buildMap(w,h,seed)` — determinístico, sem endpoint novo. Novo em shared: `gameMapToMapFile` + `mapFilePreview` (ASCII com props/spawns/bandeira). Validado ponta a ponta: sala real capturada (`arena-live-capture.map.json`) e rejogada por `BOT_MAP_ID`, sem regressão. 2 mapas curados no repo (`arena-teste` + `arena-live-capture`). Gates 29/49/35 + tsc ×3. · depende: T-024

**F4 — Plataforma (SPEC-0008)**
- **T-026** 〔M〕 ✅ (PROMPT-0042) **Telemetria estruturada p/ IA**: 1 NDJSON versionado por partida (`packages/server/logs/telemetry/<roomId>.ndjson`) com `match_start`/`match_end`, `kill` (posições+níveis dos dois lados, threats), `upgrade_offer`/`upgrade_choice` (ofertados E recusados), `flag_possession`, `quit`, `tick_slow` (watchdog, >100ms), `error` (tick nunca derruba a sala). `npm run analyze -- [matchId|--list]` imprime funil, cards mais recusados, heatmap ASCII de mortes, watchdog/erros — lógica pura testável em `telemetry/analyze.ts`. Validado ponta a ponta com 8 bots reais. Gates 30/62/35 + tsc ×3.
- **T-027** 〔G〕 ✅ (Sessão 24, ADR-019) **Backend Django**: `accounts` (Account/PlayerStats/GuestLink, JWT RS256+JWKS+guest+link) + `maps` (registry, validador espelho do TS, `import_maps`) + `gameops` (RoomConfig/GameEvent, config efetiva por evento) + `telemetry` (ingestão batch, schema T-026) + admin + `platformClient.ts` no Node (cache+TTL de config, batch de telemetria, degradação atrás de `PLATFORM_ENABLED`). 71 testes pytest (Postgres real) + 8 vitest novos; aceites #2 (evento sem deploy) e #3 (degradação) verificados manualmente ponta a ponta. `backend/dev.sh` sobe tudo com 1 comando.
- **T-028** 〔G〕 ✅ (2026-07-06, ADR-020) **Auth email+senha**: `POST /auth/register`+`/login` (Django) + verificação de JWT no join do Colyseus (`authVerifier.ts`, jose+JWKS, cache interno, sem round-trip por join; token inválido cai pra guest sem rejeitar) + janela discreta no client (`auth.ts`: pill no canto, nunca modal, guest permanece 1 clique; registra o guest local no Django em best-effort; login/registro herdam stats via `/auth/link`). **Google OAuth adiado a pedido do CD** — ver T-028-google. pytest 79/79 (+8 novos), vitest server 76/76 (+6 novos), tsc ×3 limpos. · depende: T-027 ✅
- **T-028-google** 〔M〕 Provider Google OAuth (opcional, fora de fase) — plugar no mesmo endpoint de emissão de JWT; `Account.google_sub` já reservado no schema, sem migração nova · depende: T-028 ✅
- **T-029** 〔P〕 ADR-012 liga na conta (estatística, nunca poder in-round) · depende: T-028 ✅

**F5 — Empacotamento (SPEC-0009)**
- **T-030** 〔G〕 Docker compose dev/prod + `scripts/dev.sh`/`scripts/prod.sh` com verificação de saúde
- **T-031** 〔M〕 Hardening: healthz, rate-limit, backup Postgres, envs segregadas · depende: T-030
- **T-OPTIONAL 1** (acima) Passe de balance final com perfis/mapas novos

**F6 — Lançamento (SPEC-0009)**
- **T-032** 〔G〕 🚀 V1 na VPS: deploy prod, domínio+TLS, página inicial, teste de carga, go-live e divulgação · depende: todas

---

# V1 — Som, personagens e lobby (PROPOSAL-0004) · ✅ aprovada pelo CD (2026-07-06)

> Plano: **`docs/proposals/PROPOSAL-0004-som-personagens-lobby.md`**. Specs a gerar: Som → `SPEC-0013` · Personagens → `SPEC-0014` · Lobby → `SPEC-0015` (tasks de docs abaixo).
> Alocação de modelo por task: **`instrucoes/GUIA_MODELOS_CLAUDE.md`**.
> Frentes disjuntas (Som ∥ Personagens ∥ Backend; Lobby depois) — paralelizáveis; dentro da frente, executar em série. Tudo antes de T-030/T-032.

**Frente S — Som (SPEC-0013) — client-only**
- **T-049** 〔M〕 ✅ (2026-07-06) **AudioSystem + registry procedural**: `packages/client/src/audio.ts` novo — `SoundDef` (synth WebAudio: tipo/freq/envelope/noise; campo `file?` reservado), `AUDIO_REGISTRY`, `AudioContext` com unlock no primeiro gesto, master gain + mute, teto de vozes, pool. Espelhar o padrão do `vfx.ts` (T-022): sons derivados de eventos existentes, nada ad-hoc no `main.ts`. **Contexto:** `packages/client/src/vfx.ts` (padrão) · `packages/client/src/main.ts` (pontos de evento). **Aceite:** 3 sons de teste tocam por evento real; mute funciona; zero erro de autoplay no console.
- **T-050** 〔M〕 ✅ (2026-07-06) **Mapeamento evento→som completo**: coleta por kind (xp/coin/hp/shield/weapon/box/farm_event), fire por launcher (basic/heavy/rapid), hit dado/recebido, kill/death/respawn, level-up + card escolhido, bandeira (pickup/drop/cooldown/respawn), xp_combo, spawn_materialize, toast. Sons distinguíveis entre si (tabela na SPEC-0013). **Contexto:** `packages/client/src/audio.ts` · `vfx.ts` (lista de eventos) · `hud.ts`. **Aceite:** partida com bots audível e legível de olhos fechados; sem estouro de vozes. · depende: T-049
- **T-051** 〔P〕 ✅ (2026-07-06) **Áudio posicional + polish**: atenuação/pan por distância da câmera, ducking simples, sliders master/sfx persistidos em localStorage (o lobby T-058 expõe depois). **Contexto:** `packages/client/src/audio.ts`. · depende: T-050

**Frente C — Personagens/classe/skin (SPEC-0014) — shared+client**
- **T-052** 〔M〕⚠schema ✅ (2026-07-06) **Registry de classes (contrato)**: `packages/shared/src/classes.ts` — `ClassDef { id, launcherIds, baseTint, skinIds }`, `CLASS_REGISTRY` com só `archer` (launchers atuais viram os projéteis da classe); `Player.classId`/`skinId` no schema; join valida (inválido ⇒ default, nunca rejeita). **Contexto:** `packages/shared/src/{launchers,constants}.ts` · `packages/server/src/state/ArenaState.ts` · `packages/server/src/rooms/ArenaRoom.ts`. **Aceite:** testes de join com classe válida/inválida/ausente; bots sem regressão; tsc ×3.
- **T-053** 〔G〕 **Arqueiro low poly procedural (F2, ADR-008)**: `packages/client/src/characters.ts` — `createCharacterVisual(classId, skinId)` retorna `THREE.Group` com partes nomeadas (cabeça cone 4 lados, corpo cylinder, braços/pernas boxes, capuz, arco), `flatShading`, **geometrias/materiais singleton**; plugado em `createPlayerVisual` (`visuals.ts`, `VISUAL_PHASE=2` para personagens). Referência visual: imagem do CD (PROMPT-0044). **Contexto:** `instrucoes/FASES_VISUAIS.md` · `packages/client/src/visuals.ts`. **Aceite:** silhueta legível e direção óbvia de facing; draw calls medidos antes/depois no F3 (< 200 total com 10 players); screenshot pro CD. · depende: T-052
- **T-054** 〔M〕 **Animações procedurais**: idle (respiração), walk (pernas/braços por seno, velocity da rede), shoot (puxar arco no evento fire), death/spawn (integra com `SPAWN_ANIM_MS` da T-045). Update central por frame em `characters.ts`; sem clock global novo. **Contexto:** `packages/client/src/characters.ts` · `main.ts` (loop + eventos). **Aceite:** os 4 estados visíveis com bots; sem custo de frame perceptível. · depende: T-053
- **T-055** 〔M〕 **Projéteis do arqueiro**: visual de flecha (mesh orientado pela velocidade) para os launchers da classe; trail leve no heavy; mantém dano/rede intactos. **Contexto:** `packages/client/src/{main,vfx}.ts` · `packages/shared/src/launchers.ts` (leitura). **Aceite:** flecha aponta pra onde voa; 3 launchers visualmente distintos. · depende: T-053
- **T-056** 〔P〕 **Skins por paleta**: variações de cor por `skinId` (tabela em `classes.ts`), aplicadas na fábrica; gancho pronto pra classes futuras (guerreiro/mago = nova entrada no registry). **Contexto:** `packages/shared/src/classes.ts` · `packages/client/src/characters.ts`. · depende: T-053

**Frente B — Fechamento backend/painel (extensão SPEC-0008) — Django+platform**
- **T-060** 〔M〕 **KDA + ranking**: agregar kills/deaths da telemetria (T-026/T-027) em `PlayerStats`; endpoints `GET /stats/me` e `GET /ranking` (paginado); admin list com busca. **Contexto:** `backend/` (apps `telemetry`, `accounts`) · schema NDJSON da T-026. **Aceite:** pytest de agregação; partida real de bots reflete no ranking.
- **T-061** 〔M〕 **Auditoria + fechamento do admin**: passar o pente em `GameEvent`/`RoomConfig`/contas/nicks — o que falta pra operar eventos, salas, moderação de nick e métricas 100% pelo admin, sem deploy; endpoint de settings do player (usado pela T-058). **Contexto:** `backend/` · `packages/server/src/platform/platformClient.ts`. **Aceite:** checklist da SPEC-0008 todo verde; criar evento novo pelo admin muda sala ao vivo. · depende: T-060
- **T-029** (já listado acima, F4) entra nesta frente. · depende: T-028 ✅

**Frente L — Lobby pré-sala (SPEC-0015) — client(+auth)**
- **T-057** 〔G〕 **Janela pré-sala**: card único antes do join evoluindo `#profile-selector` + pill da T-028 (nunca cadeia de modais): identidade (guest/conta, nick), seleção de classe com preview 3D girando (`createCharacterVisual`), settings (perfil de controle, volumes, fullscreen T-048), botão **Jogar**. **Regra: 1 clique com defaults.** **Contexto:** `packages/client/src/{auth,main,characters,immersion}.ts` · `index.html`. **Aceite:** jogador novo entra com 1 clique; tudo configurável sem sair do card; mobile ok. · depende: T-053, T-052
- **T-058** 〔M〕 **Persistência de settings + nick**: localStorage sempre; conta Django quando logado (endpoint da T-061); nick sanitizado/limitado server-side. **Contexto:** `packages/client/src/auth.ts` · `packages/server/src/rooms/ArenaRoom.ts` · endpoint T-061. **Aceite:** settings sobrevivem a reload e a outra máquina (logado); nick malicioso vira fallback. · depende: T-057, T-061
- **T-059** 〔M〕⚠schema **Seleção no join**: join envia `{nick, classId, skinId, profile}`; servidor valida contra `CLASS_REGISTRY` e reflete no estado; bots ganham classe default. **Contexto:** `packages/server/src/rooms/ArenaRoom.ts` · `packages/shared/src/classes.ts` · `packages/bots/src/bot.ts`. **Aceite:** testes de join; troca de classe no lobby aparece pros outros players. · depende: T-057, T-052
- **T-062** 〔P〕 **Ranking/stats no lobby**: consumir `GET /stats/me` + `GET /ranking` no card (aba discreta). **Contexto:** `packages/client/src/auth.ts` · endpoints T-060. · depende: T-057, T-060

**Docs (gerar antes de cada frente — tasks baratas)**
- **T-D13** 〔docs〕 SPEC-0013 (som) a partir do §3 da PROPOSAL-0004 + tabela evento→som · **T-D14** 〔docs〕 SPEC-0014 (personagens) a partir do §4 + esqueleto de partes/animações · **T-D15** 〔docs〕 SPEC-0015 (lobby) a partir do §5 + wireframe texto do card. Usar `specs/TEMPLATE.md`.

**Frente X — Console staff (OPCIONAL, pós-V1, não bloqueia T-032)**
- **T-063** 〔M〕 **Console staff**: claim `role=staff` no JWT (Django admin marca a conta); console in-game (tecla dedicada) com **whitelist server-side** de comandos (toggles de room, spawn rates, kick, flag on/off), audit log na telemetria; GUI fica pra V1.x. **Contexto:** `backend/accounts` · `packages/server/src/platform/authVerifier.ts` · `ArenaRoom.ts`. **Aceite:** comando fora da whitelist ignorado; não-staff não abre console; toda execução logada. · depende: T-028 ✅

---
Concluiu tudo? Reler `docs/VISAO-ATUAL.md` e abrir nova sessão de ideias (PROMPT-0004).
