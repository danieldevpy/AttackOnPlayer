import { describe, expect, it } from "vitest";
import { extractSymbols } from "./code.js";

const KINDS = ["function", "class", "interface", "type", "enum", "const"];

const SAMPLE = `
export type EffectKind = "speed_up" | "xp_boost";

interface Internal {
  x: number;
}

export interface LauncherDef {
  id: string;
  movement: number;
}

export enum Facing {
  North,
  South,
}

function helper(a: number): number {
  return a + 1;
}

export function main(a: number, b: string): void {
  helper(a);
}

export class ArenaRoom {
  tick(): void {}
}

export const LAUNCHERS: Record<string, number> = {
  a: 1,
};

const secret = 42;
`;

describe("aci · index/code (F1)", () => {
  const symbols = extractSymbols(SAMPLE, "packages/fixture/sample.ts", KINDS);
  const byName = Object.fromEntries(symbols.map((s) => [s.name, s]));

  it("extrai um símbolo de cada tipo configurado", () => {
    const kinds = new Set(symbols.map((s) => s.kind));
    expect(kinds).toEqual(
      new Set(["type", "interface", "enum", "function", "class", "const"]),
    );
  });

  it("marca exported corretamente (declarações internas x exportadas)", () => {
    expect(byName.Internal.exported).toBe(false);
    expect(byName.LauncherDef.exported).toBe(true);
    expect(byName.helper.exported).toBe(false);
    expect(byName.main.exported).toBe(true);
    expect(byName.secret.exported).toBe(false);
    expect(byName.LAUNCHERS.exported).toBe(true);
  });

  it("calcula a linha 1-based correta", () => {
    const expected = SAMPLE.split("\n").findIndex((l) =>
      l.includes("export interface LauncherDef"),
    ) + 1;
    expect(byName.LauncherDef.line).toBe(expected);
  });

  it("assinatura corta antes do corpo/valor — não devolve o arquivo inteiro", () => {
    expect(byName.main.signature).toBe("export function main(a: number, b: string): void");
    expect(byName.main.signature).not.toContain("helper(a)");
    expect(byName.LAUNCHERS.signature).toContain(
      "export const LAUNCHERS: Record<string, number> =",
    );
    expect(byName.LAUNCHERS.signature).not.toContain("a: 1");
  });

  it("respeita a lista de kinds da config (ex.: sem 'const' pedido)", () => {
    const onlyFn = extractSymbols(SAMPLE, "x.ts", ["function"]);
    expect(onlyFn.every((s) => s.kind === "function")).toBe(true);
    expect(onlyFn.map((s) => s.name)).toEqual(["helper", "main"]);
  });
});
