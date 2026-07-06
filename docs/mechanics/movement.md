# Movimento

- Contínuo (x/z floats) sobre grid lógico 15×13; tile = 1 unidade.
- Velocidade base 4 u/s; raio do jogador 0.35.
- Cliente envia direção normalizada (`input {x,z}`); servidor integra a 20Hz e resolve colisão por eixo (desliza em paredes).
- Cliente interpola (lerp ~15%/frame) até a posição autoritativa.
- Futuro (M1+): dash/esquiva com custo, base do sistema de aura por mecânica.

## Facing (T-009, revisado por ADR-015/T-019)

- `Player.dir` (ângulo em radianos) é estado sincronizado de primeira classe — todo player
  tem uma direção "para onde olha", separada de para onde se move.
- **Híbrido, resolvido no servidor, mira é atributo do PERFIL de controle no cliente
  (ADR-015):** o input carrega `aimX/aimZ` opcionais. Quando presentes, `dir` aponta para
  a mira. Quando ausentes, `dir` segue a última direção de movimento (`x/z` do input).
  Parado e sem mira ativa, `dir` mantém o último valor — nunca zera. O servidor não sabe
  nem precisa saber qual perfil (mouse/keyboard/touch/bot) originou o `aimX/aimZ`.
- **Perfil `mouse` (T-019):** envia `aimX/aimZ` a cada tick de rede (20Hz), calculado por
  raycast do cursor contra o chão (y=0) menos a posição do player — permite girar em pé
  sem se mover (crosshair 360°). Perfis futuros sem mouse (T-019b: `keyboard`/`touch`)
  podem preencher `aimX/aimZ` do seu jeito ou simplesmente omitir e cair no facing por
  movimento.
- Custo de rede: 1 número por player a mais no estado (`dir`), substituindo o antigo
  `fx/fz` acoplado ao tiro — desprezível a 20Hz (ver SPEC-0003).
