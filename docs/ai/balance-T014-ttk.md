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

## TTK medido (bots) — preenchido 2026-07-04, pós T-017

Base de comparação: `packages/server/logs/sessions.jsonl` — 90 sessões-bot históricas
(dano 10) vs 12 sessões-bot novas (dano 20 + cards + skills, rodadas de 20–24s).

| Métrica | Antes (dano 10, histórico) | Depois (dano 20) |
|---|---|---|
| Kills por sessão-bot | 16/90 = **0.18** | 6/12 = **0.50** (sessões mais curtas) |
| Kills/min (sessões-bot agregadas) | ~0.04 | ~0.25 |
| Evidência de TTK | — | bots terminando com hp 20/40 (sofreram 4/3 acertos de 20 — TTK 5 se confirma na prática) |

**Leitura:** kills ~2.8× mais frequentes por sessão mesmo em rodadas curtas; vários
bots terminam "à beira da morte" (hp ≤ 40), o que antes quase não acontecia — confronto
agora fecha dentro de um engajamento. Nenhum indício de one-shot (impossível por
construção: teto de força ×3.0 → dano máx. 60 < 100 HP mínimo).

**Nota de método:** amostra pequena (12 sessões, salas de teste). O passe formal com
10 partidas cheias continua na T-OPTIONAL 1 — re-rodar depois que T-008b puser builds
variadas nos bots.

## Risco observado

Dano 20 com bots `forte` (fireInterval 280–600ms) pode deixar bots letais demais contra
jogador iniciante. Se a medição confirmar, o ajuste correto é no `fireIntervalMs` dos bots
(camada de skill), **não** no dano da arma (regra de jogo, igual pra todos).
