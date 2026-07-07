// Personagens procedurais V2 (SPEC-0014 / ADR-008, fase F2 "composição") — arqueiro low-poly
// no estilo mobile top-down (Kingshot / Archero / Whiteout Survival), 100% por código, sem
// nenhum asset externo (GLTF/FBX/OBJ/textura). Evolui a V1 (primitivas soltas) para uma
// silhueta legível de arqueiro: capuz pontudo, barba, cinto, aljava, botas, arco curvo.
//
// ── Arquitetura ────────────────────────────────────────────────────────────────────────
// • Esqueleto de PIVÔS (THREE.Group) — hip/chest/head/ombros/cotovelos/pernas/joelhos/arco —
//   que só existem para animar. As MALHAS penduram sob eles.
// • Cada segmento animável é UMA malha: a geometria dele é o MERGE de várias sub-formas
//   facetadas com COR POR VÉRTICE (couro, pele, cabelo, madeira, metal...). Assim um único
//   material flat colore o boneco inteiro e o detalhe todo (gola, nariz, aljava) não custa
//   draw call extra. ~13 draw calls por personagem, independente da quantidade de detalhes.
//
// ── Performance (centenas de players) ──────────────────────────────────────────────────
// • TODAS as geometrias e o material são SINGLETON: geometrias de segmento são construídas
//   uma vez por classe:skin (cor por vértice embutida) e cacheadas; o material flat é único e
//   global (vertexColors). Cada instância só cria Groups (pivôs) + Mesh leves apontando pros
//   mesmos buffers — nada de geometria/material por instância, nada alocado por frame.
//
// ── Facing ─────────────────────────────────────────────────────────────────────────────
// Olha para +X local (mesma convenção do dir da rede, atan2(z,x)); quem gira o grupo é o
// createPlayerVisual (rotation.y = -dir).
//
// API pública estável: createCharacterVisual · updateCharacterAnimation · triggerCharacterShoot
// (+ triggerCharacterHit / triggerCharacterDeath).
import * as THREE from "three";
import { CLASS_REGISTRY, DEFAULT_CLASS_ID } from "@aop/shared";

// ── Material único e global (cor vem do atributo `color` de cada geometria) ──────────────
const CHAR_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0 });
const STRING_MAT = new THREE.LineBasicMaterial({ color: 0xe8e0cf });

// ── Paleta por classe:skin ───────────────────────────────────────────────────────────────
interface Palette {
  tunic: number; // túnica/corpo (baseTint da classe)
  leather: number; // membros/capuz (couro)
  leatherDk: number; // sombra do couro (botas, cinto)
  skin: number; // rosto/mãos
  hair: number; // cabelo/barba/sobrancelha
  wood: number; // arco/haste da flecha
  metal: number; // ponta da flecha / detalhes
  cloth: number; // gola/pano claro
}
const paletteCache = new Map<string, Palette>();
function shade(hex: number, f: number): number {
  return new THREE.Color(hex).multiplyScalar(f).getHex();
}
function paletteFor(classId: string, skinId: string): Palette {
  const key = `${classId}:${skinId}`;
  const cached = paletteCache.get(key);
  if (cached) return cached;
  const def = CLASS_REGISTRY[classId] ?? CLASS_REGISTRY[DEFAULT_CLASS_ID];
  const tint = def.skinTints[skinId] ?? def.baseTint; // T-056: cor por skinId, cai pro tint base da classe
  const pal: Palette = {
    tunic: tint,
    leather: shade(tint, 0.72),
    leatherDk: shade(tint, 0.48),
    skin: 0xd9a066,
    hair: 0x3a2a1a,
    wood: 0x7a5a3a,
    metal: 0xc0c6cc,
    cloth: shade(tint, 1.18),
  };
  paletteCache.set(key, pal);
  return pal;
}

// ── Utilitários de geometria (só em build-time; nunca por frame) ─────────────────────────
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
/** Matriz de transformação (build-time) a partir de pos/rot/escala. */
function xf(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): THREE.Matrix4 {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}
interface SubPart {
  g: THREE.BufferGeometry;
  c: number; // cor sólida da sub-parte (embutida como cor por vértice)
  m?: THREE.Matrix4; // posição/rotação da sub-parte dentro do segmento
}
/**
 * Funde N sub-formas facetadas numa única geometria não-indexada com atributo `color`.
 * Resultado é um singleton de segmento (uma malha, uma draw call, N cores).
 */
function mergeColored(parts: SubPart[]): THREE.BufferGeometry {
  const position: number[] = [];
  const normal: number[] = [];
  const color: number[] = [];
  const col = new THREE.Color();
  for (const part of parts) {
    const g = part.g.clone().toNonIndexed();
    if (part.m) g.applyMatrix4(part.m);
    const pos = g.attributes.position.array as ArrayLike<number>;
    const nor = g.attributes.normal.array as ArrayLike<number>;
    col.setHex(part.c);
    for (let i = 0; i < pos.length; i += 3) {
      position.push(pos[i], pos[i + 1], pos[i + 2]);
      normal.push(nor[i], nor[i + 1], nor[i + 2]);
      color.push(col.r, col.g, col.b);
    }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(normal, 3));
  out.setAttribute("color", new THREE.Float32BufferAttribute(color, 3));
  return out;
}

// Formas-base reutilizadas pelos builders (clonadas dentro do merge, nunca compartilhadas cruas).
// hex = prisma hexagonal (tronco/cabeça facetados); box4 = "caixa" via cilindro de 4 lados
// (trapezoide facetado com normais corretas, sem hand-rolling de winding); cone facetado.
function hex(topR: number, botR: number, h: number): THREE.CylinderGeometry {
  return new THREE.CylinderGeometry(topR, botR, h, 6);
}
function box4(topR: number, botR: number, h: number): THREE.CylinderGeometry {
  // cilindro de 4 lados = caixa afunilada; giro de 45° (aplicado no xf) alinha aos eixos.
  return new THREE.CylinderGeometry(topR, botR, h, 4);
}

// ── Builders de segmento (cada um → 1 geometria mergeada, em seu frame de pivô local) ─────
// Convenção: membros penduram de y=0 (junta) para -y; tronco/cabeça sobem de y=0 para +y.

function buildTorso(p: Palette): THREE.BufferGeometry {
  const parts: SubPart[] = [
    // tronco hexagonal: peito largo em cima, cintura fina embaixo
    { g: hex(0.19, 0.14, 0.42), c: p.tunic, m: xf(0, 0.21, 0) },
    // gola/colarinho no topo
    { g: hex(0.14, 0.12, 0.06, ), c: p.cloth, m: xf(0, 0.42, 0) },
    // cinto na cintura
    { g: hex(0.15, 0.15, 0.06), c: p.leatherDk, m: xf(0, 0.06, 0) },
    // ombreiras (leem a silhueta de ombro)
    { g: box4(0.06, 0.09, 0.1), c: p.leather, m: xf(0, 0.4, -0.18, 0, Math.PI / 4, 0) },
    { g: box4(0.06, 0.09, 0.1), c: p.leather, m: xf(0, 0.4, 0.18, 0, Math.PI / 4, 0) },
    // aljava nas costas (-X), inclinada
    { g: box4(0.045, 0.06, 0.28), c: p.leatherDk, m: xf(-0.14, 0.26, 0.05, 0, Math.PI / 4, 0.5) },
    // 3 flechas espiando da aljava
    { g: box4(0.012, 0.012, 0.18), c: p.wood, m: xf(-0.17, 0.42, 0.02, 0, 0, 0.5) },
    { g: box4(0.012, 0.012, 0.18), c: p.wood, m: xf(-0.18, 0.42, 0.07, 0, 0, 0.5) },
    { g: box4(0.012, 0.012, 0.18), c: p.metal, m: xf(-0.19, 0.42, -0.03, 0, 0, 0.5) },
  ];
  return mergeColored(parts);
}

function buildHead(p: Palette): THREE.BufferGeometry {
  const parts: SubPart[] = [
    // cabeça facetada: testa maior no topo, queixo afunilado embaixo
    { g: hex(0.15, 0.1, 0.24), c: p.skin, m: xf(0, 0.12, 0) },
    // capuz pontudo cobrindo topo/nuca (cone 6 lados, levemente pra trás)
    { g: new THREE.ConeGeometry(0.21, 0.36, 6), c: p.leather, m: xf(-0.03, 0.22, 0, 0, Math.PI / 6, -0.12) },
    // cabelo aparecendo sob o capuz
    { g: box4(0.12, 0.14, 0.08), c: p.hair, m: xf(-0.06, 0.06, 0, 0, Math.PI / 4, 0) },
    // barba no queixo (afunila pra baixo)
    { g: box4(0.09, 0.05, 0.1), c: p.hair, m: xf(0.06, -0.02, 0, 0, Math.PI / 4, 0) },
    // nariz pequeno à frente (+X)
    { g: new THREE.ConeGeometry(0.03, 0.06, 4), c: p.skin, m: xf(0.15, 0.11, 0, 0, 0, -Math.PI / 2) },
    // sobrancelhas
    { g: new THREE.BoxGeometry(0.02, 0.015, 0.04), c: p.hair, m: xf(0.14, 0.17, -0.05) },
    { g: new THREE.BoxGeometry(0.02, 0.015, 0.04), c: p.hair, m: xf(0.14, 0.17, 0.05) },
  ];
  return mergeColored(parts);
}

function buildUpperArm(p: Palette): THREE.BufferGeometry {
  // trapézio: mais grosso no ombro, mais fino no cotovelo
  return mergeColored([{ g: box4(0.06, 0.05, 0.2), c: p.leather, m: xf(0, -0.1, 0, 0, Math.PI / 4, 0, 1.1, 1, 0.9) }]);
}

function buildForeArm(p: Palette): THREE.BufferGeometry {
  return mergeColored([
    // antebraço
    { g: box4(0.05, 0.045, 0.18), c: p.leather, m: xf(0, -0.09, 0, 0, Math.PI / 4, 0, 1, 1, 0.85) },
    // mão = cubo girado 45°
    { g: new THREE.BoxGeometry(0.06, 0.06, 0.06), c: p.skin, m: xf(0, -0.19, 0, Math.PI / 4, Math.PI / 4, 0) },
  ]);
}

function buildThigh(p: Palette): THREE.BufferGeometry {
  return mergeColored([{ g: box4(0.07, 0.06, 0.24), c: p.tunic, m: xf(0, -0.12, 0, 0, Math.PI / 4, 0, 1, 1, 0.95) }]);
}

function buildShin(p: Palette): THREE.BufferGeometry {
  return mergeColored([
    // canela
    { g: box4(0.055, 0.05, 0.2), c: p.leather, m: xf(0, -0.1, 0, 0, Math.PI / 4, 0, 0.95, 1, 0.9) },
    // bota (peça separada, mais escura, com biqueira pra frente)
    { g: box4(0.07, 0.08, 0.09), c: p.leatherDk, m: xf(0.02, -0.22, 0, 0, Math.PI / 4, 0, 1, 1, 1.5) },
  ]);
}

function buildBow(p: Palette): THREE.BufferGeometry {
  // arco curvo via CatmullRomCurve3 + TubeGeometry (substitui o TorusGeometry da V1).
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.24, 0),
    new THREE.Vector3(0.13, -0.12, 0),
    new THREE.Vector3(0.16, 0, 0),
    new THREE.Vector3(0.13, 0.12, 0),
    new THREE.Vector3(0, 0.24, 0),
  ]);
  const tube = new THREE.TubeGeometry(curve, 14, 0.016, 4, false);
  return mergeColored([
    { g: tube, c: p.wood },
    // grip escuro no centro (onde a mão do arqueiro segura) — reforça a leitura de "arco", não graveto
    { g: box4(0.03, 0.03, 0.1), c: p.leatherDk, m: xf(0.16, 0, 0, 0, Math.PI / 4, 0) },
    // encoches nas pontas (onde a corda prende)
    { g: new THREE.ConeGeometry(0.024, 0.045, 4), c: p.leatherDk, m: xf(0.02, 0.25, 0, 0, 0, Math.PI * 0.92) },
    { g: new THREE.ConeGeometry(0.024, 0.045, 4), c: p.leatherDk, m: xf(0.02, -0.25, 0, 0, 0, -Math.PI * 0.08) },
  ]);
}

function buildArrow(p: Palette): THREE.BufferGeometry {
  // flecha ao longo de +X: haste + ponta + empenagem.
  return mergeColored([
    { g: box4(0.008, 0.008, 0.34), c: p.wood, m: xf(0.02, 0, 0, 0, 0, Math.PI / 2) },
    { g: new THREE.ConeGeometry(0.02, 0.06, 4), c: p.metal, m: xf(0.2, 0, 0, 0, 0, -Math.PI / 2) },
    { g: new THREE.BoxGeometry(0.05, 0.04, 0.005), c: p.cloth, m: xf(-0.15, 0, 0.015) },
    { g: new THREE.BoxGeometry(0.05, 0.04, 0.005), c: p.cloth, m: xf(-0.15, 0, -0.015) },
  ]);
}

// Corda: 3 pontos (nock superior / centro / nock inferior). Geometria PEQUENA e POR INSTÂNCIA
// (exceção deliberada ao "tudo compartilhado" — são só 3 vértices, custo desprezível mesmo em
// centenas de players) porque o ponto central precisa se mover por instância durante o puxar
// (tensão real da corda), o que uma geometria singleton compartilhada não permitiria.
function buildStringGeo(): THREE.BufferGeometry {
  return new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0.24, 0),
    new THREE.Vector3(-0.03, 0, 0),
    new THREE.Vector3(0, -0.24, 0),
  ]);
}

// ── Cache de geometrias de segmento por classe:skin (singleton) ──────────────────────────
interface SegmentGeos {
  torso: THREE.BufferGeometry;
  head: THREE.BufferGeometry;
  upperArm: THREE.BufferGeometry;
  foreArm: THREE.BufferGeometry;
  thigh: THREE.BufferGeometry;
  shin: THREE.BufferGeometry;
  bow: THREE.BufferGeometry;
  arrow: THREE.BufferGeometry;
}
const segCache = new Map<string, SegmentGeos>();
function segmentsFor(classId: string, skinId: string): SegmentGeos {
  const key = `${classId}:${skinId}`;
  const cached = segCache.get(key);
  if (cached) return cached;
  const p = paletteFor(classId, skinId);
  const segs: SegmentGeos = {
    torso: buildTorso(p),
    head: buildHead(p),
    upperArm: buildUpperArm(p),
    foreArm: buildForeArm(p),
    thigh: buildThigh(p),
    shin: buildShin(p),
    bow: buildBow(p),
    arrow: buildArrow(p),
  };
  segCache.set(key, segs);
  return segs;
}

// ── Dimensões do esqueleto (frames locais dos pivôs) ─────────────────────────────────────
const PELVIS_Y = 0.5;
const TORSO_H = 0.42;
const SHOULDER_Y = 0.34; // rel. ao chest
const SHOULDER_Z = 0.2;
const UPPER_ARM_H = 0.2;
const FORE_ARM_H = 0.19;
const HEAD_Y = 0.44; // rel. ao chest
const LEG_Z = 0.1;
const THIGH_H = 0.24;
const BOW_CANT_X = 0.14; // inclinação lateral fixa do arco (estilo/leitura de silhueta)
const BOW_TILT_Z = 0.1; // leve caimento pra frente do arco em cima da contra-rotação (ver abaixo)

interface Rig {
  hip: THREE.Group;
  chest: THREE.Group;
  head: THREE.Group;
  shL: THREE.Group;
  elL: THREE.Group;
  shR: THREE.Group;
  elR: THREE.Group;
  legL: THREE.Group;
  kneeL: THREE.Group;
  legR: THREE.Group;
  kneeR: THREE.Group;
  bow: THREE.Group;
  arrow: THREE.Mesh;
  string: THREE.Line;
}

/**
 * Boneco procedural da classe (F2 V2). Retorna um `THREE.Group` pronto pra entrar no grupo do
 * player (createPlayerVisual) ou no preview do lobby (T-057). Pivôs em `group.userData.rig`.
 */
export function createCharacterVisual(classId: string, skinId: string): THREE.Group {
  const g = segmentsFor(classId, skinId);
  const root = new THREE.Group();

  const mesh = (geo: THREE.BufferGeometry, name: string) => {
    const m = new THREE.Mesh(geo, CHAR_MAT);
    m.name = name;
    return m;
  };
  const pivot = (name: string, x = 0, y = 0, z = 0) => {
    const grp = new THREE.Group();
    grp.name = name;
    grp.position.set(x, y, z);
    return grp;
  };

  // quadril → tronco/pernas
  const hip = pivot("hip", 0, 0, 0);
  const chest = pivot("chest", 0, PELVIS_Y, 0);
  chest.add(mesh(g.torso, "torso"));
  hip.add(chest);

  // cabeça
  const head = pivot("head", 0, HEAD_Y, 0);
  head.add(mesh(g.head, "headMesh"));
  chest.add(head);

  // braço esquerdo (segura o arco)
  const shL = pivot("shoulderL", 0, SHOULDER_Y, -SHOULDER_Z);
  shL.add(mesh(g.upperArm, "upperArmL"));
  const elL = pivot("elbowL", 0, -UPPER_ARM_H, 0);
  elL.add(mesh(g.foreArm, "foreArmL"));
  shL.add(elL);
  chest.add(shL);
  // arco na mão esquerda; leve inclinação lateral fixa (BOW_CANT_X) só por estilo/silhueta —
  // a inclinação frente/trás (rotation.z) é recalculada por frame pra CONTRA-GIRAR o braço
  // (ver updateCharacterAnimation) e manter o arco sempre ereto, como um arco de verdade.
  const bow = pivot("bow", 0, -FORE_ARM_H, 0);
  bow.rotation.x = BOW_CANT_X;
  bow.add(mesh(g.bow, "bowMesh"));
  const stringLine = new THREE.Line(buildStringGeo(), STRING_MAT);
  stringLine.name = "string";
  bow.add(stringLine);
  const arrow = mesh(g.arrow, "arrow");
  bow.add(arrow);
  elL.add(bow);

  // braço direito (puxa a corda)
  const shR = pivot("shoulderR", 0, SHOULDER_Y, SHOULDER_Z);
  shR.add(mesh(g.upperArm, "upperArmR"));
  const elR = pivot("elbowR", 0, -UPPER_ARM_H, 0);
  elR.add(mesh(g.foreArm, "foreArmR"));
  shR.add(elR);
  chest.add(shR);

  // pernas
  const legL = pivot("legL", 0, PELVIS_Y, -LEG_Z);
  legL.add(mesh(g.thigh, "thighL"));
  const kneeL = pivot("kneeL", 0, -THIGH_H, 0);
  kneeL.add(mesh(g.shin, "shinL"));
  legL.add(kneeL);
  hip.add(legL);

  const legR = pivot("legR", 0, PELVIS_Y, LEG_Z);
  legR.add(mesh(g.thigh, "thighR"));
  const kneeR = pivot("kneeR", 0, -THIGH_H, 0);
  kneeR.add(mesh(g.shin, "shinR"));
  legR.add(kneeR);
  hip.add(legR);

  root.add(hip);

  const rig: Rig = { hip, chest, head, shL, elL, shR, elR, legL, kneeL, legR, kneeR, bow, arrow, string: stringLine };
  root.userData.rig = rig;
  // pose de repouso dos braços: levemente pra fora/frente (arqueiro pronto)
  applyRestPose(rig);
  // contra-rotação inicial do arco (mesma fórmula do updateCharacterAnimation) — evita 1
  // frame com o arco na orientação padrão (0) antes do primeiro tick de animação.
  bow.rotation.z = -(shL.rotation.z + elL.rotation.z) + BOW_TILT_Z;
  return root;
}

// Pose de repouso "pronto pra atirar" (não braços caídos): braço do arco já levantado com o
// arco visível à frente do peito, mão da corda já próxima da corda (não totalmente puxada).
// Silhueta reconhecível como arqueiro mesmo parado — inspirado em Archero/Kingshot, onde o
// herói nunca larga a arma. Reusado tanto no rig inicial quanto no idle/walk da animação.
const REST_SH_L = 0.95;
const REST_EL_L = 0.05;
const REST_SH_R = 0.55;
const REST_EL_R = 0.75;

/** Pose neutra de repouso (usada como base do idle). */
function applyRestPose(r: Rig): void {
  r.shL.rotation.z = REST_SH_L;
  r.shR.rotation.z = REST_SH_R;
  r.elL.rotation.z = REST_EL_L;
  r.elR.rotation.z = REST_EL_R;
}

// ── Animação procedural ──────────────────────────────────────────────────────────────────
// Update central por frame, dirigido pelo estado JÁ sincronizado (posição ⇒ velocidade de
// passada; spawn de projétil ⇒ shoot). Reusa o relógio-fase global `t` do main.ts (sem clock
// novo) e não aloca nada por frame — só escreve rotações/posições dos pivôs.
const STRIDE = 3.2; // cadência da passada (fator sobre `t`)
const SHOOT_MS = 320;
const HIT_MS = 220;
const DEATH_MS = 600;

/** Dispara a animação de puxar/soltar o arco. */
export function triggerCharacterShoot(playerGroup: THREE.Group, nowMs: number): void {
  const char = playerGroup.userData.character as THREE.Group | undefined;
  if (char) char.userData.shootAt = nowMs;
}
/** Dispara o recuo de "levou dano". */
export function triggerCharacterHit(playerGroup: THREE.Group, nowMs: number): void {
  const char = playerGroup.userData.character as THREE.Group | undefined;
  if (char) char.userData.hitAt = nowMs;
}
/** Dispara a queda de morte (cosmético; no servidor a morte é respawn imediato). */
export function triggerCharacterDeath(playerGroup: THREE.Group, nowMs: number): void {
  const char = playerGroup.userData.character as THREE.Group | undefined;
  if (char) char.userData.deathAt = nowMs;
}

/**
 * Anima o boneco de um player. Seguro em qualquer fase/estrutura: sem rig, retorna sem custo.
 * @param t         fase global do loop (main.ts) — sem relógio novo
 * @param moveSpeed 0..1 velocidade planar normalizada (0 = parado ⇒ idle)
 * @param nowMs     performance.now() para janelas de shoot/hit/death
 */
export function updateCharacterAnimation(playerGroup: THREE.Group, t: number, moveSpeed: number, nowMs: number): void {
  const char = playerGroup.userData.character as THREE.Group | undefined;
  if (!char) return;
  const r = char.userData.rig as Rig | undefined;
  if (!r) return;

  // DEATH sobrepõe tudo: queda (tomba pra frente) + encolhe (desaparece).
  const deathAt = (char.userData.deathAt as number) ?? 0;
  if (deathAt > 0) {
    const dp = Math.min(1, (nowMs - deathAt) / DEATH_MS);
    r.hip.rotation.z = -dp * (Math.PI / 2); // tomba
    r.hip.position.y = -dp * 0.1;
    char.scale.setScalar(Math.max(0.001, 1 - dp));
    if (dp >= 1) {
      // fim da janela: reseta (o respawn/materialize reexibe o boneco)
      char.userData.deathAt = 0;
      char.scale.setScalar(1);
      r.hip.rotation.z = 0;
      r.hip.position.y = 0;
    }
    return;
  }
  if (char.scale.x !== 1) char.scale.setScalar(1);

  const phase = t * STRIDE;
  const gait = Math.sin(phase) * moveSpeed;

  // ── Quadril: respiração (idle) + balanço/oscilação (walk) ──
  const breathe = Math.sin(t * 1.3) * 0.012;
  r.hip.position.y = breathe - Math.abs(Math.sin(phase)) * 0.03 * moveSpeed; // sobe/desce da passada
  r.hip.rotation.z = 0;
  r.hip.rotation.y = gait * 0.12; // quadril oscila
  r.chest.rotation.y = -gait * 0.06; // ombros compensam
  r.chest.rotation.z = 0;

  // ── Pernas: passada natural com joelho dobrando na fase de trás ──
  r.legL.rotation.z = gait * 0.5;
  r.legR.rotation.z = -gait * 0.5;
  r.kneeL.rotation.z = -Math.max(0, -gait) * 0.7;
  r.kneeR.rotation.z = -Math.max(0, gait) * 0.7;

  // ── Cabeça: estabiliza (contrapõe a oscilação do tronco) + micro-bob de respiração ──
  r.head.rotation.y = -r.chest.rotation.y * 0.6;
  r.head.rotation.z = breathe * 0.5;

  // ── Braços: shoot sobrepõe a passada; senão balançam em contra-fase das pernas ──
  const shootAt = (char.userData.shootAt as number) ?? 0;
  const shooting = shootAt > 0 && nowMs - shootAt < SHOOT_MS;
  if (shooting) {
    const prog = (nowMs - shootAt) / SHOOT_MS;
    const draw = Math.sin(Math.min(1, prog / 0.6) * (Math.PI / 2)); // puxa (0→1) até 60% da janela
    const release = prog > 0.6 ? (prog - 0.6) / 0.4 : 0; // solta no fim
    const pull = draw * (1 - release);
    // esquerdo trava mirando (arco já estava perto disso no repouso, só refina); direito
    // puxa a corda a partir da pose de repouso até o ponto de ancoragem (perto da cabeça).
    r.shL.rotation.z = 1.2;
    r.elL.rotation.z = 0.0;
    r.shR.rotation.z = REST_SH_R + pull * (1.15 - REST_SH_R);
    r.elR.rotation.z = REST_EL_R + pull * (1.85 - REST_EL_R); // cotovelo puxa até perto da bochecha
    r.chest.rotation.y = -0.15 - pull * 0.15; // tronco gira alguns graus
    r.head.rotation.y = 0.14; // cabeça acompanha a mira
    r.bow.scale.set(1, 1 + pull * 0.06, 1); // arco flexiona levemente
    r.arrow.position.x = -pull * 0.14 * (1 - release); // flecha recua na puxada e dispara
    r.arrow.visible = release < 0.5;
  } else {
    if (shootAt > 0) char.userData.shootAt = 0;
    // repouso "pronto" + leve balanço de caminhada por cima (amplitude pequena — o arco
    // fica sempre visível/levantado, não é o balanço livre de um braço vazio andando)
    const armSwing = gait * 0.1;
    r.shL.rotation.z = REST_SH_L - armSwing;
    r.shR.rotation.z = REST_SH_R + armSwing;
    r.elL.rotation.z = REST_EL_L;
    r.elR.rotation.z = REST_EL_R;
    if (r.bow.scale.y !== 1) r.bow.scale.set(1, 1, 1);
    if (r.arrow.position.x !== 0) r.arrow.position.x = 0;
    if (!r.arrow.visible) r.arrow.visible = true;
  }

  // ── Arco: contra-gira o braço (shL+elL) pra ficar sempre ereto, como um arco de verdade
  // seguraria — sem isso ele gira junto com o braço e vira uma "vareta caída" ao mirar. ──
  r.bow.rotation.z = -(r.shL.rotation.z + r.elL.rotation.z) + BOW_TILT_Z;

  // ── Corda: tensiona de verdade (ponto central acompanha o recuo da flecha) em vez de ──
  // ficar sempre com a mesma corda "esticada" parada — geometria é por instância (ver
  // buildStringGeo) só pra isso ser possível sem afetar os outros players.
  const stringPos = r.string.geometry.attributes.position as THREE.BufferAttribute;
  const stringMidX = -0.03 + r.arrow.position.x;
  if (stringPos.getX(1) !== stringMidX) {
    stringPos.setX(1, stringMidX);
    stringPos.needsUpdate = true;
  }

  // ── Hit: recuo curto (tronco inclina pra trás) somado por cima ──
  const hitAt = (char.userData.hitAt as number) ?? 0;
  const hitDt = nowMs - hitAt;
  if (hitAt > 0 && hitDt < HIT_MS) {
    const k = 1 - hitDt / HIT_MS; // decai
    r.chest.rotation.z += -0.35 * k; // inclina pra trás
    r.hip.position.x = -0.05 * k; // pequeno recuo
  } else {
    if (hitAt > 0) char.userData.hitAt = 0;
    if (r.hip.position.x !== 0) r.hip.position.x = 0;
  }
}
