# PROMPT-0014 — T-009: facing como estado de primeira classe · 2026-07-04

## Pedido (resumo fiel do CD)
- SPEC-0003 já aprovada (facing, mira desacoplada e gatilhos de disparo). Executar a implementação por task, mantendo o jogo sempre funcional e testável por humano a cada entrega.
- Começar pela primeira task da quebra: T-009.

## Decisões tomadas (e por quem)
- IA: `Player.dir` (ângulo em radianos) vira estado sincronizado; resolvido no servidor (nunca no cliente) — mantém o princípio 2 (servidor autoritativo) já registrado nas Notas da IA da spec.
- IA: híbrido resolvido assim — se o input trouxer `aimX/aimZ` com módulo > 0, `dir` aponta pra lá; senão, se houver `inputX/inputZ` (movimento), `dir` segue o movimento; parado e sem mira, `dir` mantém o valor anterior (nunca zera).
- IA: cliente só manda `aimX/aimZ` no tick em que o mouse de fato se moveu (`mousemove` seta uma flag consumida no próximo `sendInput`), para não "grudar" o facing no cursor quando o jogador só quer andar. Corrigido durante a implementação: a primeira versão reenviava o último vetor de mira em ticks sem movimento do mouse (ficava "preso" a uma posição relativa desatualizada) — trocado por um payload que só inclui `aimX/aimZ` no tick exato da mira.
- IA: `fx/fz` (mira+tiro acoplados) do protocolo antigo **não foi tocado nesta task** — o tiro continua saindo do clique como antes; a decisão de aposentar `fx/fz` de vez fica para T-010 (gatilhos desacoplados), que já está com o gancho pronto (`dir` existe e está correto).
- IA: adicionado ao overlay F3 (facing do meu player + de todos) como infraestrutura de teste desta própria task — o critério de aceite pede "estado sincronizado reflete facing correto", e sem visor não dava para provar isso manualmente sem instrumentar o F3 de qualquer forma (T-011 herda e expande esse painel).

## Resultado verificado
- Typecheck limpo em `server` e `client` (`tsc --noEmit`).
- `npm run test` (shared): 10/10.
- `packages/server/src/systems/projectiles.test.ts`: 2/2 (não tocado nesta task, sem regressão).
- `npm run bots -- 3 10`: bots entram, se movem e um deles engaja combate (protocolo antigo `fx/fz` continua sendo lido pelo servidor nesta task) — sem regressão.
- Verificação ao vivo no browser (preview): F3 mostrou os 3 casos do critério de aceite —
  1. Mouse movido sem tecla nem clique → `facing` mudou para o ângulo do cursor (ex.: 51°) sem o player se mover.
  2. Só teclado (`d` depois `w`) → `facing` seguiu a direção do movimento (0° e depois -90°), coerente com `atan2`.
  3. Soltar todas as teclas → `facing` manteve o último valor (não zerou).
  Disparo por clique (mecanismo antigo, intocado) continuou funcionando — 1 projétil visível voando na tela.

## Veredito CD (preencher após teste no browser)
- Testado em: —
- Fluxos: [ ] mira mouse [ ] facing por teclado [ ] facing parado [ ] tiro por clique (regressão)
- Resultado: pendente
- Observações:

## Regras que nascem daqui
- `Player.dir` nunca é zerado pelo servidor — só é reatribuído quando há mira válida ou movimento; ausência de ambos preserva o último valor.
- Mira (`aimX/aimZ`) só entra no payload de input no tick exato em que o mouse se moveu — nunca reenviar um vetor de mira de um tick anterior (motivo: o vetor é relativo à posição do player naquele instante, fica errado se reenviado depois que o player se moveu).

## Pendências para o próximo prompt
- T-010: aposentar `fx/fz`, `ProjectileSystem` passa a usar `fire` (gatilho) + `dir` (facing); atualizar `docs/mechanics/combat.md`.
- T-011: rotação visível do grupo de todos os players (hoje só o overlay F3 mostra o número).
- T-013 vai quebrar temporariamente o tiro dos bots quando T-010 aposentar `fx/fz` — aceito pela própria quebra de tasks da spec (bots migram na T-013).
