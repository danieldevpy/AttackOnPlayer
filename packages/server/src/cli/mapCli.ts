/**
 * T-025 (SPEC-0007): CLI de mapas — `npm run map -- <comando> [args]`.
 *
 * Fluxo do CD: gerar → salvar → reajustar → jogar (ver spec, "Problema/objetivo").
 *   gen           <fim> gera por seed e imprime o preview ASCII — NÃO grava nada em disco.
 *   save          <id>  gera por seed e GRAVA em maps/<id>.map.json (recusa sobrescrever sem --force).
 *   save-current  <id>  captura o mapa de uma sala rodando (via /debug/rooms) e grava.
 *   update        <id>  regenera o conteúdo de um mapa JÁ salvo (novo seed/w/h), preservando
 *                       id/name/author existentes a menos que sobrescritos por flag.
 *   list                lista os mapas salvos em maps/.
 *   preview       <id>  imprime o preview ASCII de um mapa salvo.
 *
 * Mapas curados (instâncias editadas à mão) NÃO passam por esta CLI para o conteúdo em si —
 * edita-se o JSON direto e o servidor valida no load (critério de aceite da spec). A CLI cobre
 * geração/captura por seed e o preview de curadoria.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import {
  buildMap,
  gameMapToMapFile,
  mapFilePreview,
  mapSizeFor,
  validateMapFile,
  type MapFileV1,
} from "@aop/shared";
import { MAPS_DIR, loadMapFile } from "../mapLoader";

type Flags = Record<string, string | true>;

function parseArgs(argv: string[]): { positional: string[]; flags: Flags } {
  const positional: string[] = [];
  const flags: Flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function fail(msg: string): never {
  console.error(`Erro: ${msg}`);
  process.exit(1);
}

function flagStr(flags: Flags, key: string): string | undefined {
  const v = flags[key];
  return typeof v === "string" ? v : undefined;
}

function flagNum(flags: Flags, key: string): number | undefined {
  const v = flagStr(flags, key);
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) fail(`--${key} precisa ser um número (recebi "${v}")`);
  return n;
}

function ensureMapsDir() {
  if (!existsSync(MAPS_DIR)) mkdirSync(MAPS_DIR, { recursive: true });
}

function mapFilePath(id: string): string {
  return join(MAPS_DIR, `${id}.map.json`);
}

function writeMapFile(file: MapFileV1) {
  const errors = validateMapFile(file);
  if (errors.length) fail(`mapa inválido, não gravado:\n- ${errors.join("\n- ")}`);
  ensureMapsDir();
  writeFileSync(mapFilePath(file.id), JSON.stringify(file, null, 2) + "\n", "utf-8");
  console.log(`Gravado: maps/${file.id}.map.json`);
  console.log("");
  console.log(mapFilePreview(file));
}

function resolveDims(flags: Flags): { w: number; h: number } {
  const w = flagNum(flags, "w");
  const h = flagNum(flags, "h");
  if (w !== undefined && h !== undefined) return { w, h };
  const def = mapSizeFor(4); // default 75x65 — o mesmo mínimo do caminho procedural (ADR-007)
  return { w: w ?? def.w, h: h ?? def.h };
}

function resolveSeed(flags: Flags): number {
  return flagNum(flags, "seed") ?? Math.floor(Math.random() * 2147483647);
}

function cmdGen(flags: Flags) {
  const { w, h } = resolveDims(flags);
  const seed = resolveSeed(flags);
  const map = buildMap(w, h, seed);
  const file = gameMapToMapFile(map, { id: "(preview)", name: "preview — não gravado" });
  console.log(mapFilePreview(file));
  console.log("");
  console.log(`Gostou? Grave com: npm run map -- save <id> --name "Nome" --seed ${seed} --w ${w} --h ${h}`);
}

function cmdSave(id: string, flags: Flags) {
  const name = flagStr(flags, "name");
  if (!name) fail('save precisa de --name "Nome do mapa"');
  if (existsSync(mapFilePath(id)) && !flags.force) {
    fail(`maps/${id}.map.json já existe — use --force pra sobrescrever, ou "update ${id}"`);
  }
  const { w, h } = resolveDims(flags);
  const seed = resolveSeed(flags);
  const map = buildMap(w, h, seed);
  const file = gameMapToMapFile(map, { id, name, author: flagStr(flags, "author") });
  writeMapFile(file);
}

async function cmdSaveCurrent(id: string, flags: Flags) {
  const server = flagStr(flags, "server") ?? "http://localhost:2567";
  const roomId = flagStr(flags, "room");
  let body: any;
  try {
    const res = await fetch(`${server}/debug/rooms`);
    body = await res.json();
  } catch (e) {
    fail(`não consegui falar com ${server}/debug/rooms — o servidor está rodando? (${(e as Error).message})`);
  }
  const rooms: any[] = body.rooms ?? [];
  if (!rooms.length) fail(`nenhuma sala ativa em ${server}`);
  const room = roomId ? rooms.find((r) => r.roomId === roomId) : rooms[0];
  if (!room) fail(`sala "${roomId}" não encontrada em ${server}/debug/rooms`);

  if (room.map.mapId) {
    // sala já rodando um mapa curado — "capturar" é reempacotar o arquivo já existente sob o
    // id pedido (não há conteúdo procedural pra regenerar aqui).
    const source = loadMapFile(room.map.mapId);
    const file: MapFileV1 = {
      ...source,
      id,
      name: flagStr(flags, "name") ?? source.name,
      author: flagStr(flags, "author") ?? source.author,
    };
    if (existsSync(mapFilePath(id)) && !flags.force && id !== room.map.mapId) {
      fail(`maps/${id}.map.json já existe — use --force pra sobrescrever`);
    }
    console.log(`Sala ${room.roomId} já roda o mapa curado "${room.map.mapId}" — reempacotando sob "${id}".`);
    writeMapFile(file);
    return;
  }

  if (existsSync(mapFilePath(id)) && !flags.force) {
    fail(`maps/${id}.map.json já existe — use --force pra sobrescrever`);
  }
  // T-025 (nota da spec): regenerar por (w,h,seed) reproduz EXATAMENTE o mesmo mapa que a sala
  // já está jogando (gerador determinístico) — não precisa de endpoint extra pra "baixar" props.
  const { w, h, seed } = room.map;
  const map = buildMap(w, h, seed);
  const name = flagStr(flags, "name") ?? `Capturado da sala ${room.roomId}`;
  const file = gameMapToMapFile(map, { id, name, author: flagStr(flags, "author") });
  console.log(`Capturando sala ${room.roomId} (${w}x${h}, seed ${seed}).`);
  writeMapFile(file);
}

function readRawMapFile(id: string): MapFileV1 {
  const path = mapFilePath(id);
  if (!existsSync(path)) {
    fail(`maps/${id}.map.json não existe — crie primeiro com "save" ou "save-current"`);
  }
  return JSON.parse(readFileSync(path, "utf-8")) as MapFileV1;
}

function cmdUpdate(id: string, flags: Flags) {
  const current = readRawMapFile(id);
  const w = flagNum(flags, "w") ?? current.w;
  const h = flagNum(flags, "h") ?? current.h;
  const seed = flagNum(flags, "seed") ?? current.seed ?? Math.floor(Math.random() * 2147483647);
  const name = flagStr(flags, "name") ?? current.name;
  const author = flagStr(flags, "author") ?? current.author;
  const map = buildMap(w, h, seed);
  const file = gameMapToMapFile(map, { id, name, author });
  console.log(`Reajustando "${id}" (preservando name/author salvos, a menos que passados por flag).`);
  writeMapFile(file);
}

function cmdList() {
  if (!existsSync(MAPS_DIR)) {
    console.log("Nenhum mapa salvo ainda (crie um com `npm run map -- save <id> --name \"...\"`).");
    return;
  }
  const files = readdirSync(MAPS_DIR).filter((f) => f.endsWith(".map.json"));
  if (!files.length) {
    console.log("Nenhum mapa salvo ainda (crie um com `npm run map -- save <id> --name \"...\"`).");
    return;
  }
  console.log("id".padEnd(20) + "nome".padEnd(30) + "tamanho".padEnd(12) + "seed".padEnd(14) + "autor");
  for (const f of files) {
    try {
      const m = JSON.parse(readFileSync(join(MAPS_DIR, f), "utf-8")) as MapFileV1;
      console.log(
        m.id.padEnd(20) +
          m.name.padEnd(30) +
          `${m.w}x${m.h}`.padEnd(12) +
          String(m.seed ?? "-").padEnd(14) +
          (m.author ?? "-")
      );
    } catch (e) {
      console.log(`${f}  [ERRO ao ler: ${(e as Error).message}]`);
    }
  }
}

function cmdPreview(id: string) {
  const file = loadMapFile(id);
  console.log(mapFilePreview(file));
}

function usage() {
  console.log(`Uso: npm run map -- <comando> [args]

Comandos:
  gen [--seed n] [--w n] [--h n]
      Gera por seed e imprime o preview ASCII. Não grava nada.

  save <id> --name "Nome" [--seed n] [--w n] [--h n] [--author x] [--force]
      Gera por seed e grava em maps/<id>.map.json.

  save-current <id> [--server http://localhost:2567] [--room <roomId>] [--name] [--author] [--force]
      Captura o mapa de uma sala rodando (via /debug/rooms) e grava.

  update <id> [--seed n] [--w n] [--h n] [--name] [--author]
      Regenera o conteúdo de um mapa já salvo, preservando id (e name/author se omitidos).

  list
      Lista os mapas salvos em maps/.

  preview <id>
      Imprime o preview ASCII de um mapa salvo (valida antes).`);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { positional, flags } = parseArgs(rest);

  switch (cmd) {
    case "gen":
      cmdGen(flags);
      break;
    case "save":
      if (!positional[0]) fail("save precisa de um <id>");
      cmdSave(positional[0], flags);
      break;
    case "save-current":
      if (!positional[0]) fail("save-current precisa de um <id>");
      await cmdSaveCurrent(positional[0], flags);
      break;
    case "update":
      if (!positional[0]) fail("update precisa de um <id>");
      cmdUpdate(positional[0], flags);
      break;
    case "list":
      cmdList();
      break;
    case "preview":
      if (!positional[0]) fail("preview precisa de um <id>");
      cmdPreview(positional[0]);
      break;
    default:
      usage();
      if (cmd) process.exit(1);
  }
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
