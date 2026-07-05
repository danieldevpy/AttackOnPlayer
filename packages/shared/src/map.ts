import { BASE_MAP_W, MAP_MIN_SCALE, PROP_DENSITY, SAFE_ZONE_RADIUS, WAR_ZONE_RADIUS } from "./constants";
import { mulberry32 } from "./rng";

export const TILE_FREE = 0;
export const TILE_WALL = 1;

/** Pré-modelos de visual chegam em T-002; aqui só o tipo e o footprint colidem. */
export type PropType = "pedra" | "arvore" | "caixa" | "muro";
export interface Prop {
  x: number; // canto inferior-esquerdo, em tiles
  z: number;
  w: number; // footprint em tiles
  h: number;
  type: PropType;
}

export type ZoneKind = "safe" | "war" | "field";
/** Zona circular em coordenadas de tile (ADR-010). */
export interface Zone {
  kind: "safe" | "war";
  cx: number;
  cz: number;
  radius: number;
}

/** Mapa é definido por (w, h, seed) — 3 números sincronizados; cada lado reconstrói igual. */
export interface GameMap {
  w: number;
  h: number;
  seed: number;
  cells: Uint8Array;
  props: Prop[];
  zones: Zone[];
}

/** ADR-007: mínimo 5x o base (75x65); cresce com jogadores esperados. Só entre rounds. */
export function mapSizeFor(expectedPlayers: number): { w: number; h: number } {
  const extra = Math.max(0, Math.floor(expectedPlayers) - 4);
  const w = Math.min(BASE_MAP_W * MAP_MIN_SCALE + extra * 10, 115); // 75..115 (ímpar)
  return { w, h: w - 10 };
}

const PROP_TYPES: PropType[] = ["pedra", "arvore", "caixa", "muro"];

/**
 * Uma zona de guerra central; mapas que cresceram além do mínimo (ADR-007) ganham uma segunda.
 * SPEC-0005: as zonas SAFE em torno de cada spawn foram REMOVIDAS — não existe mais canto
 * intocável. A proteção ao nascer virou invulnerabilidade temporal (SPAWN_PROTECTION_MS),
 * aplicada por player, não por região. O primitivo `kind: "safe"` continua existindo em
 * `zoneAt`/tipos (testes de combate ainda o exercem), só não é mais gerado no mapa.
 */
/** Centro do mapa — usado pela zona de guerra principal e pela posição default da
 * bandeira (T-021; T-024 vai poder sobrescrever via formato de mapa versionado). */
export function mapCenter(w: number, h: number): { x: number; z: number } {
  return { x: w / 2, z: h / 2 };
}

function buildZones(w: number, h: number, _spawns: Array<{ x: number; z: number }>): Zone[] {
  const zones: Zone[] = [];
  zones.push({ kind: "war", cx: w / 2, cz: h / 2, radius: WAR_ZONE_RADIUS });
  if (w > BASE_MAP_W * MAP_MIN_SCALE) {
    zones.push({ kind: "war", cx: w * 0.22, cz: h * 0.78, radius: WAR_ZONE_RADIUS * 0.8 });
  }
  return zones;
}

/**
 * Campo aberto (ADR-010, T-001): só a borda colide; props esparsos (~4%) ficam
 * isolados uns dos outros (nunca formam parede contínua → nenhuma região fechada)
 * e nunca nascem perto de spawn. Zonas (safe/guerra/campo) derivam do mesmo seed,
 * sem afetar o grid de colisão.
 */
export function buildMap(w: number, h: number, seed: number): GameMap {
  const cells = new Uint8Array(w * h);
  for (let z = 0; z < h; z++) {
    for (let x = 0; x < w; x++) {
      const border = x === 0 || z === 0 || x === w - 1 || z === h - 1;
      cells[z * w + x] = border ? TILE_WALL : TILE_FREE;
    }
  }

  const rnd = mulberry32(seed);
  const spawns = spawnPoints(w, h);
  const zones = buildZones(w, h, spawns);
  const props: Prop[] = [];

  const nearSpawn = (x: number, z: number, pw: number, ph: number) =>
    spawns.some((s) => Math.abs(s.x - (x + pw / 2)) + Math.abs(s.z - (z + ph / 2)) < SAFE_ZONE_RADIUS);

  // nenhum vizinho (incl. diagonais) já ocupado → props nunca se tocam, logo nunca fecham um corredor.
  const isIsolated = (x: number, z: number, pw: number, ph: number) => {
    for (let dz = -1; dz <= ph; dz++) {
      for (let dx = -1; dx <= pw; dx++) {
        const inside = dx >= 0 && dx < pw && dz >= 0 && dz < ph;
        if (inside) continue;
        const tx = x + dx;
        const tz = z + dz;
        if (tx < 0 || tz < 0 || tx >= w || tz >= h) continue;
        if (cells[tz * w + tx] === TILE_WALL) return false;
      }
    }
    return true;
  };

  const targetProps = Math.round(PROP_DENSITY * (w - 2) * (h - 2));
  let placed = 0;
  let attempts = 0;
  while (placed < targetProps && attempts < targetProps * 25) {
    attempts++;
    const type = PROP_TYPES[Math.floor(rnd() * PROP_TYPES.length)];
    const pw = type === "muro" ? 2 : 1;
    const ph = 1;
    const x = 1 + Math.floor(rnd() * (w - 1 - pw));
    const z = 1 + Math.floor(rnd() * (h - 2));
    if (nearSpawn(x, z, pw, ph)) continue;
    if (!isIsolated(x, z, pw, ph)) continue;
    for (let dx = 0; dx < pw; dx++) cells[z * w + (x + dx)] = TILE_WALL;
    props.push({ x, z, w: pw, h: ph, type });
    placed++;
  }

  return { w, h, seed, cells, props, zones };
}

/** T-024: flood-fill de sanidade — confirma que toda célula livre é alcançável a partir de
 * qualquer outra (nenhuma região fechada). O gerador por seed já garante isso estruturalmente
 * (`isIsolated`, props nunca se tocam); mapas curados (arquivo) precisam desta checagem
 * explícita na validação, já que um humano/CLI pode editar o JSON livremente. */
export function floodFillReachable(map: GameMap): boolean {
  const total = map.w * map.h;
  let start = -1;
  let freeCount = 0;
  for (let i = 0; i < total; i++) {
    if (map.cells[i] !== TILE_FREE) continue;
    freeCount++;
    if (start === -1) start = i;
  }
  if (start === -1) return true; // sem células livres — nada a checar

  const seen = new Uint8Array(total);
  const stack = [start];
  seen[start] = 1;
  let reached = 1;
  while (stack.length) {
    const idx = stack.pop()!;
    const x = idx % map.w;
    const z = Math.floor(idx / map.w);
    const neighbors: Array<[number, number]> = [
      [x + 1, z],
      [x - 1, z],
      [x, z + 1],
      [x, z - 1],
    ];
    for (const [nx, nz] of neighbors) {
      if (nx < 0 || nz < 0 || nx >= map.w || nz >= map.h) continue;
      const nIdx = nz * map.w + nx;
      if (seen[nIdx] || map.cells[nIdx] !== TILE_FREE) continue;
      seen[nIdx] = 1;
      reached++;
      stack.push(nIdx);
    }
  }
  return reached === freeCount;
}

/** Zona no ponto dado (centro de tile ou posição contínua). Safe tem prioridade sobre guerra. */
export function zoneAt(map: GameMap, x: number, z: number): ZoneKind {
  let inWar = false;
  for (const zone of map.zones) {
    if (Math.hypot(zone.cx - x, zone.cz - z) > zone.radius) continue;
    if (zone.kind === "safe") return "safe";
    inWar = true;
  }
  return inWar ? "war" : "field";
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
