# PROMPT-0049 — T-054 (SPEC-0014): Animações procedurais · 2026-07-06

## Pedido (resumo fiel)

Executor de task (agente worker) recebeu **T-054** do BACKLOG (Frente C — Personagens/classe/
skin, PROPOSAL-0004, client): animações procedurais do arqueiro — **idle** (respiração),
**walk** (pernas/braços por seno, velocity da rede), **shoot** (puxar arco no evento fire),
**death/spawn** (integra com `SPAWN_ANIM_MS` da T-045). Update central por frame em
`characters.ts`; **sem clock global novo**. Contexto: `characters.ts` · `main.ts` (loop +
eventos). Aceite: os 4 estados visíveis com bots; sem custo de frame perceptível. Depende de
T-053.

## Decisões tomadas (e por quem)

- **IA:** update procedural central em `characters.ts` — `updateCharacterAnimation(playerGroup,
  { t, moveSpeed, nowMs })` + `triggerCharacterShoot(playerGroup, nowMs)`. Reusa o relógio-fase
  global `t` do `main.ts` (nenhum clock novo, conforme a task) e **não aloca nada por frame**
  (só lê/escreve escalares). As poses de repouso são guardadas em `mesh.userData.baseX/baseY`
  na fábrica (T-053) e a animação anima OFFSETS sobre elas.
- **IA (walk sem velocity na rede):** o schema **não sincroniza velocidade** (só `x`/`z`/`dir`).
  Derivo a velocidade de passada do **deslocamento renderizado** do próprio grupo (a posição da
  rede já é suavizada pelo lerp existente), normalizada e suavizada em `vis.userData.moveSpeed`.
  Idle e walk são um contínuo: amplitude do balanço ∝ `moveSpeed`, então parado (0) cai
  naturalmente pra idle (só respiração). Pernas em contra-fase; braços em contra-fase das
  pernas.
- **IA (shoot sem evento de fire e sem `ownerId`):** não existe evento "fire" (os
  `debug_event`/combat são dev-only) e o `Projectile.ownerId` **não é sincronizado**. Sinal
  production-safe = **spawn de projétil** (estado sincronizado): o projétil nasce na posição do
  atirador, então no primeiro frame de um projétil novo atribuo o disparo ao **player mais
  próximo** do ponto de spawn (raio 1.6) e disparo a animação de puxar/soltar o arco. Heurística
  puramente cosmética, tolerante a erro se dois players estiverem colados.
- **IA (death/spawn):** confirmei no servidor (`ArenaRoom.ts:528`) que **morte é respawn
  imediato no mesmo tick** (zera nível, reposiciona, `hp = maxHp`, `spawnProtectedUntil`) — o
  cliente **nunca** observa `hp<=0`. Logo não há pose de "morte" separada pra animar: o cue
  visível do (re)nascimento é a **materialização** (scale-in via `SPAWN_ANIM_MS`, T-045) que já
  existe. "Integração" = durante a materialização a animação zera `moveSpeed` e reseta o
  tracking de passada, pra não brigar com o scale-in nem contar o "teleporte" do respawn como
  corrida.
- **IA:** `updateCharacterAnimation` é seguro em F1 — se o grupo não tem
  `userData.character` (cápsula), retorna sem custo. Assim a troca de fase (`VISUAL_PHASE`) não
  quebra o loop.
- **Fora de escopo (outras tasks):** visual da flecha/trail dos projéteis (T-055), skins por
  paleta (T-056), ligar `classId`/`skinId` da rede no boneco (T-059). Não toquei schema, rede,
  server nem bots.

## Resultado verificado

- `packages/client/src/characters.ts`: guarda pose de repouso na fábrica (`baseX`/`baseY`) +
  API de animação (`STRIDE`/`SHOOT_MS`, `CharAnimOpts`, `triggerCharacterShoot`,
  `updateCharacterAnimation`).
- `packages/client/src/visuals.ts`: `createPlayerVisual` guarda `group.userData.character` (a
  animação acha o boneco por aqui).
- `packages/client/src/main.ts`: import de `characters.ts`; no loop por player calcula
  `moveSpeed` do deslocamento renderizado (zera na materialização) e chama
  `updateCharacterAnimation`; no spawn de projétil atribui o disparo ao player mais próximo e
  chama `triggerCharacterShoot`.
- **Gates:** `tsc --noEmit` limpo em `client` e `server`; `vite build` OK; `npm run test`
  (shared) **38/38**. Smoke: `dev:server` + `npm run bots -- 4 12` — 4 bots entram e saem
  limpos, servidor sem erro (só toquei client, sem regressão).
- **Verificação runtime da animação (headless, sem WebGL):** como a animação é matemática de
  objeto (Group/Mesh do three, sem GL), rodei um script `tsx` isolado (scratchpad, não
  commitado) que monta um player e exercita as funções — **11/11 asserts PASS**: idle (pernas em
  repouso, corpo respira em y), walk (pernas balançam >0.3 rad, contra-fase perna/perna e
  braço/perna, amplitude ∝ velocidade), shoot (braço levanta, arco cresce na puxada, volta ao
  repouso e limpa a janela) e F1 (update é no-op seguro). Prova que o código roda e mexe as
  partes corretamente em runtime.

## Limitação de verificação (registrada honestamente)

Igual à T-053: o harness de preview roda a janela **oculta** (`document.hidden`), então o
`requestAnimationFrame` do loop fica **pausado** e o WebGL não pinta — screenshot dos 4 estados
"com bots" pro CD depende de uma sessão GPU **visível** (`dev:server` + `dev:client` + `npm run
bots -- 6 60` localmente). A lógica de animação, porém, foi provada em runtime pelo teste
headless acima (11/11), além de tsc + build + smoke de bots.

## Regras que nascem daqui

- Toda animação de personagem é procedural e central em `characters.ts`
  (`updateCharacterAnimation`), dirigida por estado **já sincronizado** — nunca por um clock
  novo (reusa o `t` do `main.ts`). Novo estado de animação = novo ramo nessa função + um gatilho
  no `main.ts`.
- Sem `ownerId`/evento de fire na rede, "quem disparou" no cliente é inferido pelo **spawn de
  projétil mais próximo** (cosmético). Se um dia o protocolo expuser `ownerId`, trocar a
  heurística por atribuição direta.
