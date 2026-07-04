# Coletáveis (mapa vivo — ADR-006)

## Tipos (T-004 ✅ — substitui SPEC-0002)
| Kind | Visual (F1) | Efeito | Onde nasce |
|---|---|---|---|
| `xp_orb` | esfera dourada | +XP (curva de nível, growth.md) | campo, raro em safe |
| `speed_up` | octaedro ciano | velocidade ×1.5 por 8s | campo, raro em safe |
| `coin_buff` | cilindro achatado amarelo | +coins (compram reroll de atributo) | campo |
| `farm_event` | cone verde | XP em dobro por 20s (efeito `xp_boost`), anunciado no HUD | só zona de guerra |
| `box` | cubo roxo | bônus forte de atributo no round + acumulador persistente (ADR-012) | só zona de guerra, muito raro |

- Spawner roda no tick do servidor: orçamento escala com a área (~1 por 160 tiles, mín. 5).
- Célula candidata: livre (sem parede), a ≥ 4 tiles (Manhattan) de qualquer jogador, **e a zona decide o pool de kinds**: `SAFE_WEIGHTS`/`WAR_WEIGHTS`/`FIELD_WEIGHTS` (constants.ts). Zona safe também sofre supressão (`SAFE_ZONE_SPAWN_CHANCE`) — a maioria das tentativas ali é descartada.
- farm_event/box já nascem raros de graça: a zona de guerra é geograficamente pequena perto da área total do mapa — não precisa de nenhuma lógica extra de raridade global, só o peso relativo dentro do pool da zona.
- Coleta: distância < 0.6 do centro → efeito por kind (ver tabela) + evento de métrica (`pickupsByKind`).
- Respawn com atraso de 2–5s para criar deslocamento constante.

## Evolução
- M2: raridade ponderada pela **aura** de quem está na região (aura ↑ = chance de item de qualidade maior naquela célula vazia — oportunidade, não garantia).
- M2: densidade por célula (mapa dividido em zonas) substitui raio simples.
- Tipos genéricos: `stat_up` (força/velocidade/vida) — sempre como coletável genérico, nunca amarrado à arte.
