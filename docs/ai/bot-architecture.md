# Arquitetura de IA dos bots — base teórica (PROPOSAL-0002 §9-A2)

> Guia de implementação da T-020 e fundação de T-008b (perfis/boss) e do Guardian (pós-V1).
> Objetivo: **um algoritmo, muitas "características"** — comportamento novo = parâmetros, não código.

## Por que Utility AI (e não behavior tree ou FSM)

O bot atual é uma FSM implícita (`fugir → engajar → coletar`) com transições rígidas — é daí
que vem o "comportamento de robô": decisões binárias, sem hesitação, sem contexto. Alternativas:

| Modelo | Força | Fraqueza para nós |
|---|---|---|
| FSM | simples | explosão de estados; transições bruscas (robô) |
| Behavior Tree | composição legível | prioridade fixa; personalidade exige reescrever a árvore |
| **Utility AI** | decisões contínuas por pontuação; personalidade = pesos | exige calibrar curvas |

**Escolha: Utility AI** — cada ação candidata recebe um escore contínuo por "considerações";
personalidade é literalmente um vetor de pesos multiplicando escores. É o modelo que já estava
anotado para o Guardian em `bots.md` (M3); adotamos desde já para não construir duas IAs.

## As 6 camadas (pipeline por tick de pensamento, 100ms)

```
Percepção → Memória → Decisão (utility) → Steering contextual → Humanizador → Atuação
                 ↑↑↑ Personalidade (vetor de parâmetros) atravessa todas ↑↑↑
```

### 1. Percepção
O bot NÃO lê o estado inteiro: recebe um **snapshot filtrado** do que "veria" — inimigos num
raio (com ruído de distância), coletáveis, bandeira, projéteis próximos, distância das bordas.
Formato compacto (o mesmo princípio de "observações compactas" previsto para o Guardian).
*Anti-trapaça de design:* bot só reage ao que um player veria — nada de mira por estado global.

### 2. Memória
Curta e barata: última posição vista de cada inimigo (com timestamp), dano recebido recente
(de quem/de onde), resultado das últimas N decisões. Dá **hysteresis** (não troca de alvo a
cada tick) e permite "procurar quem me bateu" em vez de girar instantâneo (robô).

### 3. Decisão — Utility AI
Ações candidatas (V1): `engajar(alvo)`, `fugir`, `coletar(item)`, `disputar_bandeira`,
`perambular`, `manter_posição`. Cada ação = produto de **considerações** normalizadas 0..1
com curvas de resposta (linear/quadrática/logística):

```
score(engajar) = W_agressao × conf(minha_vida) × conf(dist_alvo) × conf(vantagem_build) × conf(nivel_alvo)
score(fugir)   = W_cautela  × (1 − conf(minha_vida)) × conf(ameaça_próxima)
score(disputar_bandeira) = W_objetivo × conf(dist_bandeira) × conf(risco_zona)
...
```

Escolhe-se a maior COM inércia (troca só se a nova superar a atual por margem `ε` — evita
oscilação). **Personalidade = {W_agressao, W_cautela, W_objetivo, W_ganancia, ...}** + knobs
do humanizador. Perfis da T-008b são presets deste vetor; o **boss** é um preset extremo +
atributos; o **Guardian** (pós-V1) troca só a camada de decisão por algo maior — o resto fica.

### 4. Steering contextual (resolve o esbarrão na borda — P1)
A decisão diz *o quê* ("ir até X"); o steering diz *como*. Modelo de **context steering**:
8–16 direções candidatas ao redor do bot; cada uma recebe interesse (aponta pro objetivo) e
perigo (proximidade de borda/prop/projétil, amostrado do mapa que o bot já reconstrói por seed);
move-se na melhor direção líquida. Substitui a perseguição em linha reta e torna o anti-stuck
(PROMPT-0019) uma **rede de segurança** raramente acionada, não o mecanismo primário.
Em duelo, o steering adiciona **strafe orbital** (componente perpendicular ao alvo, lado com
menos perigo) — comportamento humano de trocação.

### 5. Humanizador (resolve o "robô")
Camada final que suja a perfeição mecânica — TODOS os knobs por personalidade/skill:

| Knob | Efeito | Anti-padrão que corrige |
|---|---|---|
| `reactionMs` (200–500) | atraso entre perceber e agir | resposta instantânea |
| `aimLerp` (suavização) | mira PERSEGUE o alvo com atraso + leve overshoot | ruído por tick (tremor não-humano) |
| `aimErrorRad` | erro sistemático que decai enquanto rastreia | precisão constante |
| `fireIntervalMs` | cadência com jitter (já existe, PROMPT-0019) | metrônomo |
| `pausas de perambulação` | para, "olha", muda de rumo (ruído coerente, não uniforme) | vagar geométrico |
| `desistência` | abandona alvo após N s sem progresso | perseguição eterna |

### 6. Atuação
Traduz tudo na intenção `{move, aim, fire}` — **o mesmo contrato dos perfis de controle
humanos (ADR-015)**. Bot é, por construção, um "jogador com um perfil de controle a mais";
o servidor não distingue (princípio mantido desde o M0).

## Regras de implementação (T-020)

1. Cada camada = módulo próprio em `packages/bots/src/` (`perception.ts`, `memory.ts`,
   `decision.ts`, `steering.ts`, `humanizer.ts`) — testável isolada (decisão e steering são
   funções puras: snapshot → escolha; ideal para vitest).
2. `Personality` é um objeto de dados serializável (JSON) — presets em arquivo; o boss e os
   perfis da T-008b são entradas de dados, seguindo o padrão da casa (ADR-011/013).
3. Telemetria (T-026): logar decisão escolhida + escores por tick de decisão (amostrado) —
   é o que permite a IA analisar "por que o bot fez isso" e calibrar curvas com dados.
4. Orçamento: pipeline inteiro < 1ms por bot por tick de pensamento (100ms) — sem pathfinding
   pesado; BFS continua só para coleta distante, steering cuida do local.

## Leituras que fundamentam (para aprofundar depois)

- Utility AI / Infinite Axis Utility System — Dave Mark (GDC "Building a Better Centaur").
- Context steering — Andrew Fray, "Context Steering: Behavior-Driven Steering at the Macro Scale".
- The Illusion of Intelligence — humanização em F.E.A.R./Halo (reaction windows, miss on purpose).
