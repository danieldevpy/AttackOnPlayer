# SPEC-0010 — Sobrevivência: recompensa de kill contextual + recursos de vida escassos

**Status:** implementada (PROMPT-0037) · **Marco:** V1 (fase F2.5, antes do go-live F6) · **Data:** 2026-07-05

## Problema / objetivo

Hoje o único jeito de recuperar vida é **morrer e renascer** — o que zera o nível (SPEC-0005). Isso pune quem está jogando bem: um jogador com boa mira, mas machucado, não tem como se sustentar sem apostar tudo numa troca ou fugir do mapa. Falta um eixo de **sobrevivência por habilidade**: quem lê a briga e acerta deve conseguir *recursos para se manter vivo* dentro do round, sem virar bola de neve.

Três mecânicas, um só objetivo — "jogar bem = viver mais":
1. **Recompensa de kill contextual** — o abate paga diferente conforme a situação: duelo isolado → progressão (XP); briga generalizada → sobrevivência (cura).
2. **Orbes de vida (`hp_orb`)** — poucos, escassos, longe de todos e uns dos outros.
3. **Escudo temporário (`shield_temp`)** — no máximo 2 no mapa; reduz dano por alguns segundos.

## Comportamento esperado (observável pelo jogador)

### 1. Recompensa de kill contextual
- **Todo abate** continua dando o XP de kill de sempre (`XP_PER_KILL_PER_LEVEL × nível da vítima`).
- No instante do abate, o servidor conta **quantos inimigos vivos** (fora matador e vítima) estão dentro de um raio de combate ao redor do matador. Esse número é a "temperatura da briga":
  - **Duelo (0 inimigos por perto):** ganha um **bônus de XP** ("recompensa pela morte da pessoa") — o abate limpo vale progressão.
  - **Briga generalizada (≥1 inimigo por perto):** **cura um percentual da vida FALTANTE** (não da vida total). A fração cresce com a quantidade de inimigos por perto, até um teto. Nunca ultrapassa `maxHp`.
- Usar **vida faltante** (não vida total) é autolimitante de propósito: perto da morte, um abate te resgata de verdade; quase cheio, cura pouco. Recompensa proporcional ao risco em que você estava.
- Feedback: toast + VFX ("+X vida" no matador em briga; "+X XP" em duelo) reusando o registry de VFX/toasts (T-022/T-023).

### 2. Orbes de vida (`hp_orb`)
- Coletável novo que dá **+HP fixo pequeno** ao ser pego (limitado ao `maxHp`).
- **Escassos por design:** teto baixo de instâncias simultâneas no mapa; reposição lenta.
- **Espaçamento próprio, mais rígido que o coletável comum:** nasce a uma distância considerável de **qualquer jogador** e de **outro `hp_orb`**. Nunca "chove vida" num canto só.
- Nasce em campo aberto (não amarrado à zona de guerra) — recurso de sobrevivência é para quem está circulando, não prêmio de ponto quente.

### 3. Escudo temporário (`shield_temp`)
- Coletável novo. Ao pegar, o jogador **recebe menos dano por alguns segundos** (redução percentual, não imunidade — dispara acabar não perde o escudo, diferente da invulnerabilidade de nascimento).
- **No máximo 2 instâncias no mapa** ao mesmo tempo; espaçamento próprio (longe de players e de outro `shield_temp`), reposição lenta.
- Enquanto ativo: tag no HUD + VFX de escudo; o projétil que acerta ainda **consome e mostra hit**, mas o dano chega reduzido (nunca parece que a hitbox falhou).

## Fora de escopo

- Regeneração passiva de HP (curar parado). Contraria o pilar "jogo ativo" — sobrevivência vem de ação (abate/coleta), nunca de esperar.
- Cura como drop de `box`, armadura permanente, crítico, lifesteal por dano (só por **abate**).
- Amarrar qualquer coisa disso à **aura** (Pós-V1/M2) — aqui é mecânica objetiva e determinística, sem RNG de qualidade.
- Escudo como item ativo/equipável ou como skill de build. Aqui é só pickup temporário do mapa.
- Persistência entre rounds (ADR-012). Tudo expira no round.

## Critérios de aceite

- [ ] **Kill em duelo** (nenhum inimigo no raio de combate) → XP extra aplicado, **sem** cura. Testável com 2 bots isolados (smoke headless conta o evento).
- [ ] **Kill em briga** (≥1 inimigo no raio) → cura = fração da vida faltante, escalando com nº de inimigos até o teto, **sem** estourar `maxHp`. Testável com ≥3 bots aglomerados.
- [ ] Abate com HP cheio em briga → cura ≈ 0 (faltante ≈ 0); não vira overheal. Regressão coberta.
- [ ] `hp_orb`: nunca mais que o teto no mapa; sempre respeitando as duas distâncias mínimas (player e mesmo-kind). Verificável por asserção no spawner + log de spawn.
- [ ] `shield_temp`: nunca mais que 2 no mapa; enquanto o efeito está ativo no alvo, o dano recebido é multiplicado pelo fator (medível no evento de hit `damage`/`hpAfter`).
- [ ] Escudo **não** bloqueia hit (consome projétil, emite `hit` com dano reduzido) — distinto do `blockedByShield` da invulnerabilidade de nascimento.
- [ ] Todos os números vivem em `packages/shared/src/constants.ts` (fonte única) — nenhuma constante de gameplay solta no Room/EffectSystem.
- [ ] Gates verdes: `@aop/shared` + server (vitest) + bots; smoke com bots aglomerados.

## Design detalhado (proposta de implementação — sujeita ao veredito do CD)

> Números abaixo são **chute inicial calibrável** (mesma ressalva de VFX/progressão): uma constante única move cada um. TTK de referência: 5 tiros × 20 dano em 100 HP (T-014).

### Constantes novas (`packages/shared/src/constants.ts`)
```ts
// SPEC-0010 (ADR-017): Sobrevivência — recompensa de kill contextual + recursos de vida.

// --- Recompensa de kill contextual ---
export const COMBAT_THREAT_RADIUS = 6;              // tiles: inimigos vivos aqui do matador = "a briga"
export const KILL_HEAL_MISSING_FRAC_BASE = 0.25;    // 1 ameaça: cura 25% da vida FALTANTE
export const KILL_HEAL_MISSING_FRAC_PER_EXTRA = 0.1;// +10% por ameaça adicional
export const KILL_HEAL_MISSING_FRAC_MAX = 0.5;      // teto anti-snowball: 50% da faltante
export const KILL_DUEL_XP_BONUS_PER_LEVEL = 8;      // duelo (0 ameaças): XP extra por nível da vítima

// --- Orbes de vida (hp_orb) ---
export const HP_ORB_AMOUNT = 5;                     // +5 HP (clampa em maxHp)
export const HP_ORB_MAX = 3;                        // teto simultâneo no mapa
export const HP_ORB_MIN_PLAYER_DIST = 7;            // tiles Manhattan de qualquer player
export const HP_ORB_MIN_SELF_DIST = 9;              // tiles de outro hp_orb
export const HP_ORB_RESPAWN_MS = 12000;             // reposição lenta

// --- Escudo temporário (shield_temp) ---
export const SHIELD_TEMP_MAX = 2;                   // teto simultâneo no mapa
export const SHIELD_TEMP_MIN_PLAYER_DIST = 7;
export const SHIELD_TEMP_MIN_SELF_DIST = 9;
export const SHIELD_TEMP_RESPAWN_MS = 15000;
export const SHIELD_TEMP_MS = 3000;                 // dura 3s ao coletar
export const SHIELD_TEMP_DAMAGE_MULT = 0.5;         // recebe 50% do dano enquanto ativo
```
- Estender `CollectibleKind` com `"hp_orb" | "shield_temp"`.

### Recompensa de kill (ArenaRoom, no bloco de morte já existente ~linha 294)
No ponto onde hoje faz `this.grantXp(hit.killerId, killer, XP_PER_KILL_PER_LEVEL * victim.level)`:
```ts
const threats = countLivingEnemiesNear(killer, hit.killerId, hit.targetId, COMBAT_THREAT_RADIUS);
if (threats === 0) {
  // duelo → progressão
  this.grantXp(hit.killerId, killer, KILL_DUEL_XP_BONUS_PER_LEVEL * victim.level);
  this.emitDebug("kill_duel_bonus", { playerId: hit.killerId });
} else {
  // briga → sobrevivência: cura % da vida FALTANTE, escalando, com teto, sem overheal
  const frac = Math.min(KILL_HEAL_MISSING_FRAC_MAX,
    KILL_HEAL_MISSING_FRAC_BASE + (threats - 1) * KILL_HEAL_MISSING_FRAC_PER_EXTRA);
  const heal = Math.round((killer.maxHp - killer.hp) * frac);
  if (heal > 0) {
    killer.hp = Math.min(killer.maxHp, killer.hp + heal);
    this.emitDebug("kill_heal", { playerId: hit.killerId, heal, threats });
    // toast/VFX no cliente via broadcast existente
  }
}
```
- `countLivingEnemiesNear`: varre `state.players`, ignora matador/vítima/mortos, conta `hypot < radius`. Server-only, O(n) por kill — barato.

### Escudo → dano reduzido (EffectSystem + projéteis)
- Novo `EffectKind = "damage_reduction"`, `DURATION.damage_reduction = SHIELD_TEMP_MS`.
- Novo campo sincronizado no `Player`: `@type("number") damageTakenMult = 1;` (mesmo padrão de `speed`/`vitality`).
- `recompute()`: `player.damageTakenMult = active.some(damage_reduction) ? SHIELD_TEMP_DAMAGE_MULT : 1`.
- `projectiles.ts`, no cálculo de dano (após checar spawn-protection): `const damage = launcher.damage * strength * proj.damageMult * target.damageTakenMult;`. Ordem: invulnerabilidade de nascimento **bloqueia** (fica); escudo **reduz** o que passa.

### Spawner de sobrevivência (ArenaRoom — passe dedicado, separado do genérico)
- **Não** entra no orçamento/pesos do coletável comum. Passe próprio no `update()`:
  - conta `hp_orb` e `shield_temp` vivos no `state.collectibles`;
  - cada kind com seu timer (`nextHpSpawnAt`/`nextShieldSpawnAt`), teto (`HP_ORB_MAX`/`SHIELD_TEMP_MAX`) e as duas distâncias mínimas (player + mesmo-kind);
  - reusa `createCollectible(x, z, kind)` (generalizar a assinatura para aceitar kind explícito, sem quebrar o caminho por peso de zona).
- Coleta (bloco `collectibles.forEach`): `case "hp_orb"` → `p.hp = Math.min(p.maxHp, p.hp + HP_ORB_AMOUNT)`; `case "shield_temp"` → `this.effects.apply(pid, p, "damage_reduction", now)`.

### Cliente (leve)
- Render placeholder por kind: `hp_orb` (cruz/esfera vermelha), `shield_temp` (bolha/octaedro azul). Debug First — sem arte.
- Tag de escudo no HUD (reusa `player.effects`), toast "+X vida"/"+X XP" no evento de kill, VFX pela regra de intensidade (automático = leve).

## Decisão do Creative Director
**Aprovada para implementação (2026-07-05):** o CD pediu "implemente esse plano" — construído tal e qual a proposta (T-033..T-035, PROMPT-0037). **Pendente de veredito de sensação:** os 4 tunables (`KILL_HEAL_MISSING_FRAC_BASE`, `COMBAT_THREAT_RADIUS`, `HP_ORB_AMOUNT`, `SHIELD_TEMP_DAMAGE_MULT`) foram entregues com defaults e só fecham com o CD jogando período longo — mesma ressalva de VFX/progressão. Ajustável por constante única em `constants.ts`.

## Notas da IA (Lead Designer)

**Por que isto respeita o anti-snowball (pilar 4) e o risco real (pilar 3):**
- A cura **só existe onde há risco** (cercado). Num 1v1, o vencedor dominante **não** se sustenta de graça — recebe XP, não vida. Isso corta o loop "mato→curo→mato→curo" contra alvos isolados, que seria o vetor clássico de bola de neve.
- Curar % da **vida faltante** (não total) faz a cura tender a zero quando você está saudável: o recurso vai para quem estava por um fio, não para quem já domina.
- Tetos duros em tudo: fração de cura (50%), nº de orbes (3), escudos (2), redução (50%, não imunidade). Nada empilha ao infinito.
- Escassez + espaçamento dos orbes cria **deslocamento** (você tem que ir buscar, expondo-se) em vez de kite seguro perto de um ponto de cura.

**Riscos a vigiar:**
1. **Aglomerado curador.** Se brigas grandes viram "quem mata cura mais", pode incentivar teamfight eterno. Mitigação já embutida: cura é da faltante (quem está inteiro ganha pouco) e o mapa é grande. Medir com métrica `kill_heal` antes de mexer.
2. **Proxy de "briga".** Usei proximidade de inimigos vivos no instante do abate. Alternativa considerada: "tomou dano de N fontes distintas nos últimos Xs". Proximidade é mais barata e imediata, mas conta inimigo por perto que não estava atirando. Se soar errado jogando, troco o proxy sem mudar a interface (constante/função isolada).
3. **`shield_temp` + invulnerabilidade de nascimento** poderiam confundir no debug. Por isso são caminhos distintos: nascimento **bloqueia** (`blockedByShield`, dano 0), escudo **reduz** (`hit` normal com dano menor). Eventos separados.
4. **Calibração é sensação, não lógica.** Os 4 números-chave (`KILL_HEAL_MISSING_FRAC_BASE`, `COMBAT_THREAT_RADIUS`, `HP_ORB_AMOUNT`, `SHIELD_TEMP_DAMAGE_MULT`) só o CD fecha jogando. Entrego com defaults e deixo pendente de veredito humano, como VFX/progressão.

**Encaixe na esteira V1:** não bloqueia F3/F4/F5. Server-autoritativo, reusa EffectSystem + spawner + VFX/toasts que já existem. Recomendo entrar como **F2.5** (gameplay), rodando em paralelo ou logo após T-024/T-025, e **obrigatoriamente antes do go-live (F6)** — é conteúdo de sensação de jogo que o CD quis sentir antes de lançar.
