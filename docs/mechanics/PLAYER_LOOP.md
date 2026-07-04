# Loop do jogador — referência rápida

> FAQ de gameplay para CD, QA e agentes. **Números** vêm de `packages/shared/src/constants.ts` — se divergir, o código vence.  
> Atualizar este doc quando mudar XP, atributos, combate ou economia.

---

## Escalar dentro do round

### Fontes de XP

| Fonte | Efeito |
|---|---|
| `xp_orb` | +8 XP (`XP_PICKUP_AMOUNT`) |
| `farm_event` | efeito `xp_boost` — XP em **dobro** por 20s |
| Kill | +15 × **nível da vítima** (`XP_PER_KILL_PER_LEVEL`) |
| `box` | bônus de atributo (não é XP direto) |

### Curva de nível

XP para subir do nível `n`: **`20 × n^1.35`** (`xpToNext`).

Cada level-up abre uma **oferta de 3 cards** (T-016) valendo **3 pontos** cada — teclas **1/2/3** ou clique. Sem escolha em **5s** → auto-pick equilibrado (+1 Força +1 Vitalidade +1 Agilidade, o preset de sempre). Cards são **determinísticos por nível** (`upgradeCardsForLevel`) — decorou a tabela, planeja a build. Vários level-ups de uma vez viram fila (badge no HUD).

### Efeito de cada atributo (T-015 — tabela `ATTR_DEFS`, valor e teto POR atributo)

| Atributo | Impacto | Valor/pt | Piso–Teto |
|---|---|---|---|
| **Força** | Dano do tiro = `launcher.damage × strength` | +6% | 1–3.0 |
| **Vitalidade** | `maxHp = 100 × vitality` (`PLAYER_BASE_HP`) | +4% | 1–2.5 |
| **Agilidade** | Movimento = `PLAYER_SPEED × speed` (empilha com `speed_up`, teto 2×) | +3% | 1–2.0 |
| **Cadência** | Cooldown do tiro = `cooldownMs × attackSpeed` | −4% | 0.55–1 |
| **Alcance** | Range do projétil = `range × reach` (congelado no disparo) | +5% | 1–1.75 |

**TTK alvo (T-014, dano base 20):** 5 tiros entre iguais; especialista em Força derruba em 3.

### Buffs temporários

| Coletável | Efeito |
|---|---|
| `speed_up` | +50% velocidade por 8s |
| `farm_event` | XP ×2 por 20s |

### Box (zona de guerra)

- **No round:** +3 pontos em **cada** atributo-base (`BOX_ATTR_BONUS_EACH`) — 3× um level-up normal
- **Skill grátis (T-017):** sorteia 1 skill de projétil que você ainda não tem
- **Persistência (scaffold ADR-012):** soma no acumulador por `playerToken` no servidor — **não altera poder in-round ainda**; visível só em dev

### Skills de projétil (T-017)

Marcos de nível **4/8/12**: um card ★ oferece **1 de 2 skills** (Tiro Duplo, Leque, Perfurante, Fôlego, Impulso — tabela em `mechanics/combat.md`). Morte apaga as skills junto com a build.

---

## Coins e reroll

### Como ganhar coins

Coletável `coin_buff` → **+10 coins** (`COIN_BUFF_AMOUNT`).

### O que reroll faz (tecla **R**)

- Custa **15 coins** (`COIN_REROLL_COST`)
- **Redistribui aleatoriamente** o total de pontos de atributo **já ganhos no round** entre os **5** atributos (força/vitalidade/agilidade/cadência/alcance — T-015)
- **Mantém a soma** — só muda a especialização (tank / dps / mobile / gatilho / sniper)
- Servidor valida: sem coins suficientes, ignora

### O que reroll **não** muda

- Nível, XP, coins (além do custo)
- Efeitos temporários (`speed_up`, `xp_boost`)
- Progresso persistente da box (scaffold separado)
- Lançador / cooldown / alcance

### Morte apaga customização de reroll

Ao morrer, `resetAttrToLevel` volta ao preset equilibrado do **novo** nível — rerolls do round se perdem.

---

## Combate

- **Mira ≠ gatilho** (T-009/T-010): o facing (`Player.dir`) segue o mouse quando ele se move na tela, senão segue a última direção de movimento, e nunca zera parado. Espaço e clique são o mesmo gatilho — os dois disparam **na direção do facing atual**, não numa direção mandada pelo input.
- Servidor aplica cooldown (~600 ms no `basic_shot`); projétil nasce na borda do player (offset de raio) na posição autoritativa do tick — sem atraso ao atirar em movimento.
- Projétil: alcance ~8u; some em prop ou ao acertar.
- **Ganchos de mobilidade por lançador** (T-012, opcional em `LauncherDef.movement`): lentidão do atirador ao disparar e/ou herança de velocidade pelo projétil. `basic_shot` não usa nenhum; existe um lançador de teste (`heavy_shot_dev`) só em dev (`DEBUG=1` + mensagem `dev_launcher`).
- **Safe zone:** bloqueia dano; projétil é consumido; debug emite `safe_block` (não é hitbox quebrada)
- Colisão: segmento do projétil no tick vs círculo do player (`PLAYER_RADIUS`)

---

## Morte e respawn

1. HP → 0 → morte
2. **Perda de nível:** níveis 1–3 perdem ~10% do nível; sobe até ~60% em níveis altos (`lossFraction`)
3. Atributos resetam para preset do nível resultante
4. Respawn em safe zone no spawn de **menor risco** (distância de players vivos + projéteis)
5. Input de movimento e tiro **zerados** ao renascer
6. Assassino ganha XP escalado pelo nível da vítima

Flag opcional `fullResetOnDeath` (por room) — ver `progression.md`.

---

## Debug (desenvolvimento)

- **F3:** overlay com estado + feed de eventos ao vivo — sempre ativo, não depende de env var no servidor (bugfix pós-teste manual)
- **`GET /debug/rooms`:** salas ativas, ring buffer (200 eventos) — sempre ativo
- **`DEBUG=1`:** só habilita a mensagem dev-only `dev_launcher` (T-012, trocar lançador manualmente)
- **`BOT_VERBOSE=1`:** logs de decisão dos bots (alvo, caminho, fuga, `"preso — escapando lateralmente"` do anti-stuck)

---

## O que ainda não escala o jogador

- Aura, crítico, armadura (M2+)
- Matchmaking por nível (M3)
- Acumulador persistente da box **aplicado** ao round (scaffold only)
- Personalidade/atributos sorteados de bot + modo boss (T-008b) — hoje só a skill `fraco/medio/forte` varia
