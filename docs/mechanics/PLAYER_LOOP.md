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

Cada level-up adiciona **+1 ponto em cada** atributo (força, velocidade, vitalidade) — preset equilibrado v1.

### Efeito de cada atributo

Cada ponto = **+4%** no multiplicador (`ATTR_POINT_VALUE = 0.04`):

| Atributo | Impacto |
|---|---|
| **Força** | Dano do tiro = `launcher.damage × strength` |
| **Velocidade** | Movimento = `PLAYER_SPEED × speed` (empilha com `speed_up`, teto 2×) |
| **Vitalidade** | `maxHp = 100 × vitality` (`PLAYER_BASE_HP`) |

### Buffs temporários

| Coletável | Efeito |
|---|---|
| `speed_up` | +50% velocidade por 8s |
| `farm_event` | XP ×2 por 20s |

### Box (zona de guerra)

- **No round:** +3 pontos em **cada** atributo (`BOX_ATTR_BONUS_EACH`) — 3× um level-up normal
- **Persistência (scaffold ADR-012):** soma no acumulador por `playerToken` no servidor — **não altera poder in-round ainda**; visível só em dev

---

## Coins e reroll

### Como ganhar coins

Coletável `coin_buff` → **+10 coins** (`COIN_BUFF_AMOUNT`).

### O que reroll faz (tecla **R**)

- Custa **15 coins** (`COIN_REROLL_COST`)
- **Redistribui aleatoriamente** o total de pontos de atributo **já ganhos no round** entre força/velocidade/vitalidade
- **Mantém a soma** — só muda a especialização (tank / dps / mobile)
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

- Input: **click** define direção; servidor aplica cooldown (~600 ms no `basic_shot`)
- Projétil: alcance ~8u; some em prop ou ao acertar
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

- **F3:** overlay com estado + feed de eventos
- **`GET /debug/rooms`:** salas ativas, ring buffer (200 eventos)
- **`DEBUG=1`:** eventos também via WebSocket
- **`BOT_VERBOSE=1`:** logs de decisão dos bots

---

## O que ainda não escala o jogador

- Aura, crítico, armadura (M2+)
- Matchmaking por nível (M3)
- Acumulador persistente da box **aplicado** ao round (scaffold only)
- Bots não atiram sozinhos — combate PvP manual ou T-008
