import * as THREE from "three";
import { Client, Room } from "colyseus.js";
import { buildMap, TILE_WALL, ROOM_NAME, SERVER_PORT } from "@aop/shared";
import { createPlayerVisual, createCollectibleVisual } from "./visuals";

const hud = document.getElementById("hud")!;
const roster = document.getElementById("roster")!;

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

  const wallCells: Array<[number, number]> = [];
  for (let z = 0; z < h; z++)
    for (let x = 0; x < w; x++) if (map.cells[z * w + x] === TILE_WALL) wallCells.push([x, z]);
  const walls = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ color: 0x616161 }),
    wallCells.length
  );
  const m = new THREE.Matrix4();
  wallCells.forEach(([x, z], i) => {
    m.setPosition(x + 0.5, 0.5, z + 0.5);
    walls.setMatrixAt(i, m);
  });
  scene.add(walls);

  camera.position.set(w / 2, 15, h / 2 + 8);
  camera.lookAt(w / 2, 0, h / 2);
  worldBuilt = true;
  console.log(`[client] mundo ${w}x${h} (seed ${seed}), ${wallCells.length} blocos`);
}

// ---------- Entidades dinâmicas ----------
const playerVisuals = new Map<string, THREE.Group>();
const collectibleMeshes = new Map<string, THREE.Mesh>();

// ---------- Rede ----------
const url =
  location.hostname === "localhost" || location.hostname.startsWith("192.")
    ? `ws://${location.hostname}:${SERVER_PORT}`
    : `wss://${location.host}`;

const client = new Client(url);
let room: Room | undefined;
let ping = -1;
let mySessionId = "";

async function connect() {
  try {
    room = await client.joinOrCreate(ROOM_NAME, { name: `web-${Math.floor(Math.random() * 999)}` });
    mySessionId = room.sessionId;
    room.onMessage("pong", (t: number) => (ping = Math.round(performance.now() - t)));
    setInterval(() => room?.send("ping", performance.now()), 2000);
    setInterval(sendInput, 1000 / 20);
  } catch (e) {
    hud.textContent = `erro ao conectar em ${url}\n${e}`;
  }
}
connect();

// ---------- Input (teclado; touch no M1) ----------
const keys = new Set<string>();
addEventListener("keydown", (e) => keys.add(e.key.toLowerCase()));
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
let lastInput = { x: 0, z: 0 };
function sendInput() {
  const x = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
  const z = (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0);
  if (x !== lastInput.x || z !== lastInput.z) {
    lastInput = { x, z };
    room?.send("input", lastInput);
  } else if (x !== 0 || z !== 0) {
    room?.send("input", lastInput);
  }
}

// ---------- Sincronização estado → cena ----------
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
      scene.add(vis);
      playerVisuals.set(id, vis);
    }
    vis.position.x += (p.x - vis.position.x) * 0.25;
    vis.position.z += (p.z - vis.position.z) * 0.25;
  });
  playerVisuals.forEach((vis, id) => {
    if (!seenP.has(id)) {
      scene.remove(vis);
      playerVisuals.delete(id);
    }
  });

  const seenC = new Set<string>();
  st.collectibles.forEach((c: any, id: string) => {
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
}

// câmera segue o jogador suavemente
function followCamera() {
  const me = playerVisuals.get(mySessionId);
  if (!me) return;
  const tx = me.position.x;
  const tz = me.position.z;
  camera.position.x += (tx - camera.position.x) * 0.06;
  camera.position.z += (tz + 8 - camera.position.z) * 0.06;
  camera.position.y += (15 - camera.position.y) * 0.06;
  camera.lookAt(camera.position.x, 0, camera.position.z - 8);
}

// ---------- HUD + roster ----------
let rosterNext = 0;
function updateHud(now: number) {
  const st: any = room?.state;
  const me = st?.players?.get?.(mySessionId);
  const fx: string[] = me?.effects ? Array.from(me.effects) : [];
  hud.textContent =
    `ping: ${ping < 0 ? "..." : ping + "ms"}\n` +
    `nível: ${me?.level ?? "-"}` +
    (fx.includes("speed_up") ? `  ⚡x${me.speed}` : "") +
    `\nmapa: ${st?.mapW ?? "?"}x${st?.mapH ?? "?"}\n` +
    `WASD/setas para mover`;

  if (now < rosterNext || !st?.players) return;
  rosterNext = now + 250;
  let html = `<div class="title">PLAYERS</div>`;
  st.players.forEach((p: any, id: string) => {
    const self = id === mySessionId;
    const fx2: string[] = p.effects ? Array.from(p.effects) : [];
    html += `<div class="row">
      <span class="dot ${self ? "self" : "enemy"}"></span>
      <span class="name">${p.name}${self ? " (você)" : ""}</span>
      ${p.isBot ? `<span class="tag">BOT</span>` : ""}
      ${fx2.includes("speed_up") ? `<span class="tag">⚡</span>` : ""}
      <span class="lvl">lv${p.level}</span>
    </div>`;
  });
  roster.innerHTML = html;
}

// ---------- Loop ----------
let t = 0;
function animate() {
  requestAnimationFrame(animate);
  t += 0.05;
  syncWorld();
  followCamera();
  collectibleMeshes.forEach((mesh) => {
    mesh.position.y = 0.4 + Math.sin(t) * 0.08;
    mesh.rotation.y += 0.02;
  });
  updateHud(performance.now());
  renderer.render(scene, camera);
}
animate();
