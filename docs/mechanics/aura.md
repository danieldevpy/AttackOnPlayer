# Aura (M2) — ADR-005

**Aura = oportunidade, não sorte.**

## Como ganha (mecânica pronta, medida objetivamente)
- Esquiva no último instante (i-frame window curta).
- Streak de acertos sem tomar dano.
- Precisão acima de threshold na sessão.
- Coleta contestada (pegar coletável com inimigo a < 2 tiles).

## O que faz
- Aumenta a **qualidade potencial** dos drops que nascem em células vazias próximas à trajetória do jogador.
- Não dá dano, não dá vida, não multiplica RNG bruto.
- Decai com o tempo parado — aura exige jogo ativo.

## "Famar" aura
Eventos de mecânica geram pontos de aura visíveis (feedback imediato no HUD). Jogadores identificam quem tem aura → alvo social e tático.

## Métricas necessárias (pré-requisito M4/M2)
dodge_perfect, hit_streak, accuracy, contested_pickup — por jogador/sessão.
