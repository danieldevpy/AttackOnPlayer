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
- Sem dano em zona safe (ver world.md). Se o tiro encostar num player protegido pela safe zone, o projétil é consumido e emite evento `safe_block` no debug para ficar claro que foi proteção, não falha de hitbox.
- Escalabilidade: padrão de disparo novo = implementar 1 função `pattern` nova; arma nova = 1 entrada de dados. NUNCA lógica de arma no Room.

## Mira ≠ gatilho (T-010)
- Input passa a ser `{x, z, aimX?, aimZ?, fire?}` — não existe mais `fx/fz` acoplando mira e disparo.
- `fire` é só um booleano ("estou atirando?"); a **direção do tiro sempre sai do `Player.dir`** (facing, ver movement.md), nunca do input diretamente. Isso garante que espaço e clique produzam projéteis idênticos.
- `ProjectileSystem` só olha `p.firing` + cooldown do lançador; se `zoneAt(p) === "safe"`, não dispara.
- Spawn do projétil = posição autoritativa do player no tick + offset de raio (`PLAYER_RADIUS`) na direção do facing — sem tiro "atrasado" atirando em movimento.
- Cliente mapeia gatilhos num `Set` (`fireSources`): mousedown adiciona `"mouse"`, espaço adiciona `"space"`; `fire = fireSources.size > 0`. Gatilho novo (gamepad/touch) = uma entrada nesse set, sem mudar o protocolo.
- Mira (`aimX/aimZ`) continua sendo enviada sempre que o mouse se move na tela, independente de estar atirando — alimenta o facing híbrido (T-009), não o disparo.

## Ganchos de mobilidade por lançador (T-012)
- `LauncherDef.movement` é opcional e data-driven — aplicado pelo servidor via `EffectSystem` no momento do disparo (`ProjectileSystem`, não lógica solta no Room). Ausente/neutro = `basic_shot` não muda em nada.
- `selfSlowFactor` + `selfSlowMs`: vira um `EffectKind` novo (`launcher_slow`) com **magnitude dinâmica** (`ActiveEffect.magnitude`) em vez de uma constante fixa — cada lançador define seu próprio fator/duração. Expira sozinho pelo `EffectSystem.tick()` de sempre, sem código extra.
- `inheritVelocityFactor`: soma uma fração do vetor de movimento do atirador (`inputX/inputZ × PLAYER_SPEED × player.speed`) à velocidade do projétil antes de normalizar a direção — hoje só afeta a direção (a magnitude do disparo continua fixa em `projectile.speed`); pensado para projéteis pesados futuros "puxarem" com o movimento.
- **Lançador de teste (dev-only):** `heavy_shot_dev` no registro (`packages/shared/src/launchers.ts`) — `selfSlowFactor: 0.5`, `selfSlowMs: 700`, `inheritVelocityFactor: 0.3`. Só é atribuível via mensagem `dev_launcher`, e essa mensagem só funciona com `DEBUG=1` no servidor — nunca alcançável em produção.

## v1 (T-005)
1 lançador `basic_shot`: tiro reto, cd 600ms, alcance 8u. Placeholder: esfera pequena. Hit = flash no alvo + número de dano flutuante (F1 de feedback).

## Evolução planejada
Padrões novos (spread/lob/homing), troca de lançador por drop (box), skills ativas por input, i-frames de esquiva (insumo da aura, ADR-005).

## Aberto (decidir com CD)
TTK alvo; morte/perda de nível (T-006); quantos lançadores no MVP.
