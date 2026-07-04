import { Room, Client } from "colyseus";
import { ArenaState, Player, Collectible } from "../state/ArenaState";
import { MetricsRecorder } from "../metrics/SessionMetrics";
import { EffectSystem } from "../systems/effects";
import { ProjectileSystem } from "../systems/projectiles";
interface PersistentProgress {
  forca: number;
  velocidade: number;
  vitalidade: number;
}
const memDB = new Map<string, PersistentProgress>();

import {
  GameMap,
  buildMap,
  isWall,
  zoneAt,
  mapSizeFor,
  moveWithCollision,
  spawnPoints,
  collectibleBudget,
  pickWeighted,
  TICK_RATE,
  PLAYER_SPEED,
  PLAYER_RADIUS,
  MAX_PLAYERS,
  COLLECT_DIST,
  SPAWN_MIN_PLAYER_DIST,
  RESPAWN_DELAY_MIN_MS,
  RESPAWN_DELAY_MAX_MS,
  RESPAWN_FAST_MS,
  xpToNext,
  XP_PICKUP_AMOUNT,
  ATTR_POINTS_PER_LEVEL_EACH,
  SAFE_ZONE_SPAWN_CHANCE,
  SAFE_WEIGHTS,
  WAR_WEIGHTS,
  FIELD_WEIGHTS,
  COIN_BUFF_AMOUNT,
  BOX_ATTR_BONUS_EACH,
  COIN_REROLL_COST,
  lossFraction,
  XP_PER_KILL_PER_LEVEL,
  LAUNCHERS,
} from "@aop/shared";

export const activeRooms = new Map<string, ArenaRoom>();

export class ArenaRoom extends Room<ArenaState> {
  maxClients = MAX_PLAYERS;
  private map!: GameMap;
  private budget = 5;
  private metrics = new MetricsRecorder();
  private effects = new EffectSystem();
  private projectiles = new ProjectileSystem();
  private collectibleSeq = 0;
  private nextSpawnAt = 0;
  public debugEvents: Array<{ time: number; type: string; payload: any }> = [];

  onCreate(options?: { expectedPlayers?: number }) {
    this.setState(new ArenaState());

    // ADR-007: tamanho decidido AQUI e nunca mais (mínimo 5x o base)
    const size = mapSizeFor(Number(options?.expectedPlayers) || 4);
    const seed = (Date.now() % 2147483647) | 0;
    this.map = buildMap(size.w, size.h, seed);
    this.state.mapW = size.w;
    this.state.mapH = size.h;
    this.state.mapSeed = seed;
    this.budget = collectibleBudget(size.w, size.h);

    activeRooms.set(this.roomId, this);

    // pré-popula metade do orçamento (ninguém entra num mapa vazio)
    for (let i = 0; i < Math.floor(this.budget / 2); i++) this.spawnCollectible();

    this.onMessage(
      "input",
      (client, msg: { x: number; z: number; aimX?: number; aimZ?: number; fire?: boolean }) => {
        const p = this.state.players.get(client.sessionId);
        if (!p || typeof msg?.x !== "number" || typeof msg?.z !== "number") return;
        const len = Math.hypot(msg.x, msg.z);
        p.inputX = len > 1e-3 ? msg.x / Math.max(1, len) : 0;
        p.inputZ = len > 1e-3 ? msg.z / Math.max(1, len) : 0;

        // T-010: gatilho é só um booleano — a direção do tiro sai do facing (`dir`),
        // nunca do input; espaço e clique do mouse (mapeados no cliente) caem aqui iguais.
        p.firing = msg.fire === true;

        // T-009: facing híbrido — mira tem prioridade quando presente; senão segue o
        // movimento; parado (sem mira nem movimento) mantém o último dir (nunca zera).
        if (typeof msg.aimX === "number" && typeof msg.aimZ === "number") {
          const aimLen = Math.hypot(msg.aimX, msg.aimZ);
          if (aimLen > 1e-3) p.dir = Math.atan2(msg.aimZ, msg.aimX);
        } else if (p.inputX !== 0 || p.inputZ !== 0) {
          p.dir = Math.atan2(p.inputZ, p.inputX);
        }
      }
    );

    this.onMessage("ping", (client, t: number) => client.send("pong", t));

    // T-004: coins compram reroll da distribuição de atributos (não gasta se não puder pagar)
    this.onMessage("reroll", (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || p.coins < COIN_REROLL_COST) return;
      p.coins -= COIN_REROLL_COST;
      this.effects.rerollAttrPoints(client.sessionId, p);
    });

    // T-012: troca de lançador atrás de flag DEV — só existe para validar manualmente
    // os ganchos de mobilidade (ex.: heavy_shot_dev); nunca disponível em produção.
    this.onMessage("dev_launcher", (client, launcherId: string) => {
      if (process.env.DEBUG !== "1") return;
      const p = this.state.players.get(client.sessionId);
      if (!p || !LAUNCHERS[launcherId]) return;
      p.launcher = launcherId;
    });

    this.setSimulationInterval((dt) => this.update(dt / 1000), 1000 / TICK_RATE);
    console.log(
      `[arena] sala ${this.roomId}: mapa ${size.w}x${size.h} seed ${seed}, orçamento ${this.budget} coletáveis`
    );
  }

  onJoin(client: Client, options: { name?: string; bot?: boolean; token?: string }) {
    const p = new Player();
    p.name = String(options?.name ?? "player").slice(0, 16);
    p.isBot = Boolean(options?.bot);
    p.playerToken = options?.token || `bot_${client.sessionId}`;
    const spawns = spawnPoints(this.map.w, this.map.h);
    const spawn = spawns[this.state.players.size % spawns.length];
    p.x = spawn.x;
    p.z = spawn.z;
    this.state.players.set(client.sessionId, p);
    this.metrics.start(client.sessionId, p.name, p.isBot, this.roomId, p.level);
    console.log(`[arena] + ${p.name} (${client.sessionId})${p.isBot ? " [bot]" : ""}`);
  }

  onLeave(client: Client) {
    const p = this.state.players.get(client.sessionId);
    if (p) {
      this.emitDebug("disconnect", { playerId: client.sessionId });
      this.metrics.end(client.sessionId, p.level);
      console.log(`[arena] - ${p.name} (nível ${p.level})`);
    }
    this.effects.clear(client.sessionId);
    this.state.players.delete(client.sessionId);
  }

  onDispose() {
    activeRooms.delete(this.roomId);
    console.log(`[arena] Sala ${this.roomId} fechada.`);
  }

  private update(dt: number) {
    const now = Date.now();

    // efeitos expiram antes do movimento (velocidade correta no tick)
    this.effects.tick(this.state.players, now);

    // projéteis (T-005/T-006)
    const projectileHits = this.projectiles.tick(this.state, this.map, dt, now, this.effects);
    const killerByVictim = new Map<string, string>();

    // Morte e respawn (T-006)
    projectileHits.forEach((hit) => {
      if (hit.blockedBySafeZone) {
        this.emitDebug("safe_block", { victimId: hit.targetId, shooterId: hit.killerId });
        return;
      }
      const victim = this.state.players.get(hit.targetId);
      const killer = this.state.players.get(hit.killerId);
      this.emitDebug("hit", {
        victimId: hit.targetId,
        shooterId: hit.killerId,
        damage: Math.round(hit.damage),
        hpAfter: Math.max(0, Math.ceil(victim?.hp ?? 0)),
        isKill: hit.killed,
      });
      if (victim && killer && hit.killed && !killerByVictim.has(hit.targetId)) {
        killerByVictim.set(hit.targetId, hit.killerId);
        this.metrics.addKill(hit.killerId);
        this.grantXp(hit.killerId, killer, XP_PER_KILL_PER_LEVEL * victim.level);
      }
    });

    this.state.players.forEach((p, id) => {
      if (p.hp <= 0) {
        this.emitDebug("death", { playerId: id, levelBefore: p.level });
        this.metrics.addDeath(id);
        
        // Perda de nível
        const fullResetOnDeath = false; // flag por room (default global)
        if (fullResetOnDeath) {
          p.level = 1;
        } else {
          const loss = Math.floor(p.level * lossFraction(p.level));
          p.level = Math.max(1, p.level - loss);
        }
        
        p.xp = 0;
        this.effects.resetAttrToLevel(id, p, p.level);
        
        // Respawn em ponto safe escolhido por distância/risco, não sorte pura.
        const spawn = this.pickRespawnPoint(id);
        p.x = spawn.x;
        p.z = spawn.z;
        p.hp = p.maxHp;
        p.inputX = 0;
        p.inputZ = 0;
        p.firing = false;
        
        this.emitDebug("respawn", {
          playerId: id,
          killerId: killerByVictim.get(id) ?? null,
          levelAfter: p.level,
          x: spawn.x,
          z: spawn.z,
        });
        console.log(`[arena] ${p.name} morreu. Respawn no nível ${p.level} em (${spawn.x}, ${spawn.z}).`);
      }
    });

    // movimento autoritativo (velocidade = base × multiplicador do EffectSystem)
    this.state.players.forEach((p, id) => {
      if (p.inputX === 0 && p.inputZ === 0) return;
      const v = PLAYER_SPEED * p.speed;
      const moved = moveWithCollision(this.map, p.x, p.z, p.inputX * v * dt, p.inputZ * v * dt, PLAYER_RADIUS);
      this.metrics.addDistance(id, Math.hypot(moved.x - p.x, moved.z - p.z));
      p.x = moved.x;
      p.z = moved.z;
    });

    // coleta
    this.state.collectibles.forEach((c, cid) => {
      this.state.players.forEach((p, pid) => {
        if (Math.hypot(p.x - c.x, p.z - c.z) >= COLLECT_DIST) return;
        this.state.collectibles.delete(cid);
        this.emitDebug("pickup", { playerId: pid, kind: c.kind });
        switch (c.kind) {
          case "speed_up":
            this.effects.apply(pid, p, "speed_up", now);
            break;
          case "coin_buff":
            p.coins += COIN_BUFF_AMOUNT;
            break;
          case "farm_event":
            this.effects.apply(pid, p, "xp_boost", now);
            break;
          case "box":
            // bônus forte no round (vs. 1 do level-up normal)
            this.effects.addAttrPoints(pid, p, {
              velocidade: BOX_ATTR_BONUS_EACH,
              forca: BOX_ATTR_BONUS_EACH,
              vitalidade: BOX_ATTR_BONUS_EACH,
            });
            // T-004b: persistência entre partidas (ADR-012)
            if (!p.isBot) {
              let prog = memDB.get(p.playerToken);
              if (!prog) prog = { forca: 0, velocidade: 0, vitalidade: 0 };
              prog.forca += BOX_ATTR_BONUS_EACH;
              prog.velocidade += BOX_ATTR_BONUS_EACH;
              prog.vitalidade += BOX_ATTR_BONUS_EACH;
              memDB.set(p.playerToken, prog);
              console.log(`[arena] ${p.name} progresso persistente:`, prog);
            }
            break;
          default:
            this.grantXp(pid, p, XP_PICKUP_AMOUNT);
        }
        this.metrics.addPickup(pid, c.kind);
      });
    });

    // spawner — ADR-006: longe de jogadores; acelera quando abaixo da metade
    if (this.state.collectibles.size < this.budget && now >= this.nextSpawnAt) {
      if (this.spawnCollectible()) {
        const low = this.state.collectibles.size < this.budget / 2;
        this.nextSpawnAt = low
          ? now + RESPAWN_FAST_MS
          : now + RESPAWN_DELAY_MIN_MS + Math.random() * (RESPAWN_DELAY_MAX_MS - RESPAWN_DELAY_MIN_MS);
      }
    }
  }

  private pickRespawnPoint(deadPlayerId: string) {
    const spawns = spawnPoints(this.map.w, this.map.h);
    let best = spawns[0];
    let bestScore = -Infinity;

    for (const spawn of spawns) {
      let nearestPlayer = Infinity;
      this.state.players.forEach((p, id) => {
        if (id === deadPlayerId || p.hp <= 0) return;
        nearestPlayer = Math.min(nearestPlayer, Math.hypot(p.x - spawn.x, p.z - spawn.z));
      });

      let nearestProjectile = Infinity;
      this.state.projectiles.forEach((proj) => {
        nearestProjectile = Math.min(nearestProjectile, Math.hypot(proj.x - spawn.x, proj.z - spawn.z));
      });

      const playerScore = Number.isFinite(nearestPlayer) ? nearestPlayer : this.map.w + this.map.h;
      const projectileScore = Number.isFinite(nearestProjectile) ? Math.min(nearestProjectile, 12) : 12;
      const jitter = Math.random() * 0.01; // desempate sem transformar em sorte dominante
      const score = playerScore * 2 + projectileScore + jitter;

      if (score > bestScore) {
        bestScore = score;
        best = spawn;
      }
    }

    return best;
  }

  /** XP → nível → pontos de atributo (T-003). Loop cobre XP suficiente p/ vários níveis de uma vez. */
  private grantXp(id: string, p: Player, amount: number) {
    p.xp += amount * p.xpMult; // xp_boost (farm_event) dobra o ganho — T-004

    while (p.xp >= xpToNext(p.level)) {
      p.xp -= xpToNext(p.level);
      p.level += 1;
      this.effects.addAttrPoints(id, p, {
        velocidade: ATTR_POINTS_PER_LEVEL_EACH,
        forca: ATTR_POINTS_PER_LEVEL_EACH,
        vitalidade: ATTR_POINTS_PER_LEVEL_EACH,
      });
    }
  }

  /** T-004: zona decide o pool de kinds; safe também é suprimida (rara), guerra já é rara por ser pequena. */
  private spawnCollectible(): boolean {
    // amostragem aleatória (mapa grande: varrer tudo por spawn seria caro)
    for (let attempt = 0; attempt < 40; attempt++) {
      const tx = 1 + Math.floor(Math.random() * (this.map.w - 2));
      const tz = 1 + Math.floor(Math.random() * (this.map.h - 2));
      if (isWall(this.map, tx, tz)) continue;
      const cx = tx + 0.5;
      const cz = tz + 0.5;
      const zone = zoneAt(this.map, cx, cz);
      if (zone === "safe" && Math.random() > SAFE_ZONE_SPAWN_CHANCE) continue;
      let blocked = false;
      this.state.players.forEach((p) => {
        if (Math.abs(p.x - cx) + Math.abs(p.z - cz) < SPAWN_MIN_PLAYER_DIST) blocked = true;
      });
      this.state.collectibles.forEach((c) => {
        if (Math.abs(c.x - cx) + Math.abs(c.z - cz) < 2) blocked = true;
      });
      if (blocked) continue;
      this.createCollectible(cx, cz);
      return true;
    }
    return false; // mapa lotado perto de todo mundo — sem drop (design!)
  }

  private createCollectible(x: number, z: number) {
    const zone = zoneAt(this.map, x, z);
    const weights = zone === "safe" ? SAFE_WEIGHTS : zone === "war" ? WAR_WEIGHTS : FIELD_WEIGHTS;
    const kind = pickWeighted(Math.random, weights);
    const c = new Collectible();
    c.x = x;
    c.z = z;
    c.kind = kind;
    const id = `c${this.collectibleSeq++}`;
    this.state.collectibles.set(id, c);
    this.emitDebug("spawn", { id, x, z, kind, zone });
    if (kind === "farm_event") this.broadcast("announce", { kind: "farm_event", x, z });
  }

  private emitDebug(type: string, payload: any) {
    const ev = { time: Date.now(), type, payload };
    this.debugEvents.push(ev);
    if (this.debugEvents.length > 200) this.debugEvents.shift();
    // Bugfix pós-teste manual: o feed do F3 é opt-in (a tecla já esconde o overlay por
    // padrão) — exigir também DEBUG=1 no servidor pra alimentar esse feed era um segundo
    // interruptor escondido que ninguém lembrava de ligar. Ring buffer/HTTP já eram sempre-on;
    // agora o broadcast acompanha.
    this.broadcast("debug_event", ev);
  }
}
