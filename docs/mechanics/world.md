# Mundo — campo aberto, props e zonas (ADR-010)

## Geração (substitui o labirinto — T-001)
Do mesmo seed sincronizado derivam:
1. **Props colidíveis** esparsos (~4% dos tiles): pedra (1×1), árvore (1×1), caixa (1×1), muro (2×1). Ocupam tiles no grid de colisão existente.
2. **Zonas** (círculos/retângulos em coordenadas de tile):
   - **Safe** (uma por spawn): sem dano, spawn de coletável comum raro, cor de chão levemente azulada.
   - **Guerra** (1–2 por mapa, no centro/pontos quentes): loot raro (box, farm event), spawn acelerado, chão avermelhado. Risco ↔ recompensa.
   - **Campo** (resto): neutro.
3. Corredores de respiro: nenhuma região fechada (props nunca formam paredes contínuas > N tiles).

## Pré-modelos de props (T-002 ✅, em visuals.ts — fase F2)
| Prop | Composição (primitivas) | Colide? |
|---|---|---|
| Pedra | icosaedro achatado cinza | sim |
| Árvore | cilindro marrom + cone verde | sim |
| Caixa | cubo madeira | sim (futuro: quebrável com drop) |
| Muro | cubo esticado 2×1 | sim |
| Bandeira de zona | haste + plano colorido | não (marca zona de guerra) |

## Mapa dinâmico
- v1: zonas fixas por round (posição varia com o seed).
- v2 (futuro): zona de guerra migra entre rounds; eventos temporários ("chuva de farm" numa área) anunciados no HUD.

## O que NÃO muda com o pivô
Grid de colisão por tile, seed sync (3 números), tamanho por população (ADR-007), spawner longe de jogadores (ADR-006), pathfinding BFS dos bots.
