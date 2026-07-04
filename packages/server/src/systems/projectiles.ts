import { Player, Projectile, ArenaState } from "../state/ArenaState";
import { LAUNCHERS, isWall, zoneAt, GameMap } from "@aop/shared";

// Generate unique IDs for projectiles
let _projId = 0;

export interface KillEvent {
  victimId: string;
  killerId: string;
}

export class ProjectileSystem {
  tick(state: ArenaState, map: GameMap, dt: number, now: number): KillEvent[] {
    const kills: KillEvent[] = [];
    
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
        if (targetId === proj.ownerId) return; // ignore self
        if (target.hp <= 0) return; // ignore dead
        
        // safe zone protects from damage
        if (zoneAt(map, target.x, target.z) === "safe") return;

        const distance = Math.hypot(proj.x - target.x, proj.z - target.z);
        // Player radius is 0.4 usually, projectile radius is launcher.projectile.radius
        if (distance < 0.4 + launcher.projectile.radius) {
          // HIT!
          const owner = state.players.get(proj.ownerId);
          const strength = owner ? owner.strength : 1;
          const damage = launcher.damage * strength;
          
          target.hp -= damage;
          if (target.hp <= 0) {
            kills.push({ victimId: targetId, killerId: proj.ownerId });
          }
          hitPlayer = true;
        }
      });

      if (hitPlayer) {
        toRemove.push(pid);
        return;
      }
    });

    toRemove.forEach((pid) => state.projectiles.delete(pid));
    
    return kills;
  }
}
