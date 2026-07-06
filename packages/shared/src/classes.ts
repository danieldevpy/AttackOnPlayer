// Registro de classes de personagem (T-052, SPEC-0014/PROPOSAL-0004 §4) — contrato
// data-driven: classe nova (guerreiro/mago) = 1 entrada aqui, sem tocar sistema. Só
// "archer" por enquanto — os launchers já existentes (basic_shot/heavy_shot/rapid_shot)
// viram os "projéteis da classe" via `launcherIds` (ADR-011: sem mudar dano/rede).

export interface ClassDef {
  id: string;
  launcherIds: string[]; // lançadores (launchers.ts) disponíveis pra esta classe
  baseTint: number; // cor base (hex 0xRRGGBB) do visual procedural (T-053)
  skinIds: string[]; // paletas alternativas (T-056); 1º item é a skin default da classe
}

export const CLASS_REGISTRY: Record<string, ClassDef> = {
  archer: {
    id: "archer",
    launcherIds: ["basic_shot", "heavy_shot", "rapid_shot"],
    baseTint: 0x6b4f2a, // couro/madeira — placeholder de gameplay-first (ADR-008) até arte final
    skinIds: ["default"],
  },
};

export const DEFAULT_CLASS_ID = "archer";

/** Classe válida = tem entrada no registro. */
export function isValidClassId(id: unknown): id is string {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(CLASS_REGISTRY, id);
}

/** Skin válida = existe na lista de skins DA classe informada (nunca cross-classe). */
export function isValidSkinId(classId: string, skinId: unknown): skinId is string {
  const def = CLASS_REGISTRY[classId];
  return !!def && typeof skinId === "string" && def.skinIds.includes(skinId);
}

/**
 * Resolve a escolha de classe/skin no join: inválido ou ausente cai pro default — join NUNCA
 * rejeita por causa de classId/skinId ruim (mesma regra de authToken opcional, T-028b).
 */
export function resolveClassSelection(
  classId?: unknown,
  skinId?: unknown
): { classId: string; skinId: string } {
  const resolvedClassId = isValidClassId(classId) ? classId : DEFAULT_CLASS_ID;
  const def = CLASS_REGISTRY[resolvedClassId];
  const resolvedSkinId = isValidSkinId(resolvedClassId, skinId) ? (skinId as string) : def.skinIds[0];
  return { classId: resolvedClassId, skinId: resolvedSkinId };
}
