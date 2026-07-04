# Crescimento — XP, atributos e economia (PROMPT-0003)

Princípio: crescimento **controlável e escalável** — nunca "tudo num atributo só".

## Camadas
```
XP → nível → pontos de atributo → distribuição em atributos → poder efetivo
coins → economia paralela (uso a decidir)
```

## XP e nível (T-003 ✅)
- Fontes de XP: coletável comum (pouco), farm event (muito), kill (média + bônus por nível da vítima), box (bônus).
- Curva: `xpParaNivel(n) = XP_BASE × n^XP_EXP` — 2 constantes controlam TODO o pacing (balance por dados, ver metrics.md).
- Subir de nível → +PONTOS_POR_NIVEL pontos de atributo.

## Atributos (T-003 ✅)
| Atributo | Efeito | Interage com |
|---|---|---|
| Força | multiplica dano do lançador | combat.md |
| Velocidade | multiplica velocidade base (empilha com efeitos, respeita teto ADR-009) | movement.md |
| Vitalidade | vida máxima | combat.md |

- v1: auto-distribuição (preset equilibrado) para não travar o fluxo de 2–3 min.
- v2: escolha manual rápida (3 botões no respawn/level-up).
- Implementação: atributos entram no `EffectSystem` como camada "permanente do round" (ADR-009) — mesmo pipeline, sem código novo de recompute.

## Coletáveis expandidos (T-004 ✅ — tabela completa em mechanics/collectibles.md)
`xp_orb`, `speed_up`, `coin_buff` nascem no campo (raros em zona safe); `farm_event`/`box` só na zona de guerra. Zona escolhe o *pool* de pesos (`FIELD_WEIGHTS`/`SAFE_WEIGHTS`/`WAR_WEIGHTS`), não uma lista fixa por kind.

## Decisões do CD (2026-07-04 — desbloquearam T-004)
1. **Box "reset de MU":** dá bônus forte só no round (atributos, mesmo pipeline do EffectSystem — `BOX_ATTR_BONUS_EACH`, 3× o de um level-up normal) **e** vai somar pontos num acumulador persistente por `playerToken` quando o scaffold (T-004b/ADR-012) estiver pronto. O acumulador só é visível com `DEV_MODE` ligado (painel debug, T-007) e não influencia o poder dentro do round nem o balanceamento entre salas ainda. Skill/lançador do box fica pendente de T-005 (lançadores não existem ainda) — quando chegar, box passa a também sortear um lançador.
2. **Coins compram reroll:** implementado — `EffectSystem.rerollAttrPoints` redistribui o TOTAL de pontos já ganhos entre os 3 atributos (mantém a soma, muda a proporção). Custa `COIN_REROLL_COST` coins, acionado pela tecla R no cliente (placeholder de UI — vira botão de verdade quando F2/F3 de UI entrar em pauta).
