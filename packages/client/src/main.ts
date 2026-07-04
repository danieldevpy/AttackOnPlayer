import * as THREE from "three";
import { Client, Room } from "colyseus.js";
import {
  buildMap,
  isWall,
  MAP_W,
  MAP_H,
  ROOM_NAME,
  SERVER_PORT,
} from "@aop/shared";

const hud = document.getElementById("hud")!;

// ---------- Cena (placeholders — Debug First) ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x181820);

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100);
camera.position.set(MAP_W / 2, 14, MAP_H / 2 + 7); // de cima, leve inclinação
camera.lookAt(MAP_W / 2, 0, MAP_H / 2);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); // leveza em mobile
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

// chão
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(MAP_W, MAP_H),
  new THREE.MeshLambertMaterial({ color: 0x2e7d32 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.set(MAP_W / 2, 0, MAP_H / 2);
scene.add(floor);

// paredes (InstancedMesh = 1 draw call)
const grid = buildMap();
const wallCells: Array<[number, number]> = [];
for (let z = 0; z < MAP_H; z++)
  for (let x = 0; x < MAP_W; x++) if (isWall(grid, x, z)) wallCells.push([x, z]);
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

// ---------- Meshes dinâmicos (diff por chave a cada frame) ----------
const playerMeshes = new Map<string, THREE.Mesh>();
const collectibleMeshes = new Map<string, THREE.Mesh>();
const playerGeo = new THREE.CapsuleGeometry(0.35, 0.5, 4, 8);
const collectGeo = new THREE.SphereGeometry(0.25, 12, 12);
const collectMat = new THREE.MeshLambertMaterial({ color: 0xffd54f, emissive: 0x7a5c00 });

function colorFor(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return new THREE.Color().setHSL(h / 360, 0.7, 0.55).getHex();
}

// ---------- Rede ----------
const url =
  location.hostname === "localhost" || location.hostname.startsWith("192.")
    ? `ws://${location.hostname}:${SERVER_PORT}`
    : `wss://${location.host}`; // produção atrás de proxy TLS

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

// ---------- Input (teclado; touch entra no M1) ----------
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
    room?.send("input", lastInput); // keepalive de input
  }
}

// ---------- Render loop ----------
function syncMeshes() {
  if (!room?.state?.players) return;

  const seenP = new Set<string>();
  room.state.players.forEach((p: any, id: string) => {
    seenP.add(id);
    let mesh = playerMeshes.get(id);
    if (!mesh) {
      mesh = new THREE.Mesh(
        playerGeo,
        new THREE.MeshLambertMaterial({ color: id === mySessionId ? 0x42a5f5 : colorFor(id) })
      );
      mesh.position.set(p.x, 0.6, p.z);
      scene.add(mesh);
      playerMeshes.set(id, mesh);
    }
    // interpolação até a posição autoritativa
    mesh.position.x += (p.x - mesh.position.x) * 0.25;
    mesh.position.z += (p.z - mesh.position.z) * 0.25;
  });
  playerMeshes.forEach((mesh, id) => {
    if (!seenP.has(id)) {
      scene.remove(mesh);
      playerMeshes.delete(id);
    }
  });

  const seenC = new Set<string>();
  room.state.collectibles.forEach((c: any, id: string) => {
    seenC.add(id);
    if (!collectibleMeshes.has(id)) {
      const mesh = new THREE.Mesh(collectGeo, collectMat);
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

let t = 0;
function animate() {
  requestAnimationFrame(animate);
  t += 0.05;
  syncMeshes();
  collectibleMeshes.forEach((mesh) => (mesh.position.y = 0.4 + Math.sin(t) * 0.08));

  const me: any = room?.state?.players?.get?.(mySessionId);
  hud.textContent =
    `ping: ${ping < 0 ? "..." : ping + "ms"}\n` +
    `nível: ${me?.level ?? "-"}\n` +
    `jogadores: ${room?.state?.players?.size ?? 0}\n` +
    `WASD/setas para mover`;

  renderer.render(scene, camera);
}
animate();
