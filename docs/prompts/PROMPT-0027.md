# PROMPT-0027 — T-019: perfis de controle + perfil mouse (SPEC-0006, ADR-015) · 2026-07-05

## Pedido (resumo fiel do CD)
Execução autônoma e sequencial da V1 (PROPOSAL-0002), começando por `Executar T-019 do docs/BACKLOG.md`, sem intervenção a cada task — dúvidas genuínas podem ser perguntadas, o resto segue automático.

## Decisões tomadas (e por quem)
- **Herdado antes de tocar código:** gates automáticos rodados na íntegra em `evolução` (shared 13/13, server 19/19, tsc ×3, guarda `.js` órfão, smoke de bots) — todos verdes — e **merge fast-forward `evolução` → `main`**, conforme recomendação do `SESSAO_ATUAL.md` anterior (T-019 mexe no input que a SPEC-0005 tinha acabado de mudar).
- **Camada de perfis (ADR-015):** `packages/client/src/input/types.ts` define o contrato `Intent {moveX,moveZ,aimX?,aimZ?,fire}` + `ControlProfile {id,attach,detach,poll}`. Perfil novo (T-019b) = uma classe nova; zero mudança de rede.
- **Perfil `mouse`** (`packages/client/src/input/mouseProfile.ts`): WASD strafe (movimento independe da mira, como já era); mira por raycast do cursor contra o plano y=0 usando a câmera atual, vetor `aim = hit - playerPos` enviado como `aimX/aimZ` — campo que o servidor **já aceitava** desde SPEC-0003/bots (T-013) e nunca mudou (ADR-015 confirmado: servidor inalterado). Gatilho por clique ou espaço.
- **`main.ts`:** removido o input cru (`keys`/`fireSources` inline); `sendInput()` agora só faz `activeProfile.poll()` → payload. F3/cards(1-2-3)/reroll(R) continuam como ações globais fora da intenção de perfil. Envio de input passou a ser incondicional a cada tick de rede (20Hz) — alinhado ao padrão que os bots já usavam (T-013, "mira contínua"), necessário para girar em pé sem mover.
- **Crosshair + cursor:** `#crosshair` (div) em `index.html`, escondendo o cursor do SO via classe `cursor-hidden` no perfil ativo; câmera ganha leve offset (`CAMERA_AIM_OFFSET = 2.5`) na direção da mira, sem girar (câmera do jogo continua fixa em ângulo, ADR-015 "servidor/câmera não muda").
- **HUD:** dica de controles atualizada (`mouse=mira`); debug F3 (`gatilho`) passou a ler `lastIntent.fire`/`activeProfile.id` em vez do `fireSources` removido.

## Resultado verificado
- **Gates:** shared 13/13 · server 19/19 · `tsc --noEmit` limpo ×3 (client/server/bots) · guarda `.js` órfão sem saída · `npm run bots -- 3 15` sem crash (combate/level-up ok).
- **Client isolado (sem GPU no preview headless, screenshot indisponível neste ambiente):** instanciada a classe real `MouseControlProfile` via import dinâmico no browser com câmera/posição de player sintéticas — confirmado que mouse à direita da tela produz `aimX > 0` e mouse à esquerda produz `aimX < 0` (crosshair segue o cursor 1:1); `fire` liga com `mousedown`; `moveX/moveZ` seguem WASD independente da mira. `attach()` aplica `cursor-hidden` no body e `active` no crosshair.
- **Servidor:** confirmado por leitura de código que `ArenaRoom.ts` já processa `aimX/aimZ` opcional desde antes desta task (nenhuma mudança de servidor foi necessária, como o ADR previa).

## Regras que nascem daqui
- **Mira é atributo do perfil, nunca do servidor.** O contrato de rede é só `{x,z,aimX?,aimZ?,fire?}`; qualquer perfil novo (teclado, touch, bot) só precisa preencher esses campos do seu jeito.
- **Input do cliente é enviado a cada tick de rede, incondicionalmente** (sem de-duplicar parado/sem-fire) — permite girar em pé com o mouse sem mover. Custo de rede é desprezível (mesmo padrão dos bots).
- **Verificação de UI em ambiente sem GPU:** quando `preview_screenshot` travar (sandbox sem WebGL), validar lógica client isolando a classe via import dinâmico no browser (`preview_eval`) em vez de depender só do screenshot.

## Pendências para o próximo prompt
- T-019b (perfis `keyboard`/`touch` + auto-detecção + seletor) — o `ControlProfile` já está pronto para receber essas classes.
- Veredito do CD no browser real (com GPU) do perfil mouse — critério de aceite "circular um alvo mantendo o crosshair nele" pede um humano de verdade; defaults e lógica já verificados automaticamente acima.
