# Coletáveis (mapa vivo — ADR-006)

## Tipos (desde SPEC-0002)
| Kind | Visual (F1) | Efeito |
|---|---|---|
| `level_up` | esfera dourada | +1 nível |
| `speed_up` | octaedro ciano | velocidade ×1.5 por 8s (ver mechanics/skills.md) |

Proporção de spawn: 70% level_up / 30% speed_up.

- Spawner roda no tick do servidor: orçamento escala com a área (~1 por 160 tiles, mín. 5).
- Célula candidata: livre (sem parede) e a ≥ 4 tiles (Manhattan) de qualquer jogador.
- Coleta: distância < 0.6 do centro → +1 nível (M0) e evento de métrica.
- Respawn com atraso de 2–5s para criar deslocamento constante.

## Expansão planejada (T-004 — ver growth.md)
xp_orb, farm_event (zona de guerra, XP em dobro na área), coin_buff, box (skill + pontos; regra de persistência pendente de decisão do CD).

## Evolução
- M2: raridade ponderada pela **aura** de quem está na região (aura ↑ = chance de item de qualidade maior naquela célula vazia — oportunidade, não garantia).
- M2: densidade por célula (mapa dividido em zonas) substitui raio simples.
- Tipos genéricos: `stat_up` (força/velocidade/vida) — sempre como coletável genérico, nunca amarrado à arte.
