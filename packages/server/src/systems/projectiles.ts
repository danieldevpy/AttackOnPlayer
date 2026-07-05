import { Player, Projectile, ArenaState } from "../state/ArenaState";
import { LAUNCHERS, isWall, zoneAt, GameMap, PLAYER_RADIUS, PLAYER_SPEED, combinedSkillMods } from "@aop/shared";
import { EffectSystem } from "./effects";

// Generate unique IDs for projectiles
let _projId = 0;

export interface ProjectileHitEvent {
  targetId: string;
  killerId: string;
  damage: number;
  killed: boolean;
  blockedBySafeZone: boolean;
  blockedByShield: boolean; // SPEC-0005: alvo com invulnerabilidade de nascimento ativa
}

export class ProjectileSystem {
  tick(state: ArenaState, map: GameMap, dt: number, now: number, effects: EffectSystem): ProjectileHitEvent[] {
    const hits: ProjectileHitEvent[] = [];

    // 1. Process player fire input (T-010: gatilho dispara sempre na direção do facing)
    state.players.forEach((p, id) => {
      if (!p.firing) return;
      if (zoneAt(map, p.x, p.z) === "safe") return; // cannot fire in safe zone

      const launcher = LAUNCHERS[p.launcher];
      if (!launcher) return;

      // T-017: skills do player entram como modificadores data-driven sobre o lançador
      const mods = combinedSkillMods(Array.from(p.skills));

      // T-015 (cadência) + T-017 (ex.: perfurante +25%): cooldown efetivo =
      // base do lançador × attackSpeed × cooldownMult das skills.
      if (now - p.lastFireAt < launcher.fire.cooldownMs * p.attackSpeed * mods.cooldownMult) return;

      p.lastFireAt = now;
      // SPEC-0005: disparar encerra a invulnerabilidade de nascimento — imunidade é só para
      // se reposicionar após (re)nascer, nunca para atirar protegido.
      if (p.spawnProtectedUntil > now) p.spawnProtectedUntil = 0;

      let dirX = Math.cos(p.dir);
      let dirZ = Math.sin(p.dir);

      // T-012: gancho de herança de velocidade — projétil pesado pode "puxar" a
      // direção do movimento do atirador. Default ausente = comportamento neutro.
      const inherit = launcher.movement?.inheritVelocityFactor;
      if (inherit) {
        const vx = dirX * launcher.projectile.speed + p.inputX * PLAYER_SPEED * p.speed * inherit;
        const vz = dirZ * launcher.projectile.speed + p.inputZ * PLAYER_SPEED * p.speed * inherit;
        const vlen = Math.hypot(vx, vz) || 1;
        dirX = vx / vlen;
        dirZ = vz / vlen;
      }

      // T-017 (pattern "spread" generalizado): N projéteis centrados no facing.
      // N = 1 (sem skill) degenera no tiro reto de sempre — zero mudança de comportamento.
      const count = Math.max(1, Math.round(mods.projectilesPerShot));
      const baseAngle = Math.atan2(dirZ, dirX);
      for (let i = 0; i < count; i++) {
        const angle = baseAngle + (i - (count - 1) / 2) * mods.spreadRad;
        const dx = Math.cos(angle);
        const dz = Math.sin(angle);

        const proj = new Projectile();
        // nasce na borda do player (offset = raio) na posição autoritativa do tick — sem atraso.
        proj.x = p.x + dx * PLAYER_RADIUS;
        proj.z = p.z + dz * PLAYER_RADIUS;
        proj.launcherId = p.launcher;
        proj.ownerId = id;
        proj.dirX = dx;
        proj.dirZ = dz;
        // T-015/T-017: range/dano/velocidade efetivos CONGELADOS no disparo — trocar de
        // build depois não altera projéteis já voando (servidor autoritativo).
        proj.maxRange = launcher.projectile.range * p.reach * mods.rangeMult;
        proj.damageMult = mods.damageFactor;
        proj.pierceLeft = mods.pierce;
        proj.speedMult = mods.projSpeedMult;

        state.projectiles.set(`p${++_projId}`, proj);
      }

      // T-012: gancho de lentidão — reduz a velocidade do atirador por um tempo, default neutro.
      if (launcher.movement?.selfSlowFactor && launcher.movement.selfSlowMs) {
        effects.applySlow(id, p, launcher.movement.selfSlowFactor, launcher.movement.selfSlowMs, now);
      }
    });

    // 2. Simulate projectiles
    const toRemove: string[] = [];
    state.projectiles.forEach((proj, pid) => {
      const launcher = LAUNCHERS[proj.launcherId];
      if (!launcher) {
        toRemove.push(pid);
        return;
      }

      const dist = launcher.projectile.speed * proj.speedMult * dt; // T-017: fôlego acelera o projétil
      const prevX = proj.x;
      const prevZ = proj.z;
      proj.x += proj.dirX * dist;
      proj.z += proj.dirZ * dist;
      proj.distanceTraveled += dist;

      // check range (T-015: usa o range efetivo do disparo; fallback = base do lançador)
      if (proj.distanceTraveled >= (proj.maxRange || launcher.projectile.range)) {
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

      // check hit players — T-017: com pierce o projétil pode atravessar alvos; `hitIds`
      // garante que o mesmo alvo não é atingido 2x pelo mesmo projétil.
      let consumed = false;
      state.players.forEach((target, targetId) => {
        if (consumed) return;
        if (targetId === proj.ownerId) return; // ignore self
        if (target.hp <= 0) return; // ignore dead
        if (proj.hitIds.includes(targetId)) return; // já atravessado (pierce)

        const distance = distancePointToSegment(target.x, target.z, prevX, prevZ, proj.x, proj.z);
        if (distance < PLAYER_RADIUS + launcher.projectile.radius) {
          // safe zone protects from damage, but still consumes the projectile so
          // debugging does not look like the hitbox failed.
          if (zoneAt(map, target.x, target.z) === "safe") {
            consumed = true;
            hits.push({
              targetId,
              killerId: proj.ownerId,
              damage: 0,
              killed: false,
              blockedBySafeZone: true,
              blockedByShield: false,
            });
            return;
          }

          // SPEC-0005: invulnerabilidade de nascimento — consome o projétil (não some no ar,
          // o feedback é o mesmo de safe) mas não aplica dano enquanto o escudo estiver ativo.
          if (now < target.spawnProtectedUntil) {
            consumed = true;
            hits.push({
              targetId,
              killerId: proj.ownerId,
              damage: 0,
              killed: false,
              blockedBySafeZone: false,
              blockedByShield: true,
            });
            return;
          }

          // HIT!
          const owner = state.players.get(proj.ownerId);
          const strength = owner ? owner.strength : 1;
          const damage = launcher.damage * strength * proj.damageMult; // T-017: fator das skills

          target.hp -= damage;
          proj.hitIds.push(targetId);
          hits.push({
            targetId,
            killerId: proj.ownerId,
            damage,
            killed: target.hp <= 0,
            blockedBySafeZone: false,
            blockedByShield: false,
          });

          if (proj.pierceLeft > 0) proj.pierceLeft -= 1; // atravessa e segue voando
          else consumed = true;
        }
      });

      if (consumed) {
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
