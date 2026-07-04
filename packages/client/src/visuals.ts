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
