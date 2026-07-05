import * as THREE from "three";
import { Client, Room } from "colyseus.js";
import { buildMap, isWall, zoneAt, ROOM_NAME, SERVER_PORT } from "@aop/shared";
import { createPlayerVisual, createCollectibleVisual, propParts, updatePowerVisual, updateShieldVisual } from "./visuals";
import { initHud, updateHud, showUpgradeOffer, onUpgradeApplied, chooseUpgradeByIndex, onCombatEvent } from "./hud";
import { MouseControlProfile } from "./input/mouseProfile";
import type { ControlProfile, Intent } from "./input/types";

const hud = document.getElementById("hud")!;
const debugOverlay = document.getElementById("debug-overlay")!;
const debugEventsContainer = document.getElementById("debug-events")!;
const debugStateEl = document.getElementById("debug-state")!;
const debugCloseBtn = document.getElementById("debug-close")!;
let debugOpen = false;

debugCloseBtn.addEventListener("click", () => {
  debugOpen = false;
  debugOverlay.classList.remove("active");
});

// ---------- Cena base ----------
const BG = 0x181820;
const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);
scene.fog = new THREE.Fog(BG, 22, 48); // "indo longe": o mundo some na névoa (ADR-007)

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 120);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(5, 10, 3);
scene.add(sun);

// ---------- Mundo (construído após receber mapW/mapH/mapSeed do servidor) ----------
let worldBuilt = false;
function buildWorld(w: number, h: number, seed: number) {
  const map = buildMap(w, h, seed); // mesmo seed = mesmo mapa do servidor (ADR-007)

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshLambertMaterial({ color: 0x2e7d32 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(w / 2, 0, h / 2);
  scene.add(floor);

  // grid sutil: referência visual de deslocamento no mapa grande
  const grid = new THREE.GridHelper(Math.max(w, h), Math.max(w, h), 0x3a8a3e, 0x3a8a3e);
  (grid.material as THREE.Material).opacity = 0.25;
  (grid.material as THREE.Material).transparent = true;
  grid.position.set(w / 2, 0.01, h / 2);
  scene.add(grid);

  // borda do mapa: contém a arena (campo aberto não tem labirinto — ADR-010/T-001)
  const perimeter: Array<[number, number]> = [];
  for (let x = 0; x < w; x++) {
    perimeter.push([x, 0]);
    perimeter.push([x, h - 1]);
  }
  for (let z = 1; z < h - 1; z++) {
    perimeter.push([0, z]);
    perimeter.push([w - 1, z]);
  }
  const border = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ color: 0x616161 }),
    perimeter.length
  );
  const m = new THREE.Matrix4();
  perimeter.forEach(([x, z], i) => {
    m.setPosition(x + 0.5, 0.5, z + 0.5);
    border.setMatrixAt(i, m);
  });
  scene.add(border);

  // props esparsos (F2 — composição de primitivas, T-002): 1 InstancedMesh POR PARTE
  // do tipo, não por instância — N pedras/árvores continuam poucos draw calls.
  const byType = new Map<string, typeof map.props>();
  map.props.forEach((p) => {
    if (!byType.has(p.type)) byType.set(p.type, []);
    byType.get(p.type)!.push(p);
  });
  byType.forEach((list, type) => {
    const parts = propParts(type as "pedra" | "arvore" | "caixa" | "muro");
    parts.forEach((part) => {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, list.length);
      list.forEach((p, i) => {
        const cx = p.x + p.w / 2 + part.offset.x;
        const cy = part.offset.y;
        const cz = p.z + p.h / 2 + part.offset.z;
        const scale = part.scale ?? new THREE.Vector3(1, 1, 1);
        m.compose(new THREE.Vector3(cx, cy, cz), new THREE.Quaternion(), scale);
        mesh.setMatrixAt(i, m);
      });
      scene.add(mesh);
    });
  });

  // bandeiras: decorativas, marcam o centro de cada zona de guerra (não colidem — world.md)
  map.zones
    .filter((z) => z.kind === "war")
    .forEach((z) => {
      propParts("bandeira").forEach((part) => {
        const mesh = new THREE.Mesh(part.geometry, part.material);
        mesh.position.set(z.cx + part.offset.x, part.offset.y, z.cz + part.offset.z);
        scene.add(mesh);
      });
    });

  // zonas: cliente pinta o chão a partir do mesmo seed (ADR-010), sem tráfego extra
  const ZONE_COLOR = { safe: 0x2f6fa8, war: 0x8a2f2f } as const;
  const zoneTiles: Record<"safe" | "war", Array<[number, number]>> = { safe: [], war: [] };
  for (let z = 1; z < h - 1; z++) {
    for (let x = 1; x < w - 1; x++) {
      if (isWall(map, x, z)) continue;
      const kind = zoneAt(map, x + 0.5, z + 0.5);
      if (kind === "field") continue;
      zoneTiles[kind].push([x, z]);
    }
  }
  const rot = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
  (Object.keys(zoneTiles) as Array<"safe" | "war">).forEach((kind) => {
    const tiles = zoneTiles[kind];
    if (!tiles.length) return;
    const mesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: ZONE_COLOR[kind], transparent: true, opacity: 0.45 }),
      tiles.length
    );
    tiles.forEach(([x, z], i) => {
      const tile = rot.clone();
      tile.setPosition(x + 0.5, 0.015, z + 0.5);
      mesh.setMatrixAt(i, tile);
    });
    scene.add(mesh);
  });

  camera.position.set(w / 2, 15, h / 2 + 8);
  camera.lookAt(w / 2, 0, h / 2);
  worldBuilt = true;
  console.log(`[client] mundo ${w}x${h} (seed ${seed}), ${map.props.length} props, ${map.zones.length} zonas`);
}

// ---------- Entidades dinâmicas ----------
const playerVisuals = new Map<string, THREE.Group>();
const collectibleMeshes = new Map<string, THREE.Mesh>();
const projectileMeshes = new Map<string, THREE.Mesh>();

// ---------- Rede ----------
const url =
  location.hostname === "localhost" || location.hostname.startsWith("192.")
    ? `ws://${location.hostname}:${SERVER_PORT}`
    : `wss://${location.host}`;

const client = new Client(url);
let room: Room | undefined;
let ping = -1;
let mySessionId = "";

let playerToken = localStorage.getItem("aop_token");
if (!playerToken) {
  playerToken = "tok_" + Math.random().toString(36).substring(2, 10);
  localStorage.setItem("aop_token", playerToken);
}

async function connect() {
  try {
    room = await client.joinOrCreate(ROOM_NAME, {
      name: `web-${Math.floor(Math.random() * 999)}`,
      token: playerToken
    });
    mySessionId = room.sessionId;
    room.onMessage("pong", (t: number) => (ping = Math.round(performance.now() - t)));
    room.onMessage("announce", (msg: { kind: string }) => {
      if (msg.kind === "farm_event") announceUntil = performance.now() + 6000;
    });
    room.onMessage("debug_event", (ev: any) => {
      pushDebugEvent(ev);
    });
    // T-016: cards de level-up — servidor manda a oferta e confirma a escolha
    room.onMessage("upgrade_offer", (offer: any) => showUpgradeOffer(offer));
    room.onMessage("upgrade_applied", (msg: any) => onUpgradeApplied(msg));
    setInterval(() => room?.send("ping", performance.now()), 2000);
    setInterval(sendInput, 1000 / 20);
  } catch (e) {
    hud.textContent = `erro ao conectar em ${url}\n${e}`;
  }
}
connect();

// ---------- Debug (T-007) ----------
// Também capturamos eventos localmente (independente de DEBUG=1 no server)
const localDebugEvents: Array<{time: number; type: string; payload: any}> = [];

function pushDebugEvent(ev: {time: number; type: string; payload: any}) {
  localDebugEvents.push(ev);
  if (localDebugEvents.length > 200) localDebugEvents.shift();
  if (debugOpen) renderDebugEvent(ev);
  // T-018: juice de combate — número de dano no alvo + streak no HUD
  onCombatEvent(ev, mySessionId);
  if (ev.type === "hit" && ev.payload?.damage > 0) {
    const vis = playerVisuals.get(ev.payload.victimId);
    if (vis) spawnDamagePopup(vis.position.x, vis.position.z, ev.payload.damage, ev.payload.isKill === true);
  }
}

// ---------- Números de dano flutuantes (T-018) ----------
// Sprite com CanvasTexture; orçamento fixo (máx. 24 vivos) — sem custo quando não há combate.
const damagePopups: Array<{ sprite: THREE.Sprite; born: number }> = [];
const POPUP_LIFE_MS = 900;

function spawnDamagePopup(x: number, z: number, damage: number, kill: boolean) {
  if (damagePopups.length >= 24) return;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const g = canvas.getContext("2d")!;
  // fonte cresce com o dano — golpe forte É visivelmente forte
  const fontSize = Math.round(Math.min(46, 20 + damage * 0.6));
  g.font = `bold ${fontSize}px monospace`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.strokeStyle = "#000";
  g.lineWidth = 5;
  g.fillStyle = kill ? "#ff5252" : damage >= 30 ? "#ffb300" : "#ffe082";
  const text = kill ? `${Math.round(damage)} ☠` : `${Math.round(damage)}`;
  g.strokeText(text, 64, 34);
  g.fillText(text, 64, 34);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false })
  );
  sprite.scale.set(1.7, 0.85, 1);
  sprite.position.set(x, 1.35, z);
  scene.add(sprite);
  damagePopups.push({ sprite, born: performance.now() });
}

function updateDamagePopups(now: number) {
  for (let i = damagePopups.length - 1; i >= 0; i--) {
    const p = damagePopups[i];
    const age = (now - p.born) / POPUP_LIFE_MS;
    if (age >= 1) {
      scene.remove(p.sprite);
      p.sprite.material.map?.dispose();
      p.sprite.material.dispose();
      damagePopups.splice(i, 1);
      continue;
    }
    p.sprite.position.y = 1.35 + age * 0.8; // sobe
    p.sprite.material.opacity = 1 - age * age; // some no fim
  }
}

function renderDebugEvent(ev: {time: number; type: string; payload: any}) {
  const el = document.createElement("div");
  el.className = `debug-event type-${ev.type}`;
  const ts = new Date(ev.time).toISOString().substring(11, 23);
  el.innerHTML = `<span class="ts">[${ts}]</span> <b>${ev.type}</b> ${JSON.stringify(ev.payload)}`;
  debugEventsContainer.appendChild(el);
  debugEventsContainer.scrollTop = debugEventsContainer.scrollHeight;
  if (debugEventsContainer.children.length > 60) debugEventsContainer.firstChild?.remove();
}

function updateDebugState() {
  if (!debugOpen) return;
  const st: any = room?.state;
  const me = st?.players?.get?.(mySessionId);
  const now = Date.now();

  const rows: string[] = [];
  rows.push(`<h3>🔍 DEBUG (F3) — ${new Date(now).toISOString().substring(11,23)}</h3>`);
  rows.push(`<table>`);

  // Servidor
  rows.push(`<tr><td colspan="2" class="section">── SALA ──</td></tr>`);
  rows.push(`<tr><td>mapa</td><td>${st?.mapW ?? "?"}×${st?.mapH ?? "?"} seed:${st?.mapSeed ?? "?"}</td></tr>`);
  rows.push(`<tr><td>players</td><td>${st?.players?.size ?? 0}</td></tr>`);
  rows.push(`<tr><td>coletáveis</td><td>${st?.collectibles?.size ?? 0}</td></tr>`);
  rows.push(`<tr><td>projéteis</td><td>${st?.projectiles?.size ?? 0}</td></tr>`);
  rows.push(`<tr><td>ping</td><td>${ping < 0 ? "..." : ping + " ms"}</td></tr>`);

  // Meu player
  if (me) {
    rows.push(`<tr><td colspan="2" class="section">── MEU PLAYER ──</td></tr>`);
    rows.push(`<tr><td>sessão</td><td>${mySessionId}</td></tr>`);
    rows.push(`<tr><td>pos</td><td>x:${me.x?.toFixed(2)} z:${me.z?.toFixed(2)}</td></tr>`);
    rows.push(`<tr><td>facing</td><td>${((me.dir ?? 0) * 180 / Math.PI).toFixed(0)}°</td></tr>`);
    rows.push(`<tr><td>gatilho</td><td>${lastIntent.fire ? `ativo (${activeProfile.id})` : "inativo"}</td></tr>`);
    rows.push(`<tr><td>hp</td><td>${Math.ceil(me.hp)}/${me.maxHp} (vit:${me.vitality?.toFixed(2)})</td></tr>`);
    const shieldMs = Math.max(0, (me.spawnProtectedUntil ?? 0) - Date.now());
    rows.push(`<tr><td>escudo</td><td>${shieldMs > 0 ? `${(shieldMs / 1000).toFixed(1)}s` : "—"}</td></tr>`);
    rows.push(`<tr><td>nível / xp</td><td>${me.level} / ${me.xp?.toFixed(0)}</td></tr>`);
    rows.push(`<tr><td>força</td><td>${me.strength?.toFixed(3)}</td></tr>`);
    rows.push(`<tr><td>velocidade</td><td>${me.speed?.toFixed(3)}</td></tr>`);
    rows.push(`<tr><td>cadência (×cd)</td><td>${me.attackSpeed?.toFixed(3)}</td></tr>`);
    rows.push(`<tr><td>alcance (×range)</td><td>${me.reach?.toFixed(3)}</td></tr>`);
    rows.push(`<tr><td>launcher</td><td>${me.launcher}</td></tr>`);
    rows.push(`<tr><td>skills</td><td>${me.skills?.length ? Array.from(me.skills).join(", ") : "nenhuma"}</td></tr>`);
    rows.push(`<tr><td>coins</td><td>${me.coins}</td></tr>`);
    const fx: string[] = me.effects ? Array.from(me.effects) : [];
    rows.push(`<tr><td>efeitos</td><td>${fx.length ? fx.join(", ") : "nenhum"}</td></tr>`);
    rows.push(`<tr><td>token</td><td>${localStorage.getItem("aop_token") ?? "?"}</td></tr>`);
  }

  // Todos os players
  rows.push(`<tr><td colspan="2" class="section">── TODOS OS PLAYERS ──</td></tr>`);
  st?.players?.forEach((p: any, id: string) => {
    const tag = id === mySessionId ? " (você)" : (p.isBot ? " [bot]" : "");
    rows.push(`<tr><td>${p.name}${tag}</td><td>lv${p.level} HP:${Math.ceil(p.hp)}/${p.maxHp} x:${p.x?.toFixed(1)} z:${p.z?.toFixed(1)} dir:${((p.dir ?? 0) * 180 / Math.PI).toFixed(0)}°</td></tr>`);
  });

  rows.push(`</table>`);
  debugStateEl.innerHTML = rows.join("");
}

// ---------- Input por perfil de controle (ADR-015 / T-019) ----------
// Todo perfil produz a MESMA intenção {move, aim, fire}; o servidor não muda (já aceita
// aimX/aimZ opcional desde SPEC-0003). Mira/rotação é atributo do PERFIL, não uma regra
// global — perfil novo (T-019b: keyboard/touch) é só uma classe nova, zero mudança de rede.
let announceUntil = 0;
const crosshairEl = document.getElementById("crosshair")!;

const activeProfile: ControlProfile = new MouseControlProfile({
  camera,
  crosshairEl,
  getPlayerPos: () => {
    const st: any = room?.state;
    const me = st?.players?.get?.(mySessionId);
    return me ? { x: me.x, z: me.z } : null;
  },
});
activeProfile.attach();

// Ações fora da intenção de jogo (debug, cards, reroll) continuam globais — não são
// atributo de perfil de controle.
addEventListener("keydown", (e) => {
  if (e.key === "F3") {
    e.preventDefault();
    debugOpen = !debugOpen;
    debugOverlay.classList.toggle("active", debugOpen);
    if (debugOpen) {
      // Preenche o feed com os últimos eventos locais
      debugEventsContainer.innerHTML = "";
      localDebugEvents.slice(-30).forEach(renderDebugEvent);
    }
    return;
  }
  // T-016: 1/2/3 escolhem o card da oferta aberta (consome a tecla só se houver oferta)
  if (e.key === "1" || e.key === "2" || e.key === "3") {
    if (chooseUpgradeByIndex(Number(e.key) - 1)) return;
  }
  if (e.key.toLowerCase() === "r") room?.send("reroll"); // T-004: coins compram reroll de atributo
});

// Última intenção enviada; a câmera (followCamera) reusa o vetor de mira para o leve
// offset (ADR-015) sem precisar chamar poll() de novo fora do tick de rede.
let lastIntent: Intent = { moveX: 0, moveZ: 0, fire: false };

function sendInput() {
  const intent = activeProfile.poll();
  lastIntent = intent;
  const payload: { x: number; z: number; aimX?: number; aimZ?: number; fire?: boolean } = {
    x: intent.moveX,
    z: intent.moveZ,
  };
  if (typeof intent.aimX === "number" && typeof intent.aimZ === "number") {
    payload.aimX = intent.aimX;
    payload.aimZ = intent.aimZ;
  }
  if (intent.fire) payload.fire = true;
  room?.send("input", payload);
}

// ---------- Sincronização estado → cena ----------
// T-011: menor caminho angular (evita o grupo "girar a volta toda" ao cruzar +-180°)
function shortestAngleDiff(from: number, to: number): number {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function syncWorld() {
  const st: any = room?.state;
  if (!st) return;
  if (!worldBuilt && st.mapW > 0) buildWorld(st.mapW, st.mapH, st.mapSeed);
  if (!worldBuilt) return;

  const seenP = new Set<string>();
  st.players.forEach((p: any, id: string) => {
    seenP.add(id);
    let vis = playerVisuals.get(id);
    if (!vis) {
      vis = createPlayerVisual(id, id === mySessionId);
      vis.position.set(p.x, 0, p.z);
      vis.rotation.y = -(p.dir ?? 0);
      scene.add(vis);
      playerVisuals.set(id, vis);
    }
    vis.position.x += (p.x - vis.position.x) * 0.25;
    vis.position.z += (p.z - vis.position.z) * 0.25;
    // dir do servidor segue a convenção atan2(z,x); rotation.y = -dir alinha o
    // "nariz" (local +X) com essa direção no mundo (ver visuals.ts).
    vis.rotation.y += shortestAngleDiff(vis.rotation.y, -(p.dir ?? 0)) * 0.25;
    updatePowerVisual(vis, p.level ?? 1, t); // T-018: aro de poder por faixa de nível
    updateShieldVisual(vis, (p.spawnProtectedUntil ?? 0) > Date.now(), t); // SPEC-0005: bolha de invuln
  });
  playerVisuals.forEach((vis, id) => {
    if (!seenP.has(id)) {
      scene.remove(vis);
      playerVisuals.delete(id);
    }
  });

  const seenC = new Set<string>();
  st.collectibles?.forEach((c: any, id: string) => {
    seenC.add(id);
    if (!collectibleMeshes.has(id)) {
      const mesh = createCollectibleVisual(c.kind);
      mesh.position.set(c.x, 0.4, c.z);
      scene.add(mesh);
      collectibleMeshes.set(id, mesh);
    }
  });
  collectibleMeshes.forEach((mesh, id) => {
    if (!seenC.has(id)) {
      scene.remove(mesh);
      collectibleMeshes.delete(id);
    }
  });

  const seenProj = new Set<string>();
  st.projectiles?.forEach((proj: any, id: string) => {
    seenProj.add(id);
    let mesh = projectileMeshes.get(id);
    if (!mesh) {
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.3),
        new THREE.MeshBasicMaterial({ color: 0xffaa00 })
      );
      mesh.position.set(proj.x, 0.5, proj.z);
      scene.add(mesh);
      projectileMeshes.set(id, mesh);
    }
    mesh.position.x += (proj.x - mesh.position.x) * 0.5;
    mesh.position.z += (proj.z - mesh.position.z) * 0.5;
  });
  projectileMeshes.forEach((mesh, id) => {
    if (!seenProj.has(id)) {
      scene.remove(mesh);
      projectileMeshes.delete(id);
    }
  });
}

// câmera segue o jogador suavemente
const CAMERA_AIM_OFFSET = 2.5; // ADR-015: leve deslocamento do alvo na direção da mira, sem girar a câmera
function followCamera() {
  const me = playerVisuals.get(mySessionId);
  if (!me) return;
  let offsetX = 0;
  let offsetZ = 0;
  const { aimX, aimZ } = lastIntent;
  if (typeof aimX === "number" && typeof aimZ === "number") {
    const len = Math.hypot(aimX, aimZ);
    if (len > 1e-3) {
      offsetX = (aimX / len) * CAMERA_AIM_OFFSET;
      offsetZ = (aimZ / len) * CAMERA_AIM_OFFSET;
    }
  }
  const tx = me.position.x + offsetX;
  const tz = me.position.z + offsetZ;
  camera.position.x += (tx - camera.position.x) * 0.06;
  camera.position.z += (tz + 8 - camera.position.z) * 0.06;
  camera.position.y += (15 - camera.position.y) * 0.06;
  camera.lookAt(camera.position.x, 0, camera.position.z - 8);
}

// ---------- HUD + roster (T-016: extraídos para hud.ts) ----------
initHud({
  getRoom: () => room,
  getSessionId: () => mySessionId,
  getPing: () => ping,
  getAnnounceUntil: () => announceUntil,
});

// ---------- Loop ----------
let t = 0;
let debugTick = 0;
function animate() {
  requestAnimationFrame(animate);
  t += 0.05;
  syncWorld();
  followCamera();
  collectibleMeshes.forEach((mesh) => {
    mesh.position.y = 0.4 + Math.sin(t) * 0.08;
    mesh.rotation.y += 0.02;
  });
  updateDamagePopups(performance.now()); // T-018
  updateHud(performance.now());
  // Atualiza painel de debug a ~10fps para não sobrecarregar DOM
  if (debugOpen && ++debugTick % 2 === 0) updateDebugState();
  renderer.render(scene, camera);
}
animate();
