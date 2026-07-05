# PROMPT-0026 — Correções da SPEC-0005: facing por movimento + XP inteiro · 2026-07-05

## Pedido (resumo fiel do CD)
Duas coisas feitas erradas na leva anterior (PROMPT-0025):
1. o facing (direção e visão do player) **não** deve ser controlado pelo mouse, e sim pela direção baseada na **movimentação** do player, como antes — só que melhorado e mais eficiente;
2. o XP aparece na tela fracionado (ex.: `1.4789999999 / 88`), atrapalhando a experiência.

## Decisões tomadas (e por quem)
- **(1) Facing pelo movimento:** removido do cliente do player todo o caminho de mira por mouse — `cursorGroundOffset()` (raycast contra o chão), o listener `mousemove`, o estado `hasCursor` e o envio de `aimX/aimZ`. O servidor já derivava `dir` de `inputX/inputZ` quando não há `aim` (T-009); agora esse é o único caminho para o player. Parado, mantém o último `dir` (nunca zera). Mais eficiente: zero raycast por tick e payload de rede menor. O campo `aimX/aimZ` do protocolo **permanece** e é usado só pelos **bots** (miram no alvo em combate) — nenhuma mudança no servidor nem nos bots.
- **(2) XP inteiro:** a causa era o XP passivo somar `XP_PER_SECOND * dt` (0.05/tick) direto em `p.xp`. Trocado por **acumulador de tempo por player no servidor** (`xpAccum: Map<string, number>`): acumula a fração e só entrega `grantXp` em unidades **inteiras** (1/s), então `p.xp` nunca fica fracionado. Limpo no `onLeave`. HUD também passou a `Math.floor(xp)` por defesa.

## Resultado verificado
- **Gates:** shared 13/13 · server 19/19 · `tsc --noEmit` limpo ×3 (client/server/bots).
- Revisão: cliente do player não envia mais `aim` (só `{x, z, fire?}`); servidor usa o ramo de facing por movimento; `p.xp` só recebe inteiros via acumulador (dt=0.05, 20 ticks ⇒ +1 XP/s).

## Regras que nascem daqui
- **Facing do player = movimento; mouse = só gatilho.** Mira por ponteiro fica reservada a entidades que precisam mirar em alvo (bots) — não é o esquema de controle do humano.
- **Estado sincronizado nunca fracionado por acúmulo de tick.** Ganhos contínuos (XP/s) usam acumulador que entrega inteiros; o HUD floora por defesa, mas a fonte da verdade já é limpa.

## Pendências para o próximo prompt
- Veredito do CD no browser (facing por movimento + XP inteiro).
- Segue valendo: re-medir pacing (XP passivo × morte-zera-nível) com bots.
