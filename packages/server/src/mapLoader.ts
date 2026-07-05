import { readFileSync } from "fs";
import { join } from "path";
import { MapFileV1, validateMapFile, mapFileToGameMap, GameMap } from "@aop/shared";

/** T-024: mapas curados vivem em `<repo>/maps/<id>.map.json` — conteúdo versionado, não código
 * de nenhum package (a CLI da T-025 escreve/lê aqui). Servidor roda sempre via tsx a partir do
 * source (sem etapa de build), então `__dirname` aponta pro `.ts` real e a subida até a raiz do
 * repo é estável: packages/server/src -> packages/server -> packages -> raiz. */
const MAPS_DIR = join(__dirname, "..", "..", "..", "maps");

export function loadMapFile(mapId: string): MapFileV1 {
  const path = join(MAPS_DIR, `${mapId}.map.json`);
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch {
    throw new Error(`mapa "${mapId}" não encontrado em ${path}`);
  }
  const parsed = JSON.parse(raw) as MapFileV1;
  const errors = validateMapFile(parsed);
  if (errors.length) throw new Error(`mapa "${mapId}" inválido:\n- ${errors.join("\n- ")}`);
  return parsed;
}

export function loadMap(mapId: string): { file: MapFileV1; map: GameMap } {
  const file = loadMapFile(mapId);
  return { file, map: mapFileToGameMap(file) };
}
