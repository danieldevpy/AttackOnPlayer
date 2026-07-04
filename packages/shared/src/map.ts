import { BASE_MAP_W, MAP_MIN_SCALE } from "./constants";
import { mulberry32 } from "./rng";

export const TILE_FREE = 0;
export const TILE_WALL = 1;

/** Mapa é definido por (w, h, seed) — 3 números sincronizados; cada lado reconstrói igual. */
export interface GameMap {
  w: number;
  h: number;
  seed: number;
  cells: Uint8Array;
}

/** ADR-007: mínimo 5x o base (75x65); cresce com jogadores esperados. Só entre rounds. */
export function mapSizeFor(expectedPlayers: number): { w: number; h: number } {
  const extra = Math.max(0, Math.floor(expectedPlayers) - 4);
  const w = Math.min(BASE_MAP_W * MAP_MIN_SCALE + extra * 10, 115); // 75..115 (ímpar)
  return { w, h: w - 10 };
}

/**
 * Grid estilo Bomberman: bordas + pilares em coordenadas pares, mais obstáculos
 * aleatórios determinísticos. Obstáculos extras só em cruzamentos (x,z ímpares),
 * nunca adjacentes a outro e nunca perto de spawn → conectividade garantida.
 */
export function buildMap(w: number, h: number, seed: number): GameMap {
  const cells = new Uint8Array(w * h);
  for (let z = 0; z < h; z++) {
    for (let x = 0; x < w; x++) {
      const border = x === 0 || z === 0 || x === w - 1 || z === h - 1;
      const pillar = x % 2 === 0 && z % 2 === 0;
      cells[z * w + x] = border || pillar ? TILE_WALL : TILE_FREE;
    }
  }
  const rnd = mulberry32(seed);
  const spawns = spawnPoints(w, h);
  for (let z = 1; z < h - 1; z += 2) {
    for (let x = 1; x < w - 1; x += 2) {
      const nearSpawn = spawns.some((s) => Math.abs(s.x - (x + 0.5)) + Math.abs(s.z - (z + 0.5)) < 6);
      const neighborBlocked =
        (x - 2 > 0 && cells[z * w + (x - 2)] === TILE_WALL) ||
        (z - 2 > 0 && cells[(z - 2) * w + x] === TILE_WALL);
      if (!nearSpawn && !neighborBlocked && rnd() < 0.08) cells[z * w + x] = TILE_WALL;
    }
  }
  return { w, h, seed, cells };
}

export function isWall(map: GameMap, x: number, z: number): boolean {
  if (x < 0 || z < 0 || x >= map.w || z >= map.h) return true;
  return map.cells[z * map.w + x] === TILE_WALL;
}

/** Cantos + meios das bordas (centro do tile), sempre em células de corredor livres. */
export function spawnPoints(w: number, h: number): Array<{ x: number; z: number }> {
  const oddMid = (n: number) => {
    let m = Math.floor(n / 2);
    if (m % 2 === 0) m -= 1;
    return m + 0.5;
  };
  return [
    { x: 1.5, z: 1.5 },
    { x: w - 1.5, z: 1.5 },
    { x: 1.5, z: h - 1.5 },
    { x: w - 1.5, z: h - 1.5 },
    { x: oddMid(w), z: 1.5 },
    { x: oddMid(w), z: h - 1.5 },
    { x: 1.5, z: oddMid(h) },
    { x: w - 1.5, z: oddMid(h) },
  ];
}

/** Colisão círculo (jogador) vs grid, resolvida por eixo (desliza na parede). */
export function moveWithCollision(
  map: GameMap,
  px: number,
  pz: number,
  dx: number,
  dz: number,
  radius: number
): { x: number; z: number } {
  let x = px + dx;
  if (circleHitsWall(map, x, pz, radius)) x = px;
  let z = pz + dz;
  if (circleHitsWall(map, x, z, radius)) z = pz;
  return { x, z };
}

export function circleHitsWall(map: GameMap, cx: number, cz: number, r: number): boolean {
  const minTx = Math.floor(cx - r);
  const maxTx = Math.floor(cx + r);
  const minTz = Math.floor(cz - r);
  const maxTz = Math.floor(cz + r);
  for (let tz = minTz; tz <= maxTz; tz++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (!isWall(map, tx, tz)) continue;
      const nx = Math.max(tx, Math.min(cx, tx + 1));
      const nz = Math.max(tz, Math.min(cz, tz + 1));
      const ddx = cx - nx;
      const ddz = cz - nz;
      if (ddx * ddx + ddz * ddz < r * r) return true;
    }
  }
  return false;
}
