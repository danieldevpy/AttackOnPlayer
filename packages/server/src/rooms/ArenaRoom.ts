import { Room, Client } from "colyseus";
import { ArenaState, Player, Collectible } from "../state/ArenaState";
import { MetricsRecorder } from "../metrics/SessionMetrics";
import { EffectSystem } from "../systems/effects";
import {
  GameMap,
  buildMap,
  isWall,
  mapSizeFor,
  moveWithCollision,
  spawnPoints,
  collectibleBudget,
  TICK_RATE,
  PLAYER_SPEED,
  PLAYER_RADIUS,
  MAX_PLAYERS,
  COLLECT_DIST,
  SPEED_UP_CHANCE,
  SPAWN_MIN_PLAYER_DIST,
  RESPAWN_DELAY_MIN_MS,
  RESPAWN_DELAY_MAX_MS,
  RESPAWN_FAST_MS,
  xpToNext,
  XP_PICKUP_AMOUNT,
  ATTR_POINTS_PER_LEVEL_EACH,
} from "@aop/shared";

export class ArenaRoom extends Room<ArenaState> {
  maxClients = MAX_PLAYERS;
  private map!: GameMap;
  private budget = 5;
  private metrics = new MetricsRecorder();
  private effects = new EffectSystem();
  private collectibleSeq = 0;
  private nextSpawnAt = 0;

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

    // pré-popula metade do orçamento (ninguém entra num mapa vazio)
    for (let i = 0; i < Math.floor(this.budget / 2); i++) this.spawnCollectible();

    this.onMessage("input", (client, msg: { x: number; z: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || typeof msg?.x !== "number" || typeof msg?.z !== "number") return;
      const len = Math.hypot(msg.x, msg.z);
      p.inputX = len > 1e-3 ? msg.x / Math.max(1, len) : 0;
      p.inputZ = len > 1e-3 ? msg.z / Math.max(1, len) : 0;
    });

    this.onMessage("ping", (client, t: number) => client.send("pong", t));

    this.setSimulationInterval((dt) => this.update(dt / 1000), 1000 / TICK_RATE);
    console.log(
      `[arena] sala ${this.roomId}: mapa ${size.w}x${size.h} seed ${seed}, orçamento ${this.budget} coletáveis`
    );
  }

  onJoin(client: Client, options: { name?: string; bot?: boolean }) {
    const p = new Player();
    p.name = String(options?.name ?? "player").slice(0, 16);
    p.isBot = Boolean(options?.bot);
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
      this.metrics.end(client.sessionId, p.level);
      console.log(`[arena] - ${p.name} (nível ${p.level})`);
    }
    this.effects.clear(client.sessionId);
    this.state.players.delete(client.sessionId);
  }

  private update(dt: number) {
    const now = Date.now();

    // efeitos expiram antes do movimento (velocidade correta no tick)
    this.effects.tick(this.state.players, now);

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
        if (c.kind === "speed_up") {
          this.effects.apply(pid, p, "speed_up", now);
        } else {
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

  /** XP → nível → pontos de atributo (T-003). Loop cobre XP suficiente p/ vários níveis de uma vez. */
  private grantXp(id: string, p: Player, amount: number) {
    p.xp += amount;
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

  private spawnCollectible(): boolean {
    // amostragem aleatória (mapa grande: varrer tudo por spawn seria caro)
    for (let attempt = 0; attempt < 40; attempt++) {
      const tx = 1 + Math.floor(Math.random() * (this.map.w - 2));
      const tz = 1 + Math.floor(Math.random() * (this.map.h - 2));
      if (isWall(this.map, tx, tz)) continue;
      const cx = tx + 0.5;
      const cz = tz + 0.5;
      let blocked = false;
      this.state.players.forEach((p) => {
        if (Math.abs(p.x - cx) + Math.abs(p.z - cz) < SPAWN_MIN_PLAYER_DIST) blocked = true;
      });
      this.state.collectibles.forEach((c) => {
        if (Math.abs(c.x - cx) + Math.abs(c.z - cz) < 2) blocked = true;
      });
      if (blocked) continue;
      const c = new Collectible();
      c.x = cx;
      c.z = cz;
      c.kind = Math.random() < SPEED_UP_CHANCE ? "speed_up" : "level_up";
      this.state.collectibles.set(`c${this.collectibleSeq++}`, c);
      return true;
    }
    return false; // mapa lotado perto de todo mundo — sem drop (design!)
  }
}
