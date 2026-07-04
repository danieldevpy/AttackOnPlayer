# PROPOSAL-0001 — Sistema de skills, atributos expandidos e escala de poder

> **Status:** ✅ aprovada pelo CD (2026-07-04) — virou `specs/SPEC-0004-skills-atributos-escala.md` (tasks T-014..T-018 + adendos T-008b/T-OPTIONAL 1 no BACKLOG, ADR-013). Este arquivo permanece como registro do diagnóstico e das alternativas.
> **Escopo:** diagnóstico do problema de dano, atributos novos, level-up gamificado, skills de projétil, integração com bots/boss e guardrails anti-snowball.
> **Referências:** GAME_CONSTITUTION.md · mechanics/growth.md · mechanics/combat.md · mechanics/skills.md (ADR-009) · mechanics/aura.md (ADR-005) · ai/bots.md · constants.ts · launchers.ts

---

## 1. Diagnóstico — por que "o dano aumenta devagar"

O dano **não** aumenta devagar. O problema é que **o HP do alvo aumenta na mesma velocidade**, então o poder relativo nunca muda:

| Constante atual | Valor |
|---|---|
| `basic_shot.damage` | 10 |
| `PLAYER_BASE_HP` | 100 |
| `ATTR_POINT_VALUE` | +4%/ponto (igual para os 3 atributos) |
| `ATTR_POINTS_PER_LEVEL_EACH` | +1 ponto em **cada** atributo por nível |

Consequência matemática: em níveis iguais, dano = `10 × (1+0.04p)` e HP = `100 × (1+0.04p)` — o quociente é **sempre 10 tiros para matar**, no nível 1 ou no nível 20. Com cooldown de 600ms são 5.4s de acertos *perfeitos*; com erro de mira, esquiva e alcance de só 8u, o TTK real passa fácil de 30s. Em partidas de 2–3 min, isso significa que quase nenhum confronto termina em kill.

Três causas somadas:

1. **TTK base alto demais** — 10 tiros é número de MMO, não de arena de 2–3 min.
2. **Escala simétrica** — preset equilibrado + mesmo valor por ponto ⇒ evolução não muda o resultado do confronto, só os números na tela. O jogador *sente* que não evoluiu porque, relativamente, não evoluiu.
3. **Sem especialização real** — o reroll (coins) muda proporção, mas a distribuição por nível é sempre automática e igual. Não há decisão de build, logo não há "sentir aura" ao evoluir.

## 2. Princípios (o que este plano NÃO quebra)

- **Servidor autoritativo + EffectSystem (ADR-009):** todo atributo/skill novo entra em `recompute()`/`ProjectileSystem`, nunca no Room ou no cliente. Zero arquitetura nova.
- **Lançadores data-driven (ADR-011):** multishot/spread/pierce = campos novos em `LauncherDef` + 1 função de pattern. Nada de lógica de arma no Room.
- **Habilidade > sorte (Constituição):** cards de upgrade oferecem *escolha*, não RNG de poder. Aura continua sendo oportunidade (ADR-005), nunca dano grátis.
- **Risco real:** morte continua resetando atributos ao preset do nível (`resetAttrToLevel`), perda de nível continua valendo. Builds se perdem ao morrer — especializar é apostar.
- **Rounds de 2–3 min:** nenhuma escolha pode travar o fluxo — todo menu tem default automático por timeout.
- **Bots no mesmo protocolo:** bots são clientes comuns; tudo que players ganham server-side, bots ganham de graça. Só a *política de escolha* deles é código novo (gancho T-008b).

## 3. Proposta A — Rebalance imediato do TTK (pré-requisito de tudo)

Definir **TTK alvo** explícito e ajustar 2 constantes. Sugestão:

> **TTK alvo: 5 tiros em níveis iguais sem especialização; 3–4 quando o atacante é especializado em dano.**

| Mudança | De | Para | Efeito |
|---|---|---|---|
| `basic_shot.damage` | 10 | **20** | 5 tiros base (2.4s de acertos perfeitos — ainda exige mirar bem) |
| `ATTR_POINT_VALUE` por atributo (ver §4) | 4% único | valores **assimétricos** | dano cresce mais rápido que HP ⇒ TTK cai suavemente com o nível |

Escala assimétrica sugerida: **Força +6%/pt, Vitalidade +4%/pt**. No preset equilibrado o TTK fica estável em ~5 tiros (nível 8 vs nível 8: 28.4 de dano vs 128 HP); a queda real vem da **especialização** (§5): um nível 8 com build full-Força (21 pts = ×2.26) derruba um equilibrado em **3 tiros** — evoluir e escolher passam a ser *sentidos*, sem virar one-shot. Validação: rodar 10 partidas de bots e medir TTK/kills por round (T-OPTIONAL 1 já previa exatamente isso; a métrica de dano/kill já existe no `SessionMetrics`).

## 4. Proposta B — Atributos expandidos (3 → 5)

Cada atributo com **valor por ponto e teto próprios** (troca a constante única `ATTR_POINT_VALUE` por uma tabela `ATTR_DEFS` em `constants.ts` — mesma filosofia data-driven dos lançadores):

| Atributo | Efeito | Valor/pt | Teto | Onde pluga |
|---|---|---|---|---|
| **Força** | multiplica `launcher.damage` | +6% | ×3.0 | já existe (`player.strength`) |
| **Vitalidade** | multiplica `maxHp` | +4% | ×2.5 | já existe (`player.vitality`) |
| **Agilidade** (ex-Velocidade) | multiplica velocidade de movimento | +3% | ×2.0 (teto ADR-009 mantido) | já existe (`player.speed`) |
| **Cadência** 🆕 | reduz `cooldownMs` do lançador | −4% | mín. 55% do cd base (600→330ms) | `ProjectileSystem` lê `player.attackSpeed` |
| **Alcance** 🆕 | multiplica `projectile.range` | +5% | ×1.75 (8u→14u) | `ProjectileSystem` lê `player.reach` no spawn do projétil |

Notas de design:

- **Cadência e Alcance são os dois atributos que o jogador pediu com o corpo**: "não alcanço" e "demoro pra derrubar" são as frustrações atuais. Ambos são multiplicadores no mesmo pipeline do EffectSystem — implementação barata.
- **Tetos individuais** substituem o medo de snowball: velocidade já tinha teto 2×; cadência mínima de 330ms impede metralhadora; alcance máximo de 14u não cobre o mapa (75u+), então posicionamento continua valendo.
- Reroll de coins passa a redistribuir entre **5** atributos — sem mudança de mecânica.
- "Lançar mais de um projétil" **não** vira atributo linear (multishot ×N escala explosivamente) — vira **skill discreta**, ver §6.

## 5. Proposta C — Level-up gamificado: cards de escolha

Substituir a auto-distribuição (v1) pela **v2 já prevista em growth.md**, com formato roguelite:

- Ao subir de nível, o HUD mostra **3 cards**, cada um valendo **3 pontos** (ex.: `+3 Força`, `+2 Vitalidade +1 Agilidade`, `+2 Cadência +1 Alcance`). Teclas 1/2/3 ou clique.
- **Timeout de 5s → auto-pick equilibrado** (rotação entre os atributos). O jogo NUNCA pausa; dá pra escolher correndo. Isso preserva o fluxo de 2–3 min e o caso "ignorei o menu".
- Total de pontos por nível continua **3** (hoje: 1 em cada um dos 3 atributos) — a curva de poder total não muda, muda a *concentração*.
- Os cards oferecidos são determinísticos por nível (tabela fixa ou rotação), **não sorteados** — habilidade > sorte: quem conhece a tabela planeja a build.
- Em **marcos de nível (4, 8, 12)**, um dos cards é uma **skill de projétil** (§6) em vez de pontos.

Por que cards e não menu de +/-: decisão em <2s, legível no meio do combate, e é o formato que gera o "momento de aura" (escolhi errado/certo e o round mostra na hora). Morte continua resetando para o preset do novo nível — a build é o que se perde ao morrer, reforçando o pilar de risco.

## 6. Proposta D — Skills de projétil (multishot & cia.)

Extensão do `LauncherDef` (ADR-011) com modificadores de disparo, escolhidos nos marcos de nível (§5) ou dropados pela **box** (decisão do CD já registrada em growth.md: "quando lançadores existirem, box sorteia um"):

```ts
// extensão de LauncherDef / camada de modificadores por player
fire: {
  cooldownMs: number;
  pattern: "straight" | "spread";   // 1 função nova por pattern (ADR-011)
  projectilesPerShot?: number;      // default 1
  spreadRad?: number;               // ângulo entre projéteis
  damageFactor?: number;            // dano por projétil quando multishot
}
pierce?: number;                    // atravessa N alvos
```

Skills iniciais propostas (marcos 4/8/12 — escolher 1 de 2 por marco):

| Skill | Efeito | Balanceamento embutido |
|---|---|---|
| **Tiro Duplo** | 2 projéteis paralelos (±6°) | 65% do dano cada (130% total, mas exige acertar os dois) |
| **Leque** | 3 projéteis em cone (±20°) | 50% cada — controle de área, fraco em duelo |
| **Perfurante** | atravessa 1 alvo/prop | dano cheio, cooldown +25% |
| **Fôlego** | +35% range e +20% velocidade do projétil | sem dano extra — skill de sniper |
| **Impulso** | matar reseta o cooldown e dá +30% velocidade por 2s | recompensa agressão, é o card de "aura" |

Implementação: `ProjectileSystem` já itera projéteis por tick com colisão por segmento; multishot é um loop no spawn, pierce é não consumir o projétil no primeiro hit. Nenhum sistema novo.

## 7. Proposta E — "Sentir aura": feedback de poder

Poder que não se vê não existe. Dentro da fase visual atual (placeholders, FASES_VISUAIS):

- **Glow/escala sutil por faixa de nível** no boneco (níveis 1–3 sem nada; 4–7 aro fraco; 8+ aro forte + trail). Serve também de leitura tática: "aquele ali é perigoso" — alimenta o pilar "sobreviver muito te torna alvo valioso" e prepara o "famar aura" do M2.
- **Números de dano crescem com o dano** (fonte maior em hits fortes) + flash mais intenso.
- **Kill feed + streak no HUD** ("3 kills sem morrer") — insumo direto das métricas que o M2/aura já exige (hit_streak).
- **Card escolhido pisca no HUD** por 2s — reforço da decisão.

Custo baixo (só `visuals.ts`/HUD), impacto direto na sensação de progressão. Não confundir com a **Aura (ADR-005)**, que continua sendo o sistema de oportunidade do M2 — isto aqui é o *juice* que faz a evolução ser percebida.

## 8. Bots, perfis e boss (protagonista continua sendo o player)

Bots ganham tudo de graça no servidor (mesmo pipeline). O que muda é a **política de escolha** — que é exatamente o gancho da T-008b:

- **Perfis de build por bot** (sorteados na sessão): `bruto` (Força/Cadência), `tanque` (Vitalidade/Agilidade), `caçador` (Alcance/Agilidade), `equilibrado` (auto-pick). Bot escolhe o card do seu perfil, sempre — determinístico e **explorável**: o player que percebe "aquele bot é tanque" pode kitar com alcance. Habilidade > sorte.
- **Skills de marco:** bot pega a skill mapeada ao perfil (bruto→Tiro Duplo, caçador→Fôlego...).
- **Boss (T-008b):** nasce nível 6–8 com build concentrada + 1 skill + skill de combate `forte`. Vira o evento da sala.
- **Vantagens exclusivas do player (protagonismo):** só players têm reroll por coins, timeout de escolha (bot decide instantâneo mas *sempre igual*), e — no M2 — só players acumulam Aura. Bot escala, mas não surpreende; player escala **e** decide.

## 9. Guardrails anti-snowball (risco 1 do Lead Designer)

1. **Tetos por atributo** (§4) — poder tem assíntota.
2. **Curva de perda na morte já existente** (`lossFraction` até 60%) — build alta é aposta alta.
3. **XP por kill escala com o nível da vítima** (já existe) — derrubar o líder é o melhor catch-up do jogo.
4. **"Caça ao rei"** (proposta antiga do LD, encaixa aqui): jogador com maior nível da sala fica sinalizado no HUD/minimapa a partir do nível 8. Junto com o glow do §7, o forte vira alvo público.
5. **TTK menor corta o snowball nos dois sentidos:** o líder também morre em 4–5 tiros de uma emboscada de dois jogadores fracos.

## 10. Ordem de implementação sugerida (para quebrar em tasks depois)

| Fase | Conteúdo | Dependências |
|---|---|---|
| **1. Rebalance TTK** (§3) | 2 constantes + rodada de bots medindo TTK | nenhuma — dá resultado hoje |
| **2. ATTR_DEFS + Cadência/Alcance** (§4) | tabela de atributos, 2 atributos novos no EffectSystem/ProjectileSystem | Fase 1 |
| **3. Cards de level-up** (§5) | protocolo `choose_upgrade`, HUD de cards, timeout, validação server-side | Fase 2 |
| **4. Skills de projétil** (§6) | patterns spread/pierce, marcos de nível, box sorteia skill | Fase 3 |
| **5. Juice de poder** (§7) | visuals/HUD | paralelo a 3–4 |
| **6. Perfis de bot + boss** (§8) | política de escolha por perfil (T-008b absorve isto) | Fase 3 |

Cada fase é jogável e testável com bots isoladamente (Debug First). Fase 1 pode entrar imediatamente como hotfix de balance.

## 11. Questões abertas para o CD decidir

1. **TTK alvo:** 5 tiros base está bom, ou prefere 4 (mais letal) / 6 (mais tático)?
2. **Timeout do card:** 5s com auto-pick, ou escolha só no respawn (zero interrupção, menos agência)?
3. **Cards determinísticos por nível** (proposto) ou com leve variação sorteada?
4. **Skills nos marcos 4/8/12** — quantidade certa para round de 2–3 min? (Nível 8 custa ~970 XP acumulado pela curva atual; nível 6, ~465. Verificar com dados de bots se o marco 8 é alcançável em partida típica — talvez os marcos certos sejam 3/6/9.)
5. **Boss** entra junto com a Fase 6 ou espera o M3 (Guardian)?
