# Combate — Lançadores (ADR-011)

Mecânica central: **acertar o objeto lançado em outra pessoa.**

## Modelo de dados (shared/src/launchers.ts — T-005)
```ts
interface LauncherDef {
  id: string;              // "basic_shot"
  name: string;
  projectile: {
    speed: number;         // u/s
    radius: number;        // colisão
    range: number;         // u até desaparecer ("ter distância, modo longe")
  };
  fire: {
    cooldownMs: number;
    pattern: "straight";   // evolui: "spread" | "lob" | "homing" | "orbit"...
  };
  damage: number;          // base — multiplicado por atributos do jogador
  onHitEffects: EffectKind[]; // ex.: slow, burn — reusa EffectSystem
  movement?: {             // T-012 — opcional, default ausente = comportamento neutro
    selfSlowFactor?: number;       // multiplica a velocidade do atirador ao disparar (0<x<1)
    selfSlowMs?: number;           // duração do slow
    inheritVelocityFactor?: number; // 0..1 — fração da velocidade do atirador herdada pelo projétil
  };
}
```

## Regras
- Servidor simula tudo: spawn do projétil, integração por tick, colisão com props (some) e jogadores (dano).
- Colisão com jogadores usa o segmento percorrido pelo projétil no tick, não só a posição final, para evitar tiro "atravessar" em baixa taxa de simulação.
- Dano efetivo = `damage × força do atirador`; vida = `vitalidade` (ver growth.md).
- **Invulnerabilidade de nascimento (SPEC-0005):** se o tiro encostar num player com escudo ativo (3s ao nascer/renascer, `SPAWN_PROTECTION_MS`), o projétil é consumido e emite evento `shield_block` no debug — proteção, não falha de hitbox. O escudo cai no instante em que o próprio player dispara. (Substitui a antiga zona safe, removida do mapa — o código do `safe_block` permanece só para os testes.)
- Escalabilidade: padrão de disparo novo = implementar 1 função `pattern` nova; arma nova = 1 entrada de dados. NUNCA lógica de arma no Room.

## Mira ≠ gatilho (T-010)
- Input passa a ser `{x, z, aimX?, aimZ?, fire?}` — não existe mais `fx/fz` acoplando mira e disparo.
- `fire` é só um booleano ("estou atirando?"); a **direção do tiro sempre sai do `Player.dir`** (facing, ver movement.md), nunca do input diretamente. Isso garante que espaço e clique produzam projéteis idênticos.
- `ProjectileSystem` só olha `p.firing` + cooldown do lançador (a antiga trava `zoneAt === "safe"` nunca dispara agora — sem safe zones). Disparar zera `spawnProtectedUntil` (encerra a invulnerabilidade de nascimento — SPEC-0005).
- Spawn do projétil = posição autoritativa do player no tick + offset de raio (`PLAYER_RADIUS`) na direção do facing — sem tiro "atrasado" atirando em movimento.
- Cliente mapeia gatilhos num `Set` (`fireSources`): mousedown adiciona `"mouse"`, espaço adiciona `"space"`; `fire = fireSources.size > 0`. Gatilho novo (gamepad/touch) = uma entrada nesse set, sem mudar o protocolo.
- **Facing pelo movimento (SPEC-0005):** o **cliente do player não envia `aim`** — o facing (`Player.dir`) é derivado pelo servidor do movimento (`inputX/inputZ`); parado, mantém o último `dir`. O campo `aimX/aimZ` do protocolo **continua existindo e é usado pelos bots** (que miram no alvo em combate), nunca pelo player humano.

## Ganchos de mobilidade por lançador (T-012)
- `LauncherDef.movement` é opcional e data-driven — aplicado pelo servidor via `EffectSystem` no momento do disparo (`ProjectileSystem`, não lógica solta no Room). Ausente/neutro = `basic_shot` não muda em nada.
- `selfSlowFactor` + `selfSlowMs`: vira um `EffectKind` novo (`launcher_slow`) com **magnitude dinâmica** (`ActiveEffect.magnitude`) em vez de uma constante fixa — cada lançador define seu próprio fator/duração. Expira sozinho pelo `EffectSystem.tick()` de sempre, sem código extra.
- `inheritVelocityFactor`: soma uma fração do vetor de movimento do atirador (`inputX/inputZ × PLAYER_SPEED × player.speed`) à velocidade do projétil antes de normalizar a direção — hoje só afeta a direção (a magnitude do disparo continua fixa em `projectile.speed`); pensado para projéteis pesados futuros "puxarem" com o movimento.
- **Lançador de teste (dev-only):** `heavy_shot_dev` no registro (`packages/shared/src/launchers.ts`) — `selfSlowFactor: 0.5`, `selfSlowMs: 700`, `inheritVelocityFactor: 0.3`. Só é atribuível via mensagem `dev_launcher`, e essa mensagem só funciona com `DEBUG=1` no servidor — nunca alcançável em produção.

## v1 (T-005)
1 lançador `basic_shot`: tiro reto, cd 600ms (base), alcance 8u (base), dano 20 (T-014 — TTK alvo 5 tiros). Placeholder: esfera pequena.

## Skills de projétil (T-017, SPEC-0004)
Camada de modificadores **por player** sobre o lançador equipado — registro data-driven em `packages/shared/src/skills.ts` (`SKILLS` + `combinedSkillMods`). Skill nova = 1 entrada; NUNCA lógica no Room (mesma regra dos lançadores).

| Skill | Efeito | Custo embutido |
|---|---|---|
| `tiro_duplo` | 2 projéteis (±6°) | 65% de dano cada |
| `leque` | 3 projéteis em cone (±20°) | 50% de dano cada |
| `perfurante` | atravessa 1 alvo (`hitIds` impede re-hit) | cooldown +25% |
| `folego` | +35% range, +20% velocidade do projétil | sem dano extra |
| `impulso` | kill reseta cooldown + `kill_rush` (+30% vel/2s, via EffectSystem) | — |

- **Combinação sem explosão:** projéteis por tiro = MAX entre skills; fatores de dano/range/cooldown = PRODUTO; pierce = SOMA.
- **Congelado no disparo:** dano/range/velocidade do projétil são fixados no spawn (`damageMult`/`maxRange`/`speedMult`) — build nunca muda projétil em voo.
- **Cooldown efetivo** = `cooldownMs × attackSpeed (cadência) × cooldownMult (skills)`.
- **Como ganhar:** marcos de nível 4/8/12 (card ★, escolher 1 de 2 — `SKILL_MILESTONE_CHOICES`) ou box (sorteia uma que falte). Morte apaga as skills (pilar risco real).
- Decisão de design: skills são modificadores por player; `LauncherDef` fica reservado a **lançadores novos** (armas trocáveis) — os dois empilham.

## Evolução planejada
Padrões novos (lob/homing/orbit), troca de lançador por drop (box), skills ativas por input, i-frames de esquiva (insumo da aura, ADR-005).

## Aberto (decidir com CD)
TTK alvo; morte/perda de nível (T-006); quantos lançadores no MVP.
