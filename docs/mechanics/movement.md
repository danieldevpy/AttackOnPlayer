# Movimento

- Contínuo (x/z floats) sobre grid lógico 15×13; tile = 1 unidade.
- Velocidade base 4 u/s; raio do jogador 0.35.
- Cliente envia direção normalizada (`input {x,z}`); servidor integra a 20Hz e resolve colisão por eixo (desliza em paredes).
- Cliente interpola (lerp ~15%/frame) até a posição autoritativa.
- Futuro (M1+): dash/esquiva com custo, base do sistema de aura por mecânica.
