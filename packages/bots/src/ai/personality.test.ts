import { describe, expect, it } from "vitest";
import { pickCard, BOT_PROFILES } from "./personality";

describe("pickCard (T-008b — política de escolha de cards por perfil)", () => {
  it("agressivo (bruto) escolhe força bruta quando presente na oferta", () => {
    const offer = [{ id: "casca_grossa" }, { id: "forca_bruta" }, { id: "pes_ligeiros" }];
    expect(pickCard(BOT_PROFILES.agressivo.cardPolicy, offer)).toBe("forca_bruta");
  });

  it("cauteloso (tanque) escolhe casca grossa quando presente", () => {
    const offer = [{ id: "forca_bruta" }, { id: "casca_grossa" }, { id: "equilibrado" }];
    expect(pickCard(BOT_PROFILES.cauteloso.cardPolicy, offer)).toBe("casca_grossa");
  });

  it("caçador escolhe olhar de águia quando presente, senão o 2º da preferência", () => {
    const offer = [{ id: "forca_bruta" }, { id: "pes_ligeiros" }];
    expect(pickCard(BOT_PROFILES.cacador.cardPolicy, offer)).toBe("pes_ligeiros");
  });

  it("equilibrado escolhe o card equilibrado quando presente (auto-pick de sempre)", () => {
    const offer = [{ id: "forca_bruta" }, { id: "equilibrado" }, { id: "olhar_de_aguia" }];
    expect(pickCard(BOT_PROFILES.equilibrado.cardPolicy, offer)).toBe("equilibrado");
  });

  it("sem nenhum card preferido na oferta (ex.: marco de skill), cai no primeiro — nunca trava", () => {
    const offer = [{ id: "skill_tiro_duplo" }, { id: "skill_leque" }];
    expect(pickCard(BOT_PROFILES.agressivo.cardPolicy, offer)).toBe("skill_tiro_duplo");
  });

  it("é determinístico: a mesma oferta sempre produz a mesma escolha (habilidade > sorte)", () => {
    const offer = [{ id: "olhar_de_aguia" }, { id: "pes_ligeiros" }, { id: "equilibrado" }];
    const results = new Set(
      Array.from({ length: 20 }, () => pickCard(BOT_PROFILES.cacador.cardPolicy, offer))
    );
    expect(results.size).toBe(1);
  });
});
