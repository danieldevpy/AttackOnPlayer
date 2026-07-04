# Crescimento — XP, atributos e economia (PROMPT-0003)

Princípio: crescimento **controlável e escalável** — nunca "tudo num atributo só".

## Camadas
```
XP → nível → pontos de atributo → distribuição em atributos → poder efetivo
coins → economia paralela (uso a decidir)
```

## XP e nível (T-003)
- Fontes de XP: coletável comum (pouco), farm event (muito), kill (média + bônus por nível da vítima), box (bônus).
- Curva: `xpParaNivel(n) = XP_BASE × n^XP_EXP` — 2 constantes controlam TODO o pacing (balance por dados, ver metrics.md).
- Subir de nível → +PONTOS_POR_NIVEL pontos de atributo.

## Atributos (T-003)
| Atributo | Efeito | Interage com |
|---|---|---|
| Força | multiplica dano do lançador | combat.md |
| Velocidade | multiplica velocidade base (empilha com efeitos, respeita teto ADR-009) | movement.md |
| Vitalidade | vida máxima | combat.md |

- v1: auto-distribuição (preset equilibrado) para não travar o fluxo de 2–3 min.
- v2: escolha manual rápida (3 botões no respawn/level-up).
- Implementação: atributos entram no `EffectSystem` como camada "permanente do round" (ADR-009) — mesmo pipeline, sem código novo de recompute.

## Coletáveis expandidos (T-004)
| Kind | Onde | Efeito |
|---|---|---|
| `xp_orb` | campo (substitui level_up) | +XP pequeno |
| `speed_up` | campo | boost temporário (já existe) |
| `farm_event` | zona de guerra, raro, anunciado | área dá XP em dobro por 20s |
| `coin_buff` | campo | +coins / multiplicador de coins temporário |
| `box` | zona de guerra, muito raro | skill/lançador + pontos de atributo |

## ⚠️ Decisões pendentes do CD (bloqueiam T-004)
1. **Box "reset de MU":** reset implica progresso PERMANENTE entre partidas — conflita com "progressão por round" da constituição. (a) box só vale no round; (b) criar meta-progressão permanente (mudar constituição). Recomendação da IA: (a) agora, discutir (b) no M3 junto com persistência.
2. **Coins compram o quê?** Pode nascer como acumulador sem uso (métricas dirão o valor certo depois).
