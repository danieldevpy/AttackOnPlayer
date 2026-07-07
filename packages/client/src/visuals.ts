// ADR-008: TODO visual nasce aqui. Trocar de fase = editar este arquivo.
// Fases: 1 primitivas | 2 composição | 3 sprites 3D | 4 low-poly
// Guia completo: instrucoes/FASES_VISUAIS.md
import * as THREE from "three";
import { POWER_BAND_MID, POWER_BAND_HIGH, DEFAULT_CLASS_ID, CLASS_REGISTRY } from "@aop/shared";
import { createCharacterVisual } from "./characters";

// T-053 (SPEC-0014): personagens sobem de F1 (cápsula) para F2 (composição procedural).
export const VISUAL_PHASE: 1 | 2 | 3 | 4 = 2;

const playerGeo = new THREE.CapsuleGeometry(0.35, 0.5, 4, 8);
const ringGeo = new THREE.RingGeometry(0.45, 0.58, 24);
const noseGeo = new THREE.ConeGeometry(0.18, 0.5, 8); // T-011: indicador placeholder de facing
const noseMat = new THREE.MeshLambertMaterial({ color: 0xffee58, emissive: 0x8a7600 });
// Coletáveis — fase F2 (composição de primitivas): cada tipo tem forma RECONHECÍVEL
// (cruz = vida, escudo = domo azul, moeda em pé, baú = corpo+tampa…) em vez de uma
// primitiva genérica. Geometrias e materiais são singletons de módulo — N coletáveis do
// mesmo tipo reusam os mesmos objetos (nada alocado por instância, "leve sempre" §5).
const collGeo = {
  gem: new THREE.OctahedronGeometry(0.24), // xp: gema/cristal valioso
  crossV: new THREE.BoxGeometry(0.14, 0.44, 0.14), // hp: cruz médica (haste vertical)
  crossH: new THREE.BoxGeometry(0.44, 0.14, 0.14), // hp: cruz médica (haste horizontal)
  dome: new THREE.SphereGeometry(0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), // escudo: domo/bolha
  ringBase: new THREE.TorusGeometry(0.24, 0.035, 8, 20), // aro no chão (grounding)
  arrow: new THREE.ConeGeometry(0.2, 0.42, 4), // velocidade/2xXP: seta pra cima
  arrowSmall: new THREE.ConeGeometry(0.14, 0.28, 4),
  coin: new THREE.CylinderGeometry(0.26, 0.26, 0.07, 20), // moeda (fica em pé, gira = "flip")
  chestBody: new THREE.BoxGeometry(0.46, 0.26, 0.34), // baú: corpo
  chestLid: new THREE.BoxGeometry(0.48, 0.16, 0.36), // baú: tampa
  latch: new THREE.BoxGeometry(0.1, 0.14, 0.06), // baú: fecho dourado
  // T-039 (SPEC-0011): arma coletável — "arma no pedestal". Cano + coronha sobre um aro,
  // distinguível por tipo (pesada = cano grosso, rápida = cano fino duplo).
  weaponBarrelHeavy: new THREE.CylinderGeometry(0.09, 0.11, 0.5, 10), // pesado: cano grosso
  weaponBarrelRapid: new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), // rápido: cano fino
  weaponStock: new THREE.BoxGeometry(0.16, 0.14, 0.14), // coronha/corpo
};
const collMat = {
  xp: new THREE.MeshLambertMaterial({ color: 0xffd54f, emissive: 0x8a6300 }),
  hp: new THREE.MeshLambertMaterial({ color: 0xff5252, emissive: 0x7a0d0d }),
  shield: new THREE.MeshLambertMaterial({ color: 0x42a5f5, emissive: 0x123a6b, transparent: true, opacity: 0.72 }),
  speed: new THREE.MeshLambertMaterial({ color: 0x26c6da, emissive: 0x006064 }),
  coin: new THREE.MeshLambertMaterial({ color: 0xffc107, emissive: 0x6d4c00 }),
  farm: new THREE.MeshLambertMaterial({ color: 0x66bb6a, emissive: 0x1b5e20 }),
  box: new THREE.MeshLambertMaterial({ color: 0x8e24aa, emissive: 0x3a0d47 }),
  gold: new THREE.MeshLambertMaterial({ color: 0xffca28, emissive: 0x6d4c00 }),
  // T-039: cor por tipo de arma (bate com o projétil em main.ts: pesado laranja, rápido ciano).
  weaponHeavy: new THREE.MeshLambertMaterial({ color: 0xff6d00, emissive: 0x7a2e00 }),
  weaponRapid: new THREE.MeshLambertMaterial({ color: 0x40c4ff, emissive: 0x0d3b5c }),
  weaponRing: new THREE.MeshLambertMaterial({ color: 0xffab00, emissive: 0x6d4c00 }), // aro âmbar "item raro"
};

interface CollPart {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  pos?: [number, number, number];
  rot?: [number, number, number];
  scale?: [number, number, number];
}

/** Peças de cada coletável (F2). Composição legível com poucas partes por tipo. */
function collectibleParts(kind: string, weaponId?: string): CollPart[] {
  switch (kind) {
    case "weapon": {
      // T-039 (SPEC-0011): arma sobre um aro âmbar (leitura "item raro/único"). O cano
      // distingue o tipo: pesado = grosso laranja, rápido = fino ciano.
      const heavy = weaponId === "heavy_shot";
      const barrel = heavy ? collGeo.weaponBarrelHeavy : collGeo.weaponBarrelRapid;
      const mat = heavy ? collMat.weaponHeavy : collMat.weaponRapid;
      return [
        { geometry: barrel, material: mat, pos: [0.02, 0.06, 0], rot: [0, 0, Math.PI / 2] }, // cano deitado
        { geometry: collGeo.weaponStock, material: mat, pos: [-0.22, 0.06, 0] }, // coronha
        { geometry: collGeo.ringBase, material: collMat.weaponRing, pos: [0, -0.16, 0], rot: [Math.PI / 2, 0, 0] },
      ];
    }
    case "hp_orb": // cruz de vida vermelha
      return [
        { geometry: collGeo.crossV, material: collMat.hp },
        { geometry: collGeo.crossH, material: collMat.hp },
      ];
    case "shield_temp": // domo/bolha azul sobre um aro
      return [
        { geometry: collGeo.dome, material: collMat.shield, pos: [0, -0.02, 0] },
        { geometry: collGeo.ringBase, material: collMat.shield, pos: [0, -0.06, 0], rot: [Math.PI / 2, 0, 0] },
      ];
    case "speed_up": // seta ciano pra cima ("boost") sobre um aro
      return [
        { geometry: collGeo.arrow, material: collMat.speed, pos: [0, 0.06, 0] },
        { geometry: collGeo.ringBase, material: collMat.speed, pos: [0, -0.18, 0], rot: [Math.PI / 2, 0, 0] },
      ];
    case "coin_buff": // moeda em pé (o giro do grupo vira o "flip")
      return [{ geometry: collGeo.coin, material: collMat.coin, rot: [Math.PI / 2, 0, 0] }];
    case "farm_event": // seta dupla verde = XP em dobro
      return [
        { geometry: collGeo.arrow, material: collMat.farm, pos: [0, 0.12, 0] },
        { geometry: collGeo.arrowSmall, material: collMat.farm, pos: [0, -0.14, 0] },
      ];
    case "box": // baú: corpo + tampa + fecho dourado
      return [
        { geometry: collGeo.chestBody, material: collMat.box, pos: [0, -0.04, 0] },
        { geometry: collGeo.chestLid, material: collMat.box, pos: [0, 0.16, 0] },
        { geometry: collGeo.latch, material: collMat.gold, pos: [0, 0.06, 0.19] },
      ];
    default: // xp_orb: gema dourada
      return [{ geometry: collGeo.gem, material: collMat.xp, scale: [1, 1.3, 1] }];
  }
}

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
export function createPlayerVisual(
  id: string,
  isSelf: boolean,
  classId?: string,
  skinId?: string
): THREE.Group {
  const group = new THREE.Group();

  // F2 (T-053): boneco procedural da classe. O ANEL (abaixo) continua sendo o sinal de
  // aliado/inimigo (SPEC-0002) e a leitura de facing vem do próprio modelo (arco à frente),
  // então o "nariz" placeholder só existe na F1.
  // T-059 (SPEC-0015): classId/skinId chegam sincronizados do estado (Player.classId/skinId).
  // Ausentes (ou classe/skin desconhecida) caem pro default — o servidor já resolveu, mas o
  // cliente também tolera para nunca quebrar a renderização.
  // (F3: THREE.Sprite. F4: GLTF.)
  if (VISUAL_PHASE >= 2) {
    const resolvedClass = classId && CLASS_REGISTRY[classId] ? classId : DEFAULT_CLASS_ID;
    const def = CLASS_REGISTRY[resolvedClass];
    const resolvedSkin = skinId && def.skinIds.includes(skinId) ? skinId : def.skinIds[0];
    const char = createCharacterVisual(resolvedClass, resolvedSkin);
    group.userData.character = char; // T-054: a animação procedural acha o boneco por aqui
    group.add(char);
  } else {
    // F1: cápsula + "nariz" de facing.
    const body = new THREE.Mesh(
      playerGeo,
      new THREE.MeshLambertMaterial({ color: isSelf ? 0x42a5f5 : colorFor(id) })
    );
    body.position.y = 0.6;
    group.add(body);

    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.rotation.z = -Math.PI / 2; // aponta para +X local, mesma convenção do dir (atan2(z,x))
    nose.position.set(0.65, 0.65, 0);
    group.add(nose);
  }

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
 * SPEC-0011 (T-041): estado visual da bandeira NO MAPA (o objeto único, não o portador).
 * - livre e ativa (`state==="active"`, sem portador): ACESA — pano emissivo pulsante + a
 *   PointLight ancorada nela (lê-se de longe que está disponível). É a MESMA orçamento de
 *   1 luz: quando livre a luz é da bandeira; quando carregada, a luz vai pro portador (glow).
 * - carregada: mesh apagado/cinza (quem brilha é o portador), luz da bandeira desligada.
 * - cooldown: mesh some (visible=false), fora do jogo.
 * `group.userData.pano` é o material DEDICADO do pano (clonado no main.ts) e
 * `group.userData.groundLight` a PointLight da bandeira livre — ambos mutados por frame,
 * sem alocar nada nem trocar material (só propriedades).
 */
export function updateFlagGround(group: THREE.Group, state: string, carried: boolean, t: number) {
  const inCooldown = state === "cooldown";
  group.visible = !inCooldown;

  const pano = group.userData.pano as THREE.MeshLambertMaterial | undefined;
  let light = group.userData.groundLight as THREE.PointLight | undefined;
  if (!light) {
    light = new THREE.PointLight(0xffd54f, 0, 12, 1.5);
    light.position.y = 1.15;
    group.add(light);
    group.userData.groundLight = light;
  }

  const free = !inCooldown && !carried; // livre no chão e disputável
  light.visible = free;
  if (free) {
    // pulso por seno — só muda intensidade/emissive, sem alocar
    light.intensity = 1.4 + Math.sin(t * 4) * 0.6;
    if (pano) {
      pano.color.setHex(0xef5350);
      pano.emissive.setHex(0xff7043);
      pano.emissiveIntensity = 0.5 + Math.sin(t * 4) * 0.35;
    }
  } else if (pano) {
    // carregada: pano apagado/cinza (o brilho é do portador)
    pano.color.setHex(0x6b6b6b);
    pano.emissive.setHex(0x000000);
    pano.emissiveIntensity = 0;
  }
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
  damage_reduction: 0x42a5f5, // SPEC-0010: escudo temporário
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
export function updateNameplate(
  group: THREE.Group,
  revealed: boolean,
  name: string,
  level: number,
  hp: number,
  maxHp: number
) {
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
  const label = `${name}|${level}|${hpClamped}/${maxHp}`;
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
  const text = `Lv${level} ${name}`;
  g.strokeText(text, 80, 16);
  g.fillText(text, 80, 16);
  // barra de HP: fundo escuro + preenchimento colorido pela fração de vida
  const frac = maxHp > 0 ? hpClamped / maxHp : 0;
  g.fillStyle = "#000a";
  g.fillRect(10, 28, 140, 10);
  g.fillStyle = frac > 0.5 ? "#66bb6a" : frac > 0.25 ? "#ffca28" : "#ef5350";
  g.fillRect(10, 28, 140 * frac, 10);
  tex.needsUpdate = true;
}

/** F2: coletável = grupo de primitivas com forma reconhecível (ver `collectibleParts`).
 * T-039: `weaponId` (opcional) distingue o visual da arma coletável por tipo. */
export function createCollectibleVisual(kind: string, weaponId?: string): THREE.Group {
  const group = new THREE.Group();
  for (const part of collectibleParts(kind, weaponId)) {
    const mesh = new THREE.Mesh(part.geometry, part.material);
    if (part.pos) mesh.position.set(part.pos[0], part.pos[1], part.pos[2]);
    if (part.rot) mesh.rotation.set(part.rot[0], part.rot[1], part.rot[2]);
    if (part.scale) mesh.scale.set(part.scale[0], part.scale[1], part.scale[2]);
    group.add(mesh);
  }
  return group;
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
