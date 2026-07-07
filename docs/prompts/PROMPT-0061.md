# PROMPT-0061 — Arqueiro: corrigir "pegada" do arco + animação de disparo (evolui PROMPT-0051) · 2026-07-07

## Pedido (resumo fiel)

Pedido direto do CD (fora da numeração do BACKLOG), em cima do resultado da PROMPT-0051: a V2 do
arqueiro melhorou, mas **o arco e o personagem não têm "aquela pegada de arqueiro"** e **a
animação de disparo não ficou muito legal**. Pedido pra analisar e melhorar especificamente o
arqueiro (silhueta/pose + animação), sem reabrir o resto do sistema.

## Diagnóstico (antes de mexer)

Simulação headless da hierarquia de pivôs (sem WebGL, só matriz/quaternion) mostrou a causa raiz:
o arco é filho do cotovelo esquerdo (`elL`) e **herda a rotação do braço inteiro**. Medido: o arco
ficava a **20° da vertical em repouso e ~72° (quase deitado) no disparo full-pull** — ou seja,
girava junto com o braço até quase deitar, em vez de continuar ereto como um arco de verdade
seguraria. Esse é o motivo mais provável de "não parecer pegada de arqueiro": visualmente o arco
vira uma "vareta caída" ao mirar. Pose de repouso também tinha os braços quase caídos ao lado do
corpo (`shL.z=0.15`), então a silhueta do arco mal aparecia — pouco reconhecível como arqueiro
parado, ao contrário da referência (Archero/Kingshot, onde o herói nunca larga a arma).

## Decisões tomadas (e por quem)

- **IA — contra-rotação do arco (fix estrutural):** a cada frame, `bow.rotation.z =
  -(shL.rotation.z + elL.rotation.z) + BOW_TILT_Z`. Cancela a rotação acumulada do
  ombro+cotovelo antes de aplicar uma inclinação fixa pequena (`BOW_TILT_Z = 0.1` rad), então o
  arco fica **sempre ereto** (mesma inclinação mundo, ~5.7°) em qualquer pose — parado, andando
  ou disparando. Verificado por simulação headless (`THREE.Group` só de matrizes): tilt do arco
  idêntico (5.7°) em idle, nos dois extremos da passada e em pull 0/0.5/1.0 do disparo. Também
  setado uma vez na criação (`createCharacterVisual`) pra não ter 1 frame com a orientação padrão
  antes do primeiro tick de animação.
- **IA — pose de repouso "pronto pra atirar":** braço do arco já levantado (`REST_SH_L=0.95`,
  antes `0.15`) com o arco visível à frente do peito; mão da corda já perto da corda
  (`REST_SH_R=0.55`, `REST_EL_R=0.75`), não fully-drawn mas nitidamente "arqueiro com arma na
  mão", igual às referências. Usada tanto no rig inicial quanto na base do idle/walk.
- **IA — balanço de caminhada reduzido:** antes os braços faziam um balanço livre completo
  (±0.35 rad) como quem anda sem nada nas mãos; trocado por um balanço pequeno (±0.1 rad) por
  cima da pose "pronto" — o arco continua visível/levantado andando, só ganha um bounce sutil.
- **IA — disparo mira no ponto de ancoragem (perto da bochecha):** braço da corda agora interpola
  de `REST_SH_R/REST_EL_R` até `1.15`/`1.85` conforme `pull`. Medido: mão da corda termina a
  **0.29 de distância da cabeça** (praticamente na mesma altura, Y=0.946 vs cabeça Y=0.940) no
  pull máximo — o clássico "puxar até a bochecha/orelha" de arqueiro — contra 0.29→"mão solta
  longe da cabeça" (~0.64 de distância) na versão anterior.
- **IA — corda com tensão real:** a corda deixou de ser uma `BufferGeometry` **singleton global**
  (mesmo buffer pra todos os personagens, sempre "esticada" na mesma forma parada) e passou a ser
  **por instância** (`buildStringGeo()`, 3 vértices) — única exceção deliberada à regra de
  "compartilhar tudo": o ponto central da corda precisa se mover por instância durante o puxar, o
  que um singleton compartilhado impediria (moveria a corda de todo mundo ao mesmo tempo).
  Custo: 3 vértices × centenas de players = desprezível; **zero draw call novo** (já era 1
  `Line` por personagem). O ponto central acompanha `arrow.position.x` (mesmo valor que já regia
  o recuo da flecha), então corda e flecha recuam juntas de forma consistente. Update só escreve
  no buffer quando o valor muda (guarda de igualdade) pra não subir GPU buffer todo frame à toa
  quando o personagem está parado.
- **IA — arco ganha grip + encoches:** `buildBow` ganhou um grip escuro no centro (onde a mão
  segura) e duas encoches nas pontas (onde a corda prende), mergeados na mesma geometria (0 draw
  call extra) — reforça a leitura de "isso é um arco", não um graveto curvo genérico. Curva do
  tubo original mantida intacta (risco baixo; não mexi na forma que já funcionava).
- **IA — cant lateral fixo do arco:** `bow.rotation.x = BOW_CANT_X` (0.14 rad), estático, só
  estético — dá uma leve inclinação 3D pro arco em vez de ficar perfeitamente "de cutelo" pra
  câmera elevada do jogo (câmera a ~45° da vertical, não é top-down puro).
- **Fora de escopo:** não toquei a forma do corpo (torso/cabeça/pernas — já estava "melhorou",
  segundo o CD), não toquei rede/servidor/schema, não toquei outras classes.

## Resultado verificado

- `packages/client/src/characters.ts`: `buildBow` (grip + encoches), corda por instância
  (`buildStringGeo` substitui o singleton `getStringGeo`), `Rig.string` novo campo, cant fixo do
  arco na criação, pose de repouso nova (`REST_SH_L/EL_L/SH_R/EL_R`), balanço de caminhada
  reduzido, disparo mirando o ponto de ancoragem, contra-rotação do arco (idle/walk/shoot) e
  tensão real da corda.
- **Gates:** `tsc --noEmit` limpo em `client`; `vite build` OK (mesmo tamanho de bundle, sem novas
  dependências). Não toquei `server`/`bots`/`shared` — confirmado que `characters.ts` não é
  importado por nenhum deles (é client-only, renderização Three.js).
- **Verificação headless (sem WebGL, matemática de objeto):**
  - Tilt do arco constante (~5.7°) em idle, nos dois extremos da passada (gait=±1) e em
    pull=0/0.5/1.0 do disparo — confirma o fix da contra-rotação.
  - Distância mão-da-corda→cabeça cai de 0.475 (repouso) pra 0.290 (pull máximo), com a altura Y
    da mão convergindo pra quase a mesma altura da cabeça — confirma o ponto de ancoragem.
  - Draw calls inalterados: **13/personagem** (12 meshes + 1 Line), 8 geometrias de segmento e 1
    material compartilhados entre 2 instâncias (checado programaticamente). Corda confirmada
    **não-compartilhada** entre instâncias (por design) e mutável numa instância sem afetar outra.

## Limitação de verificação

Mesma limitação das sessões T-053/T-054/PROMPT-0051: o preview roda com a janela oculta
(`document.hidden`, rAF pausado), então screenshot real não é possível neste ambiente. A validação
foi feita por matemática de objeto (posições/rotações mundiais via `THREE.Object3D.getWorldPosition/
getWorldQuaternion`, sem GL) e por inspeção programática da árvore de cena (contagem de draw
calls, compartilhamento de geometria/material). Captura visual real pede sessão com GPU visível
(`dev:server` + `dev:client` + observar um bot arqueiro atirando).

## Regras que nascem daqui

- Qualquer peça pendurada num pivô que **precisa manter uma orientação absoluta própria** (ex.:
  um arco que deve ficar ereto) tem que **contra-girar** a soma das rotações dos pivôs pais na
  mesma trava de eixo, todo frame — não dá pra confiar que "pendurar do jeito certo uma vez" vai
  se manter certo conforme o braço anima.
- "Compartilhar tudo" (regra de PROMPT-0051) vale pra geometria/material que não muda de forma
  por instância. Quando uma peça precisa de estado visual mutável por instância (corda com
  tensão), uma geometria pequena e por instância é uma exceção aceitável — desde que o tamanho
  seja trivial (aqui, 3 vértices) e não crie draw call novo.
