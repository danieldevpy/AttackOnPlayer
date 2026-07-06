// Personagens F2 (ADR-008 / SPEC-0014 / PROPOSAL-0004 §4) — composição de primitivas.
// Fábrica única `createCharacterVisual(classId, skinId)`: monta o boneco procedural da
// classe (só "archer" por enquanto, T-052) a partir do `baseTint` do CLASS_REGISTRY.
// Geometrias são singletons de módulo e os materiais ficam em cache por classe+skin —
// N players do mesmo tipo reusam os MESMOS objetos (nada alocado por instância, "leve
// sempre" §5). Partes nomeadas (`mesh.name` + `group.userData.parts`) para a animação
// procedural (T-054) achar cada segmento sem varrer a árvore.
//
// Convenção de facing: o boneco olha para +X local (mesma do "nariz" da F1 e do dir da
// rede, atan2(z,x)) — o arco fica à frente (+X) e o capuz aponta para trás, deixando a
// direção óbvia. Quem gira o grupo é o `createPlayerVisual` (rotation.y = -dir).
import * as THREE from "three";
import { CLASS_REGISTRY, DEFAULT_CLASS_ID } from "@aop/shared";

// --- Geometrias singleton (compartilhadas por todos os personagens) ---
const geo = {
  head: new THREE.ConeGeometry(0.17, 0.34, 4), // cabeça = cone 4 lados (silhueta pontuda de capuz)
  hood: new THREE.ConeGeometry(0.25, 0.42, 4), // capuz por cima, um pouco maior e mais escuro
  body: new THREE.CylinderGeometry(0.2, 0.25, 0.5, 6), // corpo/túnica, low-seg
  arm: new THREE.BoxGeometry(0.12, 0.4, 0.12), // braços (um de cada lado, eixo Z)
  leg: new THREE.BoxGeometry(0.14, 0.42, 0.16), // pernas
  bow: new THREE.TorusGeometry(0.28, 0.03, 6, 12, Math.PI), // arco = meia torus (arc = π)
};

/** Conjunto de materiais de um personagem (uma paleta por classe+skin). */
interface CharMaterials {
  tunic: THREE.Material; // corpo
  hood: THREE.Material; // capuz + membros (couro)
  skin: THREE.Material; // rosto
  wood: THREE.Material; // arco
}

const matCache = new Map<string, CharMaterials>();

/** Sombra de uma cor por fator multiplicativo (mais escuro < 1). */
function shade(hex: number, factor: number): number {
  return new THREE.Color(hex).multiplyScalar(factor).getHex();
}

/**
 * Materiais da classe/skin, criados sob demanda e memoizados: todos os players da mesma
 * combinação reusam o mesmo conjunto (singleton por paleta, não por boneco). `flatShading`
 * dá o look low-poly facetado sem custo de arte. skinId reservado para as paletas da T-056;
 * hoje só "default", então a cor vem do `baseTint` da classe.
 */
function materialsFor(classId: string, skinId: string): CharMaterials {
  const key = `${classId}:${skinId}`;
  const cached = matCache.get(key);
  if (cached) return cached;

  const def = CLASS_REGISTRY[classId] ?? CLASS_REGISTRY[DEFAULT_CLASS_ID];
  const tint = def.baseTint;
  const mk = (color: number) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0 });
  const mats: CharMaterials = {
    tunic: mk(tint),
    hood: mk(shade(tint, 0.7)),
    skin: mk(0xd7b48a), // tom de pele placeholder (gameplay-first)
    wood: mk(0x8d6e63), // arco de madeira
  };
  matCache.set(key, mats);
  return mats;
}

interface CharPartSpec {
  name: string;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  pos: [number, number, number];
  rot?: [number, number, number];
}

/** Peças do personagem (ordem/nomes estáveis para a T-054). */
function characterParts(m: CharMaterials): CharPartSpec[] {
  return [
    { name: "legL", geometry: geo.leg, material: m.hood, pos: [0, 0.21, -0.11] },
    { name: "legR", geometry: geo.leg, material: m.hood, pos: [0, 0.21, 0.11] },
    { name: "body", geometry: geo.body, material: m.tunic, pos: [0, 0.66, 0] },
    { name: "armL", geometry: geo.arm, material: m.hood, pos: [0, 0.72, -0.28] },
    { name: "armR", geometry: geo.arm, material: m.hood, pos: [0, 0.72, 0.28] },
    // rosto ligeiramente à frente (+X) — a direção do olhar fica óbvia
    { name: "head", geometry: geo.head, material: m.skin, pos: [0.04, 1.05, 0] },
    // capuz por cima e um pouco atrás, cobrindo a nuca
    { name: "hood", geometry: geo.hood, material: m.hood, pos: [-0.03, 1.08, 0] },
    // arco erguido à frente do corpo, plano vertical (empunhado)
    { name: "bow", geometry: geo.bow, material: m.wood, pos: [0.3, 0.72, 0], rot: [0, Math.PI / 2, 0] },
  ];
}

/**
 * Boneco procedural da classe (F2). Retorna um `THREE.Group` pronto para ser adicionado ao
 * grupo do player (`createPlayerVisual`) ou usado isolado no preview do lobby (T-057).
 * Partes acessíveis por `mesh.name` e por `group.userData.parts[name]`.
 */
export function createCharacterVisual(classId: string, skinId: string): THREE.Group {
  const group = new THREE.Group();
  const mats = materialsFor(classId, skinId);
  const parts: Record<string, THREE.Mesh> = {};
  for (const spec of characterParts(mats)) {
    const mesh = new THREE.Mesh(spec.geometry, spec.material);
    mesh.name = spec.name;
    mesh.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
    if (spec.rot) mesh.rotation.set(spec.rot[0], spec.rot[1], spec.rot[2]);
    group.add(mesh);
    parts[spec.name] = mesh;
  }
  group.userData.parts = parts;
  return group;
}
