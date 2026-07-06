# PROMPT-0050 — T-055 (SPEC-0014): Projéteis do arqueiro · 2026-07-06

## Pedido (resumo fiel)

Executor de task (agente worker) recebeu **T-055** do BACKLOG (Frente C — Personagens/classe/
skin, PROPOSAL-0004, client): trocar o placeholder de esfera do projétil por um visual de
**flecha** (mesh orientado pela velocidade) para os 3 launchers da classe `archer`; **trail
leve** só no `heavy_shot`; manter dano/rede intactos (task é puramente visual). **Contexto:**
`packages/client/src/{main,vfx}.ts` · `packages/shared/src/launchers.ts` (leitura). **Aceite:**
flecha aponta pra onde voa; 3 launchers visualmente distintos. Depende de T-053 (já ✅).

## Decisões tomadas (e por quem)

- **IA:** flecha = haste (cilindro fino) + ponta (cone 4 lados, mesmo low-poly da cabeça do
  personagem em T-053) montadas num `THREE.Group`, com as geometrias **rotacionadas uma vez na
  criação** (`rotateZ(-Math.PI/2)`) pra que o eixo canônico da geometria já nasça deitado no
  local +X — a mesma convenção de "nariz" usada pelos personagens (`vis.rotation.y = -dir`,
  comentário em `syncWorld`). Isso evita rotação por parte a cada instância; só o `Group`
  inteiro gira.
- **IA:** direção real do projétil (`dirX`/`dirZ`) **não é sincronizada** pro cliente (campos
  internos do servidor, `ArenaState.ts:Projectile`) — só `x`/`z`/`launcherId`. Como o padrão de
  disparo de todo `LauncherDef` hoje é `"straight"` e nenhum dos 3 launchers de player tem
  `movement.inheritVelocityFactor` (só o `heavy_shot_dev`, nunca atribuído), a direção real do
  disparo é **exatamente** `p.dir` do atirador no instante do tiro (`projectiles.ts:41-42`).
  Por isso a flecha é orientada **uma única vez, na criação do mesh**, lendo o `dir` do player
  mais próximo do ponto de spawn — reaproveitando a MESMA heurística de vizinhança que a T-054
  já usava pra decidir quem disparou (antes só animava o arco; agora também orienta a flecha).
  Não recalcula por frame: mais barato e correto (trajetória sempre reta).
- **IA:** geometrias/materiais continuam **singletons de módulo** por launcher (regra "leve
  sempre" §5) — `createArrowMesh` só instancia `THREE.Mesh` novos referenciando a geometria/
  material compartilhados, um `Group` novo por projétil (era um `Mesh` novo antes; troca de
  tipo no `Map`, sem custo adicional de geometria).
- **IA:** distinção visual dos 3 launchers manteve a MESMA lógica da T-039 (cor + tamanho),
  só trocando esfera por flecha com as mesmas proporções relativas — sem inventar paleta nova.
- **IA:** `trail` é um campo opcional em `ProjStyle`; só `heavy_shot` o define
  (`arrow_trail_heavy` em `vfx.ts`, `intensity: "leve"` — reforça "arma vantajosa" sem virar
  aura, mesma regra de intensidade da T-022). Rastro spawna a cada 90ms de voo, um novo
  `Map<string, number>` (`lastArrowTrailAt`) por projétil, limpo no despawn (mesmo padrão do
  `lastTrailSpawn` de player já existente).

## Resultado verificado

- `packages/client/src/main.ts`: `projectileMeshes` agora é `Map<string, THREE.Group>`;
  `ProjStyle` ganhou `shaftGeo`/`headGeo`/`shaftLen`/`headLen`/`trail?`; `createArrowMesh`
  monta o grupo; heurística de vizinhança (já existente da T-054) estendida pra também ler
  `dir` do atirador e orientar a flecha; rastro do `heavy_shot` plugado no loop de sync.
- `packages/client/src/vfx.ts`: `arrow_trail_heavy` novo em `VFX_DEFS`.
- Sem mudança em schema/protocolo/servidor — dano e rede intactos (task 100% client).
- `cd packages/client && npx tsc --noEmit` limpo; `tsc` também limpo em `server`/`bots`
  (config compartilhada). `npm run test -w @aop/shared` 38/38 · `packages/server` vitest 80/80
  · `packages/bots` vitest 35/35 — nenhuma regressão (task não tocou shared/server, só
  rodados por completude do gate).
- **Smoke real:** `server-verify`:2604 + `client-verify`:5299 no ar; client conectou como
  player real na sala (log do servidor: `+ web-365`); `SERVER_URL=ws://localhost:2604 npm run
  bots -- 4 20` (e de novo com 4/15s) — bots dispararam de verdade (`tiros: 2`, `tiros: 6` no
  log do run) atravessando os 3 launchers ao longo da partida; console do browser sem NENHUM
  erro (`preview_console_logs` level=error vazio) do início ao fim das duas rodadas de bots.
- **Confirmação visual pendente (mesma limitação já registrada nas sessões 31/32, T-053/T-054):**
  `preview_screenshot` deu timeout e o painel de debug (F3) não atualizou — `document.
  visibilityState` reporta `"hidden"` nesta config de preview (rAF pausado por aba em
  background), reproduzível mesmo reiniciando o server de preview do zero. Não é regressão
  desta task; é o mesmo ambiente que já bloqueou o screenshot de T-053/T-054. Fica pendente
  pro CD confirmar em navegador de verdade que a flecha aponta pra onde voa e que os 3
  launchers são distinguíveis (código e lógica de orientação revisados e consistentes com o
  padrão já testado do facing dos personagens).
- `npm run aci -- index` rodado ao final.

## Regras que nascem daqui

- Quando um campo do servidor não é sincronizado (aqui, `dirX`/`dirZ` do projétil) mas existe
  um campo sincronizado equivalente em outra entidade (aqui, `Player.dir`) e a regra de negócio
  garante que os dois coincidem no instante relevante (disparo `"straight"` sem herança de
  velocidade), preferir ler o campo já sincronizado a duplicar lógica ou adicionar um campo
  novo ao schema — mais barato e sem tocar rede/protocolo (fora do escopo desta task de
  qualquer forma).
- Preview headless com `document.visibilityState === "hidden"` é uma limitação de ambiente
  conhecida (já registrada nas sessões 31/32) — não vale reabrir investigação a cada task
  visual; documentar a pendência pro CD e seguir pelos outros sinais (tsc, gates, bots reais,
  console sem erro).
