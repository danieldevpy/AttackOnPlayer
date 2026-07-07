import { describe, it, expect } from "vitest";
import {
  CLASS_REGISTRY,
  DEFAULT_CLASS_ID,
  isValidClassId,
  isValidSkinId,
  resolveClassSelection,
  sanitizeDisplayName,
  DEFAULT_NICK,
  NICK_MAX_LEN,
} from "./classes";

describe("CLASS_REGISTRY (T-052)", () => {
  it("só tem a classe archer, com os 3 launchers atuais e ao menos 1 skin", () => {
    expect(Object.keys(CLASS_REGISTRY)).toEqual(["archer"]);
    const archer = CLASS_REGISTRY.archer;
    expect(archer.id).toBe("archer");
    expect(archer.launcherIds).toEqual(["basic_shot", "heavy_shot", "rapid_shot"]);
    expect(archer.skinIds.length).toBeGreaterThan(0);
    expect(typeof archer.baseTint).toBe("number");
  });

  it("toda skin da classe tem uma cor (T-056) e a skin default usa o baseTint", () => {
    const archer = CLASS_REGISTRY.archer;
    for (const skinId of archer.skinIds) {
      expect(typeof archer.skinTints[skinId]).toBe("number");
    }
    expect(archer.skinTints[archer.skinIds[0]]).toBe(archer.baseTint);
  });

  it("DEFAULT_CLASS_ID aponta pra uma classe que existe no registro", () => {
    expect(CLASS_REGISTRY[DEFAULT_CLASS_ID]).toBeDefined();
  });
});

describe("isValidClassId / isValidSkinId (T-052)", () => {
  it("aceita classe existente e rejeita inexistente/tipo errado", () => {
    expect(isValidClassId("archer")).toBe(true);
    expect(isValidClassId("mago")).toBe(false);
    expect(isValidClassId(undefined)).toBe(false);
    expect(isValidClassId(123)).toBe(false);
  });

  it("skin só é válida se pertence à classe informada", () => {
    expect(isValidSkinId("archer", "default")).toBe(true);
    expect(isValidSkinId("archer", "inexistente")).toBe(false);
    expect(isValidSkinId("mago", "default")).toBe(false);
  });
});

describe("resolveClassSelection — join válido/inválido/ausente (T-052)", () => {
  it("classe e skin válidas passam direto", () => {
    expect(resolveClassSelection("archer", "default")).toEqual({ classId: "archer", skinId: "default" });
  });

  it("classe inválida cai pro default (nunca rejeita)", () => {
    expect(resolveClassSelection("guerreiro", "default")).toEqual({
      classId: DEFAULT_CLASS_ID,
      skinId: CLASS_REGISTRY[DEFAULT_CLASS_ID].skinIds[0],
    });
  });

  it("classId/skinId ausentes caem pro default", () => {
    expect(resolveClassSelection(undefined, undefined)).toEqual({
      classId: DEFAULT_CLASS_ID,
      skinId: CLASS_REGISTRY[DEFAULT_CLASS_ID].skinIds[0],
    });
  });

  it("skin inválida para uma classe válida cai pra 1ª skin da classe", () => {
    expect(resolveClassSelection("archer", "skin_que_nao_existe")).toEqual({
      classId: "archer",
      skinId: CLASS_REGISTRY.archer.skinIds[0],
    });
  });
});

describe("sanitizeDisplayName — nick no join (T-059, alinhado ao Django)", () => {
  it("nick simples passa", () => {
    expect(sanitizeDisplayName("Daniel")).toBe("Daniel");
  });

  it("nick com espaço/hífen/ponto/underscore passa", () => {
    expect(sanitizeDisplayName("Ana Maria_2")).toBe("Ana Maria_2");
    expect(sanitizeDisplayName("no-ob.1")).toBe("no-ob.1");
  });

  it("acentos (Unicode) preservados", () => {
    expect(sanitizeDisplayName("João")).toBe("João");
  });

  it("faz trim das bordas", () => {
    expect(sanitizeDisplayName("  Dan  ")).toBe("Dan");
  });

  it("vazio/só espaços => fallback", () => {
    expect(sanitizeDisplayName("")).toBe(DEFAULT_NICK);
    expect(sanitizeDisplayName("   ")).toBe(DEFAULT_NICK);
  });

  it("HTML/script => fallback INTEIRO (não sanitiza parcial)", () => {
    expect(sanitizeDisplayName("<script>alert(1)</script>")).toBe(DEFAULT_NICK);
    expect(sanitizeDisplayName("a<b")).toBe(DEFAULT_NICK);
  });

  it("caracteres de controle => fallback", () => {
    expect(sanitizeDisplayName("nick\x00\x07")).toBe(DEFAULT_NICK);
  });

  it("não-string => fallback", () => {
    expect(sanitizeDisplayName(undefined)).toBe(DEFAULT_NICK);
    expect(sanitizeDisplayName(42)).toBe(DEFAULT_NICK);
    expect(sanitizeDisplayName(null)).toBe(DEFAULT_NICK);
  });

  it("fallback custom é respeitado", () => {
    expect(sanitizeDisplayName("<bad>", "Anon")).toBe("Anon");
  });

  it("nick válido longo é truncado em NICK_MAX_LEN", () => {
    const long = "A".repeat(NICK_MAX_LEN + 10);
    expect(sanitizeDisplayName(long)).toBe("A".repeat(NICK_MAX_LEN));
  });
});
