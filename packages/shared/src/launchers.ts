export interface LauncherDef {
  id: string;
  name: string;
  projectile: {
    speed: number;
    /**
     * Raio de HIT contra JOGADORES — a "sensação de acerto" (TTK, hitbox generosa). Mantido
     * confortável de propósito: o jogador não deve "errar tiro que parecia acertar".
     */
    radius: number;
    /**
     * T-038 (SPEC-0011): raio de colisão contra o CENÁRIO (props/paredes), MENOR que `radius`.
     * Um projétil fino atravessa o vão diagonal entre dois props que se tocam no canto — o
     * `radius` cheio (0.4) batia no canto e morria. Ausente = usa `radius` (retrocompat).
     */
    sceneryRadius?: number;
    range: number;
  };
  fire: {
    cooldownMs: number;
    pattern: "straight";
  };
  damage: number;
  onHitEffects: string[];
  /**
   * T-012: ganchos opcionais de mobilidade — como o disparo interfere no movimento.
   * Todos com default neutro (ausente = sem efeito nenhum); `basic_shot` não define
   * nada aqui de propósito. Aplicado pelo servidor via EffectSystem no momento do tiro.
   */
  movement?: {
    selfSlowFactor?: number; // multiplica a velocidade do atirador (0<x<1 = mais lento)
    selfSlowMs?: number; // duração do slow em ms
    inheritVelocityFactor?: number; // 0..1 — fração da velocidade do atirador herdada pelo projétil
  };
}

export const LAUNCHERS: Record<string, LauncherDef> = {
  basic_shot: {
    id: "basic_shot",
    name: "Tiro Básico",
    projectile: {
      speed: 12, // units per second
      radius: 0.4, // hit em player: hitbox confortável (não muda o TTK/sensação — T-038)
      sceneryRadius: 0.22, // T-038: cenário fino — atravessa o vão diagonal entre props que se tocam no canto
      range: 8,
    },
    fire: {
      cooldownMs: 600,
      pattern: "straight",
    },
    // T-014 (SPEC-0004/ADR-013): 10 → 20. TTK alvo = 5 tiros em níveis iguais sem
    // especialização (antes eram 10 — TTK constante, confronto nunca fechava em 2–3 min).
    damage: 20,
    onHitEffects: [],
  },
  // T-039 (SPEC-0011): lançador coletável VANTAJOSO — pesado. Dano ~1.4× do basic, projétil
  // mais lento, cooldown maior. DPS ligeiramente acima do basic, mas exige mirar bem (bala
  // lenta). Vantagem clara, não absurda (anti-snowball, pilar 4). Inspirado no heavy_shot_dev,
  // mas SEM os ganchos de mobilidade (self-slow) — é uma arma de pegar e usar, não de teste.
  heavy_shot: {
    id: "heavy_shot",
    name: "Tiro Pesado",
    projectile: {
      speed: 9, // mais lento que o basic (12) — bala pesada, precisa de leitura de mira
      radius: 0.42, // hit em player levemente maior (bala grande) — leitura generosa
      sceneryRadius: 0.24, // T-038: também atravessa o vão diagonal
      range: 8,
    },
    fire: {
      cooldownMs: 780, // maior que o basic (600) — cadência baixa
      pattern: "straight",
    },
    damage: 28, // 1.4× do basic (20). DPS ≈ 28/0.78 = 35.9/s vs basic 33.3/s: +8% de DPS
    onHitEffects: [],
  },
  // T-039 (SPEC-0011): lançador coletável VANTAJOSO — rápido. Cooldown bem menor, dano menor
  // por tiro, DPS levemente acima do basic. Vantagem = pressão contínua e chance de hit maior,
  // não burst. Também anti-snowball (dano baixo por bala = punição por errar é pequena).
  rapid_shot: {
    id: "rapid_shot",
    name: "Tiro Rápido",
    projectile: {
      speed: 13, // levemente mais rápido — bala leve/ágil
      radius: 0.38, // hit em player levemente menor (bala pequena)
      sceneryRadius: 0.2, // T-038: o mais fino — atravessa o vão diagonal com folga
      range: 8,
    },
    fire: {
      cooldownMs: 340, // bem menor que o basic (600) — cadência alta
      pattern: "straight",
    },
    damage: 13, // menor por tiro. DPS ≈ 13/0.34 = 38.2/s vs basic 33.3/s: +15% de DPS
    onHitEffects: [],
  },
  // T-012: lançador de teste (dev-only, ver ArenaRoom `dev_launcher`) — valida o
  // gancho de mobilidade. Nunca atribuído por padrão a jogador nenhum.
  heavy_shot_dev: {
    id: "heavy_shot_dev",
    name: "[DEV] Tiro Pesado",
    projectile: {
      speed: 9,
      radius: 0.5,
      range: 8,
    },
    fire: {
      cooldownMs: 900,
      pattern: "straight",
    },
    damage: 28, // T-014: mantém a proporção 1.4× do basic_shot após o rebalance de TTK
    onHitEffects: [],
    movement: {
      selfSlowFactor: 0.5,
      selfSlowMs: 700,
      inheritVelocityFactor: 0.3,
    },
  },
};
