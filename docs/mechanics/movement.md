# Movimento

- Contínuo (x/z floats) sobre grid lógico 15×13; tile = 1 unidade.
- Velocidade base 4 u/s; raio do jogador 0.35.
- Cliente envia direção normalizada (`input {x,z}`); servidor integra a 20Hz e resolve colisão por eixo (desliza em paredes).
- Cliente interpola (lerp ~15%/frame) até a posição autoritativa.
- Futuro (M1+): dash/esquiva com custo, base do sistema de aura por mecânica.

## Facing (T-009)

- `Player.dir` (ângulo em radianos) é estado sincronizado de primeira classe — todo player
  tem uma direção "para onde olha", separada de para onde se move.
- **Híbrido, resolvido no servidor:** o input carrega `aimX/aimZ` opcionais (vetor até o
  cursor, projetado no chão). Quando presentes, `dir` aponta para a mira. Quando ausentes,
  `dir` segue a última direção de movimento (`x/z` do input). Parado e sem mouse ativo,
  `dir` mantém o último valor — nunca zera.
- **Mouse só conta quando se move:** o cliente só envia `aimX/aimZ` no tick em que o mouse
  de fato se deslocou na tela (não a cada frame com o cursor parado), para não "prender" o
  facing no cursor quando o jogador só quer andar.
- Custo de rede: 1 número por player a mais no estado (`dir`), substituindo o antigo
  `fx/fz` acoplado ao tiro — desprezível a 20Hz (ver SPEC-0003).
