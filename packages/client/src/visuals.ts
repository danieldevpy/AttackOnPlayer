// ADR-008: TODO visual nasce aqui. Trocar de fase = editar este arquivo.
// Fases: 1 primitivas | 2 composição | 3 sprites 3D | 4 low-poly
// Guia completo: instrucoes/FASES_VISUAIS.md
import * as THREE from "three";

export const VISUAL_PHASE: 1 | 2 | 3 | 4 = 1;

const playerGeo = new THREE.CapsuleGeometry(0.35, 0.5, 4, 8);
const ringGeo = new THREE.RingGeometry(0.45, 0.58, 24);
const levelUpGeo = new THREE.SphereGeometry(0.25, 12, 12);
const speedUpGeo = new THREE.OctahedronGeometry(0.28);

const levelUpMat = new THREE.MeshLambertMaterial({ color: 0xffd54f, emissive: 0x7a5c00 });
const speedUpMat = new THREE.MeshLambertMaterial({ color: 0x26c6da, emissive: 0x005662 });

/** Cor estável por id (inimigos variam de tom, mas o ANEL é o sinal). */
export function colorFor(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return new THREE.Color().setHSL(h / 360, 0.7, 0.55).getHex();
}

/**
 * Visual do jogador + sinalização de aliado/inimigo (SPEC-0002):
 * anel discreto no chão — azul = você, vermelho = inimigo. Não invasivo.
 */
export function createPlayerVisual(id: string, isSelf: boolean): THREE.Group {
  const group = new THREE.Group();

  // F1: cápsula. (F2: compor corpo+cabeça+mãos aqui. F3: THREE.Sprite. F4: GLTF.)
  const body = new THREE.Mesh(
    playerGeo,
    new THREE.MeshLambertMaterial({ color: isSelf ? 0x42a5f5 : colorFor(id) })
  );
  body.position.y = 0.6;
  group.add(body);

  const ring = new THREE.Mesh(
    ringGeo,
    new THREE.MeshBasicMaterial({
      color: isSelf ? 0x42a5f5 : 0xef5350,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  group.add(ring);

  return group;
}

export function createCollectibleVisual(kind: string): THREE.Mesh {
  return kind === "speed_up"
    ? new THREE.Mesh(speedUpGeo, speedUpMat)
    : new THREE.Mesh(levelUpGeo, levelUpMat);
}

/**
 * Props (T-002, fase F2 — só para cenário): cada tipo é 1+ "partes" de primitivas.
 * main.ts monta 1 InstancedMesh POR PARTE (não por prop), então N pedras/árvores
 * continuam custando poucos draw calls — a composição não fura o orçamento (< 200).
 */
export interface PropPart {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  offset: THREE.Vector3; // relativo ao centro do footprint do prop, no chão (y=0)
  scale?: THREE.Vector3;
}

const propGeo = {
  pedra: new THREE.IcosahedronGeometry(0.4, 0),
  troncoArvore: new THREE.CylinderGeometry(0.12, 0.15, 0.6, 6),
  folhaArvore: new THREE.ConeGeometry(0.4, 0.7, 8),
  caixa: new THREE.BoxGeometry(0.8, 0.8, 0.8),
  muro: new THREE.BoxGeometry(1.8, 1.1, 0.9),
  haste: new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6),
  pano: new THREE.BoxGeometry(0.5, 0.3, 0.02),
};

const propMat = {
  pedra: new THREE.MeshLambertMaterial({ color: 0x9e9e9e }),
  tronco: new THREE.MeshLambertMaterial({ color: 0x6d4c30 }),
  folha: new THREE.MeshLambertMaterial({ color: 0x2e7d32 }),
  caixa: new THREE.MeshLambertMaterial({ color: 0x8d6e63 }),
  muro: new THREE.MeshLambertMaterial({ color: 0x4e4e4e }),
  haste: new THREE.MeshLambertMaterial({ color: 0x5d4037 }),
  pano: new THREE.MeshLambertMaterial({ color: 0xef5350 }),
};

/** Bandeira não colide (world.md) — só marca zona de guerra, montada à parte em main.ts. */
export function propParts(type: "pedra" | "arvore" | "caixa" | "muro" | "bandeira"): PropPart[] {
  switch (type) {
    case "pedra":
      return [{ geometry: propGeo.pedra, material: propMat.pedra, offset: new THREE.Vector3(0, 0.25, 0), scale: new THREE.Vector3(1, 0.6, 1) }];
    case "arvore":
      return [
        { geometry: propGeo.troncoArvore, material: propMat.tronco, offset: new THREE.Vector3(0, 0.3, 0) },
        { geometry: propGeo.folhaArvore, material: propMat.folha, offset: new THREE.Vector3(0, 0.95, 0) },
      ];
    case "caixa":
      return [{ geometry: propGeo.caixa, material: propMat.caixa, offset: new THREE.Vector3(0, 0.4, 0) }];
    case "muro":
      return [{ geometry: propGeo.muro, material: propMat.muro, offset: new THREE.Vector3(0, 0.5, 0) }];
    case "bandeira":
      return [
        { geometry: propGeo.haste, material: propMat.haste, offset: new THREE.Vector3(0, 0.7, 0) },
        { geometry: propGeo.pano, material: propMat.pano, offset: new THREE.Vector3(0.28, 1.15, 0) },
      ];
  }
}
