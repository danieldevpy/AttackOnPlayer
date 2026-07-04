import * as THREE from "three";
import { Client, Room } from "colyseus.js";
import { buildMap, isWall, zoneAt, xpToNext, ROOM_NAME, SERVER_PORT } from "@aop/shared";
import { createPlayerVisual, createCollectibleVisual, propParts } from "./visuals";

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
    room.onMessage("announce", (msg: { kind: string }) => {
      if (msg.kind === "farm_event") announceUntil = performance.now() + 6000;
    });
    setInterval(() => room?.send("ping", performance.now()), 2000);
    setInterval(sendInput, 1000 / 20);
  } catch (e) {
    hud.textContent = `erro ao conectar em ${url}\n${e}`;
  }
}
connect();

// ---------- Input (teclado; touch no M1) ----------
let announceUntil = 0;
const keys = new Set<string>();
addEventListener("keydown", (e) => {
  keys.add(e.key.toLowerCase());
  if (e.key.toLowerCase() === "r") room?.send("reroll"); // T-004: coins compram reroll de atributo
});
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
  const xpNeed = me ? xpToNext(me.level) : 0;
  hud.textContent =
    `ping: ${ping < 0 ? "..." : ping + "ms"}\n` +
    `nível: ${me?.level ?? "-"} (xp ${me?.xp ?? 0}/${xpNeed})` +
    (fx.includes("speed_up") ? `  ⚡x${me.speed}` : "") +
    (fx.includes("xp_boost") ? `  2xXP` : "") +
    `\nforça ${me?.strength?.toFixed(2) ?? "-"}  vitalidade ${me?.vitality?.toFixed(2) ?? "-"}` +
    `\ncoins: ${me?.coins ?? 0}  (R = reroll de atributo)` +
    `\nmapa: ${st?.mapW ?? "?"}x${st?.mapH ?? "?"}\n` +
    `WASD/setas para mover` +
    (now < announceUntil ? `\n\n🔥 farm_event na zona de guerra!` : "");

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
      ${fx2.includes("xp_boost") ? `<span class="tag">2xXP</span>` : ""}
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
