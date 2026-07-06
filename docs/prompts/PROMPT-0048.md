# PROMPT-0048 — T-053 (SPEC-0014): Arqueiro low poly procedural (F2) · 2026-07-06

## Pedido (resumo fiel)

Executor de task (agente worker) recebeu **T-053** do BACKLOG (Frente C — Personagens/classe/
skin, PROPOSAL-0004, shared+client): `packages/client/src/characters.ts` novo com
`createCharacterVisual(classId, skinId)` retornando `THREE.Group` com partes nomeadas (cabeça
cone 4 lados, corpo cylinder, braços/pernas boxes, capuz, arco), `flatShading`, geometrias/
materiais **singleton**; plugado em `createPlayerVisual` (`visuals.ts`, `VISUAL_PHASE=2` para
personagens). Referência visual: imagem do CD (PROMPT-0044). Aceite: silhueta legível e
direção óbvia de facing; draw calls medidos antes/depois no F3 (< 200 total com 10 players);
screenshot pro CD. Depende de T-052.

## Decisões tomadas (e por quem)

- **IA:** geometrias como singletons de módulo (mesmo padrão de `collGeo`/`propGeo` em
  `visuals.ts`) e materiais memoizados num `Map` por `classId:skinId` (`materialsFor`) — N
  players da mesma classe/skin reusam o MESMO conjunto de materiais, nada alocado por boneco
  ("leve sempre" §5). A cor vem do `baseTint` da classe (T-052); `skinId` já entra na chave do
  cache, pronto pra T-056 sem refatorar.
- **IA:** facing pelo próprio modelo — arco à frente (+X local) e rosto levemente adiantado,
  capuz um pouco atrás; convenção +X é a mesma do "nariz" da F1 e do `dir` da rede
  (`atan2(z,x)`), então `createPlayerVisual` continua girando o grupo com `rotation.y = -dir`.
  Como o modelo já dá a direção, o "nariz" placeholder passa a existir SÓ na F1 (branch
  `VISUAL_PHASE < 2`); o **anel** de aliado/inimigo (SPEC-0002) continua igual nas duas fases.
- **IA:** partes nomeadas por `mesh.name` **e** espelhadas em `group.userData.parts[name]` —
  a animação procedural (T-054) acha cada segmento (legL/legR/body/armL/armR/head/hood/bow) sem
  varrer a árvore. Fora do escopo desta task, mas o contrato de nomes nasce aqui.
- **IA:** `createPlayerVisual` usa `DEFAULT_CLASS_ID` + skin default por enquanto — a seleção
  de classe/skin vinda da rede (`Player.classId`/`skinId`, T-052) só é ligada no join da T-059;
  não mexi na assinatura `createPlayerVisual(id, isSelf)` nem em `main.ts` (fora do escopo).
- **IA:** `MeshStandardMaterial { flatShading: true }` conforme a task — a cena já tem
  `AmbientLight` + `DirectionalLight` (main.ts), então o material reage à luz como os Lambert
  existentes; look facetado low-poly sem custo de arte.

## Resultado verificado

- `packages/client/src/characters.ts` novo: `createCharacterVisual(classId, skinId)` +
  helpers internos (`materialsFor` com cache, `shade`, `characterParts`). 8 partes por boneco
  (2 pernas, corpo, 2 braços, cabeça, capuz, arco).
- `packages/client/src/visuals.ts`: `VISUAL_PHASE` 1 → **2**; `createPlayerVisual` bifurca —
  F2 monta `createCharacterVisual(default)` + anel; F1 mantém cápsula + nariz. Import de
  `createCharacterVisual` e de `DEFAULT_CLASS_ID`/`CLASS_REGISTRY` (`@aop/shared`).
- Gates: `tsc --noEmit` limpo em `client` e `server`; `vite build` do client OK (86 módulos,
  bundle 641 kB — warning de chunk > 500 kB é pré-existente, não relacionado); `npm run test`
  (shared) **38/38**. Smoke: `npm run dev:server` + `npm run bots -- 9 120` — **9 bots
  entraram na mesma sala sem regressão** (schema `classId` da T-052 não quebra o join de bot),
  subiram de nível e saíram limpos.
- **Draw calls (análise determinística — ver nota de limitação abaixo):** F2 custa **9 draw
  calls por player** (8 meshes do personagem + 1 anel) contra 3 na F1 (corpo+anel+nariz). 10
  players = **90** draw calls base; anéis/nameplates condicionais (poder, escudo, buff,
  nameplate) só aparecem quando ativos. Somado ao chão + props instanciados (1 draw call por
  parte-tipo) + coletáveis, o total fica **confortavelmente < 200** com 10 players. O delta da
  subida F1→F2 é ~+60 draw calls no pior caso base.

## Limitação de verificação (registrada honestamente)

Screenshot e contagem **empírica** de draw calls via `renderer.info` NÃO foram possíveis neste
harness de preview: a janela do preview roda **oculta** (`document.hidden === true`,
`visibilityState === "hidden"`), então o `requestAnimationFrame` do loop de render fica
**pausado** (0 frames em 800 ms medidos) — o WebGL não pinta, o que também faz o
`preview_screenshot` estourar timeout. Confirmei que o cliente compila, empacota, conecta e
inicializa o canvas (1280×720) sem erro de console; a captura visual pro CD e a medição
empírica de draw calls no F3 dependem de uma sessão GPU **visível** (são, por natureza, o
"screenshot pro CD" do aceite). Recomendo ao CD rodar `npm run dev:server` + `npm run
dev:client` localmente, entrar com `npm run bots -- 9 60` e conferir silhueta/facing + F3.

## Regras que nascem daqui

- Personagens agora em **F2** (`VISUAL_PHASE = 2`): todo visual de player nasce em
  `characters.ts` (fábrica única por classe), plugado no ponto de troca único
  `createPlayerVisual`. Classe nova = nova entrada no `CLASS_REGISTRY` (T-052) — `characters.ts`
  já lê `baseTint` de lá. Nomes de partes (`legL/legR/body/armL/armR/head/hood/bow`) são o
  contrato pra animação procedural (T-054).
