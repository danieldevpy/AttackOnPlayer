# Visão atual — snapshot do produto

> Retrato **estável** do jogo e do milestone. Atualizar quando a **fase** mudar (ex.: T-008 fechada), não a cada commit.
> Para "onde paramos **hoje**", ler `docs/SESSAO_ATUAL.md` primeiro.

**Snapshot:** 2026-07-04 · Marco **M1** em andamento — base (T-001..T-008) e SPEC-0003 (facing/mira/gatilhos, T-009..T-013) **completas**

---

## O jogo, em uma frase

Arena web 3D top-down de partidas curtas (2–3 min) num **campo aberto com zonas de risco**, onde você **mira e atira para acertar outros jogadores**, **cresce por XP e atributos** dentro do round — e **perde parte do nível ao morrer**.

## O que já funciona (jogável hoje)

| Área | Estado |
|---|---|
| Multiplayer autoritativo (Colyseus, 20 Hz) | ✅ |
| Mapa grande por seed, props, zonas safe/field/war | ✅ |
| Movimento + colisão, coletáveis, EffectSystem | ✅ |
| XP, nível, força/velocidade/vitalidade | ✅ |
| Coins + reroll de build (tecla R) | ✅ |
| Box (bônus round + scaffold persistência ADR-012) | ✅ |
| **Facing sincronizado** (mira > movimento > mantém o último) + indicador visual girando | ✅ T-009/T-011 |
| **Mira ≠ gatilho** — espaço e clique disparam igual na direção do facing | ✅ T-010 |
| **Ganchos de mobilidade por lançador** (lentidão/herança de velocidade, data-driven) | ✅ T-012 |
| Tiro, dano, morte, respawn, perda de nível | ✅ |
| Debug F3 + `/debug/rooms` (sempre ativos, sem env var) | ✅ |
| Bots headless: coleta (BFS), combate (mira/lead, foge, skill `fraco/medio/forte`) | ✅ T-008/T-013 |
| Bots: ritmo de ataque por skill + anti-stuck (não grudam em obstáculo) | ✅ bugfix pós-teste |
| Personalidade/atributos sorteados de bot + modo boss | ⬜ T-008b |
| Touch / UI final / arte | ⬜ fim M1+ |
| Deploy produção | ⬜ M5 |

## Loop do jogador (resumo)

Ver detalhes e números em **`docs/mechanics/PLAYER_LOOP.md`**.

```
explorar → coletar XP/coins/buffs → subir nível → especializar com reroll
         → mirar (mouse/movimento) → atirar (espaço/clique) → kill dá XP
         → morrer penaliza nível e reseta build do round
```

## Stack e pacotes

- **Client:** `packages/client` — Three.js, input, HUD placeholder
- **Server:** `packages/server` — Colyseus, simulação autoritativa
- **Shared:** `packages/shared` — constantes, mapa, launchers
- **Bots:** `packages/bots` — clientes headless para teste

Local: `ws://localhost:2567` · `http://localhost:5173`

## Direção imediata

Nenhuma task de código pendente conhecida. Próximos passos são decisão do CD:

1. Veredito ao vivo no browser dos fluxos da SPEC-0003 + bugfix (ver tabela em `docs/SESSAO_ATUAL.md`)
2. Merge `movimento_e_direcao` → `main` (checklist em `docs/QA.md`)
3. Escolher a próxima leva: **T-008b** (personalidade/boss de bot), **T-OPTIONAL 1** (balance/métricas), ou uma spec nova

## Ideias registradas mas fora do escopo atual

- Aura (M2), Guardian NPC + matchmaking (M3), dashboard métricas (M4), VPS (M5)
- Escolha manual de atributos no level-up (v2 em `growth.md`)
- Persistência da box **ligada** ao poder in-round (scaffold existe; ativação futura)
- Lançadores novos usando o gancho de mobilidade (T-012 só entregou o mecanismo + 1 lançador de teste dev-only)

## Processo de desenvolvimento

1 prompt = 1 task (do backlog ou de uma spec) · registro em `docs/prompts/` · continuidade em `docs/SESSAO_ATUAL.md` · mapa completo em `docs/DOC_MAP.md`.
