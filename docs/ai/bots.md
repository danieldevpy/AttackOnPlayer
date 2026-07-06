# Bots

## Bots de debug (M0 — feito)
- Headless, conectam via colyseus.js como jogadores reais (mesmo protocolo, zero código especial no servidor).
- Comportamento: caça o coletável mais próximo; sem alvo, vagueia evitando paredes.
- Uso: `npm run bots -- <qtd> <segundos>`. Servem para testar sync, colisão, spawner e métricas.
- Todos os bots da sessão entram na **mesma sala** (o primeiro fixa via `joinOrCreate`, os
  demais `joinById`; sala lotada = erro explícito no log, nunca sala fantasma — PROMPT-0032).

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

**Ações candidatas:** `engage | flee | collect | wander | flag`. A ação `flag` (T-021,
`disputar_bandeira` do doc teórico) vale só para bandeira **no chão** (corrida de pickup,
perseguição direta); bandeira **carregada por inimigo** vira bônus de `engage` no portador
(PROMPT-0032) — disputar é atirar em quem carrega, com alcance de caça estendido.
`manter_posição` continua fora, ainda sem dado que a justifique (Gameplay First).

**Refinamentos pós-teste manual do CD (PROMPT-0032):**
- **Alvos "compartilhados":** `decide()` avalia os N inimigos mais próximos com um viés
  determinístico por (bot, inimigo) (`targetBias`, hash estável) — bots diferentes elegem
  alvos diferentes em vez de todos travarem no mesmo mais próximo/portador.
- **Encurralado → vira e luta:** fugindo colado na borda com ameaça no raio, a decisão troca
  a fuga por `engage` (briga de desespero, sem pesar `hpFrac` de propósito).
- **Kite:** fugindo com o perseguidor no alcance do launcher, o bot atira de volta enquanto
  corre (atuação, não decisão).
- **Separação:** dentro de ~1.8u de outro player, cada vizinho empurra o vetor de movimento
  para fora — vários bots caçando o mesmo portador não viram um bolo empilhado.

**Caça poder + coragem com vida cheia (T-037, SPEC-0011):** a "aura" do jogo (banda de poder
por nível — `POWER_BAND_MID`/`POWER_BAND_HIGH` do shared, mesma fonte do aro visual da T-018)
agora atrai ameaça — um jogador forte parado não fica em paz. (1) **Percepção estendida:**
inimigo em banda mid/high é percebido além do raio normal (× 1.6 mid / × 2.5 high), como o
aro é visível de longe. (2) **Peso de engage por aura:** o alvo forte recebe mais peso de
engage (× 1.25 mid / × 1.5 high, com TETO) e ganha um piso em `advantageConf` — vale caçá-lo
mesmo em desvantagem de nível; o `targetBias` determinístico por (bot, alvo) e a confiança por
distância seguem valendo, então os alvos continuam distribuídos (nunca "todos contra um").
(3) **Coragem com vida cheia:** HP ≥ ~90% e inimigo fora de safe percebido ⇒ o bot parte pra
cima do alvo escolhido (engage vence farm/perambular/bandeira). (4) **Fuga só com plano:** fugir
só é opção com HP baixo **e** um coletável de cura percebido (`hp_orb`, também `box`) para onde
correr; sem rota de cura, luta (kite/desespero seguem valendo). Tudo em `decision.ts`/
`perception.ts` (funções puras, testadas); constantes de calibração em `personality.ts`
(`AURA_PERCEPTION_MULT_*`, `AURA_ENGAGE_MULT_*`, `FULL_HP_COURAGE_FRAC`).

## Perfis nomeados, política de cards e boss (T-008b, SPEC-0004 addendum)
`packages/bots/src/ai/personality.ts` define `BOT_PROFILES` — cada perfil combina um vetor
`Personality` (como o bot **luta**) com uma `CardPolicy` (como o bot **constrói**), sorteado
por sessão (`BOT_PROFILE` env fixa um; ausente = sorteio). Sobre o preset sorteado aplica-se
a **dosagem individual** (`withIndividualDosage`, PROMPT-0032): cada bot nasce com variação
própria (±25% nos pesos, ±20–30% nos knobs) — dois "cautelosos" na mesma sessão não jogam
idêntico; o log de entrada mostra a dosagem (`agr/caut/obj/fuga<%hp`):

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
