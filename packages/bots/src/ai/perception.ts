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

/**
 * Camada 1 (bot-architecture.md): snapshot FILTRADO do que o bot "veria" — inimigos vivos
 * dentro do raio de percepção (com ruído leve de distância), coletáveis e a distância da
 * borda mais próxima. Anti-trapaça de design: nunca recebe o estado inteiro do servidor.
 */
export function buildPerception(
  map: MapBounds,
  self: RawSelf,
  enemies: RawEntity[],
  collectibles: RawEntity[],
  perceptionRadius: number,
  zoneOf: (x: number, z: number) => Zone,
  rng: () => number = Math.random
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

  return {
    self: { x: self.x, z: self.z, hp: self.hp, maxHp: self.maxHp, level: self.level, zone: selfZone },
    enemies: perceivedEnemies,
    collectibles: perceivedCollectibles,
    nearestBorderDist,
  };
}
