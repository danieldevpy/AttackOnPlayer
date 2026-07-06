import { describe, expect, it } from "vitest";
import { MapFileV1, validateMapFile, mapFileToGameMap, gameMapToMapFile, mapFilePreview } from "./mapFile";
import { isWall, buildMap } from "./map";

function baseMap(overrides: Partial<MapFileV1> = {}): MapFileV1 {
  return {
    version: 1,
    id: "test",
    name: "Mapa de teste",
    w: 10,
    h: 10,
    instances: [],
    zones: [],
    spawns: [{ x: 1.5, z: 1.5 }],
    flag: { x: 5, z: 5 },
    ...overrides,
  };
}

describe("validateMapFile", () => {
  it("aceita um mapa mínimo válido", () => {
    expect(validateMapFile(baseMap())).toEqual([]);
  });

  it("rejeita objectId desconhecido", () => {
    const errors = validateMapFile(baseMap({ instances: [{ objectId: "portal", x: 3, z: 3 }] }));
    expect(errors.some((e) => e.includes("objectId desconhecido"))).toBe(true);
  });

  it("rejeita spawn fora dos limites", () => {
    const errors = validateMapFile(baseMap({ spawns: [{ x: 99, z: 99 }] }));
    expect(errors.some((e) => e.includes("spawn"))).toBe(true);
  });

  it("rejeita bandeira fora dos limites", () => {
    const errors = validateMapFile(baseMap({ flag: { x: -1, z: -1 } }));
    expect(errors.some((e) => e.includes("bandeira"))).toBe(true);
  });

  it("rejeita mapa com região fechada (flood-fill)", () => {
    // muro (2x1) forma uma parede reta atravessando o corredor livre no meio do mapa,
    // isolando o canto inferior-direito do resto (região fechada).
    const instances = [];
    for (let x = 1; x < 9; x += 2) instances.push({ objectId: "muro", x, z: 5 });
    const errors = validateMapFile(baseMap({ instances }));
    expect(errors.some((e) => e.includes("flood-fill"))).toBe(true);
  });
});

describe("mapFileToGameMap", () => {
  it("marca paredes pelo footprint do objectId (muro = 2 tiles)", () => {
    const map = mapFileToGameMap(baseMap({ instances: [{ objectId: "muro", x: 4, z: 4 }] }));
    expect(isWall(map, 4, 4)).toBe(true);
    expect(isWall(map, 5, 4)).toBe(true);
    expect(isWall(map, 6, 4)).toBe(false);
  });

  it("bandeira é decorativa — não colide", () => {
    const map = mapFileToGameMap(baseMap({ instances: [{ objectId: "bandeira", x: 4, z: 4 }] }));
    expect(isWall(map, 4, 4)).toBe(false);
    expect(map.props.some((p) => p.type === ("bandeira" as any))).toBe(true);
  });
});

describe("gameMapToMapFile (T-025: CLI de mapas)", () => {
  it("é o inverso de mapFileToGameMap — round-trip preserva colisão", () => {
    const generated = buildMap(21, 17, 42);
    const file = gameMapToMapFile(generated, { id: "gerado", name: "Gerado" });
    expect(validateMapFile(file)).toEqual([]);

    const rebuilt = mapFileToGameMap(file);
    expect(rebuilt.cells).toEqual(generated.cells);
    expect(rebuilt.props.length).toBe(generated.props.length);
  });

  it("aplica id/name/author do metadado pedido", () => {
    const file = gameMapToMapFile(buildMap(15, 13, 1), { id: "x", name: "Nome X", author: "IA" });
    expect(file.id).toBe("x");
    expect(file.name).toBe("Nome X");
    expect(file.author).toBe("IA");
    expect(file.seed).toBe(1);
  });
});

describe("mapFilePreview (T-025: CLI de mapas)", () => {
  it("desenha grid do tamanho certo com borda de parede", () => {
    const file = gameMapToMapFile(buildMap(11, 9, 7), { id: "p", name: "Preview" });
    const preview = mapFilePreview(file);
    const lines = preview.split("\n").filter((l) => /^[#.A-Za-z=]+$/.test(l) && l.length === 11);
    expect(lines.length).toBe(9);
    expect(lines[0]).toBe("#".repeat(11));
  });

  it("marca spawns com S e a bandeira com F", () => {
    const file = baseMap({ w: 10, h: 10, spawns: [{ x: 1.5, z: 1.5 }], flag: { x: 5, z: 5 } });
    const preview = mapFilePreview(file);
    const rows = preview.split("\n").slice(1, 11);
    expect(rows[1][1]).toBe("S");
    expect(rows[5][5]).toBe("F");
  });
});
