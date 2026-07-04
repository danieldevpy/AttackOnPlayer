# Balance T-014 — Rebalance de TTK (SPEC-0004 / ADR-013)

> Relatório do primeiro passe de balance da SPEC-0004. Complementa (não substitui) o
> passe completo da T-OPTIONAL 1, que deve re-rodar após a T-017 (skills mudam DPS efetivo).

## Mudança aplicada

| Constante | Antes | Depois |
|---|---|---|
| `LAUNCHERS.basic_shot.damage` | 10 | **20** |
| `LAUNCHERS.heavy_shot_dev.damage` (dev-only) | 14 | **28** (mantém proporção 1.4×) |

## TTK teórico (matemática verificada)

Vida base 100, cooldown 600ms, acertos perfeitos:

| Cenário | Antes | Depois |
|---|---|---|
| Nível 1 vs nível 1 | 10 tiros / 5.4s | **5 tiros / 2.4s** |
| Nível N vs nível N (preset equilibrado, escala atual +4%/pt igual) | 10 tiros (constante) | **5 tiros (constante até T-015)** |

A queda de TTK **com o nível** (5→3-4 tiros via especialização) só chega com a escala
assimétrica + builds da T-015/T-016 — este passe corrige o piso, não a curva.

## TTK medido (bots)

| Métrica (10 partidas `npm run bots -- 4 45`) | Antes | Depois |
|---|---|---|
| Kills por partida | _medir_ | _medir_ |
| avgKills (`/metrics/summary`) | _medir_ | _medir_ |

**Status da medição:** ⚠️ pendente — a sessão de implementação rodou num sandbox sem
runtime Node confiável (rede intermitente; ver DEVLOG). Comandos para preencher:

```bash
npm run dev:server &        # terminal 1
npm run bots -- 4 45        # terminal 2, repetir ~10x
curl localhost:2567/metrics/summary
```

Comparar `avgKills`/`avgDeaths` com o histórico de `packages/server/logs/sessions.jsonl`
(sessões antigas = dano 10). Se kills/partida não subirem visivelmente, revisitar o dano
base **antes** de seguir para T-016.

## Risco observado

Dano 20 com bots `forte` (fireInterval 280–600ms) pode deixar bots letais demais contra
jogador iniciante. Se a medição confirmar, o ajuste correto é no `fireIntervalMs` dos bots
(camada de skill), **não** no dano da arma (regra de jogo, igual pra todos).
