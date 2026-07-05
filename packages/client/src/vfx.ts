// T-022 (SPEC-0006): registry de VFX nomeados, derivados de eventos que o servidor já
// emite (debug_event/state) — nenhum efeito ad-hoc solto no main.ts (regra do backlog
// vivo). "Efeito novo" = 1 entrada em VFX_DEFS; toda partícula sai do MESMO pool com
// orçamento fixo (docs/mechanics/vfx-juice-backlog.md), então N efeitos simultâneos não
// estouram draw calls nem alocam por frame.
import * as THREE from "three";

export type VfxIntensity = "leve" | "aura";

interface VfxDef {
  color: number;
  count: number; // partículas por disparo
  life: number; // ms de vida de cada partícula
  speed: number; // velocidade inicial (unid/s)
  intensity: VfxIntensity; // regra do CD (§9-A4): auto=leve, escolha manual=aura chamativa
}

/**
 * Fila inicial do backlog vivo (docs/mechanics/vfx-juice-backlog.md) + efeitos-base da
 * SPEC-0006. `upgrade_chosen_aura`/`flag_aura` são os únicos "aura" — o resto é feedback
 * automático de estado, deve ficar discreto (constituição §5 "leve sempre").
 */
export const VFX_DEFS: Record<string, VfxDef> = {
  muzzle_flash: { color: 0xffee58, count: 3, life: 120, speed: 1.2, intensity: "leve" },
  hit_spark: { color: 0xffffff, count: 5, life: 180, speed: 2.0, intensity: "leve" },
  blood_hit: { color: 0xd32f2f, count: 8, life: 280, speed: 1.6, intensity: "leve" },
  death_burst: { color: 0xff7043, count: 22, life: 450, speed: 2.6, intensity: "leve" },
  shield_pop: { color: 0x82b1ff, count: 14, life: 320, speed: 2.2, intensity: "leve" },
  pickup_glint: { color: 0xffd54f, count: 6, life: 260, speed: 1.0, intensity: "leve" },
  level_up_auto: { color: 0xffd54f, count: 10, life: 500, speed: 0.9, intensity: "leve" },
  upgrade_chosen_aura: { color: 0xffab00, count: 34, life: 650, speed: 2.2, intensity: "aura" },
  speed_up_trail: { color: 0x26c6da, count: 1, life: 300, speed: 0.2, intensity: "leve" },
  flag_aura: { color: 0xffd54f, count: 2, life: 420, speed: 0.5, intensity: "aura" },
};

const MAX_PARTICLES = 260; // orçamento global fixo — custo de render não varia com o combate

interface Particle {
  alive: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  born: number;
  life: number;
  r: number;
  g: number;
  b: number;
}

export interface VfxSystem {
  points: THREE.Points;
  /** Dispara o efeito nomeado na posição dada. Nome desconhecido = no-op (nunca derruba o frame). */
  spawnAt(name: string, x: number, z: number, y?: number): void;
  update(now: number): void;
}

export function createVfxSystem(): VfxSystem {
  const positions = new Float32Array(MAX_PARTICLES * 3);
  const colors = new Float32Array(MAX_PARTICLES * 3);
  for (let i = 0; i < MAX_PARTICLES; i++) positions[i * 3 + 1] = -1000; // nasce fora da vista

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.16,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false; // partículas somem/reaparecem no mapa inteiro; nunca deve "piscar" por AABB desatualizado

  const particles: Particle[] = Array.from({ length: MAX_PARTICLES }, () => ({
    alive: false,
    x: 0,
    y: -1000,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    born: 0,
    life: 0,
    r: 1,
    g: 1,
    b: 1,
  }));
  let cursor = 0; // ring buffer: efeito novo recicla a partícula mais antiga se o pool estiver saturado

  function spawnAt(name: string, x: number, z: number, y = 0.7) {
    const def = VFX_DEFS[name];
    if (!def) return;
    const color = new THREE.Color(def.color);
    for (let i = 0; i < def.count; i++) {
      const p = particles[cursor];
      cursor = (cursor + 1) % MAX_PARTICLES;
      const angle = Math.random() * Math.PI * 2;
      const spd = def.speed * (0.5 + Math.random() * 0.6);
      p.alive = true;
      p.x = x;
      p.z = z;
      p.y = y;
      p.vx = Math.cos(angle) * spd;
      p.vz = Math.sin(angle) * spd;
      p.vy = Math.random() * 0.6 * def.speed;
      p.born = performance.now();
      p.life = def.life;
      p.r = color.r;
      p.g = color.g;
      p.b = color.b;
    }
  }

  function update(now: number) {
    const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;
    const colAttr = geo.getAttribute("color") as THREE.BufferAttribute;
    const dt = 0.016;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = particles[i];
      if (!p.alive) continue;
      const age = now - p.born;
      if (age >= p.life) {
        p.alive = false;
        posAttr.setXYZ(i, 0, -1000, 0);
        continue;
      }
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.y += p.vy * dt;
      p.vy -= 1.4 * dt; // leve gravidade — partícula cai em vez de flutuar infinita
      const fade = 1 - age / p.life;
      posAttr.setXYZ(i, p.x, p.y, p.z);
      colAttr.setXYZ(i, p.r * fade, p.g * fade, p.b * fade);
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }

  return { points, spawnAt, update };
}
