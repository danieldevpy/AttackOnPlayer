# Progressão

- Todos começam nível 1. Nível sobe coletando (M0) e por kills (M1); desce ao morrer (M1).
- Quanto mais tempo vivo + nível alto, mais valioso como alvo → força necessária para matá-lo cresce, recompensa também (M1).

## Perda de nível na morte (T-006, decisão do CD 2026-07-04)
- Piso nos níveis 1–3: perda mínima (protege jogador casual/iniciante).
- Acima do piso: perda escala com o nível — `lossFraction(level)` cresce de forma linear/clamped até um teto (perto de reset, mas não travado em 100% por padrão). Números exatos batidos em `constants.ts` na implementação.
- Respawn após morte nasce em uma safe zone escolhida por risco: o servidor pontua os spawns por distância de players vivos e projéteis recentes, em vez de usar sorte pura. O input/tiro do player é zerado ao renascer.
- **Reset total** (derruba pra nível 1) existe como **opção ativável** — flag por room (`fullResetOnDeath`) com default global configurável — não é o comportamento único.
- Fora de escopo agora (depende de combate/Aura existirem de verdade — ver LEAD_DESIGNER_NOTES 2026-07-04): crítico, armadura/defesa, aura decidindo chance de sobreviver. Registrado para quando M2 (Aura) entrar em pauta.

## Persistência entre partidas
- Progresso de round (XP, nível, atributos "vivos") continua **por partida** — reseta a cada round, mantendo o pilar "risco real" da constituição.
- Exceção aprovada pelo CD: acumulador de atributo **persistente por `playerToken`** alimentado pela box (ADR-012), scaffold para o M3. Não afeta poder em jogo ainda; visível só em `DEV_MODE`.
