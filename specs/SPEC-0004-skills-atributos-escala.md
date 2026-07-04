# SPEC-0004 — Escala de poder: atributos expandidos, cards de build e skills de projétil

**Status:** aprovada · **Marco:** M1.5 · **Data:** 2026-07-04
**Origem:** `docs/proposals/PROPOSAL-0001-skills-atributos-escala.md` (diagnóstico completo e matemática do TTK)

## Problema / objetivo

O TTK é matematicamente constante: força e vitalidade escalam na mesma taxa (+4%/pt, pontos iguais por nível), então matar alguém exige sempre 10 tiros — em qualquer nível. Evoluir não muda o resultado dos confrontos e o jogador não *sente* o próprio poder. Objetivo: TTK alvo explícito, atributos que criam **builds** (com escolha real no level-up), skills de projétil discretas e feedback visual de poder — sem quebrar EffectSystem (ADR-009), lançadores data-driven (ADR-011) nem os pilares da constituição.

## Comportamento esperado

- **TTK alvo:** 5 tiros em níveis iguais sem especialização; 3–4 quando o atacante é especializado em dano. Nunca one-shot (tetos por atributo).
- **5 atributos data-driven** (tabela `ATTR_DEFS` em `constants.ts` — valor/pt e teto próprios por atributo):

  | Atributo | Efeito | Valor/pt | Teto |
  |---|---|---|---|
  | Força | × dano do lançador | +6% | ×3.0 |
  | Vitalidade | × maxHp | +4% | ×2.5 |
  | Agilidade | × velocidade de movimento | +3% | ×2.0 (mantém ADR-009) |
  | Cadência 🆕 | − cooldown do lançador | −4% | mín. 55% do cd base |
  | Alcance 🆕 | × range do projétil | +5% | ×1.75 |

- **Level-up por cards:** ao subir de nível, HUD mostra 3 cards de 3 pontos cada (ex.: `+3 Força` / `+2 Vitalidade +1 Agilidade` / `+2 Cadência +1 Alcance`). Teclas 1/2/3 ou clique; **timeout de 5s → auto-pick equilibrado**; o jogo nunca pausa. Cards **determinísticos por nível** (habilidade > sorte: quem conhece a tabela planeja build). Servidor valida tudo.
- **Skills de projétil em marcos de nível** (constante `SKILL_MILESTONE_LEVELS`, proposta inicial 4/8/12 — revisável por dados): no marco, um dos cards é uma skill (escolher 1 de 2). Skills iniciais: Tiro Duplo, Leque, Perfurante, Fôlego, Impulso (tabela na proposal §6). Multishot **não** é atributo linear. Box também sorteia skill (decisão do CD já registrada em growth.md).
- **Morte apaga a build:** `resetAttrToLevel` volta ao preset equilibrado do novo nível; skills de marco se perdem junto. Especializar é apostar (pilar risco real).
- **Reroll (coins)** passa a redistribuir entre os 5 atributos; não toca skills de marco.
- **Feedback de poder:** glow/aro por faixa de nível (1–3 nada, 4–7 fraco, 8+ forte + trail), números de dano com escala visual, streak no HUD. Também é leitura tática ("aquele é perigoso") — prepara o "famar aura" do M2.
- **Bots no mesmo pipeline:** bots recebem cards server-side como qualquer cliente; escolhem por **política fixa por perfil** (gancho T-008b — bruto/tanque/caçador/equilibrado, determinística e explorável). Protagonismo do player: só player tem reroll, escolha livre e (no M2) Aura.

## Fora de escopo

Aura (M2, ADR-005), persistência real entre partidas (ADR-012 segue scaffold), matchmaking (M3), lançadores novos completos (só modificadores de pattern), loja de coins/UI de economia, crítico/armadura, arte final, touch.

## Critérios de aceite

- [ ] Partida de bots: TTK médio medido cai para a faixa alvo (relatório com números em `docs/ai/`).
- [ ] Teste unitário: build full-Força nível 8 (21 pts) mata equilibrado nível 8 em 3 tiros; tetos de cada atributo respeitados.
- [ ] Cadência reduz o intervalo real entre tiros no servidor; Alcance estende o range do projétil (testes de `ProjectileSystem`).
- [ ] Mensagem de escolha inválida (card inexistente / sem level-up pendente) é ignorada pelo servidor.
- [ ] Timeout sem escolha aplica auto-pick equilibrado; cliente ignorando o HUD continua evoluindo.
- [ ] Tiro Duplo spawna 2 projéteis com dano reduzido; Perfurante atravessa exatamente 1 alvo.
- [ ] Morrer reseta atributos e skills de marco para o preset do novo nível.
- [ ] Bots continuam gerando kills entre si após o protocolo novo (sem regressão vs T-008).
- [ ] Glow por faixa de nível visível (screenshot em fase visual atual).

## Decisão do Creative Director

Aprovada (Daniel, 2026-07-04): baseada na PROPOSAL-0001 — rebalance de TTK, 5 atributos com escala assimétrica, level-up gamificado por cards, multishot como skill discreta, bots/boss se beneficiam via política por perfil mas o player permanece protagonista. Questões abertas da proposal (§11) decididas na implementação com dados de bots — defaults da spec valem até lá.

## Notas da IA

- **Risco — protocolo:** `choose_upgrade` é mensagem nova; bots precisam migrar na mesma task que a introduz (aprendizado da SPEC-0003/T-013).
- **Risco — `main.ts` do cliente:** HUD de cards pressiona a dívida já registrada (LEAD_DESIGNER_NOTES) — separar `hud.ts` na task dos cards, não antes.
- **Risco — balance é hipótese:** 20 de dano / 6%/4% são pontos de partida; validar com o relatório da T-014 e re-rodar após T-017 (skills mudam DPS efetivo). As 2 constantes de pacing de XP não mudam nesta spec.
- **Detalhe técnico — cooldown vs tick:** cooldown mínimo de 330ms com tick de 50ms é seguro (checagem por timestamp, não por contagem de ticks).
- **Detalhe técnico — reroll com 5 atributos:** `rerollAttrPoints` passa de 2 para 4 cortes aleatórios; mesma lógica.
- **Alternativa descartada — multishot como atributo:** escala multiplicativa explosiva com Força/Cadência; como skill discreta com `damageFactor`, o custo embutido balanceia.
- **Ordem pensada para cada task ser jogável e testável sozinha** (Debug First): rebalance → atributos → cards → skills → juice → perfis de bot.

---

## Quebra em tasks (particionado por objetivo)

### T-014 — Rebalance TTK: dano base e relatório 〔P〕
**Objetivo:** `basic_shot.damage` 10→20 (TTK base 5 tiros); rodada de bots medindo TTK/kills por round antes/depois; relatório curto em `docs/ai/`. Ajustar testes existentes.
**Aceite:** kills por partida de bots sobem visivelmente; TTK médio cai ~metade; relatório com números reais.

### T-015 — ATTR_DEFS: tabela de atributos + Cadência e Alcance 〔M〕 · depende: T-014
**Objetivo:** substituir `ATTR_POINT_VALUE` único pela tabela `ATTR_DEFS` (valor/pt + teto por atributo, escala assimétrica da spec); `Player` ganha `attackSpeed` e `reach`; `EffectSystem.recompute()` calcula os 5; `ProjectileSystem` usa cooldown e range efetivos; reroll redistribui entre 5. Atualizar `docs/mechanics/skills.md` e `growth.md`.
**Aceite:** testes unitários de valores/tetos e do caso "full-Força n8 mata equilibrado n8 em 3 tiros"; cadência/alcance visíveis no F3.

### T-016 — Cards de level-up (escolha manual v2) 〔G〕 · depende: T-015
**Objetivo:** level-up gera oferta determinística de 3 cards (3 pts cada, tabela por nível em shared); mensagem `choose_upgrade` validada no servidor; timeout 5s → auto-pick equilibrado; HUD de cards (teclas 1/2/3, sem pausa) — extrair `hud.ts` do `main.ts` nesta task; bots respondem com auto-pick. Morte reseta para preset do novo nível (comportamento atual mantido). Atualizar `docs/mechanics/growth.md` e `PLAYER_LOOP.md`.
**Aceite:** critérios 4–5 e 7 da spec; bots sem regressão de kills (critério 8).

### T-017 — Skills de projétil: patterns, marcos e box 〔G〕 · depende: T-016
**Objetivo:** `LauncherDef.fire` ganha `projectilesPerShot/spreadRad/damageFactor` + `pierce`; função de pattern `spread`; pierce no `ProjectileSystem`; 5 skills iniciais data-driven como modificadores por player; marcos (`SKILL_MILESTONE_LEVELS`) trocam 1 card por escolha de skill (1 de 2); box sorteia skill (fecha a decisão do CD em growth.md). Atualizar `docs/mechanics/combat.md`.
**Aceite:** critério 6 da spec; skill aparece no card do marco e no F3; box concede skill em zona de guerra.

### T-018 — Juice de poder 〔P〕 · depende: T-016
**Objetivo:** glow/aro por faixa de nível + trail no 8+, números de dano com escala visual, kill streak no HUD, flash do card escolhido. Só `visuals.ts`/`hud.ts`, respeitando a fase visual atual (FASES_VISUAIS).
**Aceite:** critério 9 da spec; screenshot comparando faixas de nível.

### T-008b (existente, atualizado) — Perfis de build, personalidade e boss · depende: T-008, T-016
A política de escolha de cards por perfil (bruto/tanque/caçador/equilibrado) e o boss (nasce nível 6–8, build concentrada + 1 skill + combate `forte`) entram na T-008b já registrada no BACKLOG — esta spec adiciona contexto, não task nova.

### T-OPTIONAL 1 (existente) — ganha insumo
O relatório da T-014 é a primeira metade deste passe de balance; re-rodar após T-017.
