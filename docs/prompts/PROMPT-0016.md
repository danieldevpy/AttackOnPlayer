# PROMPT-0016 — T-011: facing visível (cliente) + bugfix de build · 2026-07-04

## Pedido (resumo fiel do CD)
- Continuar a SPEC-0003 task a task. Próxima da fila: T-011 (facing visível), que depende só de T-009 (pronta).

## Decisões tomadas (e por quem)
- IA: indicador de facing = "nariz" placeholder (cone amarelo emissivo, F1/primitivas — ADR-003), filho do mesmo `THREE.Group` do player em `visuals.ts`. Gira junto com o grupo inteiro; nenhuma arte nova.
- IA: rotação do grupo interpolada em `main.ts` (mesmo espírito do lerp de posição já existente), com menor-caminho-angular (`shortestAngleDiff`) para não girar "a volta toda" ao cruzar ±180°. Convenção: servidor manda `dir = atan2(z, x)`; `group.rotation.y = -dir` alinha o eixo local +X (onde o nariz foi colocado) com essa direção no mundo — verificado analiticamente com a fórmula de rotação em Y do Three.js antes de codar.

## Achado fora do escopo original (bugfix necessário)
Ao tentar confirmar visualmente o nariz no browser, ele simplesmente não aparecia — mesmo depois de reload completo. Investigação:
- **Causa-raiz:** o repo tinha `.js` compilados (de uma `tsc` rodada sem `--noEmit` em algum momento passado, commit `be7cc0a`) sentados do lado dos `.ts` em `packages/{client,shared,bots}/src/`. O resolvedor de módulo padrão do Vite tenta extensões na ordem `.mjs, .js, .ts, ...` — ou seja, **`.js` vence `.ts`** para qualquer import relativo sem extensão (`import ... from "./visuals"`, `export * from "./constants"` etc.).
- Confirmado pelo log de rede do preview: o cliente vinha carregando `visuals.js`, `constants.js`, `map.js`, `rng.js`, `launchers.js` — todos os **duplicados obsoletos**, não os `.ts` reais. Isso explica por que a edição em `visuals.ts` (o nariz) não tinha efeito nenhum no navegador.
- **Risco maior que só o nariz:** `packages/shared/src/index.ts` reexporta `./constants`, `./map`, `./rng`, `./launchers` sem extensão — ou seja, qualquer edição futura nesses arquivos (constantes de jogo, mapa, lançadores) também ficaria **silenciosamente sem efeito no cliente** até alguém notar. É a pior classe de bug: sem erro, sem crash, só comportamento errado/desatualizado.
- **Correção:** removidos os 9 `.js` órfãos (`client/src/{main,visuals}.js`, `shared/src/{index,constants,constants.test,map,rng,launchers}.js`, `bots/src/bot.js`) — eram cópias compiladas nunca usadas de propósito, sem `outDir` configurado nem script de build que as gerasse deliberadamente. Depois de removidos, o Vite volta a resolver `./visuals` etc. para os `.ts` reais.
- **Efeito colateral bom:** `npm run test` (shared) parou de contar 10/10 e passou a mostrar **5/5** — os "10 testes" de antes eram os mesmos 5 de `constants.test.ts` rodando **duas vezes** (uma vez do `.ts`, uma vez do `.js` duplicado). Não eram 10 testes reais.

## Resultado verificado
- Typecheck limpo em `server`, `client` e `bots` (`tsc --noEmit`) **depois** de remover os `.js`.
- `npm run test` (shared): 5/5 (número real, corrigido).
- Verificação ao vivo no browser (preview), depois da remoção: o cone amarelo aparece no player, e gira corretamente ao mover o mouse (testado apontando para a esquerda e depois para cima-direita — o nariz acompanhou nos dois casos).
- `npm run bots -- 3 10`: sem crash, mesmo resultado esperado da T-010 (bots se movem, 0 tiros — pendente T-013).

## Veredito CD (preencher após teste no browser)
- Testado em: —
- Fluxos: [ ] nariz visível no meu player [ ] gira com o mouse [ ] gira com teclado [ ] outro player (bot) também gira
- Resultado: pendente
- Observações:

## Regras que nascem daqui
- **Nunca commitar `.js` ao lado de `.ts` em `packages/*/src/`** — se algum dia for preciso rodar `tsc` manualmente para inspecionar output, usar `--outDir` fora de `src/` (ou `--noEmit`, que é o que os gates de QA sempre usaram). Um `.js` órfão silenciosamente vence o `.ts` real na resolução de módulo do Vite.
- Import relativo sem extensão (`./algumacoisa`) é uma armadilha quando há arquivo `.js` e `.ts` com o mesmo nome — o vencedor depende só da ordem de resolução do bundler, não do que o autor pretendia.

## Pendências para o próximo prompt
- T-012: ganchos de mobilidade no `LauncherDef` (ex.: lentidão ao disparar) via `EffectSystem`.
- T-013: migrar bots para o protocolo novo — fecha a lacuna de "bots não atiram mais".
- Sugestão de guarda permanente: adicionar ao `docs/QA.md` uma checagem simples (`find packages/*/src -name "*.ts"` com par `.js` = falha) para nunca mais deixar isso passar despercebido.
