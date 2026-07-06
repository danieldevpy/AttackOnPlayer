import { GameMap, Prop, Zone, TILE_FREE, TILE_WALL, floodFillReachable, spawnPoints, mapCenter } from "./map";
import { OBJECT_DEFS, isKnownObjectId } from "./objects";

/** T-024 (SPEC-0007): formato de mapa versionado. Um mapa curado é um `MapFileV1` salvo em
 * `maps/<id>.map.json` (fora dos packages — conteúdo, não código). `mapFileToGameMap` produz
 * a MESMA estrutura `GameMap` que o gerador por seed produz, então colisão/zonas/bots/render
 * não precisam saber se o mapa nasceu de seed ou de arquivo curado. */
export const MAP_FILE_VERSION = 1;

export interface MapInstance {
  objectId: string;
  x: number; // tile, canto inferior-esquerdo do footprint (mesma convenção de `Prop`)
  z: number;
  rot?: number; // graus — reservado (F1 de render/colisão ainda ignora)
  scale?: number; // reservado — footprint de colisão ainda não escala
}

export interface MapFileV1 {
  version: 1;
  id: string;
  name: string;
  author?: string;
  w: number;
  h: number;
  seed?: number; // seed de origem se o mapa nasceu de `gen` — informativo, não regenera nada
  instances: MapInstance[];
  zones: Zone[];
  spawns: Array<{ x: number; z: number }>;
  flag: { x: number; z: number };
}

/** Lista de erros — vazia = mapa válido. Nunca lança; quem chama decide (loader do servidor
 * lança com mensagem clara, CLI da T-025 imprime e recusa salvar). */
export function validateMapFile(m: MapFileV1): string[] {
  const errors: string[] = [];
  if (m.version !== MAP_FILE_VERSION) errors.push(`versão desconhecida: ${m.version}`);
  if (!(m.w > 2) || !(m.h > 2)) errors.push(`dimensões inválidas: ${m.w}x${m.h}`);
  if (!m.spawns?.length) errors.push("mapa sem nenhum spawn");

  const inBounds = (x: number, z: number) => x >= 0 && z >= 0 && x <= m.w && z <= m.h;

  (m.instances ?? []).forEach((inst, i) => {
    if (!isKnownObjectId(inst.objectId)) errors.push(`instância ${i}: objectId desconhecido "${inst.objectId}"`);
    if (!inBounds(inst.x, inst.z)) errors.push(`instância ${i}: fora dos limites (${inst.x},${inst.z})`);
  });
  (m.spawns ?? []).forEach((s, i) => {
    if (!inBounds(s.x, s.z)) errors.push(`spawn ${i}: fora dos limites (${s.x},${s.z})`);
  });
  if (!m.flag || !inBounds(m.flag.x, m.flag.z)) {
    errors.push(`bandeira fora dos limites (${m.flag?.x},${m.flag?.z})`);
  }

  if (errors.length === 0 && !floodFillReachable(mapFileToGameMap(m))) {
    errors.push("mapa tem região(ões) fechada(s) — flood-fill falhou");
  }
  return errors;
}

/** Converte o formato salvo em `GameMap`. Instâncias de objeto colidível marcam paredes no
 * grid pelo footprint do registry; `bandeira` (decorativa, marcador de zona) vira um `Prop`
 * como qualquer outro para o render, mas nunca colide. */
export function mapFileToGameMap(m: MapFileV1): GameMap {
  const cells = new Uint8Array(m.w * m.h);
  for (let z = 0; z < m.h; z++) {
    for (let x = 0; x < m.w; x++) {
      const border = x === 0 || z === 0 || x === m.w - 1 || z === m.h - 1;
      cells[z * m.w + x] = border ? TILE_WALL : TILE_FREE;
    }
  }

  const props: Prop[] = [];
  for (const inst of m.instances ?? []) {
    const def = OBJECT_DEFS[inst.objectId];
    if (!def) continue; // objectId desconhecido — validateMapFile já reporta o erro
    if (def.collidable) {
      for (let dz = 0; dz < def.footprint.h; dz++) {
        for (let dx = 0; dx < def.footprint.w; dx++) {
          const tx = inst.x + dx;
          const tz = inst.z + dz;
          if (tx >= 0 && tz >= 0 && tx < m.w && tz < m.h) cells[tz * m.w + tx] = TILE_WALL;
        }
      }
    }
    props.push({ x: inst.x, z: inst.z, w: def.footprint.w, h: def.footprint.h, type: inst.objectId as Prop["type"] });
  }

  return { w: m.w, h: m.h, seed: m.seed ?? 0, cells, props, zones: m.zones ?? [] };
}

/** T-025 (CLI de mapas): inverso de `mapFileToGameMap` — usado por `gen`/`save`/`update` da CLI
 * pra empacotar um `GameMap` recém-gerado (por seed) no formato v1 persistível. Spawns e
 * bandeira usam os defaults de sempre (cantos/meios-de-borda, centro do mapa) — o mesmo que a
 * sala usa no caminho procedural (`ArenaRoom.onCreate` sem `mapId`). */
export function gameMapToMapFile(map: GameMap, meta: { id: string; name: string; author?: string }): MapFileV1 {
  return {
    version: MAP_FILE_VERSION,
    id: meta.id,
    name: meta.name,
    author: meta.author,
    w: map.w,
    h: map.h,
    seed: map.seed,
    instances: map.props.map((p) => ({ objectId: p.type, x: p.x, z: p.z })),
    zones: map.zones,
    spawns: spawnPoints(map.w, map.h),
    flag: mapCenter(map.w, map.h),
  };
}

const OBJECT_SYMBOLS: Record<string, string> = {
  pedra: "o",
  arvore: "A",
  caixa: "C",
  muro: "=",
  bandeira: "b",
};

/** T-025 (CLI de mapas): preview ASCII de um `MapFileV1` — legível o suficiente pra revisar um
 * mapa curado sem abrir o jogo (critério de aceite da SPEC-0007). Desenha o grid completo
 * (borda + props pelo footprint do registry) e sobrepõe spawns/bandeira-objetivo como marcadores. */
export function mapFilePreview(m: MapFileV1): string {
  const grid: string[][] = [];
  for (let z = 0; z < m.h; z++) {
    const row: string[] = [];
    for (let x = 0; x < m.w; x++) {
      const border = x === 0 || z === 0 || x === m.w - 1 || z === m.h - 1;
      row.push(border ? "#" : ".");
    }
    grid.push(row);
  }

  for (const inst of m.instances ?? []) {
    const def = OBJECT_DEFS[inst.objectId];
    if (!def) continue;
    const sym = OBJECT_SYMBOLS[inst.objectId] ?? "?";
    for (let dz = 0; dz < def.footprint.h; dz++) {
      for (let dx = 0; dx < def.footprint.w; dx++) {
        const tx = inst.x + dx;
        const tz = inst.z + dz;
        if (tx >= 0 && tz >= 0 && tx < m.w && tz < m.h) grid[tz][tx] = sym;
      }
    }
  }

  for (const s of m.spawns ?? []) {
    const tx = Math.floor(s.x);
    const tz = Math.floor(s.z);
    if (tx >= 0 && tz >= 0 && tx < m.w && tz < m.h) grid[tz][tx] = "S";
  }
  if (m.flag) {
    const tx = Math.floor(m.flag.x);
    const tz = Math.floor(m.flag.z);
    if (tx >= 0 && tz >= 0 && tx < m.w && tz < m.h) grid[tz][tx] = "F";
  }

  const header = `Mapa "${m.id}" — ${m.name} (${m.w}x${m.h}${m.seed != null ? `, seed ${m.seed}` : ""})`;
  const legend = "Legenda: # parede/borda · . livre · o pedra · A arvore · C caixa · = muro · b bandeira(zona) · S spawn · F bandeira-objetivo";
  return [header, ...grid.map((row) => row.join("")), "", legend].join("\n");
}
