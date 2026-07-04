# Skills & Atributos (ADR-009)

## Modelo
```
atributo efetivo = base × efeitos ativos (com teto)
```
- Base vive em `packages/shared/src/constants.ts` (ex.: `PLAYER_SPEED`).
- Efeitos vivem no `EffectSystem` (`packages/server/src/systems/effects.ts`): kind, duração, renovação, teto.
- O servidor recalcula a cada tick e sincroniza só o resultado (`player.speed`) + a lista de kinds ativos (`player.effects`) para o HUD.
- O cliente NUNCA calcula atributo — só exibe.

## Efeitos atuais
| Kind | Fonte | Efeito | Duração | Regra |
|---|---|---|---|---|
| `speed_up` | coletável ciano | velocidade ×1.5 | 8s | pegar de novo renova; teto global 2× |

## Como criar uma skill nova (receita)
1. Adicionar o `EffectKind` e constantes em `shared/constants.ts`.
2. Tratar o kind em `EffectSystem.recompute()` (e no pickup/gatilho do Room).
3. Visual do coletável/efeito em `client/src/visuals.ts` (respeitando a fase visual atual).
4. Registrar aqui na tabela + spec se a mecânica for nova.

Proibido: lógica de atributo espalhada no `ArenaRoom` ou no cliente.

## Futuro (M1/M2)
Força (dano), vida, esquiva com i-frames (insumo de aura). Skills ativas (botão) entram como `EffectKind` disparado por input validado no servidor.
