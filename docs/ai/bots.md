# Bots

## Bots de debug (M0 — feito)
- Headless, conectam via colyseus.js como jogadores reais (mesmo protocolo, zero código especial no servidor).
- Comportamento: caça o coletável mais próximo; sem alvo, vagueia evitando paredes.
- Uso: `npm run bots -- <qtd> <segundos>`. Servem para testar sync, colisão, spawner e métricas.

## Bots de combate (M1 — T-008, mínimo do aceite; substituído pela arquitetura em camadas na T-020)
Mesma base headless; ganham camada de combate sobre a caça a coletáveis:
- **Mirar e atirar (T-013 — protocolo `{x, z, aimX?, aimZ?, fire?}`):** miram no alvo engajado continuamente (`aimX/aimZ`, com chumbo/lead) mesmo fora do alcance do launcher — só o gatilho (`fire: true`) liga quando de fato dentro de `LAUNCHERS[launcher].projectile.range`, respeitando o cooldown (controlado pelo servidor). A direção real do tiro sai do facing (`dir`) que o servidor resolve a partir dessa mira — mesmo contrato `{move, aim, fire}` dos perfis de controle humanos (ADR-015). Não atiram de dentro de zona safe nem contra alvo em safe.
- Fonte única de números de combate: `packages/shared/src/launchers.ts`. Zona: `zoneAt` de `packages/shared/src/map.ts`.

## Arquitetura de IA em camadas (T-020 — implementa `docs/ai/bot-architecture.md`)
O FSM implícito (`fugir → engajar → coletar`) virou um pipeline de 6 camadas em
`packages/bots/src/ai/` — comportamento novo é dado (`Personality`), não código novo:

| Módulo | Camada | Natureza |
|---|---|---|
| `perception.ts` | 1. Percepção | função (snapshot filtrado: inimigos no raio com ruído de distância, coletáveis, borda) |
| `memory.ts` | 2. Memória | funções sobre estado explícito (hysteresis de alvo + desistência) |
| `decision.ts` | 3. Decisão (Utility AI) | **função pura** — `decide(perception, personality, prevAction)`; testada em `decision.test.ts` |
| `steering.ts` | 4. Context steering | **função pura** — `steer({desired, lateralBias, danger})`; testada em `steering.test.ts` |
| `humanizer.ts` | 5. Humanizador | classe com estado local (atraso de reação, mira com lerp+erro decrescente, cadência com jitter, pausas de perambulação) |
| `personality.ts` | Personalidade | `BOT_PROFILES` — presets nomeados (T-008b); testado em `personality.test.ts` |

`bot.ts` (camada 6, Atuação) só orquestra: monta a percepção, aplica stickiness de memória,
decide, deixa o humanizador atrasar a reação e suavizar a mira, resolve o movimento local
com `steer()` e manda a mesma intenção `{move, aim, fire}` de sempre. BFS continua só para
coleta distante (`bfsPath`, inalterado); o anti-stuck (bugfix pós-teste manual, T-008) virou
**rede de segurança raramente acionada** — o context steering evita a maior parte dos casos
de esbarrão em borda/prop antes de precisar dele.

**Ações candidatas nesta task:** `engage | flee | collect | wander`. `disputar_bandeira` e
`manter_posição` (previstos no doc teórico) ficam de fora até a bandeira existir no jogo
(T-021) — sem dado, sem consideração de utility (Gameplay First).

## Perfis nomeados, política de cards e boss (T-008b, SPEC-0004 addendum)
`packages/bots/src/ai/personality.ts` define `BOT_PROFILES` — cada perfil combina um vetor
`Personality` (como o bot **luta**) com uma `CardPolicy` (como o bot **constrói**), sorteado
por sessão (`BOT_PROFILE` env fixa um; ausente = sorteio):

| Perfil | Comportamento | Build (cards preferidos) |
|---|---|---|
| `agressivo` | alta agressão, foge tarde, engaja de longe | **bruto**: Força → Cadência |
| `cauteloso` | foge cedo, alcance de engajamento curto | **tanque**: Vitalidade → Agilidade |
| `cacador` | persegue o mapa todo, quase não desiste | **caçador**: Alcance → Agilidade |
| `equilibrado` | mediano em tudo | auto-pick (card `equilibrado`, como sempre foi) |

`pickCard(policy, ofertaDoNível)` é **determinística** (nunca sorteio) — o mesmo perfil
sempre escolhe o mesmo card quando disponível, tornando o build do bot **observável e
explorável** pelo player (habilidade > sorte). Testado em `personality.test.ts`.

**Boss:** `BOT_BOSS=1` marca o bot de índice 0 como boss — o *comportamento* vem de
`BOSS_PROFILE` (quase tão afiado quanto `cacador`, mas quase não foge), e os *números* de
verdade (nível 6–8, build concentrada, 1 skill de marco) são decididos e aplicados pelo
**servidor** (`ArenaRoom.initBoss`, autoridade — o bot só pede `boss: true` no join).

## Gancho para o Guardian (M3, pós-V1)
`decision.ts`/`steering.ts` continuam as mesmas — só a camada de decisão trocaria por algo
maior (ou um preset de `Personality` mais extremo que o boss). Nenhuma mudança estrutural.

## Guardian (M3)
Um único NPC de elite (não vários genéricos):
- Entra quando falta jogador; sai quando sala enche.
- Alvo: melhor que ~90% dos players → treino, desafio, coop, evento.
- Economia de tokens/CPU: decide sobre **observações compactas** (posições, cooldowns, itens próximos), responde ações discretas (mover/atacar/desviar/coletar). O jogo executa; o cérebro só decide.
- Implementação inicial: máquina de estados + utility AI (sem LLM). LLM só se comportamento emergente valer o custo.
