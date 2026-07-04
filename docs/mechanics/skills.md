# Skills & Atributos (ADR-009 · ADR-013)

## Modelo
```
atributo efetivo = base × attrMult(pontos) × efeitos ativos (com piso/teto POR atributo)
```
- Base vive em `packages/shared/src/constants.ts` (ex.: `PLAYER_SPEED`).
- **T-015:** atributos são data-driven — tabela `ATTR_DEFS` em `constants.ts` (valor por ponto + piso/teto por atributo). Atributo novo = 1 linha na tabela + 1 uso no `recompute()`.
- Efeitos vivem no `EffectSystem` (`packages/server/src/systems/effects.ts`): kind, duração, renovação, teto.
- O servidor recalcula a cada tick e sincroniza só o resultado (`player.speed`, `strength`, `vitality`, `attackSpeed`, `reach`) + a lista de kinds ativos (`player.effects`) para o HUD.
- O cliente NUNCA calcula atributo — só exibe.

## Atributos (T-015 — tabela `ATTR_DEFS`, escala assimétrica ADR-013)
| Atributo | Efeito | Valor/pt | Piso–Teto | Campo sincronizado |
|---|---|---|---|---|
| Força | × dano do lançador | +6% | 1–3.0 | `strength` |
| Vitalidade | × maxHp | +4% | 1–2.5 | `vitality` |
| Agilidade | × velocidade de movimento | +3% | 1–2.0 (ADR-009) | `speed` |
| Cadência | × cooldown do lançador (menor = mais rápido) | −4% | 0.55–1 | `attackSpeed` |
| Alcance | × range do projétil (congelado no disparo) | +5% | 1–1.75 | `reach` |

Preset equilibrado (level-up automático) distribui só nos 3 atributos-base (`BASE_ATTRS`); cadência/alcance entram por escolha (cards, T-016), reroll ou box.

## Efeitos atuais
| Kind | Fonte | Efeito | Duração | Regra |
|---|---|---|---|---|
| `speed_up` | coletável ciano | velocidade ×1.5 | 8s | pegar de novo renova; teto global 2× |
| `launcher_slow` | disparo de um lançador com `movement.selfSlowFactor` (T-012) | velocidade × fator do lançador | vem do `LauncherDef`, não é fixa | único efeito com **magnitude dinâmica** (`ActiveEffect.magnitude`) — cada lançador define seu próprio fator/duração; `basic_shot` não tem, então nunca aplica |

## Como criar uma skill nova (receita)
1. Adicionar o `EffectKind` e constantes em `shared/constants.ts`.
2. Tratar o kind em `EffectSystem.recompute()` (e no pickup/gatilho do Room).
3. Visual do coletável/efeito em `client/src/visuals.ts` (respeitando a fase visual atual).
4. Registrar aqui na tabela + spec se a mecânica for nova.

Proibido: lógica de atributo espalhada no `ArenaRoom` ou no cliente.

## Futuro (M1/M2)
Força (dano), vida, esquiva com i-frames (insumo de aura). Skills ativas (botão) entram como `EffectKind` disparado por input validado no servidor.
