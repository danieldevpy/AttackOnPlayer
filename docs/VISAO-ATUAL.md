# Visão atual — snapshot do produto

> Retrato **estável** do jogo e do milestone. Atualizar quando a **fase** mudar (ex.: T-008 fechada), não a cada commit.  
> Para “onde paramos **hoje**”, ler `docs/SESSAO_ATUAL.md` primeiro.

**Snapshot:** 2026-07-04 · Marco **M1** em andamento (T-001..T-007 ✅)

---

## O jogo, em uma frase

Arena web 3D top-down de partidas curtas (2–3 min) num **campo aberto com zonas de risco**, onde você **atira para acertar outros jogadores**, **cresce por XP e atributos** dentro do round — e **perde parte do nível ao morrer**.

## O que já funciona (jogável hoje)

| Área | Estado |
|---|---|
| Multiplayer autoritativo (Colyseus, 20 Hz) | ✅ |
| Mapa grande por seed, props, zonas safe/field/war | ✅ |
| Movimento + colisão, coletáveis, EffectSystem | ✅ |
| XP, nível, força/velocidade/vitalidade | ✅ |
| Coins + reroll de build (tecla R) | ✅ |
| Box (bônus round + scaffold persistência ADR-012) | ✅ |
| Tiro reto, dano, morte, respawn, perda de nível | ✅ |
| Debug F3 + `/debug/rooms` | ✅ |
| Bots headless (coleta/movimento) | ✅ |
| Bots de combate (atiram/matam) | ⬜ T-008 |
| Touch / UI final / arte | ⬜ fim M1+ |
| Deploy produção | ⬜ M5 |

## Loop do jogador (resumo)

Ver detalhes e números em **`docs/mechanics/PLAYER_LOOP.md`**.

```
explorar → coletar XP/coins/buffs → subir nível → especializar com reroll
         → combate (tiro) → kill dá XP → morrer penaliza nível e reseta build do round
```

## Stack e pacotes

- **Client:** `packages/client` — Three.js, input, HUD placeholder
- **Server:** `packages/server` — Colyseus, simulação autoritativa
- **Shared:** `packages/shared` — constantes, mapa, launchers
- **Bots:** `packages/bots` — clientes headless para teste

Local: `ws://localhost:2567` · `http://localhost:5173`

## Direção imediata (backlog)

Ordem em `docs/BACKLOG.md`:

1. ~~T-001..T-007~~ ✅
2. **T-008** — bots de combate
3. **T-OPTIONAL 1** — balance + métricas TTK/XP/min

## Ideias registradas mas fora do escopo atual

- Aura (M2), Guardian NPC + matchmaking (M3), dashboard métricas (M4), VPS (M5)
- Escolha manual de atributos no level-up (v2 em `growth.md`)
- Persistência da box **ligada** ao poder in-round (scaffold existe; ativação futura)

## Processo de desenvolvimento

1 prompt = 1 task do backlog · registro em `docs/prompts/` · continuidade em `docs/SESSAO_ATUAL.md` · mapa completo em `docs/DOC_MAP.md`.
