import { Room, Client } from "colyseus";
import { ArenaState, Player, Collectible } from "../state/ArenaState";
import { MetricsRecorder } from "../metrics/SessionMetrics";
import {
  buildMap,
  isWall,
  moveWithCollision,
  SPAWN_POINTS,
  MAP_W,
  MAP_H,
  TICK_RATE,
  PLAYER_SPEED,
  PLAYER_RADIUS,
  MAX_PLAYERS,
  MAX_COLLECTIBLES,
  COLLECT_DIST,
  SPAWN_MIN_PLAYER_DIST,
  RESPAWN_DELAY_MIN_MS,
  RESPAWN_DELAY_MAX_MS,
} from "@aop/shared";

export class ArenaRoom extends Room<ArenaState> {
  maxClients = MAX_PLAYERS;
  private grid = buildMap();
  private metrics = new MetricsRecorder();
  private collectibleSeq = 0;
  private nextSpawnAt = 0;

  onCreate() {
    this.setState(new ArenaState());

    this.onMessage("input", (client, msg: { x: number; z: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || typeof msg?.x !== "number" || typeof msg?.z !== "number") return;
      // normaliza no servidor — cliente não dita velocidade
      const len = Math.hypot(msg.x, msg.z);
      p.inputX = len > 1e-3 ? msg.x / Math.max(1, len) : 0;
      p.inputZ = len > 1e-3 ? msg.z / Math.max(1, len) : 0;
    });

    this.onMessage("ping", (client, t: number) => client.send("pong", t));

    this.setSimulationInterval((dt) => this.update(dt / 1000), 1000 / TICK_RATE);
    console.log(`[arena] sala ${this.roomId} criada`);
  }

  onJoin(client: Client, options: { name?: string; bot?: boolean }) {
    const p = new Player();
    p.name = String(options?.name ?? "player").slice(0, 16);
    p.isBot = Boolean(options?.bot);
    const spawn = SPAWN_POINTS[this.state.players.size % SPAWN_POINTS.length];
    p.x = spawn.x;
    p.z = spawn.z;
    this.state.players.set(client.sessionId, p);
    this.metrics.start(client.sessionId, p.name, p.isBot, this.roomId, p.level);
    console.log(`[arena] + ${p.name} (${client.sessionId})${p.isBot ? " [bot]" : ""}`);
  }

  onLeave(client: Client) {
    const p = this.state.players.get(client.sessionId);
    if (p) {
      this.metrics.end(client.sessionId, p.level);
      console.log(`[arena] - ${p.name} (nível ${p.level})`);
    }
    this.state.players.delete(client.sessionId);
  }

  private update(dt: number) {
    // movimento autoritativo
    this.state.players.forEach((p, id) => {
      if (p.inputX === 0 && p.inputZ === 0) return;
      const dx = p.inputX * PLAYER_SPEED * dt;
      const dz = p.inputZ * PLAYER_SPEED * dt;
      const moved = moveWithCollision(this.grid, p.x, p.z, dx, dz, PLAYER_RADIUS);
      this.metrics.addDistance(id, Math.hypot(moved.x - p.x, moved.z - p.z));
      p.x = moved.x;
      p.z = moved.z;
    });

    // coleta
    this.state.collectibles.forEach((c, cid) => {
      this.state.players.forEach((p, pid) => {
        if (Math.hypot(p.x - c.x, p.z - c.z) < COLLECT_DIST) {
          this.state.collectibles.delete(cid);
          p.level += 1; // placeholder de progressão (M0)
          this.metrics.addPickup(pid);
        }
      });
    });

    // spawner — ADR-006: longe de jogadores
    const now = Date.now();
    if (this.state.collectibles.size < MAX_COLLECTIBLES && now >= this.nextSpawnAt) {
      if (this.spawnCollectible()) {
        this.nextSpawnAt =
          now +
          RESPAWN_DELAY_MIN_MS +
          Math.random() * (RESPAWN_DELAY_MAX_MS - RESPAWN_DELAY_MIN_MS);
      }
    }
  }

  private spawnCollectible(): boolean {
    const candidates: Array<{ x: number; z: number }> = [];
    for (let tz = 1; tz < MAP_H - 1; tz++) {
      for (let tx = 1; tx < MAP_W - 1; tx++) {
        if (isWall(this.grid, tx, tz)) continue;
        const cx = tx + 0.5;
        const cz = tz + 0.5;
        let nearPlayer = false;
        this.state.players.forEach((p) => {
          if (Math.abs(p.x - cx) + Math.abs(p.z - cz) < SPAWN_MIN_PLAYER_DIST) nearPlayer = true;
        });
        let occupied = false;
        this.state.collectibles.forEach((c) => {
          if (Math.abs(c.x - cx) + Math.abs(c.z - cz) < 2) occupied = true;
        });
        if (!nearPlayer && !occupied) candidates.push({ x: cx, z: cz });
      }
    }
    if (candidates.length === 0) return false; // mapa cheio de gente — sem drop (design!)
    const spot = candidates[Math.floor(Math.random() * candidates.length)];
    const c = new Collectible();
    c.x = spot.x;
    c.z = spot.z;
    this.state.collectibles.set(`c${this.collectibleSeq++}`, c);
    return true;
  }
}
