import { describe, expect, it } from "vitest";
import { MapFileV1, validateMapFile, mapFileToGameMap } from "./mapFile";
import { isWall } from "./map";

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
