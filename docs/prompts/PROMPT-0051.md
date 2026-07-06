# PROMPT-0051 — Personagens procedurais V2 (evolui T-053/T-054, SPEC-0014) · 2026-07-06

## Pedido (resumo fiel)

Pedido direto do CD (fora da numeração do BACKLOG): evoluir o sistema de personagens
procedurais para uma **V2** com qualidade de arte de jogo mobile low-poly top-down (Kingshot /
Archero / Whiteout Survival), **100% por código Three.js**, sem NENHUM asset externo (GLTF/FBX/
OBJ/Blender/textura). Silhueta imediatamente reconhecível como arqueiro; melhorar silhueta,
proporções, leitura, animações e modularidade **sem aumentar significativamente o custo**. Deve
rodar com **centenas de players**: compartilhar TODAS as geometrias e materiais, nada por
instância, nada por frame. Esqueleto de **pivôs** (hip/chest/head/ombros/cotovelos/pernas/
joelhos/arco), formas facetadas via BufferGeometry, arco por curva+TubeGeometry, corda em Line,
flecha separada, detalhes de silhueta (capuz, barba, cinto, aljava, botas, nariz). Animações:
idle, walk, shoot, hit, death, spawn. API pública estável: `createCharacterVisual`,
`updateCharacterAnimation`, `triggerCharacterShoot`.

## Decisões tomadas (e por quem)

- **IA — como conciliar "detalhe rico" + "centenas de players" (a tensão central):** dezenas de
  malhas soltas por personagem × centenas de players = milhares de draw calls (estoura o
  orçamento < 200 do AGENTS.md e o "leve sempre"). Solução profissional adotada: **cada segmento
  animável é UMA malha cuja geometria é o MERGE de várias sub-formas facetadas com COR POR
  VÉRTICE** (couro/pele/cabelo/madeira/metal). Assim todo o detalhe de silhueta (gola, cinto,
  aljava, flechas, nariz, barba) não custa draw call extra, e **um único material flat** colore o
  boneco inteiro. Resultado medido: **13 draw calls por personagem** (12 malhas + 1 Line da
  corda), contra 8 na V1 — aumento pequeno pra um salto grande de qualidade.
- **IA — singletons de verdade:** geometrias de segmento são construídas **uma vez por
  classe:skin** (cor embutida no atributo `color`) e cacheadas (`segCache`); o material flat é
  **um só, global** (`vertexColors`). Cada instância só cria Groups (pivôs) + Mesh leves
  apontando pros mesmos buffers. Verificado headless: 2 instâncias → **1 material, 8 geometrias
  compartilhadas** (thigh/shin/upperArm/foreArm reusados L/R e entre instâncias). Zero alocação
  por frame na animação (só escreve rotações/posições).
- **IA — geometria facetada sem hand-rolling de winding:** usei primitivas do Three como blocos
  (CylinderGeometry de 6 lados = tronco/cabeça hexagonais com peito largo/cintura fina e queixo
  afunilado; CylinderGeometry de 4 lados = "caixas" trapezoidais dos membros com normais
  corretas; ConeGeometry = capuz pontudo/nariz; **CatmullRomCurve3 + TubeGeometry** = arco
  curvo, substituindo o TorusGeometry da V1) e fundi tudo com cor por vértice. Evita bugs de
  normal/winding (risco alto num ambiente sem preview visível) e mantém "faceted / low-poly /
  flat".
- **IA — esqueleto de pivôs:** hierarquia exatamente como pedida (hip → chest → head/ombros;
  ombro → cotovelo; perna → joelho; arco na mão esquerda com corda[Line] + flecha). Pivôs são
  Groups vazios só pra animar; malhas penduram sob eles. Animação por rotação de pivô (não mais
  `mesh.rotation` de peça solta).
- **IA — animações:** idle (respiração no quadril + micro-bob da cabeça + estabilização), walk
  (passada com joelho dobrando, quadril oscila, ombros compensam, cabeça estabiliza, braços em
  contra-fase), shoot (esq. estende o arco, dir. puxa a corda com cotovelo, tronco gira, cabeça
  mira, arco flexiona, flecha recua e dispara), hit (recuo curto + inclinação do tronco), death
  (tomba + encolhe + some), spawn (mantido pelo scale-in da T-045 no grupo externo, sem brigar).
- **IA — gatilhos hit/death (limitação real):** confirmado na T-054 que **morte no servidor é
  respawn imediato** (cliente nunca vê `hp<=0`) e que os eventos de combate são **dev-only**
  (`debug_event`). Implementei `triggerCharacterHit`/`triggerCharacterDeath` como capacidades
  reais e liguei no evento de hit/death do `main.ts`; em produção o hit/death mal aparecem (o
  materialize do respawn assume). Documentado, não "escondido".
- **IA — API preservada + micro-otimização:** `createCharacterVisual`/`triggerCharacterShoot`
  intactos. `updateCharacterAnimation` trocou o objeto de opções por **args posicionais**
  (`t, moveSpeed, nowMs`) pra eliminar a alocação de um objeto por player por frame (honra
  "nenhuma alocação por frame"); ajustei a chamada no `main.ts`.
- **Fora de escopo:** skins por paleta alternativa (T-056 — o cache já é por `classId:skinId`,
  gancho pronto); ligar `classId`/`skinId` da rede (T-059). Não toquei schema/rede/servidor/bots.

## Resultado verificado

- `packages/client/src/characters.ts`: reescrito para V2 (paleta por skin, merge com cor por
  vértice, builders `buildTorso/buildHead/buildUpperArm/buildForeArm/buildThigh/buildShin/
  buildBow/buildArrow`, esqueleto de pivôs, animação por pivô + triggers shoot/hit/death).
- `packages/client/src/main.ts` (só as minhas linhas): import dos novos triggers; chamada
  posicional de `updateCharacterAnimation`; `triggerCharacterHit` no evento de hit;
  `triggerCharacterDeath` no evento de death.
- **Gates:** `tsc --noEmit` limpo em `client` e `server`; `vite build` OK; `npm run test`
  (shared) 38/38; smoke `dev:server` + `npm run bots -- 5 12` — 5 bots entram/saem limpos, sem
  erro de gameplay (só toquei client).
- **Verificação headless da animação/estrutura (sem WebGL — matemática de objeto): 24/25 asserts
  PASS** (a 1 "falha" era artefato do teste — colisão de nome pivô/malha "head", corrigida
  renomeando a malha pra `headMesh`; a partilha de material foi então confirmada num teste à
  parte: 24 malhas → 1 material). Cobre: estrutura de pivôs completa, **13 draw calls/char**,
  singletons (1 material / 8 geometrias entre 2 instâncias), cor por vértice, e os 6 estados
  (idle/walk/shoot/hit/death + no-op seguro sem rig).

## Limitação de verificação

Igual às sessões T-053/T-054: o harness de preview roda a janela **oculta** (`document.hidden`,
`requestAnimationFrame` pausado) — o WebGL não pinta e o boneco só é construído dentro do loop
rAF, então **screenshot pro CD não é possível aqui**. A geometria/animação, porém, é matemática
de objeto (sem GL) e foi provada em runtime pelo teste headless. Captura visual pede sessão GPU
visível (`dev:server` + `dev:client` + `npm run bots -- 8 60` localmente).

## Regras que nascem daqui

- Personagem = **esqueleto de pivôs (Groups) + 1 malha vertex-color por segmento animável**;
  detalhe de silhueta entra como sub-forma no merge do segmento (0 draw call extra), nunca como
  malha solta. Geometria por `classId:skin` (cacheada), material flat global único.
- Substituir primitiva por primitiva NÃO é o objetivo — o objetivo é **silhueta legível a custo
  fixo**. Novas peças/detalhes vão no merge do segmento correspondente.
- Próximo salto de escala real (centenas com 1 draw call/char) = migrar pra **SkinnedMesh**
  (mesmos pivôs viram bones, geometria mergeada ganha skinIndex/weight rígido) ou InstancedMesh —
  registrado como caminho futuro; a estrutura atual já está desenhada pra isso.
