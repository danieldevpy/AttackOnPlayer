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
}
```

## Regras
- Servidor simula tudo: spawn do projétil (input `fire {dirX, dirZ}` validado + cooldown), integração por tick, colisão com props (some) e jogadores (dano).
- Colisão com jogadores usa o segmento percorrido pelo projétil no tick, não só a posição final, para evitar tiro "atravessar" em baixa taxa de simulação.
- Dano efetivo = `damage × força do atirador`; vida = `vitalidade` (ver growth.md).
- Sem dano em zona safe (ver world.md). Se o tiro encostar num player protegido pela safe zone, o projétil é consumido e emite evento `safe_block` no debug para ficar claro que foi proteção, não falha de hitbox.
- Escalabilidade: padrão de disparo novo = implementar 1 função `pattern` nova; arma nova = 1 entrada de dados. NUNCA lógica de arma no Room.

## v1 (T-005)
1 lançador `basic_shot`: tiro reto, cd 600ms, alcance 8u. Placeholder: esfera pequena. Hit = flash no alvo + número de dano flutuante (F1 de feedback).

## Evolução planejada
Padrões novos (spread/lob/homing), troca de lançador por drop (box), skills ativas por input, i-frames de esquiva (insumo da aura, ADR-005).

## Aberto (decidir com CD)
TTK alvo; morte/perda de nível (T-006); quantos lançadores no MVP.
