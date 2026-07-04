# Coletáveis (mapa vivo — ADR-006)

- Spawner roda no tick do servidor: mantém até 5 coletáveis.
- Célula candidata: livre (sem parede) e a ≥ 4 tiles (Manhattan) de qualquer jogador.
- Coleta: distância < 0.6 do centro → +1 nível (M0) e evento de métrica.
- Respawn com atraso de 2–5s para criar deslocamento constante.

## Evolução
- M2: raridade ponderada pela **aura** de quem está na região (aura ↑ = chance de item de qualidade maior naquela célula vazia — oportunidade, não garantia).
- M2: densidade por célula (mapa dividido em zonas) substitui raio simples.
- Tipos genéricos: `stat_up` (força/velocidade/vida) — sempre como coletável genérico, nunca amarrado à arte.
