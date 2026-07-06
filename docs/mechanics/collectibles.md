# Coletáveis (mapa vivo — ADR-006)

## Tipos (T-004 ✅ — substitui SPEC-0002)
| Kind | Visual (F1) | Efeito | Onde nasce |
|---|---|---|---|
| `xp_orb` | esfera dourada | +XP (curva de nível, growth.md) | campo, raro em safe |
| `speed_up` | octaedro ciano | velocidade ×1.5 por 8s | campo, raro em safe |
| `coin_buff` | cilindro achatado amarelo | +coins (compram reroll de atributo) | campo |
| `farm_event` | cone verde | XP em dobro por 20s (efeito `xp_boost`), anunciado no HUD | só zona de guerra |
| `box` | cubo roxo | bônus forte de atributo no round + acumulador persistente (ADR-012) | só zona de guerra, muito raro |
| `hp_orb` | esfera vermelha | +5 HP (clampa em maxHp) — SPEC-0010 | campo aberto, **passe de spawn próprio** (escasso) |
| `shield_temp` | icosaedro azul | escudo temporário: recebe 50% do dano por 3s (`damage_reduction`) — SPEC-0010 | campo aberto, **passe próprio**, máx. 2 no mapa |
| `weapon` | arma sobre aro âmbar (cano por tipo) | troca `player.launcher` pelo `weaponId` sorteado no spawn — SPEC-0011 | **passe próprio**, **1 por vez**, célula walkable+alcançável totalmente aleatória (ver combat.md → Arsenal) |

## Recursos de vida escassos (SPEC-0010 — passe de spawn dedicado)
`hp_orb` e `shield_temp` NÃO entram no orçamento/pesos do coletável comum: têm um passe próprio no tick (`spawnSurvivalItem`), com teto por kind (`HP_ORB_MAX=3`, `SHIELD_TEMP_MAX=2`), distâncias mínimas MAIORES que o comum — de qualquer player (`*_MIN_PLAYER_DIST=7`) **e** de outra instância do mesmo kind (`*_MIN_SELF_DIST=9`) — e cadência lenta (`HP_ORB_RESPAWN_MS=12s`, `SHIELD_TEMP_RESPAWN_MS=15s`). Nascem só em campo aberto (nunca safe). Design: escassez força deslocamento/exposição — sobreviver é ação, não camping perto de um ponto de cura.

- Spawner roda no tick do servidor: orçamento escala com a área (~1 por 160 tiles, mín. 5).
- Célula candidata: livre (sem parede), a ≥ 4 tiles (Manhattan) de qualquer jogador, **e a zona decide o pool de kinds**: `SAFE_WEIGHTS`/`WAR_WEIGHTS`/`FIELD_WEIGHTS` (constants.ts). Zona safe também sofre supressão (`SAFE_ZONE_SPAWN_CHANCE`) — a maioria das tentativas ali é descartada.
- farm_event/box já nascem raros de graça: a zona de guerra é geograficamente pequena perto da área total do mapa — não precisa de nenhuma lógica extra de raridade global, só o peso relativo dentro do pool da zona.
- Coleta: distância < 0.6 do centro → efeito por kind (ver tabela) + evento de métrica (`pickupsByKind`).
- Respawn com atraso de 2–5s para criar deslocamento constante.

## Evolução
- M2: raridade ponderada pela **aura** de quem está na região (aura ↑ = chance de item de qualidade maior naquela célula vazia — oportunidade, não garantia).
- M2: densidade por célula (mapa dividido em zonas) substitui raio simples.
- Tipos genéricos: `stat_up` (força/velocidade/vida) — sempre como coletável genérico, nunca amarrado à arte.
