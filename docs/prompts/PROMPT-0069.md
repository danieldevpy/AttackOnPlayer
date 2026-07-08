# PROMPT-0069 — T-068: Cliente: visual da zona (anel + chão de fora) (SPEC-0016)

**Pedido:** "Executar T-068" — executar a task do `docs/BACKLOG.md` respeitando escopo
rigoroso (agente worker, execução automatizada via skill `attackonplayer-executor`).

## Contexto lido (via ACI antes de abrir arquivos inteiros)

- `npm run aci -- search T-068` → `docs/BACKLOG.md:237`.
- `docs/BACKLOG.md` (T-068, T-066, T-067 — dependências) + `specs/SPEC-0016-eventos-e-modos-
  de-jogo.md` §Notas da IA (l.181–191: abordagem do furo circular, anel por scale) e
  §Comportamento esperado (l.89–137: zona encolhe linear, dano ignora safe/escudo/protection).
- `packages/server/src/state/ArenaState.ts` (`ActiveEvent`: `id`, `phase`, `phaseEndsAt`,
  `zoneX/zoneZ/zoneRadius` — schema já existente da T-065, sem mudança aqui).
- `packages/client/src/events.ts` (T-067 — padrão de módulo dirigido por `state.event`,
  countdown derivado de `phaseEndsAt`, nunca timer próprio).
- `packages/client/src/visuals.ts` (padrões de mesh/material singleton por módulo, aros
  existentes — `updatePowerVisual`/`updateShieldVisual`/`updateBuffCooldownRing` — mesma
  técnica de "criar uma vez, só mutar opacity/scale por frame").
- `packages/client/src/main.ts` (T-045 `spawnFadeEl`/`triggerSpawnFade` — padrão de overlay
  DOM full-screen reaproveitado para a vinheta; `followCamera`/ADR-015 — câmera nunca gira,
  usada pra derivar o ângulo da seta sem estado de câmera extra).

## Entregue

- **`packages/client/src/visuals.ts`**: `createZoneRingMesh()` (torus raio unitário, y≈0.05,
  `MeshBasicMaterial` vermelho `DoubleSide`, começa invisível/opacity 0 — o raio real vem do
  `scale` aplicado em main.ts, sem realocar geometria por frame); `createZoneDarkMesh()`
  (mesh com geometria placeholder vazia, y≈0.03, só ganha forma no 1º evento);
  `buildZoneDarkGeometry(mapW, mapH, cx, cz, radius)` — `THREE.Shape` do retângulo do mapa
  inteiro com `Path.absarc` como furo, `ShapeGeometry` triangulada; em vez de rotacionar o
  mesh (fácil de errar sinal), os vértices são remapeados diretamente (Y do shape vira Z do
  mundo) e o material usa `DoubleSide` — a normal resultante não importa pro efeito puramente
  visual/transparente.
- **`packages/client/src/main.ts`**: `zoneRing`/`zoneDark` criados uma vez e adicionados à
  cena perto do `vfx`/`audio` (custo zero enquanto invisíveis); `mapDims` guardado em
  `buildWorld` (bounds reais do mapa pro chão escurecido); `updateZoneVisual(now)` — chamado
  no loop logo após `updateEvents` — lê `state.event` e:
  - mostra em `warning`/`active`, desmonta em `idle`/`ending` com fade ≤500ms (`ZONE_FADE_MS`,
    o mesmo temporizador cobre entrada e saída, dirigido por timestamp, zero tween lib);
  - anel: posição = `zoneX/zoneZ`, `scale.setScalar(radius)` a cada frame (a task pede
    explicitamente "sem realocar geometria");
  - chão escurecido: só regenera a geometria (`buildZoneDarkGeometry` + dispose da anterior)
    quando o raio muda mais que `ZONE_REDRAW_EPS` (0.5 tile) — não todo frame;
  - **vinheta vermelha** (`getZoneVignetteEl`, reuso literal do padrão `spawnFadeEl` da T-045):
    liga só quando o PRÓPRIO player (`state.players.get(mySessionId)`) está fora do raio E a
    fase é `active` (dano de zona só existe nessa fase — vinheta é feedback, o dano de
    verdade é do servidor, checagem local só de distância);
  - **seta de direção** (`getZoneArrowEl`, CSS border-triangle rotacionado): aparece quando o
    player está fora e "longe" (`dist > radius * 1.5`) durante `warning`/`active`; ângulo
    derivado de `atan2(-dx, dz)` explorando que a câmera nunca gira (ADR-015/`followCamera`:
    +X mundo = direita na tela, -Z mundo = "cima" na tela), sem precisar de nenhum estado de
    câmera adicional.

## Decisões

- **Chão escurecido via remapeamento de vértices, não rotação do mesh:** rotacionar um
  `ShapeGeometry` em -90°/+90° sobre X é fácil de errar o sinal (testado à mão via matriz de
  rotação antes de escrever o código); trocar Y↔Z direto nos vértices e comprar a ambiguidade
  de normal com `DoubleSide` é mais simples de raciocinar sobre e evita esse risco.
- **`ZONE_REDRAW_EPS = 0.5` tile** (valor exato sugerido pela spec/§Notas da IA) — único ponto
  de regeneração de geometria por frame; o resto (posição do anel, opacidade, vinheta, seta)
  é só mutação de propriedades existentes.
- **Vinheta só em `active`, seta em `warning`+`active`:** a spec só define dano (e portanto
  "estar fora é perigoso") na fase `active`; durante o `warning` o jogador só precisa SABER
  pra onde ir (seta), não sentir penalidade (sem dano ainda).
- **DOM em vez de sprite 3D pra vinheta/seta:** mesmo padrão já usado pelo fade de morte
  (T-045) e pelos overlays de evento (T-067) — mais barato, não conta como draw call de cena.
- **Sem novo arquivo:** toda a lógica ficou nos três arquivos que a task já apontava
  (`main`, `events` não precisou mudar — a zona não depende de fase de evento genérica além
  de ler `state.event` direto —, `visuals`); `events.ts` ficou intocado porque a orquestração
  da zona precisa de `scene`/`mapDims`/`mySessionId`, que só existem em `main.ts`.

## Gates

- `tsc --noEmit` em `packages/{client,server,bots}` — limpo (server/bots não tocados).
- `vite build` (`packages/client`) — OK, sem warning novo além do chunk >500kB pré-existente.
- Testes: shared 49/49, server 129/129, bots 35/35 (nenhum editado — T-068 é client-only, sem
  cobertura Vitest no client neste projeto, igual T-067).
- Smoke: servidor de dev + `npm run bots -- 3 15` — 0 erros no tick, bots entraram, subiram de
  nível e saíram normalmente (evento não disparou naturalmente na janela curta do smoke —
  esperado, `BR_MIN_PLAYERS=4` > 3 bots usados).
- **Draw calls:** +2 vs. baseline (`zoneRing` + `zoneDark`, ambos sempre presentes na cena mas
  com `visible=false` fora de warning/active) — dentro do orçamento `≤ +3` da task. Não há
  contador de draw calls no F3/debug-overlay hoje, então essa contagem é por inspeção de
  código (1 mesh por elemento novo), não medição em runtime.
- **Preview de browser NÃO executado nesta sessão** — o ambiente de execução deste agente não
  tem display/browser disponível (só shell headless). Os critérios de aceite que dependem de
  visualização real (anel visível no warning, chão escurecendo gradual, anel encolhendo até
  sumir, vinheta ligando/desligando ao cruzar a borda, seta apontando corretamente pro centro)
  **ficam pendentes de confirmação manual**. Recomendado: `DEBUG=1` + forçar
  `dev_event battle_royale` com ≥4 bots/players e observar via preview do Vite.

## Próximo passo

Validar visualmente esta task (pendência acima) antes de prosseguir. T-069/T-070/T-071
continuam liberadas em paralelo (frentes disjuntas). T-072 (polish som/VFX) depende de
T-068+T-069.
