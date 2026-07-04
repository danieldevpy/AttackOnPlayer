# PROMPT-0015 — T-010: gatilhos desacoplados e disparo pelo facing · 2026-07-04

## Pedido (resumo fiel do CD)
- Continuar a SPEC-0003 task a task, mantendo o jogo funcional e testável, e mantendo os contextos (docs) sempre atualizados no processo.
- Próxima da fila: T-010 (depende de T-009, já concluída).

## Decisões tomadas (e por quem)
- IA: protocolo de input perde `fx/fz` de vez (spec já previa isso e descartou compat retroativa — "não vale o custo"). Novo formato: `{x, z, aimX?, aimZ?, fire?}`. `fire` é só um booleano.
- IA: `ProjectileSystem` não lê mais direção nenhuma do input — usa `p.firing` (booleano) + `p.dir` (facing, resolvido pela T-009) para decidir se atira e para onde. Isso garante o critério "espaço e clique produzem projéteis idênticos" por construção (os dois só ligam o mesmo booleano).
- IA: spawn do projétil ganhou offset de raio (`PLAYER_RADIUS`) na direção do facing, a partir da posição autoritativa do player no tick — atende "sem tiro atrasado atirando em movimento".
- IA: `Player.fireDirX/fireDirZ` removidos do estado (eram só uso interno, nunca sincronizados) e substituídos por `firing: boolean` — também interno, não sincronizado (o cliente já sabe localmente se está atirando; não precisa vir de volta pelo state).
- IA: cliente mapeia gatilhos num `Set<string>` (`fireSources`): `mousedown` liga `"mouse"`, tecla espaço liga `"space"`; `fire = fireSources.size > 0`. Escolhido em vez de dois booleanos soltos porque a spec pede "mapeamento extensível (gamepad/touch no futuro sem mudar protocolo)" — novo gatilho = uma linha a mais no set, sem tocar no protocolo.
- IA: overlay F3 ganhou linha "gatilho" (mostra as fontes ativas do meu player) — fecha o critério de aceite 6 (facing **e gatilho ativo**) já nesta task, em vez de esperar a T-011.
- IA: **efeito colateral aceito** — os bots (T-008) continuam mandando `fx/fz` (formato antigo) para "mirar e atirar"; como o servidor não lê mais esse campo, os bots passam a se mover e perseguir normalmente mas não disparam mais até a T-013 migrar o protocolo deles. Isso é exatamente o que a spec previu ao separar T-013 como task própria — não adiantei a migração dos bots aqui para não misturar escopo.

## Resultado verificado
- Typecheck limpo em `server`, `client` e `bots` (`tsc --noEmit`).
- `packages/server/src/systems/projectiles.test.ts` atualizado (`shooter.dir = 0; shooter.firing = true` no lugar de `fireDirX/fireDirZ`) — 2/2 continua passando (cadeia tiro→dano→morte→kill e bloqueio em safe zone).
- `npm run test` (shared): 10/10.
- Verificação ao vivo no browser (preview): espaço e clique dispararam projéteis na direção do facing mostrado no F3; overlay mostrou "gatilho: ativo (mouse)" / "ativo (space)" corretamente ao pressionar cada um.
- `npm run bots -- 3 10`: bots entram, perseguem e se movem sem crash — confirmando o efeito colateral aceito acima (0 tiros dos bots, esperado até T-013).

## Veredito CD (preencher após teste no browser)
- Testado em: —
- Fluxos: [ ] tiro por espaço [ ] tiro por clique [ ] projéteis idênticos nos dois [ ] tiro em movimento (sem atraso) [ ] F3 mostra gatilho ativo
- Resultado: pendente
- Observações:

## Regras que nascem daqui
- Direção de qualquer projétil **sempre** vem de `Player.dir` (facing) no servidor — nunca de um vetor no input. Se uma feature futura precisar de "mira livre diferente do facing" (não é o caso hoje), isso exige decisão de design nova, não só um campo de protocolo.
- Gatilho é booleano puro; toda a lógica de "quais fontes contam como atirar" vive só no cliente (`fireSources`), sem vazar para o protocolo.

## Pendências para o próximo prompt
- T-011: rotação visível do grupo de todos os players (placeholder de direção) + interpolação.
- T-012: ganchos de mobilidade em `LauncherDef` (ex.: lentidão ao disparar) via EffectSystem.
- T-013: migrar os bots para o protocolo novo (mira contínua + gatilho) — hoje eles não atiram mais; essa task fecha a lacuna.
