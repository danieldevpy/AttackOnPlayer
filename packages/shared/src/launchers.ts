export interface LauncherDef {
  id: string;
  name: string;
  projectile: {
    speed: number;
    radius: number;
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
      radius: 0.4,
      range: 8,
    },
    fire: {
      cooldownMs: 600,
      pattern: "straight",
    },
    damage: 10,
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
    damage: 14,
    onHitEffects: [],
    movement: {
      selfSlowFactor: 0.5,
      selfSlowMs: 700,
      inheritVelocityFactor: 0.3,
    },
  },
};
