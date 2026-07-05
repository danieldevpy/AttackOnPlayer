# Progressão

- Todos começam nível 1. Nível sobe coletando (M0), por kills (M1) e por **presença — +1 XP/s só por estar vivo** (SPEC-0005); zera ao morrer.
- Quanto mais tempo vivo + nível alto, mais valioso como alvo → força necessária para matá-lo cresce, recompensa também (M1).

## Morte zera o nível (SPEC-0005, decisão do CD 2026-07-04)
- **Ao morrer o nível volta a 1** — reset total. Substitui a perda parcial anterior (`lossFraction`, T-006), que ficou aposentada do loop (função ainda exportada para testes/curva de balance e possível reintrodução por room).
- Contrapeso: o XP passivo (+1 XP/s) e o XP do reroll garantem que ninguém fica preso no fundo — quem morre volta a subir só jogando.
- Respawn nasce no spawn de **menor risco** (servidor pontua por distância de players vivos e projéteis recentes, não sorte pura). Não há mais safe zone; a proteção ao renascer é **temporal**: 3s de invulnerabilidade (`SPAWN_PROTECTION_MS`) que cai ao atirar. Input/tiro zerados ao renascer.
- Fora de escopo agora (depende de combate/Aura existirem de verdade — ver LEAD_DESIGNER_NOTES 2026-07-04): crítico, armadura/defesa, aura decidindo chance de sobreviver. Registrado para quando M2 (Aura) entrar em pauta.

## Persistência entre partidas
- Progresso de round (XP, nível, atributos "vivos") continua **por partida** — reseta a cada round, mantendo o pilar "risco real" da constituição.
- Exceção aprovada pelo CD: acumulador de atributo **persistente por `playerToken`** alimentado pela box (ADR-012), scaffold para o M3. Não afeta poder em jogo ainda; visível só em `DEV_MODE`.
