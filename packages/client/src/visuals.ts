// ADR-008: TODO visual nasce aqui. Trocar de fase = editar este arquivo.
// Fases: 1 primitivas | 2 composição | 3 sprites 3D | 4 low-poly
// Guia completo: instrucoes/FASES_VISUAIS.md
import * as THREE from "three";
import { POWER_BAND_MID, POWER_BAND_HIGH } from "@aop/shared";

export const VISUAL_PHASE: 1 | 2 | 3 | 4 = 1;

const playerGeo = new THREE.CapsuleGeometry(0.35, 0.5, 4, 8);
const ringGeo = new THREE.RingGeometry(0.45, 0.58, 24);
const noseGeo = new THREE.ConeGeometry(0.18, 0.5, 8); // T-011: indicador placeholder de facing
const noseMat = new THREE.MeshLambertMaterial({ color: 0xffee58, emissive: 0x8a7600 });
const xpOrbGeo = new THREE.SphereGeometry(0.25, 12, 12);
const speedUpGeo = new THREE.OctahedronGeometry(0.28);
const coinBuffGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.08, 16);
const farmEventGeo = new THREE.ConeGeometry(0.28, 0.4, 4);
const boxLootGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);

const xpOrbMat = new THREE.MeshLambertMaterial({ color: 0xffd54f, emissive: 0x7a5c00 });
const speedUpMat = new THREE.MeshLambertMaterial({ color: 0x26c6da, emissive: 0x005662 });
const coinBuffMat = new THREE.MeshLambertMaterial({ color: 0xffc107, emissive: 0x7a5c00 });
const farmEventMat = new THREE.MeshLambertMaterial({ color: 0x66bb6a, emissive: 0x1b4d1e });
const boxLootMat = new THREE.MeshLambertMaterial({ color: 0x8e24aa, emissive: 0x3a0d47 });

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

  // T-011: "nariz" — para onde o grupo aponta é o facing (dir). Gira com o grupo
  // inteiro; nenhuma arte ainda (ADR-003), só deixa a rotação legível.
  const nose = new THREE.Mesh(noseGeo, noseMat);
  nose.rotation.z = -Math.PI / 2; // aponta para +X local, mesma convenção do dir (atan2(z,x))
  nose.position.set(0.65, 0.65, 0);
  group.add(nose);

  return group;
}

/**
 * T-018 (SPEC-0004): "sentir aura" — aro de poder por faixa de nível. Poder que não se
 * vê não existe; também é leitura tática ("aquele ali é perigoso") e prepara o "famar
 * aura" do M2. Faixas em shared/constants.ts (POWER_BAND_*) — o cliente só exibe.
 */
const powerRingGeo = new THREE.RingGeometry(0.62, 0.74, 24);
export function updatePowerVisual(group: THREE.Group, level: number, t: number) {
  let ring = group.userData.powerRing as THREE.Mesh | undefined;
  if (!ring) {
    ring = new THREE.Mesh(
      powerRingGeo,
      new THREE.MeshBasicMaterial({ color: 0xffd54f, transparent: true, opacity: 0, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.035;
    group.add(ring);
    group.userData.powerRing = ring;
  }
  const mat = ring.material as THREE.MeshBasicMaterial;
  if (level >= POWER_BAND_HIGH) {
    // aro forte pulsante (placeholder de "trail" da fase F1 — arte de verdade é F3+)
    mat.opacity = 0.7 + Math.sin(t * 3) * 0.2;
    mat.color.setHex(0xffb300);
    ring.scale.setScalar(1.1 + Math.sin(t * 3) * 0.08);
  } else if (level >= POWER_BAND_MID) {
    mat.opacity = 0.4;
    mat.color.setHex(0xffd54f);
    ring.scale.setScalar(1);
  } else {
    mat.opacity = 0;
  }
}

/**
 * SPEC-0005: bolha de invulnerabilidade de nascimento/renascimento. Translúcida e pulsante
 * enquanto o escudo está ativo (3s ou até o player atirar); some quando cai. Placeholder F1.
 */
const shieldGeo = new THREE.SphereGeometry(0.7, 16, 12);
export function updateShieldVisual(group: THREE.Group, protectedNow: boolean, t: number) {
  let bubble = group.userData.shield as THREE.Mesh | undefined;
  if (!bubble) {
    if (!protectedNow) return; // não cria nada até precisar
    bubble = new THREE.Mesh(
      shieldGeo,
      new THREE.MeshBasicMaterial({ color: 0x82b1ff, transparent: true, opacity: 0, side: THREE.DoubleSide })
    );
    bubble.position.y = 0.6;
    group.add(bubble);
    group.userData.shield = bubble;
  }
  const mat = bubble.material as THREE.MeshBasicMaterial;
  bubble.visible = protectedNow;
  if (protectedNow) mat.opacity = 0.22 + Math.sin(t * 6) * 0.08;
}

/**
 * T-021 (SPEC-0006): glow do PORTADOR da bandeira — precisa ser lido do mapa inteiro
 * (leitura tática "quem está com a bandeira"), não só de perto; por isso é uma luz de
 * verdade (THREE.PointLight), não só material emissive/opacidade como os outros aros.
 */
export function updateFlagGlow(group: THREE.Group, carrying: boolean, t: number) {
  let glow = group.userData.flagGlow as THREE.PointLight | undefined;
  if (!glow) {
    if (!carrying) return; // não cria nada até precisar
    glow = new THREE.PointLight(0xffd54f, 0, 16, 1.5);
    glow.position.y = 1.4;
    group.add(glow);
    group.userData.flagGlow = glow;
  }
  glow.visible = carrying;
  if (carrying) glow.intensity = 2.4 + Math.sin(t * 4) * 0.6;
}

/**
 * T-022 (SPEC-0006, backlog `buff_cooldown_ring`): anel esvaziando ao redor do boneco
 * enquanto um buff temporário (velocidade/xp/impulso) está ativo. main.ts sabe o instante
 * exato de cada aplicação (evento `pickup`/`impulso`) e a duração vem das mesmas constantes
 * do EffectSystem (@aop/shared) — sem isso o cliente teria que "chutar" o tempo restante.
 * Só 1 anel por vez (o buff mais recente) — várias faixas simultâneas fica pro backlog.
 */
const BUFF_RING_COLOR: Record<string, number> = {
  speed_up: 0x26c6da,
  xp_boost: 0xffd54f,
  kill_rush: 0xff7043,
};
const buffRingGeo = new THREE.RingGeometry(0.8, 0.9, 24);
export function updateBuffCooldownRing(group: THREE.Group, active: { kind: string; frac: number } | null) {
  let ring = group.userData.buffRing as THREE.Mesh | undefined;
  if (!ring) {
    if (!active) return;
    ring = new THREE.Mesh(
      buffRingGeo,
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.045;
    group.add(ring);
    group.userData.buffRing = ring;
  }
  const mat = ring.material as THREE.MeshBasicMaterial;
  if (!active) {
    mat.opacity = 0;
    return;
  }
  mat.color.setHex(BUFF_RING_COLOR[active.kind] ?? 0xffffff);
  mat.opacity = 0.5;
  ring.scale.setScalar(0.55 + active.frac * 0.55); // esvazia = encolhe até quase sumir no fim
}

/**
 * T-023 (SPEC-0006): reveal-on-hit — "inimigo é só skin (cor+forma por token) até trocar
 * dano com ele". `revealed` já vem pronto do servidor (`p.revealedUntil > Date.now()`,
 * autoritativo); este helper só desenha/esconde. Canvas só é redesenhado quando o texto
 * muda (não todo frame) — nameplate por jogador revelado é barato mesmo com vários ao mesmo tempo.
 */
interface NameplateState {
  sprite: THREE.Sprite;
  lastLabel: string;
}
export function updateNameplate(group: THREE.Group, revealed: boolean, name: string, hp: number, maxHp: number) {
  let np = group.userData.nameplate as NameplateState | undefined;
  if (!revealed) {
    if (np) np.sprite.visible = false;
    return;
  }
  if (!np) {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 48;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false })
    );
    sprite.scale.set(1.5, 0.45, 1);
    sprite.position.y = 1.75;
    group.add(sprite);
    np = { sprite, lastLabel: "" };
    group.userData.nameplate = np;
  }
  np.sprite.visible = true;
  const hpClamped = Math.max(0, Math.ceil(hp));
  const label = `${name}|${hpClamped}/${maxHp}`;
  if (label === np.lastLabel) return;
  np.lastLabel = label;
  const tex = np.sprite.material.map as THREE.CanvasTexture;
  const canvas = tex.image as HTMLCanvasElement;
  const g = canvas.getContext("2d")!;
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.font = "bold 16px monospace";
  g.textAlign = "center";
  g.fillStyle = "#fff";
  g.strokeStyle = "#000";
  g.lineWidth = 3;
  g.strokeText(name, 80, 16);
  g.fillText(name, 80, 16);
  // barra de HP: fundo escuro + preenchimento colorido pela fração de vida
  const frac = maxHp > 0 ? hpClamped / maxHp : 0;
  g.fillStyle = "#000a";
  g.fillRect(10, 28, 140, 10);
  g.fillStyle = frac > 0.5 ? "#66bb6a" : frac > 0.25 ? "#ffca28" : "#ef5350";
  g.fillRect(10, 28, 140 * frac, 10);
  tex.needsUpdate = true;
}

export function createCollectibleVisual(kind: string): THREE.Mesh {
  switch (kind) {
    case "speed_up":
      return new THREE.Mesh(speedUpGeo, speedUpMat);
    case "coin_buff":
      return new THREE.Mesh(coinBuffGeo, coinBuffMat);
    case "farm_event":
      return new THREE.Mesh(farmEventGeo, farmEventMat);
    case "box":
      return new THREE.Mesh(boxLootGeo, boxLootMat);
    default:
      return new THREE.Mesh(xpOrbGeo, xpOrbMat);
  }
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
