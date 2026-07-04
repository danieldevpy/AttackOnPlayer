import { Player, Projectile, ArenaState } from "../state/ArenaState";
import { LAUNCHERS, isWall, zoneAt, GameMap, PLAYER_RADIUS } from "@aop/shared";

// Generate unique IDs for projectiles
let _projId = 0;

export interface ProjectileHitEvent {
  targetId: string;
  killerId: string;
  damage: number;
  killed: boolean;
  blockedBySafeZone: boolean;
}

export class ProjectileSystem {
  tick(state: ArenaState, map: GameMap, dt: number, now: number): ProjectileHitEvent[] {
    const hits: ProjectileHitEvent[] = [];
    
    // 1. Process player fire input
    state.players.forEach((p, id) => {
      if (p.fireDirX === 0 && p.fireDirZ === 0) return;
      if (zoneAt(map, p.x, p.z) === "safe") return; // cannot fire in safe zone
      
      const launcher = LAUNCHERS[p.launcher];
      if (!launcher) return;

      if (now - p.lastFireAt < launcher.fire.cooldownMs) return;

      p.lastFireAt = now;
      
      const proj = new Projectile();
      proj.x = p.x;
      proj.z = p.z;
      proj.launcherId = p.launcher;
      proj.ownerId = id;
      
      // Normalize direction
      const len = Math.hypot(p.fireDirX, p.fireDirZ);
      proj.dirX = p.fireDirX / len;
      proj.dirZ = p.fireDirZ / len;
      
      state.projectiles.set(`p${++_projId}`, proj);
    });

    // 2. Simulate projectiles
    const toRemove: string[] = [];
    state.projectiles.forEach((proj, pid) => {
      const launcher = LAUNCHERS[proj.launcherId];
      if (!launcher) {
        toRemove.push(pid);
        return;
      }

      const dist = launcher.projectile.speed * dt;
      const prevX = proj.x;
      const prevZ = proj.z;
      proj.x += proj.dirX * dist;
      proj.z += proj.dirZ * dist;
      proj.distanceTraveled += dist;

      // check range
      if (proj.distanceTraveled >= launcher.projectile.range) {
        toRemove.push(pid);
        return;
      }

      // check map bounds/walls
      if (proj.x < 0 || proj.z < 0 || proj.x >= map.w || proj.z >= map.h) {
        toRemove.push(pid);
        return;
      }
      if (isWall(map, Math.floor(proj.x), Math.floor(proj.z))) {
        toRemove.push(pid);
        return;
      }

      // check hit props (props are not explicitly in grid like walls, but wait, they are in map.props)
      let hitProp = false;
      for (const prop of map.props) {
        // Simple AABB vs circle collision
        const px = Math.max(prop.x, Math.min(proj.x, prop.x + prop.w));
        const pz = Math.max(prop.z, Math.min(proj.z, prop.z + prop.h));
        const distance = Math.hypot(proj.x - px, proj.z - pz);
        if (distance < launcher.projectile.radius) {
          hitProp = true;
          break;
        }
      }
      if (hitProp) {
        toRemove.push(pid);
        return;
      }

      // check hit players
      let hitPlayer = false;
      state.players.forEach((target, targetId) => {
        if (hitPlayer) return;
        if (targetId === proj.ownerId) return; // ignore self
        if (target.hp <= 0) return; // ignore dead

        const distance = distancePointToSegment(target.x, target.z, prevX, prevZ, proj.x, proj.z);
        if (distance < PLAYER_RADIUS + launcher.projectile.radius) {
          hitPlayer = true;

          // safe zone protects from damage, but still consumes the projectile so
          // debugging does not look like the hitbox failed.
          if (zoneAt(map, target.x, target.z) === "safe") {
            hits.push({
              targetId,
              killerId: proj.ownerId,
              damage: 0,
              killed: false,
              blockedBySafeZone: true,
            });
            return;
          }

          // HIT!
          const owner = state.players.get(proj.ownerId);
          const strength = owner ? owner.strength : 1;
          const damage = launcher.damage * strength;
          
          target.hp -= damage;
          hits.push({
            targetId,
            killerId: proj.ownerId,
            damage,
            killed: target.hp <= 0,
            blockedBySafeZone: false,
          });
        }
      });

      if (hitPlayer) {
        toRemove.push(pid);
        return;
      }
    });

    toRemove.forEach((pid) => state.projectiles.delete(pid));
    
    return hits;
  }
}

function distancePointToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const abx = bx - ax;
  const abz = bz - az;
  const lenSq = abx * abx + abz * abz;
  if (lenSq <= 1e-9) return Math.hypot(px - ax, pz - az);
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (pz - az) * abz) / lenSq));
  const cx = ax + abx * t;
  const cz = az + abz * t;
  return Math.hypot(px - cx, pz - cz);
}
