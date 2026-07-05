import type { Perception, Zone } from "./types";

export interface RawSelf {
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  level: number;
}

export interface RawEntity {
  id: string;
  x: number;
  z: number;
  hp?: number;
  maxHp?: number;
  level?: number;
}

/** Só o que a percepção precisa do mapa — mantém esta camada desacoplada do formato
 * concreto de `@aop/shared` (zona é injetada pelo chamador, que já conhece o mapa real). */
export interface MapBounds {
  w: number;
  h: number;
}

/** T-021: bandeira crua — posição atual (segue o portador) + se o próprio bot já a carrega. */
export interface RawFlag {
  x: number;
  z: number;
  carriedBySelf: boolean;
  /** id do portador; vazio = no chão. */
  carrierId?: string;
}

/**
 * Camada 1 (bot-architecture.md): snapshot FILTRADO do que o bot "veria" — inimigos vivos
 * dentro do raio de percepção (com ruído leve de distância), coletáveis e a distância da
 * borda mais próxima. Anti-trapaça de design: nunca recebe o estado inteiro do servidor.
 * A bandeira (quando a room liga o toggle) é objetivo de mapa — visível inteira, sem raio.
 */
export function buildPerception(
  map: MapBounds,
  self: RawSelf,
  enemies: RawEntity[],
  collectibles: RawEntity[],
  perceptionRadius: number,
  zoneOf: (x: number, z: number) => Zone,
  rng: () => number = Math.random,
  flag?: RawFlag
): Perception {
  const selfZone = zoneOf(self.x, self.z);

  const perceivedEnemies = enemies
    .map((e) => {
      const rawDist = Math.hypot(e.x - self.x, e.z - self.z);
      const noise = 1 + (rng() - 0.5) * 0.05; // ±2.5% — ruído de distância, não onisciência
      return {
        id: e.id,
        x: e.x,
        z: e.z,
        hp: e.hp ?? 0,
        maxHp: e.maxHp ?? 1,
        level: e.level ?? 1,
        dist: rawDist * noise,
        zone: zoneOf(e.x, e.z),
      };
    })
    .filter((e) => e.dist <= perceptionRadius)
    .sort((a, b) => a.dist - b.dist);

  const perceivedCollectibles = collectibles
    .map((c) => ({ id: c.id, x: c.x, z: c.z, dist: Math.hypot(c.x - self.x, c.z - self.z) }))
    .sort((a, b) => a.dist - b.dist);

  const nearestBorderDist = Math.min(self.x, map.w - self.x, self.z, map.h - self.z);

  const perceivedFlag = flag
    ? {
        x: flag.x,
        z: flag.z,
        dist: Math.hypot(flag.x - self.x, flag.z - self.z),
        zone: zoneOf(flag.x, flag.z),
        carriedBySelf: flag.carriedBySelf,
        carrierId: flag.carrierId || undefined,
      }
    : undefined;

  return {
    self: { x: self.x, z: self.z, hp: self.hp, maxHp: self.maxHp, level: self.level, zone: selfZone },
    enemies: perceivedEnemies,
    collectibles: perceivedCollectibles,
    nearestBorderDist,
    flag: perceivedFlag,
  };
}
