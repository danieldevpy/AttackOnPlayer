# SPEC-0003 — Facing, mira desacoplada e gatilhos de disparo

**Status:** aprovada · **Marco:** M1 · **Data:** 2026-07-04

## Problema / objetivo
Hoje o player não tem direção: ninguém vê para onde os outros olham, e o tiro depende de segurar o mouse (mira e gatilho acoplados no mesmo campo `fx/fz` do input). Queremos que **todo player tenha facing sincronizado**, que o tiro **saia na direção do facing**, que o disparo tenha **múltiplos acionáveis** (espaço, clique do mouse) e que a mecânica **acompanhe bem o movimento** — com ganchos ajustáveis para lançadores futuros interferirem na mobilidade (ex.: projétil pesado que reduz velocidade).

## Comportamento esperado
- **Facing híbrido:** o facing aponta para o cursor quando o mouse se move na tela; sem atividade de mouse, segue a última direção de movimento. Player parado mantém o último facing (nunca fica "sem direção").
- **Facing sincronizado e visível:** todos os clientes veem a rotação de todos os players (indicador placeholder — "nariz"/seta no visual, sem arte). Rotação interpolada no cliente, como já é feito com posição.
- **Mira ≠ gatilho:** o input passa a separar *para onde olho* de *estou atirando*. Espaço e clique do mouse fazem a mesma coisa: disparar na direção do facing. Mapeamento de gatilhos extensível (gamepad/touch no futuro sem mudar protocolo).
- **Tiro nasce do facing:** projétil spawna na borda do player (offset = raio) na direção do facing atual, na posição autoritativa do tick — sem tiro "atrasado" ao atirar em movimento.
- **Ganchos de mobilidade por lançador (data-driven):** `LauncherDef` ganha modificadores opcionais de movimento (ex.: fator/duração de lentidão ao disparar, herança de velocidade do player pelo projétil). Todos com default neutro — `basic_shot` não muda de comportamento. Lançador novo que mexe na mobilidade = 1 entrada de dados, nunca lógica no Room (mantém regra do combat.md).
- **Servidor autoritativo:** cliente envia intenção (mira + gatilho); servidor valida, aplica cooldown, decide direção final do projétil a partir do facing que ele mantém, e aplica os modificadores via `EffectSystem`.

## Fora de escopo
Novos lançadores (projétil pesado fica para spec própria — aqui só o gancho), spread/precisão por movimento, recuo, mira assistida, suporte real a gamepad/touch (apenas arquitetura de gatilhos preparada), arte/animação de rotação.

## Critérios de aceite
- [ ] Bot headless conectado enxerga o facing dos outros players mudando no estado sincronizado.
- [ ] Player parado atira na direção do último movimento (espaço), sem mouse.
- [ ] Espaço e clique produzem projéteis idênticos na direção do facing.
- [ ] Atirando em movimento, o projétil nasce na posição atual do player (sem offset visível de atraso).
- [ ] Um lançador de teste com modificador de lentidão reduz a velocidade do player ao disparar e expira sozinho (via EffectSystem); `basic_shot` permanece inalterado.
- [ ] Debug overlay (F3) mostra facing e gatilho ativo do meu player.

## Decisão do Creative Director
Aprovada (Daniel, 2026-07-04): facing híbrido (mouse com fallback para movimento); gatilhos sempre disparam no facing; sem física nova de velocidade agora, mas com mecânica ajustável para lançadores futuros interferirem na gameplay (ex.: projétil pesado reduz velocidade).

## Notas da IA
- **Risco — protocolo:** mudar `input {x,z,fx,fz}` quebra os bots (T-008). Migração deve atualizar bots na mesma entrega; manter compat retro temporária não vale o custo (código todo é nosso).
- **Risco — tráfego:** sincronizar facing a 20Hz para todos adiciona 1 número por player (ângulo `dir` em radianos, em vez de 2 floats). Custo desprezível; quantizar depois se necessário.
- **Alternativa descartada:** facing só no cliente (cada cliente calcula pelo movimento). Rejeitada: mouse-aim não é derivável do movimento, e servidor precisa do facing para validar o tiro (princípio 2 — servidor autoritativo).
- **Decisão de design do gancho de mobilidade:** modificadores como *efeitos* (reusa EffectSystem/expiração) em vez de estado ad-hoc no Player — consistente com ADR-009.

---

## Quebra em tasks (particionado por objetivo)

### T-009 — Facing como estado de primeira classe 〔M〕 ✅ (PROMPT-0014)
**Objetivo:** protocolo e estado. Novo input `{x, z, aimX?, aimZ?, fire?}`; `Player` ganha `dir` (ângulo, sincronizado). Servidor resolve o híbrido: usa mira quando presente, senão última direção de movimento; nunca zera. Atualizar `docs/mechanics/movement.md`.
**Aceite:** estado sincronizado reflete facing correto nos 3 casos (mouse, só teclado, parado).

### T-010 — Gatilhos desacoplados e disparo pelo facing 〔M〕 ✅ (PROMPT-0015) · depende: T-009
**Objetivo:** `ProjectileSystem` deixa de ler `fireDir` e passa a usar `fire` (gatilho) + facing do servidor; spawn com offset de raio na direção do facing. Cliente: mapa de gatilhos (espaço, mousedown) → mesmo `fire`; mira via cursor alimenta `aimX/aimZ` mesmo sem atirar. Atualizar `docs/mechanics/combat.md`.
**Aceite:** critérios 2–4 da spec.

### T-011 — Facing visível (cliente) 〔P〕 ✅ (PROMPT-0016) · depende: T-009
**Objetivo:** rotação do grupo visual de todos os players com interpolação; indicador placeholder de direção; facing no debug overlay (F3).
**Aceite:** dois clientes abertos — cada um vê o outro girar; critério 6.

### T-012 — Ganchos de mobilidade no LauncherDef 〔M〕 · depende: T-010
**Objetivo:** campos opcionais em `LauncherDef` (ex.: `movement: { selfSlowFactor?, selfSlowMs?, inheritVelocityFactor? }`, defaults neutros) aplicados pelo servidor via `EffectSystem` no momento do disparo. Lançador de teste atrás de flag/DEV para validar.
**Aceite:** critério 5.

### T-013 — Migração dos bots + QA headless 〔P〕 ✅ (PROMPT-0017) · depende: T-010
**Objetivo:** bots usam o novo protocolo (mira contínua no alvo + gatilho quando em alcance); rodada de bots valida kills funcionando como antes. Atualizar `docs/ai/bots.md`.
**Aceite:** critério 1; `npm run bots -- 3 30` gera hits/kills nas métricas como na T-008.
