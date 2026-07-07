# Devlog

## 2026-07-06 — Sessão 41 (agente worker, Frente L): T-058 (SPEC-0015) — Persistência de settings + nick

- **Arquivo modificado:** `packages/client/src/lobby.ts` — adicionado bloco T-058 com sync Django.
- **Novo bloco em `lobby.ts`:** funções `fetchDjangoSettings()` e `saveDjangoSettings()` (best-effort,
  nunca bloqueiam UI). `DjangoSettings` interface alinhada com o serializer do backend (`control_profile`,
  `volume_master`, `volume_sfx`, `fullscreen_pref`, `display_name`).
- **GET ao abrir card:** quando logado, dispara `fetchDjangoSettings()` em background. Se responder,
  faz merge sensato: nick → atualiza `#lobby-nick-input` + localStorage; perfil → `setProfile()` +
  radio buttons; volumes → `setMasterVolume/setSfxVolume` + sliders; fullscreen → checkbox.
  Falha de rede = console.warn + continua com localStorage (sem modal, sem travamento).
- **PUT ao clicar Jogar:** quando logado, dispara `saveDjangoSettings()` fire-and-forget com payload
  completo. O servidor sanitiza o `display_name` via `sanitize_display_name()` (nick malicioso vira
  fallback server-side). O nick sanitizado retornado atualiza `localStorage` e o objeto `selection`.
- **Validação funcional via curl:** GET/PUT `/api/v1/accounts/settings` confirmados — settings
  persistem entre requisições; nick `<script>alert(1)</script>` retornou fallback "NormalNick";
  nick vazio `"   "` também usou fallback. Backend inalterado (endpoint já estava completo pela T-061).
- **Gates:** tsc ×3 limpo · vite build OK · shared 39/39 · server 89/89 · bots 35/35 ·
  pytest 112/112 (backend) · ruff OK · makemigrations --check OK.

## 2026-07-06 — Sessão 40 (agente worker, Frente L): T-057 (SPEC-0015) — Janela pré-sala (lobby)

- **Novo arquivo:** `packages/client/src/lobby.ts` — card único pré-sala com 4 seções
  (identidade, classe+preview, settings, botão Jogar). CSS injetado dinamicamente via
  `injectLobbyStyles()` (sem arquivo .css avulso). `showLobby()` retorna uma `Promise<LobbySelection>`
  que resolve no clique em Jogar.
- **Integração em `main.ts`:** `showLobby` chamado após toda inicialização (renderer,
  profileManager, audio já criados) via `.then()`. O `connect()` aguarda a resolução do lobby —
  nick do card passa como `name` no joinOrCreate (campo completo em T-059). `#profile-selector`
  escondido enquanto o lobby está visível, reexibido após o clique.
- **Preview 3D:** renderer Three.js dedicado (canvas 100%×100% no wrap, `alpha:true`,
  pixel-ratio limitado a 2), iluminação própria, `createCharacterVisual` da T-053 reutilizado,
  rotação por `requestAnimationFrame` (~2s/volta), `updateCharacterAnimation` chamado para idle.
- **Identidade:** nick padrão `Guest#NNNNN` gerado (ou nome da conta se logado), persistido em
  `aop_lobby_nick` no localStorage ao digitar. Badge de auth no header (logado/anônimo) com botão
  de logout. Sanitização de nick (sem `<>` nem controles, max 20 chars, mín 1 char não-espaço).
- **Settings:** perfil de controle (radio, sincroniza com `ProfileManager`), sliders Master/SFX
  (refletem em `AudioSystem` ao vivo), toggle fullscreen (Fullscreen API).
- **Seleção de classe/skin:** cards de classe (V1 só archer) + `<select>` de skin. Troca de
  classe atualiza skins disponíveis e o preview 3D. Persistência em `aop_lobby_class`/`aop_lobby_skin`.
- **1 clique:** defaults sensatos (nick gerado, archer, skin default, perfil detectado, volumes 100%).
  Clique em Jogar destrava AudioContext (`audio.unlock()`), remove overlay, resolve Promise.
- **Mobile:** layout flex-wrap (<= 599px vira coluna única via media query), botão full-width.
- **Gates:** tsc ×3 limpo · vite build OK · shared 39/39 · server 89/89 · bots 35/35.
- **Verificação funcional:** card exibido ao abrir (snapshot DOM confirmou todas seções), 1 clique
  em Jogar removeu o overlay e exibiu o HUD de jogo. Screenshot timeout (esperado — WebGL+rAF
  bloqueiam captura, como documentado nos avisos da SESSAO_ATUAL).
- **Fora do escopo (pendências explícitas):**
  - T-058: persistência Django (sync de nick, settings na conta).
  - T-059: join enviando `{nick, classId, skinId, profile}` ao servidor.
  - T-062: aba de ranking no card.
- `npm run aci -- index` rodado ao final. Ver `docs/prompts/PROMPT-0057.md`.

## 2026-07-06 — Sessão 39 (agente worker, Frente B): T-029 — ADR-012 liga na conta
- **Frente B fechada** (T-060 ✅ → T-061 ✅ → T-029 ✅, série completa no mesmo pedido do CD).
- **Aditivo, não substitutivo:** o scaffold ADR-012 (`memDB` em memória, painel dev F3) continua
  intacto — T-029 SOMA a persistência real por cima. `PlayerStats` ganha `forca`/`agilidade`/
  `vitalidade` (migração `0004`); pickup de "box" em `ArenaRoom.ts` reporta o mesmo delta
  (`BOX_ATTR_BONUS_EACH`) pro Django via `platformClient.reportProgress()` novo, só quando
  `PLATFORM_ENABLED=1` e o player tem `accountId` (JWT verificado, T-028b) — guardrail "nunca
  poder in-round" inalterado (zero mudança em `addAttrPoints`/gameplay).
- **Endpoint novo:** `POST /api/v1/accounts/progress` (service token, delta incremental via
  `F()`, conta/stats inexistente devolve 204 sem quebrar o pickup).
- **Gates:** pytest 112/112 (+7) · vitest server 89/89 (+6, incluindo teste que insere um
  `Collectible` real de kind "box" e roda `room.update()` de verdade) · tsc ×3 limpo ·
  `makemigrations --check` limpo · `ruff` limpo.
- **Achado real durante a verificação viva:** `POST /auth/guest` quebrou contra o Postgres de
  DEV real (`ProgrammingError: column "forca" ... does not exist`) — as migrações `0003`/`0004`
  só tinham sido testadas contra a DB efêmera do pytest, nunca aplicadas na de desenvolvimento.
  `python manage.py migrate` resolveu; smoke real refeito com sucesso (`/stats/me` refletiu
  forca/agilidade/vitalidade=3 depois do `/accounts/progress`). **Regra nova:** pytest verde não
  implica banco de dev migrado — rodar `migrate` antes de testar contra o Django "de verdade".
- `npm run aci -- index` rodado ao final. Ver `docs/prompts/PROMPT-0056.md`.

## 2026-07-06 — Sessão 38 (agente worker, Frente B): T-061 — Auditoria + fechamento do admin
- **Config ao vivo:** `ArenaRoom.updateInner` passa a reconsultar `platformClient.getConfig()`
  periodicamente (`PLATFORM_SYNC_INTERVAL_MS=5s`, aproveitando o TTL de 30s já existente do
  T-027g) e aplica `xpMultiplier`/`coinMultiplier`/`flagEnabled` na sala JÁ ABERTA — antes só
  valia na criação. `mapRotation`/`expectedPlayers` continuam só-na-criação (não fazem sentido
  ao vivo). Fire-and-forget, nunca bloqueia o tick, nunca lança.
- **Moderação de nick:** `sanitize_display_name()` novo (`accounts/services.py`) — whitelist de
  charset, nick malicioso cai pro fallback inteiro (nunca tenta "limpar" caractere a caractere).
  Aplicado em `register()` e no `PUT /accounts/settings` novo. Ação de admin `reset_nick` em
  `AccountAdmin` — staff modera um nick abusivo sem deploy.
- **Endpoint de settings do player:** `PlayerSettings` novo (`control_profile`/`volume_master`/
  `volume_sfx`/`fullscreen_pref` — os mesmos 4 campos que a PROPOSAL-0004 §5 já promete pro
  lobby, não um blob inventado) + `GET/PUT /api/v1/accounts/settings` (JWT). Migração `0003`.
- **SPEC-0008:** checklist revisado — 4/5 bullets fecham; "ranking público" saiu do fora-de-
  escopo (T-060 já entrega, extensão aprovada via PROPOSAL-0004); "login com Google" documentado
  como pendência formal (ADR-020/T-028-google), não gap desta task.
- **Gates:** pytest 105/105 (+17) · `makemigrations --check` limpo · `ruff` limpo · vitest server
  83/83 (+3, `platformSync.test.ts`) · `tsc` ×3 limpo.
- **Verificação viva:** `effective_config()` confirmado mudando na hora ao criar `GameEvent` via
  shell do Django real (mesma sessão da T-060) — lado Django do "sem deploy" provado ao vivo; o
  lado Node (sala já aberta aplicando o novo config) fica coberto pelos 3 testes novos com
  `platformClient` mockado (a sala de smoke da T-060 já tinha sido descartada por inatividade).
- `npm run aci -- index` rodado ao final. Ver `docs/prompts/PROMPT-0055.md`.

## 2026-07-06 — Sessão 37 (agente worker, Frente B): T-060 — KDA + ranking
- **Pedido do CD:** implementar a Frente B (T-060 → T-061 → T-029) por completo. Este prompt =
  T-060 apenas (as próximas duas seguem em série, cada uma com gate e commit próprio).
- **Agregação na ingestão:** `accounts/services.py` novo (`apply_telemetry_stats`) — chamado
  dentro da mesma transação de `telemetry/views.py:ingest_batch`. Evento `kill` soma 1 kill no
  `killerToken` e 1 death no `victimToken`; evento `quit` soma 1 `matches_played` (única sombra
  de "sessão encerrada" por jogador que o schema T-026 tem hoje — `match_end` é por room). Token
  sem `GuestLink` (bot, guest nunca registrado) é ignorado sem derrubar o batch.
- **Endpoints novos:** `GET /api/v1/stats/me` (JWT, própria conta) e `GET /api/v1/ranking`
  (público, paginado — `PageNumberPagination`, ordenado por kills desc). `RankingEntrySerializer`
  novo (inclui `display_name` da conta via join), desacoplado do `PlayerStatsSerializer` usado
  pelos outros 4 endpoints de conta.
- **Admin:** `PlayerStatsAdmin` registrado (além da inline já existente em `AccountAdmin`) —
  `search_fields` por nick/email, ordenado por kills — "admin list com busca" da task.
- **Gates:** pytest 88/88 (+9: `test_services.py` novo, +3 em `accounts/tests/test_views.py`,
  +1 em `telemetry/tests/test_views.py`) · `makemigrations --check` limpo (sem mudança de schema)
  · `ruff check .` limpo.
- **Smoke fim a fim (fora do pytest):** Django real + Colyseus real (porta 2604, isolada da
  sessão de dev paralela em :2567) + `PLATFORM_ENABLED=1` — pipeline completo sem erro
  (`gameops/config`, `telemetry/batch` a cada ~5s). Bots reais (`6×40s`) não geraram kill (perfis
  defensivos, sem regressão) e o framework de bots não aceita `token` customizado (sempre
  `bot_<sessionId>`, sem `GuestLink`) — pra provar ATRIBUIÇÃO com o servidor real, registrei 2
  contas via `/auth/guest` e postei 1 evento `kill` real (payload idêntico ao `KillEvent` do
  Node) direto no Django rodando: `PlayerStats` e `/ranking` refletiram na hora.
- **Fora de escopo:** nenhuma mudança em `packages/server`/protocolo — telemetria já emitia os
  campos necessários desde T-026/T-027g.
- `npm run aci -- index` rodado ao final. Ver `docs/prompts/PROMPT-0054.md`.

## 2026-07-06 — Sessão 36 (agente worker, Frente C): T-056 — Skins por paleta
- **Task:** `packages/shared/src/classes.ts` ganha `ClassDef.skinTints: Record<string, number>` —
  cor (hex) por `skinId`, tabela separada de `skinIds` (que continua sendo só a lista de ids
  válidos pro contrato de rede/validação, inalterado). `archer` ganha 2 skins novas além de
  `default`: `verde` e `cinza` (paletas de couro alternativas), com `skinTints.default ===
  baseTint` (nenhuma regressão no visual atual).
- **Fábrica (`packages/client/src/characters.ts`):** `paletteFor(classId, skinId)` — que já
  recebia `skinId` mas o ignorava (`_skinId`) — agora lê `def.skinTints[skinId] ?? def.baseTint`
  como o tint que alimenta as sombras derivadas (`shade()` pra couro/gola); resto da paleta
  (pele/cabelo/madeira/metal) continua fixo, que é o visual "arqueiro" independente de skin.
  Gancho pronto pra classes futuras: guerreiro/mago só precisam de uma entrada nova no
  `CLASS_REGISTRY` com seu próprio `skinTints`.
- **Fora de escopo (não tocado):** seleção de skin pela rede (`Player.skinId` já existe desde
  T-052, mas `visuals.ts`/`createPlayerVisual` continua fixo em `DEFAULT_CLASS_ID`/skin
  default — isso é a T-059/T-057, frente Lobby, ainda não fechada).
- **Gates:** shared 39/39 (+1 teste novo: toda skin do registro tem cor, default == baseTint) ·
  server 80/80 · bots 35/35 · `tsc --noEmit` limpo em server/client/bots (cobre shared via
  project reference) · smoke com 3 bots reais por 8s contra o servidor de dev já ativo (join
  sem regressão). `npm run aci -- index` rodado ao final.

## 2026-07-06 — Sessão 35 (pedido direto do CD, fora da fila V1): Deploy em VPS sem domínio + reorganização de scripts
- **Pedido do CD:** confirmar se dá pra jogar com amigos numa VPS acessando só pelo IP público
  (sem domínio/TLS) e, se sim, montar o plano + automação; depois, subir bots junto igual o
  `run.sh` de dev; por fim, organizar todos os `.sh` soltos numa pasta `script/` e commitar.
- **Confirmado que dá:** `packages/server/src/index.ts` já escuta em todas as interfaces
  (`httpServer.listen(port)` sem host); o client é estático (build Vite); página `http://` +
  WebSocket `ws://` não sofre bloqueio de mixed content; backend Django é opcional
  (`PLATFORM_ENABLED` off por padrão).
- **Único ajuste de código:** `packages/client/src/main.ts` assumia `wss://` (TLS) pra qualquer
  host que não fosse `localhost`/`192.x`, quebrando IP público sem certificado. Adicionado
  override de build `VITE_SERVER_URL` (retrocompatível — fluxo com domínio/SPEC-0009 não seta a
  env e cai na regra antiga). Validado com `tsc --noEmit` e `vite build` real (IP fixo no bundle).
- **Novo `script/deploy-vps-sem-dominio.sh`:** idempotente — detecta IP público, instala
  Node/pm2 se faltar, `git pull`, `npm install`, builda o client com `VITE_SERVER_URL`, sobe
  `aop-server`/`aop-client` via pm2, libera `ufw`, healthcheck em `/health`. Aceita `-b/-c/-t`
  (mesma sintaxe do `run.sh`) pra subir `aop-bots` via pm2, com `--no-autorestart` quando a
  duração é finita (evita loop de restart depois que os bots terminam).
- **Reorganização:** `run.sh` e `snapshot-test.sh` (soltos na raiz, untracked, antes marcados
  como "resíduo não investigado") + o novo script de deploy foram movidos pra `script/` e
  commitados pela primeira vez. `script/run.sh` teve o `cd` ajustado (`dirname/..`) pra
  continuar resolvendo a raiz do repo a partir do novo nível; `script/snapshot-test.sh` só
  precisou de ajuste de texto (usa `$(pwd)`, não `dirname`). `backend/dev.sh` e o script do
  skill `attackonplayer-executor` ficaram de fora a pedido do CD (o primeiro é acoplado aos
  arquivos do Django em `backend/`; o segundo não é parte do jogo).
- **Verificado:** `tsc --noEmit` do client limpo (antes e depois da reorganização), `vite build`
  real gerando o bundle certo, parsing das flags `-b/-c/-t` testado isoladamente (todas as
  combinações), sintaxe dos 3 scripts (`bash -n`) ok. `npm run aci -- index` rodado após cada
  lote de mudança de código/doc.
- **Docs:** `docs/deploy/PLANO-VPS-SEM-DOMINIO.md` (plano de estudo + passo a passo + trade-offs
  + quando migrar pro fluxo oficial com domínio) e nota em `SESSAO_ATUAL.md` atualizando o
  status dos scripts (não é mais "resíduo não investigado").
- **Fora de escopo:** não mexe no fluxo oficial de lançamento (SPEC-0009/M5, domínio+TLS+Docker+
  hardening) nem no backend Django — os dois fluxos coexistem.

## 2026-07-06 — Sessão 34: Personagens procedurais V2 (evolui T-053/T-054, SPEC-0014)
- **Pedido do CD (fora da numeração):** evoluir o arqueiro procedural pra qualidade de arte
  mobile low-poly (Kingshot/Archero/Whiteout), 100% por código Three.js, sem asset externo,
  rodando com centenas de players (compartilhar tudo, nada por instância/frame).
- **Arquitetura V2:** esqueleto de **pivôs** (hip→chest→head/ombros; ombro→cotovelo;
  perna→joelho; arco na mão esq. com corda[Line] + flecha). **Cada segmento animável = 1 malha**
  cuja geometria é o MERGE de sub-formas facetadas com **cor por vértice** — todo o detalhe de
  silhueta (capuz pontudo, barba, cabelo, gola, cinto, aljava+flechas, botas, nariz,
  sobrancelhas) entra sem draw call extra. **Um material flat global**; geometria por
  `classId:skin` (cacheada). Arco por **CatmullRomCurve3 + TubeGeometry** (substitui o Torus da
  V1). Formas por CylinderGeometry de 6/4 lados (hexágono / caixa trapezoidal) — faceted sem
  hand-rolling de winding.
- **Perf:** 13 draw calls/char (12 malhas + 1 Line) vs 8 na V1. Verificado singleton: 2
  instâncias → **1 material, 8 geometrias** compartilhadas. Animação sem alocação por frame
  (`updateCharacterAnimation` virou args posicionais, elimina o objeto de opções por frame).
- **Animações (por pivô):** idle (respiração/estabilização), walk (passada+joelho, quadril
  oscila, ombros compensam, braços contra-fase), shoot (esq. segura arco / dir. puxa corda /
  tronco gira / flecha recua e dispara / arco flexiona), hit (recuo+inclinação), death
  (tomba+encolhe). Hit/death ligados aos eventos do `main.ts` — mas morte no servidor é respawn
  imediato (cliente nunca vê hp<=0), então mal aparecem em produção (documentado).
- **API preservada:** `createCharacterVisual`/`updateCharacterAnimation`/`triggerCharacterShoot`
  + novos `triggerCharacterHit`/`triggerCharacterDeath`.
- **Verificado:** tsc client+server limpo · vite build OK · shared 38/38 · bots 5×12 sem
  regressão · **teste headless 24/25** (a 1 "falha" era artefato do próprio teste — colisão de
  nome pivô/malha, corrigida; partilha de material confirmada à parte). `npm run aci -- index`
  ao final. Detalhes: `docs/prompts/PROMPT-0051.md`.
- **Limitação:** screenshot pro CD segue impossível no harness (preview oculto, rAF pausado);
  geometria/animação provadas em runtime pelo headless. Caminho futuro pra centenas com 1 draw
  call/char: SkinnedMesh (pivôs viram bones) — estrutura já desenhada pra isso.

## 2026-07-06 — Sessão 33: T-055 (SPEC-0014) — Projéteis do arqueiro
- **Task (agente worker, Frente C — Personagens/classe/skin, client):** placeholder de esfera
  do projétil (T-039) virou **flecha** (haste cilindro fino + ponta cone 4 lados, mesmo
  low-poly da T-053), orientada pela direção real do disparo — sem mudar dano/rede.
- **Geometria:** haste e ponta rotacionadas **uma vez na criação** (`rotateZ(-Math.PI/2)`) pra
  já nascerem deitadas no local +X (convenção de "nariz" dos personagens); `createArrowMesh`
  monta um `THREE.Group` novo por projétil referenciando geometria/material **singleton** por
  launcher (`projectileMeshes` passou de `Map<string, THREE.Mesh>` pra `Map<string,
  THREE.Group>`).
- **Orientação sem campo novo na rede:** `Projectile.dirX/dirZ` não são sincronizados (só
  internos do servidor); como todo `LauncherDef` de player dispara em linha reta sem herdar
  velocidade, a direção real do tiro é exatamente `Player.dir` do atirador no instante do fogo
  (`projectiles.ts:41-42`, já sincronizado). A flecha lê esse `dir` **uma vez**, na criação do
  mesh — reaproveita a mesma heurística de "player mais próximo do spawn" que a T-054 já usava
  pra disparar a animação de puxar o arco.
- **Trail leve só no `heavy_shot`:** `ProjStyle.trail?` novo + `arrow_trail_heavy` em
  `vfx.ts` (`intensity: "leve"`, mesma regra de intensidade da T-022 — reforça "arma
  vantajosa" sem virar aura), spawnado a cada 90ms de voo via `lastArrowTrailAt` (por
  projétil, limpo no despawn).
- **Verificado:** `tsc --noEmit` limpo em client/server/bots · shared 38/38 · server 80/80 ·
  bots 35/35 (task não toca shared/server, rodados por completude do gate). Smoke real:
  `server-verify`:2604 + `client-verify`:5299, client conectou como player de verdade na sala,
  2 rodadas de `npm run bots -- 4 20`/`4 15` dispararam pelos 3 launchers sem NENHUM erro de
  console. `npm run aci -- index` ao final. Detalhes: `docs/prompts/PROMPT-0050.md`.
- **Limitação (mesma das sessões 31/32):** screenshot/F3 pro CD segue pendente — preview roda
  oculto (`document.visibilityState === "hidden"`, rAF pausado), reproduzido de novo mesmo
  reiniciando o server de preview. Confirmação visual de "flecha aponta pra onde voa" fica
  pro CD num navegador real; lógica de orientação revisada e consistente com o facing já
  testado dos personagens.

## 2026-07-06 — Sessão 32: T-054 (SPEC-0014) — Animações procedurais
- **Task (agente worker, Frente C — Personagens/classe/skin, client):** animação procedural do
  arqueiro, update central por frame em `characters.ts`, **sem clock global novo** (reusa o
  relógio-fase `t` do `main.ts`) e sem alocação por frame.
- **API:** `updateCharacterAnimation(playerGroup, { t, moveSpeed, nowMs })` +
  `triggerCharacterShoot(...)`; poses de repouso guardadas na fábrica (`mesh.userData.baseX/
  baseY`, T-053) e a animação anima offsets sobre elas. `visuals.ts` guarda
  `group.userData.character`; `main.ts` dirige por player.
- **4 estados:** **idle** (respiração no y do corpo/cabeça) · **walk** (pernas/braços em
  contra-fase, amplitude ∝ velocidade planar) · **shoot** (puxar/soltar o arco numa janela de
  260 ms) · **spawn/death** (materialização scale-in da T-045; animação zera durante ela).
- **Sinais (sem velocity/ownerId/evento fire na rede):** walk usa o **deslocamento renderizado**
  do grupo (posição da rede já suavizada), suavizado em `vis.userData.moveSpeed`; shoot é
  disparado no **spawn de projétil**, atribuído ao player mais próximo do ponto de nascimento
  (projétil nasce na posição do atirador; `ownerId` não é sincronizado). Morte no servidor é
  **respawn imediato** (`ArenaRoom.ts:528`) — cliente nunca vê `hp<=0`, então o cue de morte é o
  próprio spawn.
- **Verificado:** tsc client+server limpo · `vite build` OK · shared 38/38 · smoke `bots 4 12`
  (entra/sai limpo, sem regressão — só toquei client). **Teste headless da animação (sem
  WebGL, matemática de objeto): 11/11 asserts** (idle/walk/shoot/F1-noop) provando que roda e
  mexe as partes em runtime. `npm run aci -- index` ao final. Detalhes: `docs/prompts/
  PROMPT-0049.md`.
- **Limitação:** screenshot dos 4 estados com bots pro CD segue pendente — preview roda oculto
  (rAF pausado), pede sessão GPU visível. A lógica está coberta pelo teste headless.

## 2026-07-06 — Sessão 31: T-053 (SPEC-0014) — Arqueiro low poly procedural (F2)
- **Task (agente worker, Frente C — Personagens/classe/skin, client):** `packages/client/src/
  characters.ts` novo — `createCharacterVisual(classId, skinId)` retorna `THREE.Group` do
  arqueiro procedural (8 partes nomeadas: `legL`/`legR`/`body`/`armL`/`armR`/`head`/`hood`/
  `bow`), `MeshStandardMaterial flatShading`, geometrias singleton de módulo e materiais
  memoizados por `classId:skinId` (`materialsFor`) — N players da mesma classe reusam o mesmo
  conjunto. Cor vem do `baseTint` da classe (T-052); `skinId` já na chave do cache (pronto pra
  T-056).
- **Ponto de troca (ADR-008):** `visuals.ts` `VISUAL_PHASE` 1 → **2**; `createPlayerVisual`
  bifurca — F2 monta o personagem + anel de aliado/inimigo; F1 mantém cápsula + "nariz". Como o
  modelo já dá o facing (arco à frente, +X local, mesma convenção do `dir` da rede), o nariz
  placeholder passa a existir só na F1.
- **Escopo:** não mexi na assinatura `createPlayerVisual(id, isSelf)` nem em `main.ts` — usa
  `DEFAULT_CLASS_ID` + skin default; ligar classe/skin da rede (`Player.classId`) é a T-059.
  Animação procedural (T-054) e projéteis/skins (T-055/T-056) ficam pras próprias tasks; os
  nomes de partes são o contrato que a T-054 vai consumir.
- **Verificado:** tsc limpo client+server · `vite build` OK · shared 38/38 · smoke `npm run
  bots -- 9 120` (9 bots entram sem regressão do schema classId). **Draw calls (análise
  determinística):** 9/player em F2 (8 meshes + anel) vs 3 em F1 → 90 base com 10 players,
  < 200 com chão/props/coletáveis. `npm run aci -- index` ao final. Detalhes: `docs/prompts/
  PROMPT-0048.md`.
- **Limitação de verificação:** screenshot pro CD e medição empírica de draw calls no F3 NÃO
  rodaram no harness de preview — janela **oculta** (`document.hidden`), `requestAnimationFrame`
  pausado (0 frames/800 ms), WebGL não pinta (screenshot dá timeout). Cliente compila/empacota/
  conecta/inicializa canvas sem erro; captura visual e F3 pedem sessão GPU visível (rodar
  `dev:server` + `dev:client` + bots localmente). Registrado no PROMPT-0048.

## 2026-07-06 — Sessão 30: T-052 (SPEC-0014) — Registry de classes (contrato)
- **Task (agente worker, Frente C — Personagens/classe/skin, shared+server):**
  `packages/shared/src/classes.ts` novo — `ClassDef { id, launcherIds, baseTint, skinIds }`,
  `CLASS_REGISTRY` com só `archer` (os 3 launchers atuais — basic/heavy/rapid — viram os
  "projéteis da classe"), `DEFAULT_CLASS_ID`, `isValidClassId`/`isValidSkinId`/
  `resolveClassSelection` (mesmo molde de `SKILLS`/`WEAPON_PICKUP_LAUNCHERS`: registro
  data-driven + função pura de resolução).
- **Schema:** `Player.classId`/`Player.skinId` em `ArenaState.ts`, default vindo do registro
  (`CLASS_REGISTRY[DEFAULT_CLASS_ID]`).
- **Join:** `ArenaRoom.onJoin` aceita `classId?`/`skinId?` nas options e resolve via
  `resolveClassSelection` antes de aplicar ao player — classe/skin inválida ou ausente cai pro
  default, join nunca rejeita (mesma regra do `authToken` opcional da T-028b).
- **Verificado:** 12 testes novos (8 em `shared/src/classes.test.ts`, 4 em
  `server/src/rooms/classes.test.ts` cobrindo válida/inválida/ausente/bot). Gates: shared
  38/38 · server 80/80 · tsc limpo em server/client/bots · smoke com `npm run bots -- 3 8`
  (bots sem classId no join, sem regressão). `npm run aci -- index` rodado ao final. Detalhes:
  `docs/prompts/PROMPT-0047.md`.
- **Fora do escopo desta task (outras tasks do BACKLOG já cobrem):** trocar o launcher ativo
  por classe (só 1 classe existe ainda), protocolo completo de join com nick/profile e troca
  de classe pós-join (T-059), visual procedural/skins (T-053/T-056).

## 2026-07-06 — Sessão 29: T-050+T-051 (SPEC-0013) — mapeamento evento→som + áudio posicional
- **Task (agente worker, Frente S — fecha a frente):** `packages/client/src/audio.ts` — registry
  saiu de 3 sons de teste (T-049) pra **27 sons nomeados** cobrindo todo o mapeamento pedido:
  fire por launcher (`fire_basic`/`fire_heavy`/`fire_rapid`), hit dado/recebido (`hit_given`/
  `hit_taken`), `kill`, `death_self`/`death_other`, `respawn_self`, level-up (`level_up_auto`/
  `card_chosen`), coleta por kind (`pickup_xp`/`coin`/`hp`/`shield`/`weapon`/`box`/`speed`/
  `farm`), `xp_combo`, `skill_unlock` (box), `streak`, bandeira (`flag_pickup`/`flag_drop`/
  `flag_cooldown`/`flag_respawn`) e `farm_event_announce` (evento de zona).
- **Regra de legibilidade (decisão da IA):** eventos pessoais (combate, progresso, coleta) só
  tocam pro jogador dono — numa partida de bots, tocar isso globalmente vira ruído contínuo
  (aceite pedia "legível de olhos fechados"). Eventos ambientes (fire, morte alheia, bandeira,
  zona) continuam globais.
- **T-051 (mesma task, dependia da T-050):** `AudioContext` ganhou 3 buses — `master` (mute+
  volume geral) → `sfxBus` (volume de efeitos, persistido separado) → `duckBus` (só sons
  não-`priority`). Som `priority` toca direto no `sfxBus` e abaixa o `duckBus` por ~350ms
  (ducking simples). `play(name, x?, z?)` com posição opcional: atenuação linear até 26
  unidades + `StereoPannerNode` — como a câmera nunca gira (`followCamera` sempre olha -Z),
  pan = diferença de X do mundo direto, sem trig de facing. `setListenerPosition` chamado
  1×/frame (mesmo padrão do `vfx.update`). Volumes persistidos em
  `localStorage["aop_audio_volume"]` — UI de slider fica pra T-058 (lobby).
- **`hud.ts`:** `HudCtx` ganhou `playSound` (main.ts injeta `audio.play`) — usado no toast de
  kill streak, a única leitura de combate que mora em hud.ts e não em main.ts.
- **Descoberta:** `flag_pickup`/`flag_drop` já existiam como debug events no servidor
  (`ArenaRoom.ts`) mas o client nunca tinha handler pra eles (nem VFX nem toast) — adicionados
  agora só pra áudio, sem VFX novo (fora do pedido).
- **Verificado:** `tsc --noEmit` limpo. Preview manual — as 27 entradas do registry tocaram
  sem exceção (sem posição/perto/longe-demais); volumes persistiram no localStorage; partida
  real com 4 bots (combate de verdade, hp 100→60/80) — F3 confirmou pickup/xp_combo/upgrade
  (auto e manual) passando pelos handlers novos, console sem erro. `npm run aci -- index`
  rodado ao final. Detalhes: `docs/prompts/PROMPT-0046.md`.
- **Frente S (Som, SPEC-0013) fechada:** T-049 ✅ · T-050 ✅ · T-051 ✅.

## 2026-07-06 — Sessão 28: T-049 (SPEC-0013) — AudioSystem + registry procedural
- **Task (agente worker, Frente S de PROPOSAL-0004):** `packages/client/src/audio.ts` novo —
  `SoundDef` (`wave: sine|square|sawtooth|triangle|noise`, `freq`/`freqEnd` opcional pra sweep,
  `envelope {attack, decay}`, `gain`, `file?` reservado pra sample gravado futuro), `AUDIO_REGISTRY`
  com 3 sons de teste (`fire`/`hit`/`death`), `createAudioSystem()` com `AudioContext` único
  destravado no primeiro gesto (`pointerdown`/`keydown`/`touchstart`, `{once:true}`), master gain
  + `setMuted`/`isMuted`/`toggleMuted`, pool de vozes com teto (`MAX_VOICES=12`, rouba a mais
  antiga quando satura) — espelha 1:1 o padrão do `vfx.ts` (T-022): "som novo" = 1 entrada no
  registry, nada solto em `main.ts`.
- **`main.ts`:** os 3 sons de teste plugados exatamente nos pontos onde o `vfx.ts` já dispara
  (`fire` no spawn de projétil, junto do `vfx.spawnAt(style.muzzle,...)`; `hit` em `ev.type ===
  "hit"`; `death` em `ev.type === "death"`); tecla `M` (handler global existente de F3/1-2-3/R)
  chama `audio.toggleMuted()` — só pra validar o aceite nesta task, UI/persistência de volume é
  T-051/T-058.
- **Verificado:** `cd packages/client && npx tsc --noEmit` limpo. Preview manual
  (`server-verify`:2604 + `client-verify`:5299) — client conectou numa sala real, clique
  destravou o `AudioContext` (`state: running`), `AUDIO_REGISTRY` carregado com as 3 chaves,
  `play()`/`toggleMuted()` sem exceção; bots reais (`SERVER_URL=ws://localhost:2604 npm run bots
  -- 2 15`) rodaram na mesma sala — console sem erro (autoplay ou outro), só warning padrão do
  Electron. `npm run aci -- index` rodado ao final.
- **Fora do escopo desta task (fica pra T-050):** mapeamento evento→som completo (xp/coin/hp/
  box/farm_event, fire por launcher, kill/death/respawn, level-up, bandeira, xp_combo, toast).
  Detalhes: `docs/prompts/PROMPT-0045.md`.

## 2026-07-06 — Sessão 27 (design): PROPOSAL-0004 — som, personagens/classes e lobby
- **Pedido do CD:** 4 frentes pra fechar na V1 (som procedural; classe `archer` low poly por
  composição direto no Three.js com animações; fechamento backend/admin — ranking/KDA/settings/
  nicks/eventos/salas; janela pré-sala) + console staff opcional pós-V1. Plano fatiado para
  execução agêntica com modelos menores + guia de alocação de modelo Claude por task.
- **Entregue:** `PROPOSAL-0004` · BACKLOG com **T-049..T-063** e T-D13/D14/D15 (SPEC-0013/0014/
  0015 a gerar) · `instrucoes/GUIA_MODELOS_CLAUDE.md`. Decisões do CD: som WebAudio procedural;
  tasks direto no BACKLOG. Sem mudança de código. Detalhes: `docs/prompts/PROMPT-0044.md`.
- **Próximo passo:** gerar as specs (T-D13..D15, modelo barato) e abrir as frentes S/C/B em
  paralelo (T-049 · T-052 · T-060).

## 2026-07-06 — Sessão 26: T-028 — Auth email+senha (SPEC-0008/ADR-020)
- **Pedido do CD:** retomar T-028, mas separar Google OAuth como opcional/futuro — só a fatia
  email+senha entra agora. Virou `ADR-020` + T-028 fechada em 3 sub-tasks incrementais
  (T-028a/b/c), cada uma com gate verde e commit próprio.
- **T-028a (Django):** `POST /auth/register` e `/auth/login` (`accounts/views.py`), reaproveitando
  `Account.objects.create_user` e `jwt.sign_account` já existentes da T-027c. `RegisterSerializer`
  valida email único (`normalize_email`) e senha forte (`validate_password`, os 4 validators já
  configurados desde a T-027); `LoginSerializer` checa `check_password` e rejeita contas guest.
  9 testes novos (`test_register_login.py`) → pytest 79/79.
- **T-028b (Colyseus):** `platform/authVerifier.ts` — `jose` + `createRemoteJWKSet` contra
  `/api/v1/auth/jwks.json`; JWKS cacheado internamente pela lib, sem round-trip por join.
  `ArenaRoom.onJoin` virou `async` e aceita `options.authToken` opcional atrás de
  `PLATFORM_ENABLED` (mesma flag da T-027g — off por default, zero mudança de comportamento
  atual); token válido seta `Player.accountId` (campo novo, não sincronizado — identidade, nunca
  poder in-round) e o `display_name` da conta; token ausente/expirado/inválido cai pra guest sem
  rejeitar o join. 6 testes novos (`authVerifier.test.ts`, chave RSA gerada em memória) → vitest
  server 76/76. Verificado ponta a ponta com token real emitido pelo `/auth/register` rodando
  contra o Django de verdade (script descartável, não commitado).
- **T-028c (client):** `auth.ts` — pill discreta no canto (`#auth-widget`, `bottom:150px;
  left:10px`, fora da área de jogo e da touch-stick), nunca modal, guest continua o default de
  1 clique. Ao carregar, registra o guest local no Django via `/auth/guest` em best-effort
  (`ensureGuestRegistered` — Django fora do ar não afeta o guest, aceite #3); clicar na pill
  abre um painel Entrar/Registrar; sucesso chama `/auth/link` com o `player_token` local pra
  herdar `PlayerStats` (aceite #5) e guarda o JWT (`aop_jwt`) pro próximo `joinOrCreate`
  (`authToken`). `CORS_ALLOWED_ORIGINS` ganhou a porta do `client-verify` (5299) além da
  padrão (5173) — necessário pro fetch direto do client ao Django.
- **Verificação ponta a ponta no preview** (`server-verify`:2604 + `client-verify`:5299 +
  Django:8000): registrar conta nova (pill passa a mostrar o nome), logout (volta pra "guest"),
  login com senha errada (mensagem de erro no painel, sem travar) e com senha certa (fecha o
  painel, loga) — em todos os casos a partida seguiu rodando sem interrupção (HUD subiu de
  nível 1→6 o tempo todo). Cadeia guest→registro→link validada via curl direto no Django.
- **Fora de escopo, adiado (ADR-020):** Google OAuth — `Account.google_sub` já reservado no
  schema desde a T-027b, plugar depois não pede migração. Vira T-028-google no BACKLOG.
- Gates: shared 30/30 · server 76/76 · bots 35/35 · tsc ×3 · backend pytest 79/79 · ruff limpo
  · `makemigrations --check` limpo.

## 2026-07-06 — Sessão 25: T-048 — imersão de navegador (SPEC-0012, fora de fase)
- **Pedido direto do CD, antes de retomar T-028:** "quero que o jogo ganhe uma imersão no
  navegador, estilo tela cheia, sem que atalhos, cliques errados etc, atrapalhem o jogador."
  Virou `SPEC-0012` (aprovada no próprio pedido) + `T-048` no BACKLOG.
- **`packages/client/src/immersion.ts` (novo):** botão ⛶ de tela cheia (Fullscreen API,
  `#fullscreen-toggle` dentro do `#profile-selector` existente, ícone reflete `fullscreenchange`
  via classe `.active`); `contextmenu`, clique-do-meio, `Ctrl/Cmd+scroll` (zoom), `gesturestart`
  (pinch no Safari) e `dragstart` suprimidos globalmente no documento — nenhum é atributo de
  perfil de controle, então ficam sempre ativos, independente de mouse/teclado/touch.
  `setUnloadGuard(bool)` liga/desliga um `beforeunload` que pede confirmação nativa antes de
  fechar/recarregar a aba — ligado em `main.ts` no `joinOrCreate` bem-sucedido, desligado em
  `room.onLeave`/`room.onError` (handlers novos, não existiam antes).
- **`index.html`:** `touch-action: none` + `overscroll-behavior: none` + `user-select: none`
  globais em `html, body` (antes só `body.touch-profile` tinha `touch-action`) — bloqueia
  pinch-zoom e pull-to-refresh em mobile independente do perfil ativo. Overlay de debug (F3)
  ganhou exceção (`user-select: text`) pra continuar copiável em dev.
- **Verificação:** gates inalterados (mudança 100% client) — shared 30/30 · server 70/70 ·
  bots 35/35 · tsc limpo. Browser real via preview (`server-verify`:2604 + `client-verify`:5299):
  HUD conectou ponta a ponta com o servidor real sem regressão do fluxo de join; disparo
  sintético de `contextmenu`/`wheel(ctrl)`/`dragstart` confirmou `defaultPrevented`; estilos
  globais (`touch-action`/`user-select`) confirmados via computed style; exceção do debug
  overlay preservada. Fullscreen de fato e o diálogo nativo do `beforeunload` exigem gesto real
  de usuário — não testáveis no ambiente automatizado, ficam para o CD confirmar num browser.
  Detalhes: `docs/prompts/PROMPT-0043.md`.
- **Próximo passo:** retomar a fila V1 em T-028 (auth Google + registro, SPEC-0008).

## 2026-07-06 — Sessão 24: T-027 — backend Django completo (SPEC-0008/ADR-016/ADR-019)
- **Backend novo em `backend/`** (não é workspace npm — pip+venv, Django 5.1+DRF+Postgres 16 via docker compose), entregue em sub-tasks incrementais com gate verde a cada uma (T-027a..g): scaffold + `common` (service token, `/healthz`) → `accounts` (Account/PlayerStats/GuestLink) → JWT RS256 + guest/JWKS/link → `maps` (registry + validador espelho do TS + `import_maps`) → `gameops` (RoomConfig/GameEvent + config efetiva) → `telemetry` (ingestão batch) → integração Node (`platformClient.ts` em `packages/server`).
- **Auth (fundação, T-028 fecha o resto):** guest por padrão (1 clique) com `Account` custom (PK uuid), JWT RS256 assinado/verificado via PyJWT, JWKS público para o Colyseus validar sem round-trip, e `POST /auth/link` migra `PlayerStats` do guest pra conta registrada. Google OAuth e a UI de login ficam pra T-028.
- **`maps`:** `validate_map_file` em Python espelha as regras de bounds/objectId/spawns/flag de `packages/shared/src/mapFile.ts` (flood-fill fica só no TS — mitigado testando os 2 mapas curados reais nos dois lados). `import_maps` ingere `maps/*.map.json` da raiz do monorepo; `GET /maps/<id>/` devolve o `MapFileV1` byte-a-byte idêntico ao arquivo (verificado manualmente).
- **`gameops`:** `RoomConfig` (base) + `GameEvent` (override por janela `starts_at`/`ends_at`) → `effective_config()`. Verificado manualmente: criar um `GameEvent` "XP ×2" ativo agora faz `GET /gameops/config/` refletir `xpMultiplier: 2` na hora, sem deploy (aceite #2 da SPEC-0008).
- **`telemetry`:** `POST /telemetry/batch/` valida `TELEMETRY_SCHEMA_VERSION` e os campos base de cada evento do schema T-026, ingestão tudo-ou-nada (batch com 1 evento inválido não grava nada).
- **Integração Node (`packages/server/src/platform/platformClient.ts`):** cacheia `gameops/config` (TTL 30s) e envia telemetria em batch (buffer com teto de 500), atrás de `PLATFORM_ENABLED` (default off — zero mudança nos testes/smoke atuais). `ArenaRoom.onCreate` virou `async` e aplica `flagEnabled`/`xpMultiplier`/`coinMultiplier`/`expectedPlayers`/sorteio de `mapId` da rotação quando habilitado; multiplicadores entram nos 2 pontos únicos de concessão (`grantXp`, pickup de `coin_buff`). Verificado manualmente ponta-a-ponta com o Django real: evento ativo aplicado numa room nova (aceite #2) e, derrubando o processo Django, a room seguinte caiu no cache/defaults sem lançar (aceite #3).
- **Gates:** backend — 71 testes pytest (accounts/maps/gameops/telemetry) contra Postgres real, `makemigrations --check` limpo, `ruff check` limpo. Node — shared 30/30 · server **70/70** (62 preexistentes + 8 do `platformClient`) · bots 35/35 · tsc limpo ×3 · sem `.js` órfão. `docs/QA.md` e `ADR-019` (`docs/DECISION_LOG.md`) documentam o stack concreto e os novos gates.
- **`backend/dev.sh`:** script idempotente que sobe o backend em dev com um comando (venv/deps/`.env`/chaves JWT na primeira vez; Postgres+migrate+runserver sempre).
- **Fora do escopo desta sessão (T-028):** provider Google, páginas de registro email/senha, janela de login no client.

## 2026-07-06 — Sessão 23: integração do ACI (PROPOSAL-0003 F0-F3) na evolução
- **Merge:** branch dedicada `aci` (F0 scaffold, F1 índice de código, F2 índice de docs/corpus, F3 grafo de relações + resumos automáticos) integrada via `merge --no-ff` direto na `evolução`, a pedido do CD; worktree `.claude/worktrees/aci` removido — o ACI passa a ser desenvolvido direto nesta branch a partir de agora, sem esteira paralela.
- **Conflito resolvido:** a `evolução` já tinha um **ADR-017** próprio (SPEC-0010, recompensa de kill + recursos de vida) quando a branch `aci` também registrou seu ADR como ADR-017 — renumerado para **ADR-018** (`packages/aci`, PROPOSAL-0003) na integração; referências em `packages/aci/README.md` e na própria PROPOSAL-0003 atualizadas. Conflito de `package.json` (scripts `map`/`analyze` vs `aci`/`aci:test`) resolvido mantendo as duas adições.
- **Validado pós-merge:** `npm run aci:test` 39/39 + `tsc --noEmit` limpo do pacote; gates do jogo intactos e idênticos ao pré-merge (shared 30/30, server 62/62, bots 35/35, tsc ×3) — zero regressão, isolamento do `@aop/aci` confirmado (nenhum pacote do jogo o importa).
- **Resíduo à parte, não relacionado:** `snapshot-test.sh` solto na raiz (untracked) segue sem investigar — não tem relação com o ACI nem interfere em nada.
- **Próximo passo (ACI):** F4 — contexto por feature (`aci_context_for_feature`, orçamento de tokens) e F5 — servidor MCP + integração de agentes. Ver `docs/proposals/PROPOSAL-0003-aci-infra-contexto-ia.md` §6. A fila V1 (T-027 Django, ver Sessão 22) segue inalterada.

## 2026-07-06 — Sessão 22: T-026 (telemetria estruturada, abre F4/SPEC-0008)
- **Telemetria por evento** (`packages/server/src/telemetry/`): 1 NDJSON versionado por partida (`packages/server/logs/telemetry/<roomId>.ndjson`, mesma pasta gitignored do M0). Eventos: `match_start`/`match_end`, `kill` (posições+níveis de matador E vítima + `threats` da SPEC-0010), `upgrade_offer`/`upgrade_choice` (cards ofertados E recusados — não só o escolhido), `flag_possession` (pickup/drop), `quit`, `tick_slow` (watchdog: dt real > 100ms, 2× o nominal de `TICK_RATE=20`), `error` (tick captura exceção e grava evento em vez de derrubar a sala — `update()` virou wrapper fino sobre `updateInner()`).
- **`npm run analyze -- [matchId|--list]`:** lê o NDJSON de uma partida e imprime funil de eventos, cards mais recusados (ordenado por taxa de recusa), heatmap ASCII de mortes (posição da vítima, bucketizado pelo tamanho do mapa) e resumo de watchdog/erros. Lógica pura em `telemetry/analyze.ts` (testável sem tocar disco), CLI fino em `cli/analyze.ts` — mesmo padrão de `mapFile.ts`/`mapCli.ts` da T-025.
- **Validado ponta a ponta:** servidor real + 8 bots por 60s → `npm run analyze` respondeu de fato "onde as mortes se concentram" (heatmap) e "qual card é mais recusado" (tabela ordenada) — os 2 critérios de aceite centrais da SPEC-0008 pra esta task.
- **Gates:** shared 30/30 · server **62/62** (13 testes novos: `telemetry/log.test.ts` + `telemetry/analyze.test.ts`) · bots 35/35 · tsc ×3 limpo. Detalhes em `docs/prompts/PROMPT-0042.md`.
- **Próximo passo:** T-027 (backend Django + admin, ADR-016) — escopo bem maior (novo serviço, fronteira Node×Django), recomendo alinhar com o CD antes de começar.

## 2026-07-06 — Sessão 21: 3 correções (bandeira, verificação SPEC-0010, variedade de cards)
- **Bandeira:** pedido do CD já estava coberto por T-041/T-042 (livre=acesa/carregada=apagada/cooldown=some) — código revisado, sem bug. F3 ganhou linha de estado textual (`bandeira: livre/carregada/cooldown`) porque o ambiente de preview desta sessão não sustenta o loop de render WebGL (`document.hidden` pausa o `requestAnimationFrame` — causa raiz confirmada, mesma limitação já suspeitada em sessões anteriores).
- **SPEC-0010:** confirmada funcional via smoke ao vivo (8 bots, 100s, polling do `/debug/rooms`) — `kill_heal`/`kill_duel_bonus` batendo a fórmula da spec, `hp_orb`/`shield_temp` respeitando teto e respawn; redução de dano do escudo já coberta por teste unitário.
- **Cards de level-up:** reversão pedida pelo CD do princípio "determinístico, nunca sorteio" de T-016 — pool de 6→12 cards (`UPGRADE_CARD_POOL`, novos: `rajada`/`mira_longa` puros de Cadência/Alcance + combos `fera`/`muralha`/`cacador_furtivo`/`sobrevivente`); `upgradeCardsForLevel` agora sorteia 3 distintos por level-up em vez de janela fixa por `level % 6`. Escolha dentro da oferta continua do jogador. Perfis de bot (T-008b) ganharam `preferredCardIds` estendidos pra não perder identidade de build.
- **Gates:** shared 30/30 · server 49/49 · bots 35/35 · tsc ×3 limpo. Detalhes em `docs/prompts/PROMPT-0041.md`.
- **Próximo passo:** F4 — Plataforma (SPEC-0008), começando por T-026 (telemetria NDJSON).

## 2026-07-06 — Sessão 20: fix de boot dos bots + T-046/T-047 (fecha SPEC-0011) + T-025 (CLI de mapas, fecha SPEC-0007/F3)
- **Fix:** `packages/shared/package.json` sem `"type": "module"` quebrava o boot de `@aop/bots` (`SyntaxError: does not provide an export named 'POWER_BAND_HIGH'`) — interop CJS→ESM falha em detectar named exports que atravessam várias camadas de `export * from`. Fix de 1 linha, sem regressão em nenhum dos 4 pacotes.
- **T-046 (smoke QA da SPEC-0011):** servidor + 10 bots headless, duas rodadas (200s/240s), polling de `/debug/rooms` a cada 16s (1262 eventos únicos, 265s reais — o ring buffer sozinho só retém ~30s de sessão com 10 bots). Confirmado ao vivo: arma nunca duplicada (9 ciclos spawn→pickup, 19–30s), ciclo completo `flag_cooldown_start`→`flag_respawn` = 60028ms (bate com `FLAG_COOLDOWN_MS`), combo de XP boosted a partir da 3ª coleta, `kill_heal`+`kill_duel_bonus` coexistindo (sem monopólio de alvo). Sem mudança de código de jogo.
- **T-047:** `docs/mechanics/flag.md` — ciclo completo da bandeira (ativa/carregada/dropada/abandono-cooldown/renascimento), assentamento sempre válido, visual por estado, tabela de constantes-dial.
- **T-025 (CLI de mapas, fecha F3/SPEC-0007):** `npm run map -- gen|save|save-current|update|list|preview`. `gen` só imprime preview ASCII (não grava); `save`/`update` persistem em `maps/<id>.map.json` (`update` regenera conteúdo por novo seed/w/h preservando id/name/author); `save-current` lê `/debug/rooms` (ganhou campo `mapId`) e regenera via `buildMap(w,h,seed)` — reproduz exatamente o mapa procedural da sala ao vivo, sem precisar de endpoint novo pra transportar instâncias. Novo em shared: `gameMapToMapFile` (inverso de `mapFileToGameMap`) + `mapFilePreview` (ASCII: props pelo footprint do registry, `S`=spawn, `F`=bandeira-objetivo). Validado ponta a ponta: sala real capturada (`arena-live-capture.map.json`) e rejogada com `BOT_MAP_ID`, bots carregam e jogam sem regressão — critério de aceite #1 da spec confirmado. 2 mapas curados no repo (`arena-teste` + `arena-live-capture`) — critério de aceite #3.
- **Gates:** shared 29/29 · server 49/49 · bots 35/35 · tsc ×3 limpo, em todas as três entregas da sessão. Detalhes em `docs/prompts/PROMPT-0040.md` (T-025) e `docs/prompts/PROMPT-0039.md` §Resultado T-046 (T-046/T-047).
- **Próximo passo:** F3 (SPEC-0007) fechada. Abre F4 — Plataforma (SPEC-0008): T-026 (telemetria NDJSON) → T-027 (Django) → T-028 (auth) → T-029 (ADR-012 na conta).

## 2026-07-06 — Sessão 19: SPEC-0011 / T-037..T-045 (feedback de gameplay #2) + recuperação de reset acidental
- **2º lote de feedback do CD jogando** virou a SPEC-0011 e as tasks T-037..T-045 (F2.6 do BACKLOG), implementadas por **4 agentes em 2 etapas paralelas** (frentes com arquivos disjuntos; nos compartilhados, fronteiras de região + seções próprias no fim de `constants.ts` — zero colisões).
- **T-037 (bots):** alvo em banda de poder mid/high é percebido de mais longe (×1.6/×2.5) e recebe mais peso de engage (×1.25/×1.5, com teto + piso de advantage) mantendo `targetBias` — forte é caçado, sem "todos contra um"; vida cheia (≥90%) ⇒ coragem; fuga exige rota de cura percebida, senão luta.
- **T-038/T-039 (arsenal):** `sceneryRadius` fino (0.22) separado do raio de hit (0.4) — projétil passa vão diagonal com TTK intacto; `heavy_shot`/`rapid_shot` (+8%/+15% DPS com tradeoff) + coletável `weapon` único (spawn aleatório walkable+alcançável, respawn sorteado 15–30 s, morte devolve `basic_shot`), VFX/chip de HUD por arma.
- **T-040..T-042 (bandeira):** assentamento sempre em célula walkable alcançável (`nearestReachableCell`); livre = acesa pulsante / carregada = apagada / cooldown = some; abandono 5 s ⇒ `Flag.state="cooldown"` 60 s ⇒ renasce no centro; bots ignoram em cooldown.
- **T-043..T-045 (feedback):** combo de XP server-only (2× a partir da 3ª coleta seguida, limite sorteado 3–5, dano zera); popups discretos de coleta (opacity 0.62); materialização de (re)spawn 400 ms + fade de tela do próprio jogador.
- **Incidente:** o limite de sessão cortou os agentes da Etapa 2 no relatório final; na retomada o working tree foi resetado por acidente. **Recuperação por replay dos transcripts dos subagentes** (85 ops Edit/Write bem-sucedidas, ordenadas por timestamp global, reaplicadas sobre `7c9e28e`): 0 falhas, 26 arquivos, e os gates bateram — shared 25/25 · server 49/49 · bots 35/35 · tsc ×3 limpo. Commit imediato `337ae08`. **Regra nova: commitar ao fim de cada frente verde.**
- **Pendente:** T-046 (smoke de integração ao vivo das 4 frentes) e T-047 (doc de mecânica da bandeira) — escopos fechados no BACKLOG; vereditos de sensação do CD (dials listados por task na F2.6). Detalhes em `docs/prompts/PROMPT-0039.md`.

## 2026-07-05 — Sessão 18: T-036 (passe visual — coletáveis F2, VFX de cura/escudo, HUD gamificado)
- **Coletáveis reconhecíveis (F2 composição, ADR-008):** `createCollectibleVisual` agora monta um `THREE.Group` de primitivas via `collectibleParts(kind)` (`visuals.ts`) — cruz vermelha=vida, domo azul+aro=escudo, seta ciano=velocidade, moeda em pé (gira=flip)=coins, seta dupla verde=2×XP, baú (corpo+tampa+fecho)=box, gema dourada=xp. Geometrias e materiais são singletons de módulo (N coletáveis reusam os mesmos objetos — zero alocação por instância, "leve sempre" §5). `main.ts` passou a tipar o mapa como `THREE.Group`.
- **VFX de cura/escudo (backlog vivo):** novos `heal_pop` (verde) e `shield_gain` (azul) no registry `VFX_DEFS` — fecham a lacuna de feedback da SPEC-0010. Wire: `kill_heal`→`heal_pop`+popup "+X" verde no matador; `pickup hp_orb`→`heal_pop`+"+HP_ORB_AMOUNT"; `pickup shield_temp`→`shield_gain`+anel de cooldown azul (`damage_reduction` entrou em `BUFF_RING_COLOR`/`BUFF_DURATION_MS`). Popup de dano refatorado em `pushPopup` (núcleo comum dano/cura, mesmo orçamento de 24 sprites).
- **HUD gamificado (estende T-023):** `hud.ts` troca o bloco de texto monoespaçado por um painel estruturado — badge de nível, barra de HP (cor por fração: verde/âmbar/vermelho), barra de XP, chips de efeito (⚡/2×XP/🛡/🚩/fila de level-up), atributos no [Tab]. Casca montada 1× (`buildHudShell`); por frame só mudam larguras/textos (chips só quando o conjunto muda). Regra "HUD só exibe estado" e comportamento dev/prod preservados. CSS novo em `index.html` (painel 244px, glassmorphism leve).
- **Verificação:** typecheck limpo em server/client/bots · gates inalterados 25/28/24 (só cliente mudou) · **HUD conferido em screenshot** (mockup estático com o CSS real, 2 cenários: rico dev/Tab + low-HP prod — barra vermelha no HP baixo confirmada). 3D (coletáveis/VFX) é WebGL, não screenshota no headless sem GPU — **pendente veredito visual humano** (mesma ressalva de T-022). Detalhes em `docs/prompts/PROMPT-0038.md`.

## 2026-07-05 — Sessão 17: F2.5 / SPEC-0010 (T-033..T-035 — sobrevivência por habilidade)
- **Recompensa de kill contextual (T-033, ADR-017):** no bloco de kill do `ArenaRoom`, `countLivingEnemiesNear(matador, raio COMBAT_THREAT_RADIUS)` decide a recompensa — duelo (0) → `KILL_DUEL_XP_BONUS_PER_LEVEL × nível` de XP extra (`kill_duel_bonus`); briga (≥1) → cura `killHealFraction(threats)` da vida **faltante** (`kill_heal`), teto `KILL_HEAL_MISSING_FRAC_MAX=0.5`, sem overheal. `killHealFraction` é função pura no shared (testada).
- **`hp_orb` (T-034):** coletável +5 HP com **passe de spawn dedicado** (`spawnSurvivalItem`) fora do orçamento genérico — teto `HP_ORB_MAX=3`, distâncias mínimas próprias de player (7) e de outro hp_orb (9), cadência 12s, só campo aberto. `createCollectible` ganhou `forceKind?` opcional (caminho por peso de zona intacto).
- **`shield_temp` (T-035):** coletável (máx. 2) → novo `EffectKind` `damage_reduction` (`SHIELD_TEMP_MS=3s`) → campo sincronizado `Player.damageTakenMult`; `projectiles.ts` multiplica o dano recebido por ele. **Reduz** (hit acontece com dano menor), não bloqueia — distinto da invulnerabilidade de nascimento. Cliente: placeholders (esfera vermelha / icosaedro azul) em `visuals.ts`.
- **Verificação:** shared 25/25 (5 novos, `killHealFraction`) · server 28/28 (3 novos: redução de dano ×2, escudo aplica/expira) · bots 24/24 · tsc limpo (server/client/bots). **Smoke real** com 12 bots aglomerados em servidor `PORT=2599 DEBUG=1`: `kill_heal` observado ao vivo (`threats:1→heal:10`, `threats:2→heal:14` — mesma faltante, mais inimigos = mais cura), `kill_duel_bonus` ×15, `hp_orb`/`shield_temp` nascendo (12/9) e sendo coletados (10/8) respeitando os tetos. Detalhes em `docs/prompts/PROMPT-0037.md`.
- **Pendente (não bloqueia):** veredito de sensação do CD sobre os 4 tunables (`KILL_HEAL_MISSING_FRAC_BASE`, `COMBAT_THREAT_RADIUS`, `HP_ORB_AMOUNT`, `SHIELD_TEMP_DAMAGE_MULT`) e veredito visual dos placeholders/tag de escudo (ambiente headless sem GPU não fecha screenshot do canvas).

## 2026-07-05 — Sessão 16: T-024 (registry de objetos + formato de mapa v1 + loader)
- **Registry (`packages/shared/src/objects.ts`):** `ObjectDef {id, footprint, collidable}` para `pedra`/`arvore`/`caixa`/`muro`/`bandeira` — mesma interface que objetos salvos pelo sistema (Django, SPEC-0008) vão usar depois.
- **Formato de mapa v1 (`packages/shared/src/mapFile.ts`):** `MapFileV1` (instâncias, zonas, spawns, bandeira) + `validateMapFile` (objectId desconhecido, fora dos limites, **flood-fill** via novo `floodFillReachable` em `map.ts`) + `mapFileToGameMap`, que produz a MESMA estrutura `GameMap` do gerador por seed — colisão/zonas/bots/render não mudaram nada.
- **Loader só de servidor (`packages/server/src/mapLoader.ts`):** lê `maps/<id>.map.json` do disco, valida, lança erro claro se inválido. `ArenaRoom` aceita `mapId` opcional (`ArenaState.mapId`, vazio = seed, como sempre); mapa curado manda o JSON completo por mensagem (`map_data`) no join, já que cliente/bots não leem o disco do servidor. Cliente e bots (`BOT_MAP_ID`, novo env var no mesmo padrão de `BOT_BOSS`) atualizados para os dois caminhos.
- **Verificação:** shared 20/20 (7 novos) · server 25/25 · bots 24/24 · tsc limpo em todos os pacotes · smoke real com `maps/arena-teste.map.json` (fixture de exemplo): 3 bots + 1 humano na mesma sala curada, pathfinding/combate/zona de guerra funcionando, overlay F3 confirmando `15×13 curado:arena-teste`, screenshot do mapa renderizando. Detalhes em `docs/prompts/PROMPT-0036.md`.
- Próxima: T-025 (CLI de mapas — `gen/save/save-current/update/list/preview`), que fecha os critérios de aceite que dependem de salvar o mapa de uma sala real.

## 2026-07-05 — Sessão 15: T-023 (HUD dev/prod + reveal-on-hit + toasts)
- **HUD dev/prod (`import.meta.env.DEV`, nativo do Vite):** prod vira painel compacto (ping/nível/xp/HP/tags sempre visíveis, atributos completos só segurando `[Tab]`), roster e overlay de debug (F3) somem do DOM inteiramente em prod. Dev mantém tudo sempre visível, como antes.
- **Reveal-on-hit autoritativo:** novo `Player.revealedUntil` (`ArenaState.ts`, mesmo padrão de `spawnProtectedUntil`) — setado em vítima e atirador a cada dano real (`REVEAL_ON_HIT_MS=4000`, novo em `shared/constants.ts`), renovado a cada novo hit. Nameplate (nome + barra de HP, sprite de canvas) só aparece enquanto o campo estiver no futuro — "inimigo é só skin até trocar dano com ele".
- **Toasts (`toast_text`, item do backlog vivo de VFX/juice):** fila não invasiva no canto inferior direito, substitui todo texto cru que ficava solto no HUD (streak de kills, card aplicado, `farm_event`); fade/slide via CSS, orçamento fixo (`TOAST_MAX=5`).
- **Verificação:** shared 13/13 · server 25/25 · tsc limpo em client/server · smoke real em **dois builds** — dev (tudo visível, sem regressão) e **produção de verdade** (`vite build`+`vite preview`, configuração temporária no `launch.json`, removida ao final): screenshots confirmaram painel compacto, `[Tab]` revelando atributos, nameplate aparecendo no hit certo, toasts de `farm_event` e upgrade deslizando no canto, e o menu de card manual funcionando normalmente no bundle de produção. Detalhes em `docs/prompts/PROMPT-0035.md`.
- Fase F2 da V1 completa (T-019..T-023). Próxima: T-024 (registry de objetos + mapa v1, início da F3).

## 2026-07-05 — Sessão 14: T-022 (VFX nomeados)
- **Registry data-driven (`packages/client/src/vfx.ts`):** `VFX_DEFS` com os 6 efeitos-base da SPEC-0006 (`muzzle_flash`, `hit_spark`, `death_burst`, `shield_pop`, `flag_aura`, `pickup_glint`) + os 5 da fila inicial do backlog vivo (`speed_up_trail`, `buff_cooldown_ring`, `blood_hit`, `level_up_auto`, `upgrade_chosen_aura`) — "efeito novo = 1 entrada de dados", cumprindo o critério de aceite da spec. 1 pool único de partículas (`THREE.Points`, `MAX_PARTICLES=260`, ring-buffer, sem alocação por frame) para o jogo inteiro, não 1 mesh por efeito.
- **Tudo derivado de eventos que o servidor já emite** — nenhuma mudança de protocolo: `hit`/`death`/`pickup`/`upgrade` (`debug_event`), transição local de `spawnProtectedUntil` (shield_pop), e a 1ª aparição de um projétil em `st.projectiles` (muzzle_flash). `buff_cooldown_ring` (novo helper em `visuals.ts`) ancora o timer no instante exato de aplicação (`pickup`/`impulso`) usando as mesmas constantes de duração do `EffectSystem` — sem duplicar nem "chutar" número.
- **Verificação:** shared 13/13 · server 25/25 · bots 24/24 · tsc ×3 limpo · smoke real (servidor+cliente reais, 1 humano + 6 bots, ~2min de combate/mortes/pickups/cards/bandeira) sem nenhum erro de console; screenshot do preview capturou um burst de partículas coloridas renderizando na cena, confirmando visualmente o pool funcionando. Detalhes em `docs/prompts/PROMPT-0034.md`.
- Próxima: T-023 (HUD dev/prod + reveal-on-hit + `toast_text`, que fica de fora do T-022 de propósito).

## 2026-07-05 — Sessão 13: feedback de jogo — progressão de skill/atributo + menu de level-up travava na morte
- **Sem task de backlog associada** — feedback direto do CD jogando com os ajustes da Sessão 12 já em mãos. Dois pontos:
- **Progressão pouco sentida:** `UPGRADE_CARD_POINTS` dobrou (3→6, `ATTR_POINTS_PER_LEVEL_EACH` 1→2 junto, pela invariante do preset equilibrado) — cards agora dão `+6 Força`/`+6 Vitalidade`/`+6 Agilidade`/`+4+2` em vez da metade. `SKILL_MILESTONE_LEVELS` foi de 3 marcos esparsos (4/8/12 — matematicamente impossível fechar as 5 skills numa run) pra 5 marcos, um por skill (3/6/9/12/15); a composição da oferta nesses marcos **inverteu**: agora é 2 cards de atributo + 1 de skill (`SKILL_MILESTONE_SKILL`, skill fixa por marco), não mais 2 skills à escolha + 1 atributo. Guard-test de balance (`effects.test.ts` — "full-Força mata equilibrado em 3 tiros") recalculado do zero pro novo valor, não só reescalado.
- **Bug: menu de level-up ficava travado na tela se o jogador morresse com a oferta aberta.** Causa: a morte sempre limpava a oferta pendente no servidor, mas nunca avisava o cliente — só `upgrade_applied` (escolha ou timeout) fechava a UI, e a morte pulava esse caminho. Corrigido com mensagem dedicada `upgrade_offer_closed`, enviada só quando havia mesmo uma oferta pra fechar.
- **Verificação:** shared 13/13 · server 25/25 · bots 24/24 · tsc ×3 limpo · **2 smokes end-to-end reais** contra servidor de verdade: (1) nível 2 e nível 3 mostrando a composição/valores certos dos cards; (2) dois clientes reais — atacante só disparando quando a oferta da vítima estava aberta, forçando a morte dentro da janela de 5s — confirmou `upgrade_offer_closed` chegando exatamente no momento certo, sem regressão no auto-pick normal. Detalhes em `docs/prompts/PROMPT-0033.md`.
- Fila da V1 segue parada na T-022 — CD pediu alinhamento do estado atual do projeto antes de retomar.

## 2026-07-05 — Sessão 12: QA do 1º teste manual do CD (tank controls + bots que simulam players)
- **Primeiro veredito manual do CD** sobre T-019b/T-020/T-008b/T-021 — 7 anotações resolvidas (PROMPT-0032), aprovadas em jogo real ("está melhor agora").
- **Keyboard vira tank controls:** W/S avançam/recuam pela rotação do jogador, A/D strafe relativo, setas giram; mira enviada todo tick (senão S viraria o boneco); dica do HUD agora é por perfil ativo.
- **Bots simulam players (direção do CD):** bandeira carregada por inimigo virou **bônus de engage no portador** (`×(1+objective)`, alcance estendido) — bots miram e ATIRAM em quem carrega, em vez de só perseguir; `decide()` avalia os 4 inimigos mais próximos com `targetBias` determinístico por (bot, alvo) — alvos "compartilhados", combates distribuídos, portador não monopolizado; **encurralado** (borda <3u + ameaça no raio) troca fuga por briga de desespero; **kite** (atira de volta enquanto foge); **separação** (<1.8u empurra pra fora — fim do bolo em cima do portador); **dosagem individual** (`withIndividualDosage`: ±25% nos pesos por bot — dois "cautelosos" não jogam igual; dosagem visível no log de entrada).
- **Infra de teste:** bots agora entram todos na MESMA sala (primeiro fixa, resto `joinById`, sala cheia = erro alto — antes `joinOrCreate` criava sala fantasma e "10 bots viravam 6"); `MAX_PLAYERS` 8→16; `FLAG_ABANDON_RETURN_MS` 15s→5s (CD); warning `announce` dos bots silenciado.
- **Verificação:** shared 13/13 · server 25/25 · bots 24/24 (4 novos de decisão) · tsc ×3 limpo · tank controls exercitados no browser real (facing −90°→87°, W/S seguindo a rotação) · smoke 10 bots numa sala só, dosagens distintas · **ciclo da bandeira ao vivo**: pickup aos 29.6s, portador caçado e morto aos 40.7s (`flag_drop reason: death`). Detalhes em `docs/prompts/PROMPT-0032.md`.
- Docs de IA atualizadas (`bot-architecture.md §3` + `bots.md`) com os refinamentos. Próxima: retomar a fila da V1 na T-022 (VFX nomeados).

## 2026-07-05 — Sessão 11: T-021 (bandeira "rei do mapa")
- **T-021 (SPEC-0006):** `ArenaState` ganhou a entidade `Flag` (`x,z,carrierId`) + `flagEnabled` (toggle por room, default ON). Lógica isolada em `FlagSystem` (`packages/server/src/systems/flag.ts`, molde de `EffectSystem`): pickup por distância, segue o portador vivo, derruba no local na morte (ou desconexão sem morte), volta ao centro do mapa (`mapCenter`, novo helper em `shared/map.ts`) após `FLAG_ABANDON_RETURN_MS` sem dono. XP passivo do portador é multiplicado por `FLAG_XP_MULT` (2×) direto na chamada de `grantXp` — sem tocar em `xpMult`/`EffectSystem` para não colidir com o boost de `farm_event` (os dois agora empilham, de propósito).
- **Cliente:** mesh dinâmico da bandeira sincronizado em `syncWorld()` (some quando `flagEnabled` é false); glow do portador usa a primeira `THREE.PointLight` do projeto (`updateFlagGlow`) — "glow global" pedia visibilidade no mapa inteiro, não só de perto como os aros de opacidade existentes. HUD ganhou linha textual + tag 🚩 no roster.
- **Bots:** `disputar_bandeira` finalmente entrou em `decision.ts` (estava de propósito fora desde a T-020, sem dado) — novo peso `objective` em todos os 5 presets de `Personality`, novo campo `flag` em `Perception`, novo score `objective × conf(dist) × conf(risco_zona)` (fórmula de `bot-architecture.md §3`). Movimento em `bot.ts` é perseguição direta (como engage/flee), não BFS, porque o alvo se move (segue o portador).
- **Verificação:** shared 13/13 · server 25/25 (6 novos de `flag.test.ts`) · bots 20/20 (3 novos de disputa de bandeira) · tsc limpo em server/bots/client · smoke end-to-end real (cliente colyseus.js indo até o centro do mapa) confirmou `flag_pickup` na posição certa e XP dobrando de +1/tick para +2/tick. Detalhes em `docs/prompts/PROMPT-0031.md`.
- Pendente: veredito de "sensação" do CD com bots disputando numa sessão mais longa (mapa grande — não observado no smoke curto de multiplayer); `objective` dos perfis é chute inicial, não calibrado por telemetria. Próxima: T-022 (VFX nomeados).

## 2026-07-05 — Sessão 10 (cont. 3): T-008b (perfis nomeados, cards por perfil, boss) + isolamento em worktree
- **T-008b (SPEC-0004 addendum):** `packages/bots/src/ai/personality.ts` ganhou `BOT_PROFILES` nomeados (`agressivo`/`cauteloso`/`cacador`/`equilibrado`), cada um com `Personality` + `CardPolicy` determinística (bruto/tanque/caçador/auto-pick); `pickCard()` escolhe sempre o mesmo card quando disponível — build do bot fica observável e explorável. Boss: `ArenaRoom.onJoin` ganhou `boss?: boolean` e `initBoss()` (servidor autoritativo) — nível 6–8 (`BOSS_LEVEL_MIN/MAX` novos em constants.ts), build concentrada real via `EffectSystem.addAttrPoints`, 1 skill de marco; o bot só pede `boss: true`, nunca decide os números.
- **Verificação:** shared 13/13 · server 19/19 · bots 17/17 (11 + 6 novos de `pickCard`) · tsc ×3 · guarda `.js` órfão · smoke real com boss sobrevivendo no nível 6, 27 tiros, distância mínima 0.2u contra 3 bots de perfis variados.
- **Sessão concorrente descoberta:** outra sessão/agente estava operando na MESMA working directory (branch `aci`, scaffold de `packages/aci`/PROPOSAL-0003) e trocou a branch ativa embaixo desta sessão duas vezes. Isolado com `git worktree add .claude/worktrees/v1-continue -b v1-continue evolução` + `EnterWorktree` (a pedido do CD) — sem tocar nos arquivos da outra sessão. Corrigido de quebra um vazamento no `package-lock.json` do commit da T-020 (referência órfã a `packages/aci` capturada pelo `npm install` rodado antes do isolamento).
- **Achado de ferramenta:** `preview_start`/`preview_*` não seguem o `cwd` do worktree — continuaram iniciando o servidor no diretório original, mascarando os testes do boss até isso ser detectado (via `/proc/<pid>/cwd` do processo na porta 2567) e corrigido rodando o servidor manualmente via Bash. Detalhes em `docs/prompts/PROMPT-0030.md`.
- Próxima: T-021 (bandeira "rei do mapa").

## 2026-07-05 — Sessão 10 (cont. 2): T-020 (arquitetura de IA dos bots em camadas)
- Implementado `docs/ai/bot-architecture.md` em `packages/bots/src/ai/`: `types.ts`, `personality.ts` (ponte T-008→Personality), `perception.ts` (snapshot filtrado + ruído), `memory.ts` (hysteresis + desistência), `decision.ts` (Utility AI, **função pura**), `steering.ts` (context steering, **função pura**), `humanizer.ts` (reação/lerp de mira/cadência com jitter/pausas). `bot.ts` reescrito para orquestrar as 6 camadas, preservando 100% do comportamento observável.
- Achado técnico: import estático de `@aop/shared` em `perception.ts` quebrava em runtime via `tsx` (`does not provide an export named 'zoneAt'`) — mesmo pacote que `bot.ts` já importava dinamicamente. Resolvido desacoplando `perception.ts` do shared (recebe `MapBounds`+`zoneOf` injetado) — bônus: a camada fica genérica de verdade.
- **Verificação:** shared 13/13 · server 19/19 · **bots 11/11 (novo, decision+steering puros)** · tsc ×3 · guarda `.js` órfão · smoke `BOT_VERBOSE=1 npm run bots -- 4 20` com engajar/fugir/coletar/level_up/speed_up todos observados e anti-stuck raramente acionado (1x em 20s/4 bots). Detalhes em `docs/prompts/PROMPT-0029.md`.
- Ações `disputar_bandeira`/`manter_posição` do doc teórico ficaram de fora (sem bandeira no jogo ainda — chega na T-021). Próxima: T-008b (personalidade/boss, presets nomeados substituindo a ponte por skill).

## 2026-07-05 — Sessão 10 (cont.): T-019b (perfis keyboard/touch + seletor)
- **T-019b (SPEC-0006/ADR-015):** perfil `keyboard` (`packages/client/src/input/keyboardProfile.ts` — WASD move + setas giram a mira + espaço dispara, fallback de facing-por-movimento até a 1ª rotação) e perfil `touch` (`touchProfile.ts` — twin-stick virtual por Pointer Events, metade esquerda move/metade direita mira+atira). `ProfileManager` (`manager.ts`) faz a auto-detecção (`matchMedia("pointer:coarse)"`+touch) e a troca manual persistida em `localStorage`; UI `#profile-selector` (3 botões sempre visíveis) + sticks visuais que só aparecem no perfil touch.
- **Verificação:** gates automáticos verdes; os 3 perfis (mouse/keyboard/touch) foram exercitados isolando as classes reais via `preview_eval` (import dinâmico + eventos sintéticos de teclado/pointer) — sem GPU no preview headless para screenshot, mesma limitação da T-019. Detalhes em `docs/prompts/PROMPT-0028.md`.
- Pendente: smoke manual em dispositivo touch real (bots não cobrem) + veredito do CD nos 3 perfis. Próxima: T-020 (arquitetura de IA dos bots).

## 2026-07-05 — Sessão 10: gates + merge evolução→main, T-019 (perfis de controle + mouse)
- Início da execução agêntica sequencial da V1 (PROPOSAL-0002), sem intervenção do CD a cada task. Antes de tocar código: rodados todos os gates herdados (shared 13/13, server 19/19, tsc ×3, guarda `.js` órfão, smoke de bots) — verdes — e feito o **merge fast-forward `evolução` → `main`** recomendado pela sessão anterior.
- **T-019 (SPEC-0006/ADR-015):** criada a camada de perfis de controle no cliente (`packages/client/src/input/types.ts` — contrato `Intent`/`ControlProfile`) e o perfil `mouse` (`mouseProfile.ts`): WASD strafe + mira por raycast do cursor no chão (vetor `aim` enviado como `aimX/aimZ`, campo que o servidor já aceitava desde SPEC-0003/bots — zero mudança de servidor) + gatilho por clique/espaço. `main.ts` passou a delegar input ao perfil ativo; crosshair 360° (`#crosshair`) substitui o cursor do SO; câmera ganha leve offset na direção da mira sem girar.
- **Verificação:** gates automáticos verdes; preview headless sem GPU não permitiu screenshot, então a lógica do perfil foi validada isolando a classe real via import dinâmico no browser (`preview_eval`) — confirmado que o crosshair segue o mouse e o vetor de mira aponta corretamente para os dois lados da tela. Detalhes em `docs/prompts/PROMPT-0027.md`.
- Pendente: veredito humano do CD num browser com GPU (critério "circular um alvo mantendo o crosshair nele"); T-019b (keyboard/touch) é a próxima task.

## 2026-07-05 — Sessão 9 (final): ajuste A4 — juice contínuo com regra de intensidade
- CD jogou mais e pediu (sem reestruturar o plano): mais efeitos visuais (trail de velocidade, anel de cooldown de buff, sangue no hit), distinção **automático = leve vs escolha manual = "aura" chamativa**, toasts de texto personalizados e não invasivos, e um mecanismo para adicionar juice "quando sentir a necessidade momentânea".
- Solução sem tocar nas fases: **backlog vivo** `docs/mechanics/vfx-juice-backlog.md` (fila que o CD alimenta a qualquer momento; qualquer leva puxa itens via registry da T-022) + regra de intensidade registrada na PROPOSAL-0002 §9-A4 e na SPEC-0006; `toast_text` incorporado ao T-023. Plano da V1 **finalizado**.

## 2026-07-05 — Sessão 9 (cont., design): V1 aprovada com ajustes — documentação executável completa
- CD aprovou a PROPOSAL-0002 com 3 refinamentos (registrados no §9): **A1** controles viram PERFIS (`mouse`/`keyboard`/`touch`, todos → `{move, aim, fire}`; jogo é "Valorant 3D leve"; rotação por perfil — ADR-015 encerra o vaivém das ADRs de mira); **A2** bot vira **arquitetura de IA** com base teórica própria (`docs/ai/bot-architecture.md`: percepção → utility AI → context steering → humanizador; Personality = JSON; perfis/boss/Guardian = presets); **A3** mapas referenciam **objetos registrados** (`ObjectDef` em código agora, sistema depois) e a CLI ganha `save-current` (salvar o mapa gerado atual e reajustar) — IA cura mapas com o CD, nunca gera automático.
- Criadas as 4 specs executáveis: **SPEC-0006** (F1+F2 sensação & leitura), **SPEC-0007** (F3 mapas & objetos), **SPEC-0008** (F4 telemetria/Django/auth), **SPEC-0009** (F5+F6 docker/hardening/lançamento) + **ADR-015/ADR-016**; BACKLOG revisado (T-019 dividida em T-019/T-019b; T-020 promovida a 〔G〕).
- Sem código de jogo nesta entrada. Próximo: `Executar T-019` (recomendado: veredito/merge das SPECs 3–5 antes, pois T-019 mexe no input recém-alterado).

## 2026-07-05 — Sessão 9 (design): PROPOSAL-0002 — plano completo da V1 até o lançamento
- CD jogou a build e trouxe 9 percepções (bots robóticos na borda, mira "por ângulos" → quer CS-2D, mapas escolhíveis + CLI, bandeira 2×XP/s, backend Django+admin, HUD dev/prod + inimigo revelado só ao trocar dano, VFX nomeados, logs para análise por IA, login anônimo+Google) + pedido de plano por etapas até a V1 na VPS (docker dev/prod + scripts).
- Alinhamento com o histórico: a mira CS-2D **reverte a ADR-014.6** (facing por movimento) — registrado como revisão consciente (vira ADR-015 na aprovação); Aura (M2) e Guardian (M3) adiados para pós-V1 (a bandeira entrega o "objetivo de mapa" mais barato); M4/M5 absorvidos pelas fases F4/F5/F6; guardrail da constituição mantido (conta = identidade/estatística, nunca poder in-round).
- Também commitado o código da SPEC-0005 que estava com working tree sujo da sessão anterior (já testado, 19/19 no server).
- Produzido: `docs/proposals/PROPOSAL-0002-v1-lancamento.md` (análise ponto a ponto com acréscimos, arquitetura alvo, guardrails, 6 fases, 5 questões abertas) + seção **V1** no BACKLOG (T-019..T-032, T-032 = 🚀 lançamento) + ROADMAP remapeado.
- Sem mudança de código de jogo nesta entrada. Próximo: aprovação do CD → specs por fase (SPEC-0006..0009) → `Executar T-019`.

## 2026-07-05 — Sessão 8 (cont.): correções da SPEC-0005 (PROMPT-0026)
- CD apontou 2 erros da leva anterior:
  1. **Facing não é do mouse.** A direção/visão do player deve vir do **movimento** (WASD), como antes, só que mais eficiente. Removido do cliente todo o caminho de mira por mouse (raycast `cursorGroundOffset`, `mousemove`, envio de `aim`); o servidor já deriva `dir` de `inputX/inputZ`. Cliente do player não manda mais `aim` — o campo do protocolo fica só para os bots (que miram no alvo). Menos trabalho por tick, menos rede.
  2. **XP fracionado no HUD** (`1.478.../88`). Causa: o XP passivo somava fração por tick direto em `p.xp`. Corrigido com **acumulador de tempo no servidor** (`xpAccum`): o XP entra em `p.xp` só em unidades inteiras (1/s), então o estado nunca é fracionado. HUD também floora por defesa.
- **Verificado:** shared 13/13, server 19/19, `tsc --noEmit` limpo ×3. Docs atualizadas (SPEC-0005 item 6 + nota de correção, ADR-014, PLAYER_LOOP/combat, QA, ROADMAP, SESSAO_ATUAL).

## 2026-07-04 — Sessão 8: SPEC-0005 — ajustes de gameplay pós-teste com bots
- CD testou com bots e pediu 6 alterações (PROMPT-0025), implementadas e verificadas:
  1. **XP passivo:** todo player vivo ganha +1 XP/s (`XP_PER_SECOND`) em `grantXp` por tick — o mapa não "esfria" e quem foi zerado sobe só jogando. Confirmado no smoke: bot sem tiros nem engajamento chegou ao nível 2.
  2. **Morte zera o nível:** `p.level = 1` no respawn (aposenta `lossFraction` do loop — função fica exportada p/ testes/curva de balance). Risco real máximo.
  3. **Reroll dá XP:** handler `reroll` chama `grantXp(+20, REROLL_XP_REWARD)` além de redistribuir — a tecla R vira progressão ativa (pode abrir card na hora).
  4. **Zonas safe removidas:** `buildZones` não gera mais safe (verificado: 0 tiles safe num 115×105, só war/field). O primitivo `zone.kind === "safe"` fica só nos testes de combate. Sem safe, o fire-block por zona nunca dispara.
  5. **Invulnerabilidade de nascimento:** novo campo `Player.spawnProtectedUntil`; 3s (`SPAWN_PROTECTION_MS`) ao nascer/renascer; `ProjectileSystem` bloqueia dano (evento `shield_block`, novo `blockedByShield`) e a proteção **cai quando o player atira**. Bolha translúcida no cliente + contador no F3. Verificado por script: alvo protegido = 0 dano / 5 blocks; disparar zera a própria proteção; sem proteção o alvo morre normal.
  6. **Mira contínua:** cliente recalcula `aim` (player→cursor) todo tick com cursor presente, não só no `mousemove` — fim do snap para as 8 direções do movimento (causa-raiz do "tiro em ângulos fixos").
- **Verificado:** shared 13/13, server 17/17, `tsc --noEmit` limpo ×3, guarda `.js` órfão limpa, smoke com 3 bots (level-up por presença sem kill; combate ok). Docs atualizadas: SPEC-0005, ADR-014, PLAYER_LOOP/progression/world/combat, ROADMAP, QA, SESSAO_ATUAL.
- Pendente: veredito do CD no browser (checklist novo no QA.md), re-medir pacing (XP passivo × morte-zera) com bots, T-008b (perfis/boss), merge para `main`.

## 2026-07-04 — Sessão 7: SPEC-0004 implementada (T-014..T-018)
- Execução completa da spec em 5 levas commitadas separadamente (PROMPT-0020..0024): rebalance TTK (dano 20 + guarda em teste), `ATTR_DEFS` data-driven (5 atributos, cadência/alcance no `ProjectileSystem`, reroll 5-vias com fix de arredondamento), cards de level-up (fila server-authoritative, `choose_upgrade` validado, timeout auto-pick, `hud.ts` extraído, bots respondem), skills de projétil (multishot/pierce/fôlego/impulso como modificadores por player — desvio registrado da spec: skill é do jogador, não do `LauncherDef`; marcos 4/8/12 com card ★; box sorteia skill), juice de poder (aro por faixa, números de dano com escala, streak).
- **Verificado:** shared 13/13, server 17/17 (inclui guardas de balance: 5 tiros equilibrado, 3 tiros full-força, pierce exato, cooldown 750ms do perfurante), `tsc --noEmit` limpo ×3, guarda `.js` órfão limpa, smoke com bots real (level-up via card confirmado por `hp 104` no nível 2; kill+respawn ok). **TTK medido:** kills/sessão-bot 0.18 → 0.50, bots terminando com hp 20/40 — relatório em `docs/ai/balance-T014-ttk.md`.
- Aprendizado de ambiente: sessão em sandbox com rede intermitente e filesystem efêmero fora dos mounts — toolchain bootstrapado por chamada (tarball do Node em outputs); processos de fundo não sobrevivem entre chamadas; `pkill -f tsx` mata o próprio shell (usar kill por PID/porta).
- Pendente: veredito do CD no browser (checklist novo no QA.md), T-008b (perfis/boss), merge para `main`.

## 2026-07-04 — Sessão 6 (design): SPEC-0004 — escala de poder, builds e skills
- Pedido do CD: dano "aumenta devagar", difícil eliminar players; planejar sistema de skills/atributos gamificado antes de implementar.
- Diagnóstico (PROPOSAL-0001): dano não aumenta devagar — **TTK é matematicamente constante** (10 tiros em qualquer nível) porque força e vitalidade escalam na mesma taxa (+4%/pt, pontos iguais). Verificado por conta: `10×(1+0.04p)` vs `100×(1+0.04p)`.
- CD aprovou a proposta → formalizada como `specs/SPEC-0004-skills-atributos-escala.md` + ADR-013 + tasks **T-014..T-018** no BACKLOG (nova seção M1.5), adendos em T-008b (política de cards por perfil, boss) e T-OPTIONAL 1 (relatório TTK).
- Resumo: TTK alvo 5 tiros (dano base 20), `ATTR_DEFS` assimétrica (+Cadência/+Alcance, tetos por atributo), cards de level-up determinísticos (timeout 5s, sem pausa), multishot/pierce como skills de marco (nunca atributo linear), juice visual de poder, bots no mesmo pipeline com escolha determinística — player protagonista.
- Sem mudança de código nesta entrada — só design/documentação. Próximo: `Executar T-014 do docs/BACKLOG.md`.

## 2026-07-04 — Sessão 5 (cont., docs): correção de documentação desatualizada
- Pedido do CD: documentar corretamente o bugfix anterior seguindo o padrão do projeto, e relatar estado atual + próximos passos.
- Ao revisar contra `AGENTS.md`/`DOC_MAP.md`, achado: `ROADMAP.md`, `VISAO-ATUAL.md` e `mechanics/PLAYER_LOOP.md` estavam **desatualizados de várias entregas atrás** — ainda diziam "T-008 pendente" e "bots não atiram sozinhos", quando T-008 (bots de combate) e a SPEC-0003 inteira (facing/mira/gatilhos) já estavam prontas e testadas. `QA.md` também não documentava o gate `npx vitest run` do `server` (existia e já rodava nesta sessão, só não estava no checklist).
- Corrigido: `ROADMAP.md` (linha do M1 reflete SPEC-0003 completa), `VISAO-ATUAL.md` (reescrito — tabela "o que já funciona" com facing/gatilho/ganchos de mobilidade/bots de combate/anti-stuck), `PLAYER_LOOP.md` (seções Combate e Debug reescritas pro modelo mira≠gatilho e F3 sempre-on), `QA.md` (gate do server no checklist, matriz de features com as novas mecânicas, remoção da entrada obsoleta "T-008 bots atiram" da lista de "não bloqueia merge").
- Sem mudança de código nesta entrada — só documentação. Nenhum `PROMPT-NNNN` novo (mesmo padrão da sessão de docs anterior, ver DEVLOG "Sessão 3 (docs)").

## 2026-07-04 — Sessão 5 (cont.): bugfix pós-teste manual (F3, ritmo de ataque, anti-stuck)
- CD testou a SPEC-0003 completa no browser + bots e relatou 3 problemas (PROMPT-0019):
  1. **F3 sem log:** o broadcast do feed de eventos exigia `DEBUG=1` no servidor além de abrir F3 no cliente — um segundo interruptor escondido. Removida a checagem; o feed agora sempre acompanha o ring buffer/`/debug/rooms`, que já eram sempre-on. `DEBUG=1` sobra só pro `dev_launcher` (T-012).
  2. **Bot "impossível de matar":** o gatilho do bot ligava a cada tick no alcance, limitado só pelo cooldown da arma (igual humano/bot). Cada `SkillName` ganhou `fireIntervalMs: [min,max]` (`fraco` 1000–1900ms, `medio` 550–1050ms, `forte` 280–600ms); o bot sorteia o próximo intervalo a cada tiro (nunca fixo) — gate adicional ao cooldown da arma, nunca o ultrapassa.
  3. **Bot grudando em obstáculo:** o movimento de combate era linha reta sem desvio (diferente da caça a coletável, que usa BFS). Novo anti-stuck: compara posição autoritativa tick a tick; se pretende andar e quase não desloca por ~500ms, força um desvio lateral por 350–700ms. Não depende de geometria do mapa, só da posição que o servidor já resolve.
- Verificado: tsc limpo (server/bots); shared 5/5; server 4/4. Ao vivo: F3 mostrou `spawn` sem `DEBUG=1`; `npm run bots -- 3 30` — `fraco` 9 tiros vs. `medio`/`forte` 23 (antes: 200+ pra qualquer skill); `BOT_VERBOSE=1` mostrou `"preso — escapando lateralmente"` disparando várias vezes numa sessão de 6 bots, sem regressão de combate.

## 2026-07-04 — Sessão 5 (cont.): T-012 (ganchos de mobilidade) — SPEC-0003 fecha
- **T-012** (PROMPT-0018), última task da spec: `LauncherDef` ganha `movement?` opcional (`selfSlowFactor`, `selfSlowMs`, `inheritVelocityFactor`) — ausente = neutro, `basic_shot` não muda.
- `EffectSystem` ganhou o primeiro efeito de **magnitude dinâmica** (`launcher_slow`, campo `ActiveEffect.magnitude` + método `applySlow()`) — até aqui todo efeito tinha força/duração fixas em constante; agora cada lançador pode definir as suas. `inheritVelocityFactor` bende a direção do projétil somando uma fração do vetor de movimento do atirador (não muda a magnitude do tiro, só a direção).
- Lançador de teste `heavy_shot_dev` no registro `LAUNCHERS`, só selecionável via mensagem nova `dev_launcher` — e essa mensagem só funciona com `DEBUG=1` (reaproveitado o flag real que já existia, sem inventar um `DEV_MODE` novo que só existia nos docs).
- Verificado: novo `describe` determinístico em `projectiles.test.ts` (4/4 no total) prova que `heavy_shot_dev` derruba `player.speed` para o fator exato e ele volta sozinho após a duração, e que `basic_shot` não mexe em nada. `npm run test` (shared) 5/5. `npm run bots -- 3 30` sem crash. Confirmação visual da janela transiente de 700ms não foi possível no preview (ambiente processa comandos com throttling de dezenas de segundos entre chamadas) — o teste unitário é a prova mais confiável disso mesmo.
- **SPEC-0003 fecha:** T-009..T-013 todas ✅. Falta só veredito geral do CD e decisão de merge (`movimento_e_direcao` → `main`, checklist em `QA.md`).

## 2026-07-04 — Sessão 5 (cont.): T-013 (migração dos bots)
- **T-013** (PROMPT-0017): bots (`packages/bots/src/bot.ts`) migrados para `{x, z, aimX?, aimZ?, fire?}` — miram continuamente no inimigo engajado (`aimX/aimZ`, chumbo/lead + erro por skill) mesmo fora do alcance de tiro; o gatilho (`fire: true`) só liga dentro do alcance do launcher. Direção real do disparo sai do facing resolvido pelo servidor, igual ao cliente humano desde T-009/T-010.
- Fecha o efeito colateral aceito nas duas entregas anteriores: bots tinham parado de atirar (0 tiros) porque mandavam o `fx/fz` antigo, que o servidor não lê mais.
- Verificado: tsc limpo; `npm run bots -- 6 45` (skill forte) voltou a produzir tiros e pelo menos 1 morte confirmada no log do servidor (`bot-4 morreu. Respawn...`); gate padrão completo (test/tsc×3/bots smoke/guarda `.js`) limpo.
- `docs/ai/bots.md` atualizado para o protocolo novo.
- Falta só **T-012** (ganchos de mobilidade no LauncherDef) para fechar a SPEC-0003 inteira.

## 2026-07-04 — Sessão 5 (cont.): T-011 (facing visível) + bugfix crítico de build
- **T-011** (PROMPT-0016): indicador placeholder de facing ("nariz", cone amarelo — F1/ADR-003) no `THREE.Group` de todos os players (`visuals.ts`); rotação interpolada em `main.ts` com menor-caminho-angular (`shortestAngleDiff`), convenção `group.rotation.y = -dir` verificada analiticamente com a fórmula de rotação em Y do Three.js.
- **Achado durante a verificação (não era o pedido, mas bloqueava provar T-011 funcionando):** o repo tinha `.js` compilados esquecidos do lado de `.ts` em `packages/{client,shared,bots}/src/` (de uma `tsc` rodada sem `--noEmit`, commit antigo `be7cc0a`). O Vite resolve import sem extensão preferindo `.js` — ou seja, esses arquivos obsoletos **venciam silenciosamente os `.ts` reais** em qualquer import relativo (`./visuals`, `./constants`, `./map`, `./rng`, `./launchers`). Confirmado via log de rede do preview. Removidos os 9 arquivos órfãos; o `.js` shadow nunca tinha efeito documentado em nenhuma task anterior porque ninguém tinha mexido nesses arquivos desde o commit que os gerou — mas era uma bomba-relógio para qualquer edição futura em `shared/`.
- Efeito colateral bom: `npm run test` (shared) foi de "10/10" para **5/5** — eram os mesmos 5 testes de `constants.test.ts` rodando duas vezes (uma do `.ts`, uma do `.js` duplicado), não 10 testes reais. `QA.md` atualizado com o número certo e uma guarda automática (`find ... .ts` sem par `.js`) nos gates e no checklist de merge.
- Verificado: tsc limpo nos 3 pacotes após a remoção; `npm run test` 5/5; ao vivo no browser (preview) o nariz apareceu e girou corretamente com mouse e teclado; `npm run bots -- 3 10` sem crash (0 tiros, esperado até T-013).
- Próximo: T-012 (ganchos de mobilidade) e T-013 (migração dos bots) — podem seguir em qualquer ordem, ambas dependem só de T-010 (pronta).

## 2026-07-04 — Sessão 5: SPEC-0003 — T-009 (facing) + T-010 (gatilhos desacoplados)
- Nova spec aprovada (`specs/SPEC-0003-facing-mira-gatilhos.md`, CD): facing sincronizado, mira ≠ gatilho, ganchos de mobilidade por lançador. Quebrada em T-009..T-013.
- **T-009** (PROMPT-0014): `Player.dir` (ângulo, sincronizado) — híbrido resolvido no servidor: mira (`aimX/aimZ`) tem prioridade quando presente, senão segue o movimento, parado mantém o último valor (nunca zera). Cliente só manda `aimX/aimZ` no tick em que o mouse de fato se move. `docs/mechanics/movement.md` atualizado.
- **T-010** (PROMPT-0015): protocolo de input perde `fx/fz` de vez — vira `{x, z, aimX?, aimZ?, fire?}`. `ProjectileSystem` usa só `p.firing` (booleano) + `p.dir` (facing) para decidir se/para onde atira; spawn ganha offset de raio na direção do facing. Cliente mapeia gatilhos num `Set` (`fireSources`: mouse/space) — extensível a gamepad/touch sem mudar o protocolo. `docs/mechanics/combat.md` atualizado.
- Overlay F3 ganhou `facing` e `gatilho` (fontes ativas) do meu player e `dir` de todos — fecha o critério de aceite 6 já nesta entrega.
- Verificado: tsc limpo (server/client/bots); shared 10/10; `projectiles.test.ts` 2/2 (adaptado para `dir`/`firing`); ao vivo no browser — os 3 casos de facing (mira/teclado/parado) e disparo por espaço e por clique confirmados no F3 (mesma direção, mesmo `dir`).
- **Efeito colateral aceito**: bots (T-008) ainda mandam `fx/fz` — servidor ignora, então bots se movem/perseguem normalmente mas não disparam mais (0 tiros, sem crash, confirmado com `npm run bots -- 3 10`). Fica para **T-013**, que já existe na spec pra isso.
- Próximo: T-011 (facing visível/rotação no cliente) e T-012 (ganchos de mobilidade no LauncherDef) podem seguir em paralelo — T-013 fecha a lacuna dos bots.

## 2026-07-04 — Sessão 4: T-008 (bots de combate, mínimo) + análise de frameworks
- Análise pedida pelo CD antes de codar: spec-kit/dotcontext **não são ferramentas** aqui — ADR-004 os trocou por processo leve in-repo, seguido bem. Desvios: specs pararam no SPEC-0002, SESSAO_ATUAL apontava branch defasada, edição não commitada em BACKLOG. Registrado em PROMPT-0013.
- Base arrumada: T-008 dividido em T-008 (mínimo) + **T-008b** (personalidade/atributos/boss); `bots.md` e SESSAO_ATUAL atualizados.
- Bots de combate em `packages/bots/src/bot.ts`: perfis de skill `fraco|medio|forte` (`BOT_SKILL` ou sorteio), mira com **lead**, fuga a HP baixo, e — causa-raiz corrigida — **ignoram alvos em zona safe** (antes congelavam dentro da safe do spawn, 0 tiros). `forte` = caçador pelo mapa todo.
- Verificado: tsc limpo (server/client/bots); shared 10/10; **novo teste `projectiles.test.ts` 2/2** (cadeia tiro→dano→morte→kill + bloqueio em safe); corrida ao vivo de 6 bots forte com `DEBUG=1` → **18 hits, 1 kill, 1 death** confirmados no ring buffer. Kills raros em janela curta por causa da fuga a 25% HP (ajuste fica p/ passe de balance).
- Próximo: veredito do CD no navegador; depois T-008b.

## 2026-07-04 — Sessão 3 (docs): continuidade entre sessões e modelos
- Evoluída a documentação para memória institucional: `DOC_MAP.md` (quando ler o quê), `SESSAO_ATUAL.md` (ponteiro substituído a cada sessão), `VISAO-ATUAL.md` (snapshot estável do marco), `mechanics/PLAYER_LOOP.md` (FAQ gameplay com números), `QA.md` (matriz automático vs manual + checklist merge).
- Decisão de arquitetura doc: **dois arquivos** — VISAO (fase/milestone, muda pouco) + SESSAO (fio imediato, muda sempre). Conflito: SESSAO vence para próximo passo; código vence para comportamento.
- Atualizados `AGENTS.md`, `instrucoes/COMO_CONTINUAR.md`, `REGRAS_DE_PROMPT.md` (veredito CD no template PROMPT).

## 2026-07-04 — Sessão 3 (bugfix pós-teste): respawn e hitbox
- Relato do CD após teste manual: depois de matar outro player, houve dúvida se o respawn era aleatório/seguro e o tiro pareceu não acertar novamente após o respawn.
- Diagnóstico: respawn era sorteado entre spawns safe, sem avaliar distância de outros players; além disso, dano em safe zone era bloqueado silenciosamente, parecendo falha de hitbox. A colisão do projétil também testava só a posição final do tick.
- Correções: respawn agora escolhe o spawn com melhor distância/risco, zera input/tiro ao renascer, projétil usa colisão por segmento contra o player, tiro bloqueado por safe zone consome o projétil e emite evento `safe_block`, e vitalidade agora recalcula `maxHp`.
- Verificado: typecheck limpo em server/client/bots e 10/10 testes do shared.

## 2026-07-04 — Sessão 3 (retomada): T-007
- Modo debug dinâmico fechado para teste: overlay F3 com snapshot vivo de sala/player/todos os players, feed de eventos, botão de fechar e histórico local.
- Servidor expõe `/debug/rooms` com salas ativas, mapa, budget, projéteis e ring buffer dos últimos eventos; eventos `spawn`, `pickup`, `hit`, `death` e `disconnect` entram no buffer e só são enviados por WebSocket com `DEBUG=1`.
- Bots ganharam `BOT_VERBOSE=1` para logar decisão de alvo/caminho e consomem `debug_event` sem poluir o terminal quando `DEBUG=1`.
- Verificado: typecheck limpo em server/client/bots e 10/10 testes do shared. Próximo: T-008 (Bots de combate).

## 2026-07-04 — Sessão 3 (cont.): T-006
- Morte, respawn e perda de nível.
- ProjectileSystem agora retorna as mortes confirmadas para o `ArenaRoom`.
- Vítimas perdem nível usando curva logarítmica (protege iniciantes) e respawnam num random `spawnPoints`. Seus status são resetados via nova função `resetAttrToLevel` no EffectSystem.
- Assassinos ganham XP (`XP_PER_KILL_PER_LEVEL * victim.level`).
- Kills e deaths agora são gravadas nas métricas (`SessionMetrics`).
- Próximo: T-007 (Modo debug dinâmico).

## 2026-07-04 — Sessão 3 (cont.): T-005
- Lançadores v1: tiro reto.
- Adicionado input via mouse (raycaster) e state handling (hp, maxHp) no client e server.
- ProjectileSystem implantado no servidor validando cooldown, fire ranges e colisões de projétil (com map bounds, walls, props e jogadores). Zonas safe proíbem tiro e bloqueiam dano.
- Hud exibe HP atual.

## 2026-07-04 — Sessão 3 (cont.): T-004b
- Scaffold de progressão persistente (ADR-012) implementado: `playerToken` salvo no localStorage e enviado no join.
- Servidor mapeia token num `memDB` indexado mantendo `PersistentProgress` (força, velocidade, vitalidade) que é atualizado na coleta da box.
- Verificado: tsc limpo, localStorage funciona, progresso persiste no servidor. Detalhe em PROMPT-0008.md.
- Próximo: T-005 (Lançadores v1: tiro reto).

## 2026-07-04 — Sessão 3 (cont.): T-004
- Coletáveis expandidos: xp_orb, speed_up, coin_buff (campo), farm_event/box (só zona de guerra, já raros de graça pelo tamanho da zona). Zona safe ganhou supressão de spawn própria.
- farm_event reusa EffectSystem (`xp_boost`); box dá bônus de atributo 3× maior; coins compram reroll da distribuição de atributos.
- Métricas passam a registrar pickups por kind.
- Verificado: testes 5/5, tsc limpo, 4 bots mostraram os 4 kinds de campo/guerra nas métricas (incl. 1 farm_event). Detalhe em PROMPT-0007.md.
- Aprendizado: dois `tsx watch` concorrentes brigando pela porta 2567 travaram o servidor em loop de crash — sempre `pgrep -af "src/index.ts"` antes de investigar erro de conexão.

## 2026-07-04 — Sessão 3 (cont.): T-003
- XP/nível via curva (`xpToNext`), atributos força/velocidade/vitalidade como segunda camada do EffectSystem existente (mesmo `recompute()`, preset equilibrado: 1 ponto em cada por nível, +4%/ponto).
- Primeiro teste unitário do projeto (vitest, `constants.test.ts`) — dívida registrada em LEAD_DESIGNER_NOTES começou a ser paga.
- Verificado: `npm run test` 3/3, tsc limpo, bots mostram nível subindo pela curva e atributo de velocidade refletido em `speed` independente do speed_up temporário. Detalhe em PROMPT-0006.md.
- Próximo: T-004 (coletáveis expandidos).

## 2026-07-04 — Sessão 3 (cont.): T-002
- Props ganharam pré-modelos F2 (pedra/árvore/caixa/muro/bandeira) compostos de primitivas em `visuals.ts`. Técnica: 1 InstancedMesh por parte-tipo (não por instância) — mantém draw calls baixos mesmo com composição.
- Verificado via preview (screenshot): zona safe pintada + pedra/caixa/muro distintos; bots sem regressão. Detalhe em PROMPT-0005.md.
- Próximo: T-003 (XP/nível/atributos).

## 2026-07-04 — Sessão 3: T-001 (backlog)
- Pivô ADR-010 executado: labirinto (pilares em coord. pares) → campo aberto. Só borda colide; props (~4%, pedra/árvore/caixa/muro) nascem isolados uns dos outros — garante 0 regiões fechadas sem precisar de checagem de conectividade em runtime.
- Zonas safe/guerra/campo derivam do seed (`zoneAt`), cliente pinta o chão sem tráfego extra na rede.
- Verificado: 4 seeds sem tile fechado (flood fill 100%), 0 props perto de spawn, densidade exata; bots BFS seguem coletando (níveis 2→5 em 15s); tsc limpo. Detalhe em `docs/prompts/PROMPT-0004.md`.
- Próximo: T-002 (pré-modelos visuais dos props).

## 2026-07-04 — Sessão 2: M0.5 (SPEC-0002)
- Mapa dinâmico 75×65 mín. (ADR-007), gerado por seed sincronizado; câmera follow + fog + grid ("indo longe").
- EffectSystem (ADR-009): coletável speed_up ×1.5/8s com teto 2×; arquitetura pronta p/ skills.
- Sinalização de inimigos (anéis) + roster HUD; visuals.ts com fases (ADR-008); pasta instrucoes/; log de prompts (docs/prompts/).
- Bots ganharam BFS — no mapa grande, sem pathfinding = 0 coletas; com BFS = 3.7 coletas/bot em 15s. ✅ verificado headless.
- Aprendizado sandbox: processos de fundo persistem entre execuções (porta 2567 fantasma) — usar PORT alternativa p/ testes.

## 2026-07-04 — Sessão 1: fundação
- Framework do estúdio criado (AGENTS.md, constituição, ADRs 001–006, roadmap, specs, notas CD/IA).
- Monorepo TS: `shared` (mapa, constantes, protocolo), `server` (Colyseus, tick 20Hz, autoritativo), `client` (Three.js top-down, HUD ping/nível), `bots` (headless).
- M0: arena 15×13 com pilares estilo Bomberman, movimento com colisão no servidor, coletáveis spawnam longe de jogadores (ADR-006), coleta sobe nível, métricas de sessão em `packages/server/logs/sessions.jsonl`.
- Verificação ✅: 3 bots headless em 1 sala por 12s — movimento ok (~26u de distância média), coletas ok (bot-1 chegou ao nível 4), `sessions.jsonl` gravado, `/metrics/summary` agregando. Cliente compila em 145KB gzip.

**Aberto:** combate (M1), regra final de perda de nível, controle touch.
