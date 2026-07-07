import * as THREE from "three";
import { Client, Room } from "colyseus.js";
import {
  buildMap,
  isWall,
  zoneAt,
  ROOM_NAME,
  SERVER_PORT,
  SPEED_BOOST_MS,
  XP_BOOST_MS,
  KILL_RUSH_MS,
  SHIELD_TEMP_MS,
  HP_ORB_AMOUNT,
  GameMap,
  MapFileV1,
  mapFileToGameMap,
  LAUNCHERS,
} from "@aop/shared";
import { createPlayerVisual, createCollectibleVisual, propParts, updatePowerVisual, updateShieldVisual, updateFlagGlow, updateFlagGround, updateBuffCooldownRing, updateNameplate } from "./visuals";
import { updateCharacterAnimation, triggerCharacterShoot, triggerCharacterHit, triggerCharacterDeath } from "./characters";
import { initHud, updateHud, showUpgradeOffer, onUpgradeApplied, closeUpgradeOffer, chooseUpgradeByIndex, onCombatEvent, pushToast } from "./hud";
import { createVfxSystem } from "./vfx";
import { createAudioSystem } from "./audio";
import { ProfileManager, ProfileId } from "./input/manager";
import type { Intent } from "./input/types";
import { initImmersion, setUnloadGuard } from "./immersion";
import { getAuthToken, ensureGuestRegistered } from "./auth";
import { showLobby } from "./lobby";

// T-048 (SPEC-0012): blindagem contra ações do navegador (menu de contexto, zoom, seleção
// de texto, etc.) — sempre ativa, independente de perfil de controle ou conexão.
initImmersion();

// T-023 (SPEC-0006): build prod não tem overlay de debug (F3/feeds) — só dev.
const IS_DEV = import.meta.env.DEV;

const hud = document.getElementById("hud")!;
const debugOverlay = document.getElementById("debug-overlay")!;
const debugEventsContainer = document.getElementById("debug-events")!;
const debugStateEl = document.getElementById("debug-state")!;
const debugCloseBtn = document.getElementById("debug-close")!;
let debugOpen = false;

if (!IS_DEV) {
  debugOverlay.remove();
  document.querySelector(".debug-f3-hint")?.remove();
}

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
function resizeRenderer() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener("resize", resizeRenderer);
// Mobile: girar o celular já dispara "resize" na maioria dos navegadores, mas alguns
// atrasam até o fim da animação do SO — reforço explícito pra não ficar um frame esticado.
screen.orientation?.addEventListener?.("change", () => setTimeout(resizeRenderer, 50));

scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(5, 10, 3);
scene.add(sun);

// T-022 (SPEC-0006): registry de VFX nomeados — 1 pool de partículas para todo o jogo.
const vfx = createVfxSystem();
scene.add(vfx.points);

// T-049 (SPEC-0013): registry de sons nomeados — mesmo AudioContext pra todo o jogo,
// destravado no primeiro gesto do usuário (regra de autoplay dos browsers).
const audio = createAudioSystem();

// ---------- Mundo (construído após receber mapW/mapH/mapSeed OU "map_data" do servidor) ----------
let worldBuilt = false;
// T-024 (SPEC-0007): mapa curado (mapId) não dá pra reconstruir por seed — o cliente recebe
// o GameMap já pronto (via `map_data` + `mapFileToGameMap`). Mapa gerado (sem mapId) continua
// reconstruindo localmente por `buildMap(w,h,seed)`, como sempre (ADR-007, zero tráfego extra).
function buildWorld(map: GameMap) {
  const { w, h, seed } = map;

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
const collectibleMeshes = new Map<string, THREE.Group>(); // F2: cada coletável é um grupo composto (visuals.ts)
const projectileMeshes = new Map<string, THREE.Group>(); // T-055: flecha = grupo (haste+ponta)
let flagVisual: THREE.Group | undefined; // T-021: bandeira "rei do mapa" — objeto único, não um MapSchema

// T-055 (SPEC-0014): visual do projétil do arqueiro = flecha (haste + ponta), não mais a
// esfera de placeholder da T-039. Geometria "deitada" ao longo do local +X (mesma convenção
// de "nariz" dos personagens, ver syncWorld) — cada parte é rotacionada UMA vez na criação
// da geometria singleton, então a montagem em grupo não precisa de rotação extra por parte.
function arrowShaftGeo(len: number, radius: number): THREE.CylinderGeometry {
  const g = new THREE.CylinderGeometry(radius, radius, len, 6);
  g.rotateZ(-Math.PI / 2); // eixo Y (padrão do cilindro) -> eixo X local
  return g;
}
function arrowHeadGeo(len: number, radius: number): THREE.ConeGeometry {
  const g = new THREE.ConeGeometry(radius, len, 4); // 4 lados: mesmo padrão low-poly da T-053
  g.rotateZ(-Math.PI / 2); // ápice (+Y) -> +X local, ponta aponta pra frente
  return g;
}

// T-039/T-055: visual do projétil POR lançador. Basic = discreto (flecha pequena, como
// antes era a esfera). Vantajosos = maiores e mais vistosos + muzzle mais rico (regra de
// intensidade da T-022: automático é leve, arma "boa" chama atenção). Geo/mat são singletons
// de módulo — N projéteis do mesmo lançador reusam os mesmos objetos ("leve sempre" §5).
interface ProjStyle {
  shaftGeo: THREE.CylinderGeometry;
  headGeo: THREE.ConeGeometry;
  mat: THREE.MeshBasicMaterial;
  shaftLen: number;
  headLen: number;
  muzzle: string; // entrada em VFX_DEFS disparada no nascimento do projétil
  sound: string; // T-050: entrada em AUDIO_REGISTRY — fire distinto por launcher
  trail?: string; // T-055: entrada em VFX_DEFS pro rastro leve em voo (só heavy_shot)
}
const projStyles: Record<string, ProjStyle> = {
  basic_shot: {
    shaftGeo: arrowShaftGeo(0.32, 0.035),
    headGeo: arrowHeadGeo(0.18, 0.09), // acompanha o sceneryRadius fino da T-038
    mat: new THREE.MeshBasicMaterial({ color: 0xffaa00 }),
    shaftLen: 0.32,
    headLen: 0.18,
    muzzle: "muzzle_flash",
    sound: "fire_basic",
  },
  heavy_shot: {
    shaftGeo: arrowShaftGeo(0.42, 0.05),
    headGeo: arrowHeadGeo(0.24, 0.13), // flecha pesada, bem visível
    mat: new THREE.MeshBasicMaterial({ color: 0xff6d00 }),
    shaftLen: 0.42,
    headLen: 0.24,
    muzzle: "muzzle_heavy",
    sound: "fire_heavy",
    trail: "arrow_trail_heavy", // T-055: única com rastro — reforça a leitura de "arma pesada"
  },
  rapid_shot: {
    shaftGeo: arrowShaftGeo(0.26, 0.03),
    headGeo: arrowHeadGeo(0.14, 0.07), // pequena e ágil
    mat: new THREE.MeshBasicMaterial({ color: 0x40c4ff }),
    shaftLen: 0.26,
    headLen: 0.14,
    muzzle: "muzzle_rapid",
    sound: "fire_rapid",
  },
};
function projStyleFor(launcherId: string): ProjStyle {
  return projStyles[launcherId] ?? projStyles.basic_shot;
}
/** T-055: monta o grupo haste+ponta de uma flecha a partir da geometria/material singleton do
 * lançador — a ponta fica na frente (nariz local +X), a haste logo atrás. */
function createArrowMesh(style: ProjStyle): THREE.Group {
  const group = new THREE.Group();
  const shaft = new THREE.Mesh(style.shaftGeo, style.mat);
  const head = new THREE.Mesh(style.headGeo, style.mat);
  head.position.x = style.shaftLen / 2 + style.headLen / 2;
  group.add(shaft, head);
  return group;
}

// T-022: instante exato de aplicação de cada buff temporário (evento já emitido pelo
// servidor — pickup/impulso), pareado com a MESMA duração do EffectSystem (@aop/shared),
// pra desenhar o anel esvaziando sem "chutar" o tempo restante nem duplicar a constante.
const BUFF_DURATION_MS: Record<string, number> = {
  speed_up: SPEED_BOOST_MS,
  xp_boost: XP_BOOST_MS,
  kill_rush: KILL_RUSH_MS,
  damage_reduction: SHIELD_TEMP_MS, // SPEC-0010: escudo temporário
};
const buffApplied = new Map<string, { kind: string; expiresAt: number }>();
const wasShielded = new Map<string, boolean>(); // detecta a transição p/ disparar shield_pop
const lastTrailSpawn = new Map<string, number>();
const lastArrowTrailAt = new Map<string, number>(); // T-055: rastro leve em voo, por projétil (só heavy_shot)
let lastFlagAuraAt = 0;

// T-045 (SPEC-0011): transição de nascimento — materialização scale-in + fade-in.
// Sinal escolhido: mudança de `spawnProtectedUntil` para um valor FUTURO novo.
// É o sinal mais confiável: autoritativo, sempre setado no respawn (ArenaRoom.ts),
// não depende de posição (que o lerp da câmera poderia suavizar de qualquer jeito).
// `lastSpawnProtection[id]` = último valor observado; quando muda para futuro > now → spawn.
const lastSpawnProtection = new Map<string, number>();
// Animação de materialização em andamento por player.
const spawnAnim = new Map<string, { startedAt: number; durationMs: number }>();
const SPAWN_ANIM_MS = 400; // duração da materialização (scale-in + fade-in)

// T-045: overlay DOM de fade de tela — só para o PRÓPRIO jogador ao renascer.
// Implementação mais simples que mata a sensação de "teletransporte" sem câmera cortada.
let spawnFadeEl: HTMLDivElement | null = null;
function getSpawnFadeEl(): HTMLDivElement {
  if (!spawnFadeEl) {
    spawnFadeEl = document.createElement("div");
    spawnFadeEl.style.cssText =
      "position:fixed;inset:0;background:#000;pointer-events:none;z-index:50;opacity:0;transition:none";
    document.body.appendChild(spawnFadeEl);
  }
  return spawnFadeEl;
}
/** T-045: fade de tela no próprio jogador — out→in em ~200 ms cada sentido, sem tween lib. */
function triggerSpawnFade() {
  const el = getSpawnFadeEl();
  el.style.transition = "opacity 0.2s linear";
  el.style.opacity = "1";
  setTimeout(() => {
    el.style.transition = "opacity 0.2s linear";
    el.style.opacity = "0";
  }, 250); // 200ms fade-out + 50ms pausa = 250ms antes do fade-in
}

// ---------- Rede ----------
// `?port=NNNN` só pra testar contra um servidor local em porta alternativa (ex.: quando a
// porta padrão já está ocupada por outra sessão de dev) — nunca usado fora de localhost.
const devPortOverride = new URLSearchParams(location.search).get("port");
// `VITE_SERVER_URL` (build-time): deploy em VPS por IP público sem domínio/TLS — força
// ws:// explícito pro host:porta do game server, pulando a heurística abaixo (que assume
// wss:// atrás de proxy em qualquer host que não seja localhost/LAN). Ver plano de deploy
// sem domínio. Não usado no fluxo com domínio+TLS (M5/SPEC-0009), que não seta essa env.
const configuredUrl = import.meta.env.VITE_SERVER_URL as string | undefined;
const url =
  configuredUrl ||
  (location.hostname === "localhost" || location.hostname.startsWith("192.")
    ? `ws://${location.hostname}:${devPortOverride ?? SERVER_PORT}`
    : `wss://${location.host}`);

const client = new Client(url);
let room: Room | undefined;
let ping = -1;
let mySessionId = "";

let playerToken = localStorage.getItem("aop_token");
if (!playerToken) {
  playerToken = "tok_" + Math.random().toString(36).substring(2, 10);
  localStorage.setItem("aop_token", playerToken);
}

// T-057 (SPEC-0015): seleção do lobby é preenchida quando o card resolve (ver abaixo,
// após criação do profileManager). Declaramos aqui para que connect() feche sobre ela.
let lobbySelection: import("./lobby").LobbySelection | null = null;

async function connect() {
  try {
    // Aguarda registro do guest no Django antes do join (SPEC-0008, T-060 — garante que o
    // GuestLink existe ao receber eventos de telemetria de morte). Best-effort, nunca derruba o
    // join se o Django estiver offline (degradação graciosa).
    await ensureGuestRegistered();

    // T-059 (SPEC-0015): join envia a seleção real do lobby — nick, classId, skinId.
    // - `nick`: lido do localStorage (`aop_lobby_nick`, síncrono e já sanitizado localmente),
    //   NÃO de `lobbySelection.nick`, porque o PUT do Django (T-058) é fire-and-forget e pode
    //   atualizar o objeto selection depois do join. O servidor re-sanitiza autoritativamente.
    // - `profile` NÃO viaja no join: é 100% client-side (perfil de controle mouse/kbd/touch),
    //   não afeta nada server-authoritative e não tem campo no schema. Decisão T-059 (evita
    //   campo/protocolo inútil — risco §9 PROPOSAL-0004). Persiste só em localStorage/Django.
    const storedNick = localStorage.getItem("aop_lobby_nick");
    room = await client.joinOrCreate(ROOM_NAME, {
      nick: storedNick ?? lobbySelection?.nick ?? `web-${Math.floor(Math.random() * 999)}`,
      classId: lobbySelection?.classId,
      skinId: lobbySelection?.skinId,
      token: playerToken,
      authToken: getAuthToken() ?? undefined
    });
    mySessionId = room.sessionId;
    // T-048 (SPEC-0012): partida em andamento pede confirmação antes de fechar/recarregar a aba.
    setUnloadGuard(true);
    room.onLeave(() => setUnloadGuard(false));
    room.onError(() => setUnloadGuard(false));
    room.onMessage("pong", (t: number) => (ping = Math.round(performance.now() - t)));
    room.onMessage("announce", (msg: { kind: string }) => {
      if (msg.kind === "farm_event") {
        pushToast("🔥 farm_event na zona de guerra!"); // T-023: toast, não mais texto cru
        audio.play("farm_event_announce"); // T-050: broadcast de sala, sem posição própria
      }
    });
    room.onMessage("debug_event", (ev: any) => {
      pushDebugEvent(ev);
    });
    // T-016: cards de level-up — servidor manda a oferta e confirma a escolha
    room.onMessage("upgrade_offer", (offer: any) => showUpgradeOffer(offer));
    room.onMessage("upgrade_applied", (msg: any) => onUpgradeApplied(msg));
    room.onMessage("upgrade_offer_closed", () => closeUpgradeOffer());
    // T-024: mapa curado (mapId) manda o JSON completo uma vez no join — reconstrução por
    // seed não se aplica (mapFileToGameMap produz o mesmo GameMap que o servidor usa).
    room.onMessage("map_data", (file: MapFileV1) => {
      if (worldBuilt) return;
      buildWorld(mapFileToGameMap(file));
    });
    setInterval(() => room?.send("ping", performance.now()), 2000);
    setInterval(sendInput, 1000 / 20);
  } catch (e) {
    hud.textContent = `erro ao conectar em ${url}\n${e}`;
  }
}
// connect() é chamado após o lobby resolver (ver bloco T-057 abaixo, após profileManager)

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
    if (vis) {
      spawnDamagePopup(vis.position.x, vis.position.z, ev.payload.damage, ev.payload.isKill === true);
      vfx.spawnAt("hit_spark", vis.position.x, vis.position.z);
      vfx.spawnAt("blood_hit", vis.position.x, vis.position.z);
      triggerCharacterHit(vis, performance.now()); // V2: recuo procedural de "levou dano"
    }
    // T-050: hit dado/recebido — pessoal (só o próprio jogador ouve, senão o combate dos
    // bots ao redor vira ruído contínuo). "Recebido" pesa mais que "dado" (regra de risco real).
    if (ev.payload.victimId === mySessionId) audio.play("hit_taken");
    else if (ev.payload.shooterId === mySessionId) audio.play("hit_given");
    if (ev.payload.isKill && ev.payload.shooterId === mySessionId) audio.play("kill");
  }
  // T-022: registry de VFX — cada efeito nasce de um evento que o servidor já emite.
  if (ev.type === "death") {
    const vis = playerVisuals.get(ev.payload.playerId);
    if (vis) {
      vfx.spawnAt("death_burst", vis.position.x, vis.position.z);
      triggerCharacterDeath(vis, performance.now()); // V2: queda cosmética (servidor respawna imediato)
    }
    // T-050: própria morte é dramática/pessoal; morte alheia é ambiente, posicional (T-051).
    if (ev.payload.playerId === mySessionId) audio.play("death_self");
    else if (vis) audio.play("death_other", vis.position.x, vis.position.z);
  } else if (ev.type === "kill_heal") {
    // SPEC-0010: cura por abate em briga — feedback verde ("+X") + partículas no matador.
    const vis = playerVisuals.get(ev.payload.playerId);
    if (vis) {
      spawnHealPopup(vis.position.x, vis.position.z, ev.payload.heal);
      vfx.spawnAt("heal_pop", vis.position.x, vis.position.z);
    }
  } else if (ev.type === "pickup") {
    const vis = playerVisuals.get(ev.payload.playerId);
    if (vis) vfx.spawnAt("pickup_glint", vis.position.x, vis.position.z);
    // T-050: coleta por kind — pessoal (só o coletor ouve; farm de XP de vários bots ao
    // mesmo tempo não pode virar ruído contínuo). weapon é "priority" (dedicado no registry).
    if (ev.payload.playerId === mySessionId) {
      const pickupSound: Record<string, string> = {
        xp_orb: "pickup_xp",
        coin_buff: "pickup_coin",
        hp_orb: "pickup_hp",
        shield_temp: "pickup_shield",
        weapon: "pickup_weapon",
        box: "pickup_box",
        speed_up: "pickup_speed",
        farm_event: "pickup_farm",
      };
      const soundName = pickupSound[ev.payload.kind];
      if (soundName) audio.play(soundName);
    }
    // pickup é o instante exato em que os buffs temporários são (re)aplicados no servidor —
    // reseta o anel de cooldown pra refletir a renovação, não só a 1ª aplicação.
    const kind =
      ev.payload.kind === "speed_up" ? "speed_up"
      : ev.payload.kind === "farm_event" ? "xp_boost"
      : ev.payload.kind === "shield_temp" ? "damage_reduction"
      : null;
    if (kind) buffApplied.set(ev.payload.playerId, { kind, expiresAt: performance.now() + BUFF_DURATION_MS[kind] });
    // SPEC-0010: feedback dedicado dos recursos de vida.
    if (vis && ev.payload.kind === "hp_orb") {
      spawnHealPopup(vis.position.x, vis.position.z, HP_ORB_AMOUNT);
      vfx.spawnAt("heal_pop", vis.position.x, vis.position.z);
    } else if (vis && ev.payload.kind === "shield_temp") {
      vfx.spawnAt("shield_gain", vis.position.x, vis.position.z);
    } else if (ev.payload.kind === "weapon") {
      // T-039: pegar a arma — VFX forte + toast só pro próprio jogador (não poluir com os inimigos).
      if (vis) vfx.spawnAt("weapon_pickup", vis.position.x, vis.position.z);
      if (ev.payload.playerId === mySessionId) {
        const name = LAUNCHERS[ev.payload.weaponId as string]?.name ?? "Arma";
        pushToast(`🔫 ${name} coletado!`);
      }
    }
    // T-044 (SPEC-0011): popup discreto de coleta — informativo para quem está atento.
    // hp_orb/shield_temp têm feedback dedicado da T-036; weapon tem toast. Os demais recebem
    // um texto flutuante pequeno (opacidade reduzida, fade rápido) no ponto da coleta.
    if (vis) {
      const px = vis.position.x, pz = vis.position.z;
      switch (ev.payload.kind) {
        case "xp_orb":
          spawnCollectPopup(px, pz, "+8 XP", "#ffd54f");
          break;
        case "speed_up":
          spawnCollectPopup(px, pz, "⚡ velocidade", "#26c6da");
          break;
        case "coin_buff":
          spawnCollectPopup(px, pz, "+10 moedas", "#ffc107");
          break;
        case "farm_event":
          spawnCollectPopup(px, pz, "2×XP!", "#66bb6a");
          break;
        case "box":
          spawnCollectPopup(px, pz, "atrib++", "#ce93d8");
          break;
      }
    }
  } else if (ev.type === "xp_combo") {
    // T-044 (SPEC-0011): combo de XP boosted — exibe "combo ×N" discreto no player.
    // Só aparece quando boosted=true para não poluir a tela a cada coleta comum.
    if (ev.payload.boosted) {
      const vis = playerVisuals.get(ev.payload.playerId);
      if (vis) spawnCollectPopup(vis.position.x, vis.position.z, `combo ×${ev.payload.count}`, "#ffb300");
      if (ev.payload.playerId === mySessionId) audio.play("xp_combo"); // T-050
    }
  } else if (ev.type === "impulso") {
    buffApplied.set(ev.payload.playerId, { kind: "kill_rush", expiresAt: performance.now() + BUFF_DURATION_MS.kill_rush });
  } else if (ev.type === "upgrade") {
    const vis = playerVisuals.get(ev.payload.playerId);
    if (vis) vfx.spawnAt(ev.payload.auto ? "level_up_auto" : "upgrade_chosen_aura", vis.position.x, vis.position.z);
    // T-050: level-up + card escolhido — pessoal (progressão de outro jogador não é minha leitura).
    if (ev.payload.playerId === mySessionId) audio.play(ev.payload.auto ? "level_up_auto" : "card_chosen");
  } else if (ev.type === "box_skill") {
    // T-050: skill nova vinda de box na zona de guerra — pessoal, raro.
    if (ev.payload.playerId === mySessionId) audio.play("skill_unlock");
  } else if (ev.type === "flag_pickup") {
    // T-050: bandeira — tático, todo mundo ouve (só existe 1 no mapa); posicional (T-051).
    const vis = playerVisuals.get(ev.payload.playerId);
    if (vis) audio.play("flag_pickup", vis.position.x, vis.position.z);
  } else if (ev.type === "flag_drop") {
    const vis = playerVisuals.get(ev.payload.playerId);
    if (vis) audio.play("flag_drop", vis.position.x, vis.position.z);
  } else if (ev.type === "flag_cooldown_start") {
    // T-042 (SPEC-0011): a bandeira saiu do jogo por um tempo (cooldown) — toast de leitura.
    pushToast("🏳️ Bandeira em cooldown");
    audio.play("flag_cooldown", ev.payload.x, ev.payload.z); // T-050
  } else if (ev.type === "flag_respawn") {
    // T-042: renasceu no centro, acesa e disputável de novo.
    pushToast("🚩 Bandeira renasceu no centro!");
    audio.play("flag_respawn", ev.payload.x, ev.payload.z); // T-050
  }
}

// ---------- Números de dano flutuantes (T-018) + popups de coleta (T-044) ----------
// Sprite com CanvasTexture; orçamento fixo (máx. 24 vivos) — sem custo quando não há combate.
// T-044: cada entrada carrega seu próprio lifeMs e baseOpacity (coleta usa valores menores).
const damagePopups: Array<{ sprite: THREE.Sprite; born: number; lifeMs: number; baseOpacity: number }> = [];
const POPUP_LIFE_MS = 900;

/**
 * Núcleo do popup flutuante (dano/cura/coleta): texto colorido em sprite, orçamento compartilhado.
 * T-044: `opts.opacity` (padrão 1.0) e `opts.scale` (padrão 1.0) permitem popups discretos de
 * coleta — opacidade reduzida (~0.6) + escala menor que os de dano, sem poluir a tela.
 */
function pushPopup(
  x: number,
  z: number,
  text: string,
  color: string,
  fontSize: number,
  opts?: { opacity?: number; scale?: number; lifeMs?: number }
) {
  if (damagePopups.length >= 24) return;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const g = canvas.getContext("2d")!;
  g.font = `bold ${fontSize}px monospace`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.strokeStyle = "#000";
  g.lineWidth = 5;
  g.fillStyle = color;
  g.strokeText(text, 64, 34);
  g.fillText(text, 64, 34);
  const baseOpacity = opts?.opacity ?? 1.0;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false, opacity: baseOpacity })
  );
  const s = opts?.scale ?? 1.0;
  sprite.scale.set(1.7 * s, 0.85 * s, 1);
  sprite.position.set(x, 1.35, z);
  scene.add(sprite);
  damagePopups.push({ sprite, born: performance.now(), lifeMs: opts?.lifeMs ?? POPUP_LIFE_MS, baseOpacity });
}

/**
 * T-044 (SPEC-0011): popup discreto de coleta — informativo, não polui.
 * Texto curto, opacidade reduzida (~0.6), escala menor, fade mais rápido.
 */
function spawnCollectPopup(x: number, z: number, text: string, color: string) {
  pushPopup(x, z, text, color, 14, { opacity: 0.62, scale: 0.78, lifeMs: 600 });
}

function spawnDamagePopup(x: number, z: number, damage: number, kill: boolean) {
  // fonte cresce com o dano — golpe forte É visivelmente forte
  const fontSize = Math.round(Math.min(46, 20 + damage * 0.6));
  const color = kill ? "#ff5252" : damage >= 30 ? "#ffb300" : "#ffe082";
  pushPopup(x, z, kill ? `${Math.round(damage)} ☠` : `${Math.round(damage)}`, color, fontSize);
}

/** SPEC-0010: "+X" verde de cura (kill em briga / hp_orb). */
function spawnHealPopup(x: number, z: number, amount: number) {
  pushPopup(x, z, `+${Math.round(amount)}`, "#66ff8a", Math.round(Math.min(40, 22 + amount * 0.4)));
}

function updateDamagePopups(now: number) {
  for (let i = damagePopups.length - 1; i >= 0; i--) {
    const p = damagePopups[i];
    const age = (now - p.born) / p.lifeMs; // T-044: lifeMs individual por popup
    if (age >= 1) {
      scene.remove(p.sprite);
      p.sprite.material.map?.dispose();
      p.sprite.material.dispose();
      damagePopups.splice(i, 1);
      continue;
    }
    p.sprite.position.y = 1.35 + age * 0.8; // sobe
    // T-044: baseOpacity individual — popups de coleta já começam opacos reduzidos
    p.sprite.material.opacity = p.baseOpacity * (1 - age * age);
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
  rows.push(
    `<tr><td>mapa</td><td>${st?.mapW ?? "?"}×${st?.mapH ?? "?"} ${
      st?.mapId ? `curado:${st.mapId}` : `seed:${st?.mapSeed ?? "?"}`
    }</td></tr>`
  );
  rows.push(`<tr><td>players</td><td>${st?.players?.size ?? 0}</td></tr>`);
  rows.push(`<tr><td>coletáveis</td><td>${st?.collectibles?.size ?? 0}</td></tr>`);
  rows.push(`<tr><td>projéteis</td><td>${st?.projectiles?.size ?? 0}</td></tr>`);
  rows.push(`<tr><td>ping</td><td>${ping < 0 ? "..." : ping + " ms"}</td></tr>`);
  if (st?.flagEnabled && st?.flag) {
    const flagLabel = st.flag.carrierId
      ? `carregada por ${st.players?.get?.(st.flag.carrierId)?.name ?? st.flag.carrierId}`
      : st.flag.state === "cooldown"
      ? "cooldown (fora do mapa)"
      : "livre (pegável)";
    rows.push(`<tr><td>bandeira</td><td>${flagLabel}</td></tr>`);
  }

  // Meu player
  if (me) {
    rows.push(`<tr><td colspan="2" class="section">── MEU PLAYER ──</td></tr>`);
    rows.push(`<tr><td>sessão</td><td>${mySessionId}</td></tr>`);
    rows.push(`<tr><td>pos</td><td>x:${me.x?.toFixed(2)} z:${me.z?.toFixed(2)}</td></tr>`);
    rows.push(`<tr><td>facing</td><td>${((me.dir ?? 0) * 180 / Math.PI).toFixed(0)}°</td></tr>`);
    rows.push(`<tr><td>gatilho</td><td>${lastIntent.fire ? `ativo (${profileManager.id})` : "inativo"}</td></tr>`);
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

// ---------- Input por perfil de controle (ADR-015 / T-019 + T-019b) ----------
// Todo perfil produz a MESMA intenção {move, aim, fire}; o servidor não muda (já aceita
// aimX/aimZ opcional desde SPEC-0003). Mira/rotação é atributo do PERFIL, não uma regra
// global — perfil novo é só uma classe nova em input/, zero mudança de rede.
const crosshairEl = document.getElementById("crosshair")!;
// `[data-profile]` exclui #fullscreen-toggle (mesmo container #profile-selector, T-048):
// sem o filtro, clicar em tela cheia disparava profileManager.select(undefined) — cai no
// default "mouse" em ProfileManager.build() e desligava o joystick touch (bug real do
// T-064, achado em device físico).
const profileButtons = document.querySelectorAll<HTMLButtonElement>("#profile-selector button[data-profile]");

const profileManager = new ProfileManager({
  mouse: {
    camera,
    crosshairEl,
    getPlayerPos: () => {
      const st: any = room?.state;
      const me = st?.players?.get?.(mySessionId);
      return me ? { x: me.x, z: me.z } : null;
    },
  },
  touch: {
    moveBaseEl: document.getElementById("touch-move-base")!,
    moveKnobEl: document.getElementById("touch-move-knob")!,
    aimBaseEl: document.getElementById("touch-aim-base")!,
    aimKnobEl: document.getElementById("touch-aim-knob")!,
  },
  onChange: (id) => {
    profileButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.profile === id));
  },
});
profileButtons.forEach((btn) => {
  btn.addEventListener("click", () => profileManager.select(btn.dataset.profile as ProfileId));
});

// Ações fora da intenção de jogo (debug, cards, reroll) continuam globais — não são
// atributo de perfil de controle.
addEventListener("keydown", (e) => {
  if (e.key === "F3") {
    if (!IS_DEV) return; // T-023: overlay de debug não existe em build prod
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
  if (e.key.toLowerCase() === "m") audio.toggleMuted(); // T-049: mute — UI dedicada vem no lobby (T-051/T-058)
});

// Última intenção enviada; a câmera (followCamera) reusa o vetor de mira para o leve
// offset (ADR-015) sem precisar chamar poll() de novo fora do tick de rede.
let lastIntent: Intent = { moveX: 0, moveZ: 0, fire: false };

function sendInput() {
  const intent = profileManager.poll();
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
  // T-024: mapa curado (st.mapId não-vazio) constrói só ao receber "map_data" (acima) —
  // reconstruir aqui por seed daria um mapa ERRADO (mapFile não usa buildMap).
  if (!worldBuilt && !st.mapId && st.mapW > 0) buildWorld(buildMap(st.mapW, st.mapH, st.mapSeed));
  if (!worldBuilt) return;

  const seenP = new Set<string>();
  st.players.forEach((p: any, id: string) => {
    seenP.add(id);
    let vis = playerVisuals.get(id);
    if (!vis) {
      // T-059 (SPEC-0015): classe/skin vêm sincronizadas do estado (Player.classId/skinId) —
      // outros players renderizam com a seleção que fizeram no lobby, não mais o default fixo.
      vis = createPlayerVisual(id, id === mySessionId, p.classId, p.skinId);
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

    // T-045 (SPEC-0011): detecta (re)nascimento pelo salto de spawnProtectedUntil para
    // um valor FUTURO novo. Esse campo é setado autoritativamente no servidor a cada spawn
    // (onJoin + respawn); a mudança é o sinal mais confiável sem depender de posição.
    {
      const nowMs = Date.now();
      const prevProtection = lastSpawnProtection.get(id) ?? 0;
      const curProtection: number = p.spawnProtectedUntil ?? 0;
      if (curProtection > nowMs && curProtection !== prevProtection) {
        // É um spawn/respawn novo — inicia animação de materialização.
        spawnAnim.set(id, { startedAt: performance.now(), durationMs: SPAWN_ANIM_MS });
        vfx.spawnAt("spawn_materialize", vis.position.x, vis.position.z, 0.5);
        // Para o próprio jogador: overlay de tela para eliminar o corte seco de câmera.
        if (id === mySessionId) {
          triggerSpawnFade();
          audio.play("respawn_self"); // T-050: pessoal (join inicial ou respawn após morte)
        }
      }
      lastSpawnProtection.set(id, curProtection);
    }

    // Aplica a animação de materialização se ainda estiver em andamento (scale-in + fade-in).
    // Dirigida por timestamp — zero alocação por frame, sem tween lib.
    {
      const anim = spawnAnim.get(id);
      if (anim) {
        const age = performance.now() - anim.startedAt;
        const frac = Math.min(1, age / anim.durationMs);
        // scale-in: nasce pequeno (0.05) e cresce para 1.0 com ease-out quadrático.
        const easedScale = 1 - (1 - frac) * (1 - frac);
        vis.scale.setScalar(Math.max(0.05, easedScale));
        if (frac >= 1) {
          vis.scale.setScalar(1);
          spawnAnim.delete(id);
        }
      } else {
        // Garante que o scale fique em 1 quando não há animação ativa.
        if (vis.scale.x !== 1) vis.scale.setScalar(1);
      }
    }

    // T-054: animação procedural do boneco (idle/walk/shoot). A velocidade de passada vem do
    // deslocamento RENDERIZADO do próprio grupo (posição da rede já suavizada no lerp acima) —
    // não há campo de velocidade na rede. Durante a materialização (spawn/respawn) zera pra não
    // brigar com o scale-in da T-045.
    {
      const av = vis.userData;
      if (spawnAnim.has(id)) {
        av.lastX = vis.position.x;
        av.lastZ = vis.position.z;
        av.moveSpeed = 0;
      } else {
        const lastX = av.lastX ?? vis.position.x;
        const lastZ = av.lastZ ?? vis.position.z;
        const step = Math.hypot(vis.position.x - lastX, vis.position.z - lastZ);
        av.lastX = vis.position.x;
        av.lastZ = vis.position.z;
        const inst = Math.min(1, step / 0.09); // ~passada cheia perto do topo de velocidade
        av.moveSpeed = (av.moveSpeed ?? 0) + (inst - (av.moveSpeed ?? 0)) * 0.25; // suaviza
      }
      updateCharacterAnimation(vis, t, av.moveSpeed ?? 0, performance.now());
    }

    updatePowerVisual(vis, p.level ?? 1, t); // T-018: aro de poder por faixa de nível
    const shielded = (p.spawnProtectedUntil ?? 0) > Date.now();
    updateShieldVisual(vis, shielded, t); // SPEC-0005: bolha de invuln
    if (wasShielded.get(id) && !shielded) vfx.spawnAt("shield_pop", vis.position.x, vis.position.z); // T-022
    wasShielded.set(id, shielded);
    const carryingFlag = st.flagEnabled && st.flag?.carrierId === id;
    updateFlagGlow(vis, carryingFlag, t); // T-021: glow do portador

    // T-023: reveal-on-hit — inimigo é só skin até trocar dano (revealedUntil autoritativo).
    if (id !== mySessionId) {
      const revealed = (p.revealedUntil ?? 0) > Date.now();
      updateNameplate(vis, revealed, p.name, p.level ?? 1, p.hp, p.maxHp);
    }

    // T-022: anel de buff esvaziando — 1 por vez (o mais recente aplicado).
    const buff = buffApplied.get(id);
    if (buff) {
      const now = performance.now();
      if (now >= buff.expiresAt) {
        buffApplied.delete(id);
        updateBuffCooldownRing(vis, null);
      } else {
        const total = BUFF_DURATION_MS[buff.kind] ?? 1;
        updateBuffCooldownRing(vis, { kind: buff.kind, frac: (buff.expiresAt - now) / total });
      }
    } else {
      updateBuffCooldownRing(vis, null);
    }

    // T-022 (backlog `speed_up_trail`): rastro periódico enquanto o buff está ativo —
    // reusa o mesmo pool de partículas, sem mesh dedicado por jogador.
    const fx: string[] = p.effects ? Array.from(p.effects) : [];
    if (fx.includes("speed_up")) {
      const last = lastTrailSpawn.get(id) ?? 0;
      const now = performance.now();
      if (now - last > 120) {
        vfx.spawnAt("speed_up_trail", vis.position.x, vis.position.z, 0.15);
        lastTrailSpawn.set(id, now);
      }
    }

    // T-022 (backlog `flag_aura`): sparkle periódico no portador — glow (T-021) já cobre
    // a leitura tática de longe, isto é só o "juice" de perto.
    if (carryingFlag) {
      const now = performance.now();
      if (now - lastFlagAuraAt > 350) {
        vfx.spawnAt("flag_aura", vis.position.x, vis.position.z, 1.4);
        lastFlagAuraAt = now;
      }
    }
  });
  playerVisuals.forEach((vis, id) => {
    if (!seenP.has(id)) {
      scene.remove(vis);
      playerVisuals.delete(id);
      buffApplied.delete(id);
      wasShielded.delete(id);
      lastTrailSpawn.delete(id);
      lastSpawnProtection.delete(id); // T-045
      spawnAnim.delete(id); // T-045
    }
  });

  // T-021: bandeira — objeto único (não um MapSchema); toggle por room esconde/mostra.
  if (st.flagEnabled && st.flag) {
    if (!flagVisual) {
      flagVisual = new THREE.Group();
      // SPEC-0011 (T-041): o pano da bandeira-objetivo ganha material DEDICADO (clone) —
      // assim o pulso emissivo/apagado não afeta as bandeiras decorativas das zonas de guerra.
      propParts("bandeira").forEach((part) => {
        const mat = (part.material as THREE.MeshLambertMaterial).clone();
        const mesh = new THREE.Mesh(part.geometry, mat);
        mesh.position.copy(part.offset);
        // o segundo part é o pano (ver propParts) — guarda o material pra pulsar por frame
        if (part.offset.y > 1) flagVisual!.userData.pano = mat;
        flagVisual!.add(mesh);
      });
      scene.add(flagVisual);
    }
    flagVisual.position.x += (st.flag.x - flagVisual.position.x) * 0.25;
    flagVisual.position.z += (st.flag.z - flagVisual.position.z) * 0.25;
    // T-041: acesa (livre) / apagada (carregada) / some (cooldown).
    const carried = !!st.flag.carrierId;
    updateFlagGround(flagVisual, st.flag.state ?? "active", carried, t);
  } else if (flagVisual) {
    scene.remove(flagVisual);
    flagVisual = undefined;
  }

  const seenC = new Set<string>();
  st.collectibles?.forEach((c: any, id: string) => {
    seenC.add(id);
    if (!collectibleMeshes.has(id)) {
      const mesh = createCollectibleVisual(c.kind, c.weaponId); // T-039: weaponId distingue a arma
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
      // T-039/T-055: forma+cor+tamanho e muzzle por lançador (proj.launcherId vem do servidor).
      const style = projStyleFor(proj.launcherId);
      mesh = createArrowMesh(style);
      mesh.position.set(proj.x, 0.5, proj.z);
      // T-054/T-055: o projétil nasce na posição do atirador (ownerId não é sincronizado) —
      // atribui o disparo ao player mais próximo do ponto de spawn (heurística cosmética,
      // tolerante a erro se dois players estiverem colados). O `dir` desse player É a direção
      // real do disparo (servidor: dirX/dirZ = cos/sin(dir) no instante do tiro, ver
      // projectiles.ts) — como o padrão de disparo é sempre "straight", orientar a flecha UMA
      // vez na criação basta, sem recalcular por frame.
      let shooterId: string | undefined;
      let bestD = 1.6 * 1.6;
      st.players.forEach((pl: any, pid: string) => {
        const dx = pl.x - proj.x;
        const dz = pl.z - proj.z;
        const d = dx * dx + dz * dz;
        if (d < bestD) {
          bestD = d;
          shooterId = pid;
        }
      });
      const shooterDir = shooterId ? st.players.get(shooterId)?.dir ?? 0 : 0;
      mesh.rotation.y = -shooterDir; // mesma convenção de facing dos personagens (syncWorld)
      scene.add(mesh);
      projectileMeshes.set(id, mesh);
      vfx.spawnAt(style.muzzle, proj.x, proj.z); // T-022/T-039: muzzle no cano (leve p/ basic, rico p/ vantajosos)
      audio.play(style.sound, proj.x, proj.z); // T-050: fire distinto por launcher, posicional (T-051)
      const shooterVis = shooterId ? playerVisuals.get(shooterId) : undefined;
      if (shooterVis) triggerCharacterShoot(shooterVis, performance.now());
    }
    mesh.position.x += (proj.x - mesh.position.x) * 0.5;
    mesh.position.z += (proj.z - mesh.position.z) * 0.5;
    // T-055: rastro leve em voo — só o lançador que define `style.trail` (hoje, só heavy_shot).
    const style = projStyleFor(proj.launcherId);
    if (style.trail) {
      const last = lastArrowTrailAt.get(id) ?? 0;
      const now = performance.now();
      if (now - last > 90) {
        vfx.spawnAt(style.trail, mesh.position.x, mesh.position.z, 0.5);
        lastArrowTrailAt.set(id, now);
      }
    }
  });
  projectileMeshes.forEach((mesh, id) => {
    if (!seenProj.has(id)) {
      scene.remove(mesh);
      projectileMeshes.delete(id);
      lastArrowTrailAt.delete(id);
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
  getProfileId: () => profileManager.id,
  playSound: (name) => audio.play(name),
});

// ---------- Loop ----------
let t = 0;
let debugTick = 0;
function animate() {
  requestAnimationFrame(animate);
  t += 0.05;
  syncWorld();
  followCamera();
  audio.setListenerPosition(camera.position.x, camera.position.z); // T-051: câmera nunca gira, pan = X do mundo
  collectibleMeshes.forEach((mesh) => {
    mesh.position.y = 0.4 + Math.sin(t) * 0.08;
    mesh.rotation.y += 0.02;
  });
  updateDamagePopups(performance.now()); // T-018
  vfx.update(performance.now()); // T-022
  updateHud(performance.now());
  // Atualiza painel de debug a ~10fps para não sobrecarregar DOM
  if (debugOpen && ++debugTick % 2 === 0) updateDebugState();
  renderer.render(scene, camera);
}
animate();

// ---------- T-057 (SPEC-0015): Lobby pré-sala ----------
// Deve ser invocado APÓS toda a inicialização (renderer, profileManager, audio) para que
// o card possa referenciar esses objetos via closures. A Promise bloqueia o connect() —
// o loop de render e o input já rodam mas a sala não está conectada até o clique em Jogar.
{
  const profileSelectorEl = document.getElementById("profile-selector");
  // Esconde o #profile-selector antigo enquanto o lobby está visível
  if (profileSelectorEl) profileSelectorEl.style.display = "none";

  showLobby({
    audio,
    getCurrentProfile: () => profileManager.id,
    setProfile: (id) => profileManager.select(id),
    onPlay: () => {},
  }).then((selection) => {
    lobbySelection = selection;
    // Reexibe o seletor de perfil (estado já sincronizado via setProfile acima)
    if (profileSelectorEl) profileSelectorEl.style.display = "";
    void connect();
  });
}
