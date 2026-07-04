import { MAP_W, MAP_H } from "./constants";

export const TILE_FREE = 0;
export const TILE_WALL = 1;

/** Grid estilo Bomberman: bordas sólidas + pilares em coordenadas pares. */
export function buildMap(): Uint8Array {
  const grid = new Uint8Array(MAP_W * MAP_H);
  for (let z = 0; z < MAP_H; z++) {
    for (let x = 0; x < MAP_W; x++) {
      const border = x === 0 || z === 0 || x === MAP_W - 1 || z === MAP_H - 1;
      const pillar = x % 2 === 0 && z % 2 === 0;
      grid[z * MAP_W + x] = border || pillar ? TILE_WALL : TILE_FREE;
    }
  }
  return grid;
}

export function isWall(grid: Uint8Array, x: number, z: number): boolean {
  if (x < 0 || z < 0 || x >= MAP_W || z >= MAP_H) return true;
  return grid[z * MAP_W + x] === TILE_WALL;
}

/** Pontos de spawn (centro do tile) nos quatro cantos livres. */
export const SPAWN_POINTS: Array<{ x: number; z: number }> = [
  { x: 1.5, z: 1.5 },
  { x: MAP_W - 1.5, z: 1.5 },
  { x: 1.5, z: MAP_H - 1.5 },
  { x: MAP_W - 1.5, z: MAP_H - 1.5 },
];

/** Colisão círculo (jogador) vs grid, resolvida por eixo (desliza na parede). */
export function moveWithCollision(
  grid: Uint8Array,
  px: number,
  pz: number,
  dx: number,
  dz: number,
  radius: number
): { x: number; z: number } {
  let x = px + dx;
  if (circleHitsWall(grid, x, pz, radius)) x = px;
  let z = pz + dz;
  if (circleHitsWall(grid, x, z, radius)) z = pz;
  return { x, z };
}

export function circleHitsWall(grid: Uint8Array, cx: number, cz: number, r: number): boolean {
  const minTx = Math.floor(cx - r);
  const maxTx = Math.floor(cx + r);
  const minTz = Math.floor(cz - r);
  const maxTz = Math.floor(cz + r);
  for (let tz = minTz; tz <= maxTz; tz++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (!isWall(grid, tx, tz)) continue;
      // ponto mais próximo do AABB do tile ao centro do círculo
      const nx = Math.max(tx, Math.min(cx, tx + 1));
      const nz = Math.max(tz, Math.min(cz, tz + 1));
      const ddx = cx - nx;
      const ddz = cz - nz;
      if (ddx * ddx + ddz * ddz < r * r) return true;
    }
  }
  return false;
}
