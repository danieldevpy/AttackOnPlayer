/** T-024 (SPEC-0007): registry de objetos de mapa. Cada `ObjectDef` descreve footprint (tiles)
 * e se colide — a MESMA interface hoje vem do código (aqui); quando o backend Django existir
 * (SPEC-0008), objetos salvos pelo sistema usam esta mesma forma, só a origem muda.
 * Cobre os tipos que já existem no gerador por seed (T-001/T-002) + a bandeira decorativa
 * (marcador de zona de guerra, distinta do objeto "rei do mapa" da T-021, que não é um Prop). */
export interface ObjectDef {
  id: string;
  footprint: { w: number; h: number }; // em tiles
  collidable: boolean; // true = bloqueia o grid de colisão; false = decorativo
}

export const OBJECT_DEFS: Record<string, ObjectDef> = {
  pedra: { id: "pedra", footprint: { w: 1, h: 1 }, collidable: true },
  arvore: { id: "arvore", footprint: { w: 1, h: 1 }, collidable: true },
  caixa: { id: "caixa", footprint: { w: 1, h: 1 }, collidable: true },
  muro: { id: "muro", footprint: { w: 2, h: 1 }, collidable: true },
  bandeira: { id: "bandeira", footprint: { w: 1, h: 1 }, collidable: false },
};

export type ObjectId = keyof typeof OBJECT_DEFS;

export function isKnownObjectId(id: string): id is ObjectId {
  return Object.prototype.hasOwnProperty.call(OBJECT_DEFS, id);
}
