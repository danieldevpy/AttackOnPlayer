import { Room, Client } from "colyseus";
import { ArenaState, Player, Collectible } from "../state/ArenaState";
import { MetricsRecorder } from "../metrics/SessionMetrics";
import { EffectSystem } from "../systems/effects";
import { ProjectileSystem } from "../systems/projectiles";
import { FlagSystem } from "../systems/flag";
import { EventDirector } from "../systems/events/director";
interface PersistentProgress {
  forca: number;
  agilidade: number; // T-015: renomeado de `velocidade` (scaffold ADR-012, dev-only — sem migração de dados: memória volátil)
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
  SAFE_ZONE_SPAWN_CHANCE,
  SAFE_WEIGHTS,
  WAR_WEIGHTS,
  FIELD_WEIGHTS,
  COIN_BUFF_AMOUNT,
  BOX_ATTR_BONUS_EACH,
  COIN_REROLL_COST,
  XP_PER_KILL_PER_LEVEL,
  XP_PER_SECOND,
  REROLL_XP_REWARD,
  SPAWN_PROTECTION_MS,
  CollectibleKind,
  COMBAT_THREAT_RADIUS,
  KILL_DUEL_XP_BONUS_PER_LEVEL,
  killHealFraction,
  HP_ORB_AMOUNT,
  HP_ORB_MAX,
  HP_ORB_MIN_PLAYER_DIST,
  HP_ORB_MIN_SELF_DIST,
  HP_ORB_RESPAWN_MS,
  SHIELD_TEMP_MAX,
  SHIELD_TEMP_MIN_PLAYER_DIST,
  SHIELD_TEMP_MIN_SELF_DIST,
  SHIELD_TEMP_RESPAWN_MS,
  LAUNCHERS,
  UpgradeCard,
  UPGRADE_CHOICE_TIMEOUT_MS,
  UPGRADE_AUTO_PICK,
  upgradeCardsForLevel,
  SKILLS,
  SKILL_MILESTONE_LEVELS,
  SKILL_MILESTONE_SKILL,
  combinedSkillMods,
  UPGRADE_CARD_POOL,
  BOSS_LEVEL_MIN,
  BOSS_LEVEL_MAX,
  mapCenter,
  FLAG_XP_MULT,
  FLAG_PICKUP_DIST,
  REVEAL_ON_HIT_MS,
  MapFileV1,
  reachableCells,
  nearestReachableCell,
  WEAPON_PICKUP_LAUNCHERS,
  WEAPON_MAX,
  WEAPON_MIN_PLAYER_DIST,
  weaponRespawnDelay,
  DEFAULT_LAUNCHER,
  XP_COMBO_START,
  XP_COMBO_MULT,
  xpComboLimit,
  resolveClassSelection,
  sanitizeDisplayName,
  DEFAULT_NICK,
} from "@aop/shared";
import { ArraySchema } from "@colyseus/schema";
import { loadMap } from "../mapLoader";
import { TelemetryLog } from "../telemetry/log";
import { TelemetryEvent, TELEMETRY_SCHEMA_VERSION } from "../telemetry/events";
import { platformClient, EffectiveConfig } from "../platform/platformClient";
import { verifyAccountToken } from "../platform/authVerifier";

// T-026 (SPEC-0008): limiar do watchdog de tick — 2x o intervalo nominal (TICK_RATE=20 ⇒ 50ms).
// É um número de observabilidade (detecta o servidor "engasgando" sob carga), não de gameplay —
// por isso não vive em shared/constants.ts junto dos números que afetam sensação/balance.
const TICK_WATCHDOG_MS = 100;

// T-061 (SPEC-0008): checagem periódica pra config de plataforma valer NA SALA JÁ ABERTA (não
// só na próxima) — `platformClient.getConfig()` já tem TTL de 30s próprio, então esta checagem
// só decide COM QUE FREQUÊNCIA perguntamos (barato: normalmente devolve o cache em memória).
const PLATFORM_SYNC_INTERVAL_MS = 5_000;

export const activeRooms = new Map<string, ArenaRoom>();

export class ArenaRoom extends Room<ArenaState> {
  maxClients = MAX_PLAYERS;
  // Público desde a T-066 (SPEC-0016): a interface estrutural `EventRoom` expõe mapa +
  // células alcançáveis pros eventos espaciais (zona do BR snapa centro/spawn em walkable).
  public map!: GameMap;
  private budget = 5;
  private metrics = new MetricsRecorder();
  private effects = new EffectSystem();
  private projectiles = new ProjectileSystem();
  private flagSystem = new FlagSystem();
  private director = new EventDirector(); // SPEC-0016 (T-065): registry vazio ⇒ sempre idle
  private flagCenter = { x: 0, z: 0 };
  // T-024: presentes só quando a room nasce com `mapId` (mapa curado por arquivo).
  private curatedMapFile?: MapFileV1;
  private curatedSpawns?: Array<{ x: number; z: number }>;
  private collectibleSeq = 0;
  private nextSpawnAt = 0;
  // SPEC-0010: recursos de vida escassos têm passe de spawn PRÓPRIO (fora do orçamento/pesos
  // do coletável comum) — teto e espaçamento por kind, cadência lenta. Timers independentes.
  private nextHpSpawnAt = 0;
  private nextShieldSpawnAt = 0;
  // SPEC-0011 (T-039): passe DEDICADO da arma coletável — exatamente 1 no mapa por vez.
  // Timer independente; após a coleta é reagendado com cooldown sorteado [15s,30s].
  private nextWeaponSpawnAt = 0;
  // SPEC-0011: conjunto de células alcançáveis (BFS do centro do mapa), calculado 1x no
  // onCreate. A arma nasce em célula walkable E alcançável (ignora zonas/pesos).
  // Público desde a T-066 (SPEC-0016): `EventRoom` exige (ver `map` acima).
  public reachable!: Uint8Array;
  public debugEvents: Array<{ time: number; type: string; payload: any }> = [];
  // T-016: fila de ofertas de card por player — levels[0] é a oferta aberta; o resto aguarda.
  // T-017: `cards` guarda a oferta REAL enviada (marcos incluem skills e dependem do estado
  // do player no momento do envio) — resolução valida contra isto, nunca recomputa.
  private pendingUpgrade = new Map<string, { levels: number[]; cards: UpgradeCard[]; expiresAt: number }>();
  // SPEC-0005 (correção): acumulador fracionário do XP passivo por player. O XP só entra em
  // `p.xp` em unidades INTEIRAS (1 por segundo), então o HUD nunca mostra "1.478/88".
  private xpAccum = new Map<string, number>();

  // T-043 (SPEC-0011): combo de XP — estado runtime puro (não sincronizado no schema).
  // Só coletas de xp_orb contam/avançam o combo; outros kinds NÃO zeram (só dano zera).
  // `xpComboCount`: coletas consecutivas de xp_orb desde o último reset.
  // `xpComboLimit`: limite sorteado ao iniciar o combo (1ª coleta); -1 = ainda não sorteado.
  private xpComboCount = new Map<string, number>();
  private xpComboLimitMap = new Map<string, number>();

  // T-026 (SPEC-0008): telemetria por evento (kill/upgrade/bandeira/quit/erro), 1 arquivo NDJSON
  // por partida — complementa (não substitui) o `metrics` por-jogador acima.
  private telemetry!: TelemetryLog;
  private tickCount = 0;
  private matchStartedAt = 0;
  private totalJoins = 0;
  private joinedAtMap = new Map<string, number>();

  // T-027g (SPEC-0008): multiplicadores da config de plataforma — 1 (neutro) enquanto
  // `PLATFORM_ENABLED` está off, então o comportamento de sempre não muda.
  private xpMultiplier = 1;
  private coinMultiplier = 1;
  // T-061: próxima checagem de config ao vivo (ver PLATFORM_SYNC_INTERVAL_MS).
  private nextPlatformSyncAt = 0;

  /** Público desde a T-066 (SPEC-0016): os hooks de evento (`EventRoom`) espalham estes
   * campos-base em cada `emitTelemetry` próprio (event_warning/event_end etc.). */
  telemetryBase() {
    return {
      v: TELEMETRY_SCHEMA_VERSION as typeof TELEMETRY_SCHEMA_VERSION,
      ts: Date.now(),
      tick: this.tickCount,
      matchId: this.roomId,
      mapId: this.state.mapId || undefined,
    };
  }

  /** Grava o evento local (NDJSON, sempre) e, se a plataforma estiver ligada, enfileira para
   * batch (T-027g) — a fonte local nunca depende do Django estar no ar.
   * Público (não só `private`) desde a T-065 (SPEC-0016): os hooks de `EventDefinition`
   * recebem a sala via a interface estrutural `EventRoom`, que exige acesso a este método. */
  emitTelemetry(event: TelemetryEvent) {
    this.telemetry.write(event);
    if (process.env.PLATFORM_ENABLED === "1") platformClient.queueTelemetry(event);
  }

  async onCreate(options?: { expectedPlayers?: number; flagEnabled?: boolean; mapId?: string }) {
    this.setState(new ArenaState());

    // T-027g (SPEC-0008): config da plataforma só entra em jogo atrás da flag — off por
    // default, então nenhum teste/smoke atual muda de comportamento. platformClient já
    // degrada sozinho (cache/defaults) se o Django estiver fora do ar (aceite #3).
    let platformConfig: EffectiveConfig | null = null;
    if (process.env.PLATFORM_ENABLED === "1") {
      platformConfig = await platformClient.getConfig();
      this.xpMultiplier = platformConfig.xpMultiplier;
      this.coinMultiplier = platformConfig.coinMultiplier;
    }
    const rotation = platformConfig?.mapRotation ?? [];
    const resolvedMapId =
      options?.mapId ?? (rotation.length > 0 ? rotation[Math.floor(Math.random() * rotation.length)] : undefined);

    // T-024 (SPEC-0007): mapId presente (explícito ou sorteado da rotação da plataforma) =
    // mapa curado (arquivo versionado); ausente = o caminho original por seed (ADR-007),
    // preservado tal e qual para não quebrar nada que já dependa dele (bots de teste, gates).
    if (resolvedMapId) {
      const { file, map } = loadMap(resolvedMapId);
      this.map = map;
      this.curatedMapFile = file;
      this.curatedSpawns = file.spawns;
      this.state.mapW = file.w;
      this.state.mapH = file.h;
      this.state.mapSeed = file.seed ?? 0;
      this.state.mapId = file.id;
      this.budget = collectibleBudget(file.w, file.h);
      this.flagCenter = file.flag;
    } else {
      // ADR-007: tamanho decidido AQUI e nunca mais (mínimo 5x o base)
      const size = mapSizeFor(Number(options?.expectedPlayers ?? platformConfig?.expectedPlayers) || 4);
      const seed = (Date.now() % 2147483647) | 0;
      this.map = buildMap(size.w, size.h, seed);
      this.state.mapW = size.w;
      this.state.mapH = size.h;
      this.state.mapSeed = seed;
      this.state.mapId = "";
      this.budget = collectibleBudget(size.w, size.h);
      this.flagCenter = mapCenter(size.w, size.h);
    }

    // SPEC-0011 (T-039): células alcançáveis a partir de um spawn de player (célula livre
    // garantida). Base para o spawn "totalmente aleatório mas válido" da arma coletável.
    const reachSeed = this.curatedSpawns?.[0] ?? spawnPoints(this.map.w, this.map.h)[0];
    this.reachable = reachableCells(this.map, Math.floor(reachSeed.x), Math.floor(reachSeed.z));

    // T-021: toggle por room (default ON) — bandeira nasce no centro do mapa (seed) ou
    // na posição curada pelo arquivo (mapId).
    // SPEC-0011 (T-040): toda posição em que a bandeira assenta (init/volta ao centro/drop)
    // é ajustada para a célula walkable ALCANÇÁVEL mais próxima — reusa o `reachable` já
    // pré-computado acima (BFS de um spawn de player).
    this.flagSystem.setSettle((x, z) => nearestReachableCell(this.map, x, z, this.reachable));
    this.state.flagEnabled = options?.flagEnabled ?? platformConfig?.flagEnabled ?? true;
    this.flagSystem.initAt(this.state.flag, this.flagCenter.x, this.flagCenter.z);

    activeRooms.set(this.roomId, this);

    // T-026: telemetria por partida — 1 arquivo NDJSON por roomId.
    this.telemetry = new TelemetryLog(this.roomId);
    this.matchStartedAt = Date.now();
    this.emitTelemetry({
      ...this.telemetryBase(),
      type: "match_start",
      mapW: this.state.mapW,
      mapH: this.state.mapH,
      mapSeed: this.state.mapSeed,
      expectedPlayers: options?.expectedPlayers,
    });

    // pré-popula metade do orçamento (ninguém entra num mapa vazio)
    for (let i = 0; i < Math.floor(this.budget / 2); i++) this.spawnCollectible();

    this.onMessage(
      "input",
      (client, msg: { x: number; z: number; aimX?: number; aimZ?: number; fire?: boolean }) => {
        const p = this.state.players.get(client.sessionId);
        if (!p || typeof msg?.x !== "number" || typeof msg?.z !== "number") return;
        // SPEC-0016 (T-066): morto segurado por evento ("hold_until_end") fica FORA do jogo —
        // sem input/tiro até o evento liberar o respawn (bots continuam mandando input).
        if (p.waitingRespawn) return;
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
    // SPEC-0005: além de redistribuir atributos, o reroll também concede XP — a tecla R vira
    // progressão ativa (pode subir de nível e abrir card na hora via grantXp).
    this.onMessage("reroll", (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || p.coins < COIN_REROLL_COST) return;
      p.coins -= COIN_REROLL_COST;
      this.effects.rerollAttrPoints(client.sessionId, p);
      this.grantXp(client.sessionId, p, REROLL_XP_REWARD);
    });

    // T-016: escolha de card de level-up — servidor valida tudo (oferta aberta + card
    // pertencente à oferta); escolha inválida é IGNORADA sem consumir a oferta.
    this.onMessage("choose_upgrade", (client, cardId: string) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || typeof cardId !== "string") return;
      this.resolveUpgrade(client.sessionId, p, cardId, Date.now());
    });

    // T-012: troca de lançador atrás de flag DEV — só existe para validar manualmente
    // os ganchos de mobilidade (ex.: heavy_shot_dev); nunca disponível em produção.
    this.onMessage("dev_launcher", (client, launcherId: string) => {
      if (process.env.DEBUG !== "1") return;
      const p = this.state.players.get(client.sessionId);
      if (!p || !LAUNCHERS[launcherId]) return;
      p.launcher = launcherId;
    });

    // SPEC-0016 (T-065): gatilho manual de evento pra teste/staff — mesmo padrão do
    // `dev_launcher` acima (atrás de DEBUG=1). Elegibilidade vale igual ao caminho automático
    // (ex.: <BR_MIN_PLAYERS vivos ⇒ não dispara); registry vazio nesta task ⇒ sempre no-op.
    this.onMessage("dev_event", (_client, eventId: string) => {
      if (process.env.DEBUG !== "1") return;
      const result = this.director.forceTrigger(String(eventId), this, Date.now());
      if (!result.ok) {
        console.log(`[arena] dev_event "${eventId}" não disparou: ${result.reason}`);
      }
    });

    this.setSimulationInterval((dt) => this.update(dt / 1000), 1000 / TICK_RATE);
    console.log(
      `[arena] sala ${this.roomId}: mapa ${this.state.mapW}x${this.state.mapH}` +
        (this.state.mapId ? ` (curado: ${this.state.mapId})` : ` seed ${this.state.mapSeed}`) +
        `, orçamento ${this.budget} coletáveis`
    );
  }

  async onJoin(
    client: Client,
    options: {
      name?: string;
      nick?: string;
      bot?: boolean;
      token?: string;
      boss?: boolean;
      authToken?: string;
      classId?: string;
      skinId?: string;
    }
  ) {
    const p = new Player();
    // T-059 (SPEC-0015): nick do lobby entra como nome do player (NÃO há campo novo no schema —
    // `name` já é sincronizado). Sanitização autoritativa server-side: charset/tamanho fora do
    // permitido ou ausente cai pro fallback "Guest" (mesma política do `sanitize_display_name` do
    // Django, agora dupla). Cliente pode mandar `nick` (lobby) ou `name` (bots/legado) — `nick`
    // tem precedência. Precedência final de identidade é resolvida abaixo: conta > nick/name > fallback.
    p.name = sanitizeDisplayName(options?.nick ?? options?.name, DEFAULT_NICK);
    p.isBot = Boolean(options?.bot);
    p.playerToken = options?.token || `bot_${client.sessionId}`;
    // T-052 (SPEC-0014): classId/skinId inválidos ou ausentes caem pro default — join
    // nunca rejeita por causa de seleção de personagem ruim (mesma regra do authToken).
    const { classId, skinId } = resolveClassSelection(options?.classId, options?.skinId);
    p.classId = classId;
    p.skinId = skinId;

    // T-028b (SPEC-0008): authToken é opcional — ausente/inválido/expirado cai para guest sem
    // rejeitar o join (join nunca falha por causa de auth). Atrás de PLATFORM_ENABLED, como o
    // resto da integração com a plataforma (T-027g) — off por default, zero mudança de
    // comportamento nos testes/smoke atuais.
    // Precedência de identidade (T-059): conta (JWT válido) > nick do lobby / name (bots) > fallback.
    // O nome da conta já foi sanitizado pelo Django (`sanitize_display_name`), mas re-sanitizamos
    // aqui para garantir o mesmo teto de comprimento do jogo e nunca confiar no valor recebido.
    if (process.env.PLATFORM_ENABLED === "1" && options?.authToken) {
      const claims = await verifyAccountToken(options.authToken);
      if (claims && !claims.isGuest) {
        p.accountId = claims.sub;
        p.name = sanitizeDisplayName(claims.displayName, p.name);
      }
    }
    // T-024: mapa curado traz seus próprios spawns; sem mapId, mantém os 8 cantos/meios-de-borda de sempre.
    const spawns = this.curatedSpawns ?? spawnPoints(this.map.w, this.map.h);
    const spawn = spawns[this.state.players.size % spawns.length];
    p.x = spawn.x;
    p.z = spawn.z;
    p.spawnProtectedUntil = Date.now() + SPAWN_PROTECTION_MS; // SPEC-0005: imune ao nascer
    if (options?.boss) this.initBoss(client.sessionId, p);
    this.state.players.set(client.sessionId, p);
    this.metrics.start(client.sessionId, p.name, p.isBot, this.roomId, p.level);
    this.totalJoins += 1;
    this.joinedAtMap.set(client.sessionId, Date.now());
    // T-024: mapa curado não dá pra reconstruir por seed no cliente/bots — o JSON completo
    // viaja uma vez no join (mapas pequenos, sem custo de tráfego contínuo).
    if (this.curatedMapFile) client.send("map_data", this.curatedMapFile);
    console.log(`[arena] + ${p.name} (${client.sessionId})${p.isBot ? " [bot]" : ""}${options?.boss ? " [BOSS]" : ""}`);
  }

  /**
   * T-008b: boss de bot nasce nível 6–8 já com build CONCENTRADA (1 card não-equilibrado
   * repetido — nunca o preset espalhado) + 1 skill de marco (nível 4, que o boss já passou
   * ao nascer alto). Autoridade 100% no servidor: o bot só pede `boss: true` no join, os
   * números concretos (nível, atributos, skill) são decididos e aplicados aqui.
   */
  private initBoss(id: string, p: Player) {
    p.level = BOSS_LEVEL_MIN + Math.floor(Math.random() * (BOSS_LEVEL_MAX - BOSS_LEVEL_MIN + 1));

    const concentrated = UPGRADE_CARD_POOL.filter((c) => c.id !== "equilibrado" && !c.skill);
    const card = concentrated[Math.floor(Math.random() * concentrated.length)];
    for (let lvl = 1; lvl < p.level; lvl++) this.effects.addAttrPoints(id, p, card.points);

    const skillIds = Object.keys(SKILLS);
    p.skills.push(skillIds[Math.floor(Math.random() * skillIds.length)]);
  }

  onLeave(client: Client) {
    const p = this.state.players.get(client.sessionId);
    if (p) {
      this.emitDebug("disconnect", { playerId: client.sessionId });
      this.metrics.end(client.sessionId, p.level);
      const joinedAt = this.joinedAtMap.get(client.sessionId) ?? Date.now();
      this.emitTelemetry({
        ...this.telemetryBase(),
        type: "quit",
        playerToken: p.playerToken,
        reason: "disconnect",
        durationS: Math.round((Date.now() - joinedAt) / 100) / 10,
        finalLevel: p.level,
      });
      console.log(`[arena] - ${p.name} (nível ${p.level})`);
    }
    this.effects.clear(client.sessionId);
    this.pendingUpgrade.delete(client.sessionId); // T-016
    this.xpAccum.delete(client.sessionId); // SPEC-0005
    this.xpComboCount.delete(client.sessionId); // T-043
    this.xpComboLimitMap.delete(client.sessionId); // T-043
    this.joinedAtMap.delete(client.sessionId); // T-026
    this.state.players.delete(client.sessionId);
  }

  onDispose() {
    activeRooms.delete(this.roomId);
    this.emitTelemetry({
      ...this.telemetryBase(),
      type: "match_end",
      durationS: Math.round((Date.now() - this.matchStartedAt) / 100) / 10,
      playerCount: this.totalJoins,
    });
    console.log(`[arena] Sala ${this.roomId} fechada.`);
  }

  /**
   * T-026: wrapper fino sobre `updateInner` — watchdog de tick (dt real acima do limiar vira
   * evento, nunca trava o loop) + captura de erro (um tick ruim não derruba a sala inteira;
   * fica registrado como evento `error` com contexto, em vez de crashar o processo).
   */
  private update(dt: number) {
    this.tickCount += 1;
    const dtMs = dt * 1000;
    if (dtMs > TICK_WATCHDOG_MS) {
      this.emitTelemetry({ ...this.telemetryBase(), type: "tick_slow", dtMs, thresholdMs: TICK_WATCHDOG_MS });
    }
    try {
      this.updateInner(dt);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error("[arena] erro no tick:", e);
      this.emitTelemetry({
        ...this.telemetryBase(),
        type: "error",
        context: "update",
        message: e.message,
        stack: e.stack,
      });
    }
  }

  private updateInner(dt: number) {
    const now = Date.now();

    // T-061 (SPEC-0008): evento/config de gameops criado no admin passa a valer NA SALA JÁ
    // ABERTA, não só na próxima — `getConfig()` já degrada sozinho (cache/defaults) se o
    // Django estiver fora do ar, então isto nunca pode travar nem quebrar o tick.
    if (process.env.PLATFORM_ENABLED === "1" && now >= this.nextPlatformSyncAt) {
      this.nextPlatformSyncAt = now + PLATFORM_SYNC_INTERVAL_MS;
      void platformClient.getConfig(now).then((cfg) => {
        this.xpMultiplier = cfg.xpMultiplier;
        this.coinMultiplier = cfg.coinMultiplier;
        this.state.flagEnabled = cfg.flagEnabled;
      });
    }

    // SPEC-0016 (T-065): Event Director — avalia/avança a máquina de estados do evento de
    // sessão ANTES do bloco de morte abaixo, pra qualquer dano de zona de um evento ativo
    // (onTick) já cair no MESMO tick que a checagem `p.hp <= 0` processa. Registry vazio ⇒
    // fica sempre "idle", sem custo perceptível e sem tocar em nada do comportamento atual.
    this.director.tick(this, dt, now);

    // efeitos expiram antes do movimento (velocidade correta no tick)
    this.effects.tick(this.state.players, now);

    // T-016: oferta de card expirada → auto-pick equilibrado (o jogo nunca pausa; AFK evolui)
    this.pendingUpgrade.forEach((pending, id) => {
      if (now < pending.expiresAt) return;
      const p = this.state.players.get(id);
      if (!p) {
        this.pendingUpgrade.delete(id);
        return;
      }
      this.resolveUpgrade(id, p, null, now);
    });

    // projéteis (T-005/T-006)
    const projectileHits = this.projectiles.tick(this.state, this.map, dt, now, this.effects);
    const killerByVictim = new Map<string, string>();

    // Morte e respawn (T-006)
    projectileHits.forEach((hit) => {
      if (hit.blockedBySafeZone) {
        this.emitDebug("safe_block", { victimId: hit.targetId, shooterId: hit.killerId });
        return;
      }
      if (hit.blockedByShield) {
        // SPEC-0005: dano absorvido pela invulnerabilidade de nascimento do alvo.
        this.emitDebug("shield_block", { victimId: hit.targetId, shooterId: hit.killerId });
        return;
      }
      const victim = this.state.players.get(hit.targetId);
      const killer = this.state.players.get(hit.killerId);
      // T-023 (reveal-on-hit): dano de verdade (não bloqueado) revela os dois lados por um
      // tempo, renovado a cada novo hit — "inimigo é só skin até trocar dano com ele".
      if (victim) victim.revealedUntil = now + REVEAL_ON_HIT_MS;
      if (killer) killer.revealedUntil = now + REVEAL_ON_HIT_MS;
      // T-043 (SPEC-0011): dano REAL zera o combo de XP da vítima.
      // "Dano real" = não bloqueado por safe zone e não bloqueado por escudo de nascimento.
      if (victim) {
        this.xpComboCount.set(hit.targetId, 0);
        this.xpComboLimitMap.delete(hit.targetId);
      }
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
        // SPEC-0010 (T-033): recompensa de kill CONTEXTUAL. Conta inimigos vivos perto do
        // matador no instante do abate = "temperatura da briga". Duelo isolado (0) → bônus
        // de XP (progressão); briga (≥1) → cura % da vida FALTANTE, escalando com o nº de
        // inimigos até um teto, sem overheal. Anti-snowball: cura só onde havia risco real.
        const threats = this.countLivingEnemiesNear(hit.killerId, hit.targetId, killer.x, killer.z);
        this.emitTelemetry({
          ...this.telemetryBase(),
          type: "kill",
          killerToken: killer.playerToken,
          killerPos: { x: killer.x, z: killer.z },
          killerLevel: killer.level,
          victimToken: victim.playerToken,
          victimPos: { x: victim.x, z: victim.z },
          victimLevel: victim.level,
          threats,
        });
        if (threats === 0) {
          this.grantXp(hit.killerId, killer, KILL_DUEL_XP_BONUS_PER_LEVEL * victim.level);
          this.emitDebug("kill_duel_bonus", { playerId: hit.killerId, xp: KILL_DUEL_XP_BONUS_PER_LEVEL * victim.level });
        } else {
          const heal = Math.round((killer.maxHp - killer.hp) * killHealFraction(threats));
          if (heal > 0) {
            killer.hp = Math.min(killer.maxHp, killer.hp + heal);
            this.emitDebug("kill_heal", { playerId: hit.killerId, heal, threats });
          }
        }
        // T-017 (skill impulso): kill reseta o cooldown e dá boost curto de velocidade
        if (combinedSkillMods(Array.from(killer.skills)).onKillImpulso) {
          killer.lastFireAt = 0;
          this.effects.apply(hit.killerId, killer, "kill_rush", now);
          this.emitDebug("impulso", { playerId: hit.killerId });
        }
      }
    });

    this.state.players.forEach((p, id) => {
      // SPEC-0016 (T-065): `waitingRespawn` já é uma morte processada (política
      // "hold_until_end") segurando o player em hp=0 — sem o guard, este forEach reprocessaria
      // a morte (flag/nível/telemetria) a cada tick enquanto ele espera o fim do evento.
      if (p.hp <= 0 && !p.waitingRespawn) this.handleDeath(id, p, killerByVictim, now);
    });

    // SPEC-0005: presença viva — todo player conectado (bots inclusos) ganha XP por segundo
    // só por estar na sala. O tempo acumula por tick, mas o XP entra em unidades INTEIRAS
    // (mantém `p.xp` sem casas decimais no HUD). grantXp cuida do(s) level-up(s) e do card.
    // Roda depois da morte/respawn deste tick, então quem acabou de renascer já conta como vivo.
    this.state.players.forEach((p, id) => {
      if (p.hp <= 0) return;
      const acc = (this.xpAccum.get(id) ?? 0) + XP_PER_SECOND * dt;
      const whole = Math.floor(acc);
      this.xpAccum.set(id, acc - whole);
      if (whole > 0) {
        // T-021: portador da bandeira ganha o XP passivo em dobro.
        const flagMult = this.state.flagEnabled && this.state.flag.carrierId === id ? FLAG_XP_MULT : 1;
        this.grantXp(id, p, whole * flagMult);
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

    // T-021: bandeira — segue o portador (ou conta o abandono), depois checa pickup por distância.
    if (this.state.flagEnabled) {
      // SPEC-0011 (T-042): o tick decide as transições de cooldown; devolve o evento pra o
      // cliente/toast (flag_cooldown_start = saiu do jogo; flag_respawn = renasceu no centro).
      const flagEvent = this.flagSystem.tick(this.state.flag, this.state.players, this.flagCenter, now);
      if (flagEvent) this.emitDebug(flagEvent, { x: this.state.flag.x, z: this.state.flag.z });
      // T-042: pickup só quando ATIVA (em cooldown a bandeira está fora do jogo).
      if (this.state.flag.state === "active" && !this.state.flag.carrierId) {
        this.state.players.forEach((p, id) => {
          if (this.state.flag.carrierId || p.hp <= 0) return;
          if (Math.hypot(p.x - this.state.flag.x, p.z - this.state.flag.z) < FLAG_PICKUP_DIST) {
            this.flagSystem.pickup(this.state.flag, id);
            this.emitDebug("flag_pickup", { playerId: id });
            this.emitTelemetry({
              ...this.telemetryBase(),
              type: "flag_possession",
              playerToken: p.playerToken,
              action: "pickup",
              pos: { x: p.x, z: p.z },
            });
          }
        });
      }
    }

    // coleta
    this.state.collectibles.forEach((c, cid) => {
      this.state.players.forEach((p, pid) => {
        // SPEC-0016 (T-066): morto (em especial o segurado por evento, que fica ticks com
        // hp=0 no lugar da morte) não coleta nada. No fluxo normal o respawn no mesmo tick
        // devolve hp=maxHp antes deste passe, então nada muda fora de evento.
        if (p.hp <= 0) return;
        if (Math.hypot(p.x - c.x, p.z - c.z) >= COLLECT_DIST) return;
        this.state.collectibles.delete(cid);
        // SPEC-0011 (T-039): pickup da arma leva o weaponId no evento — o cliente usa pra
        // VFX/toast ("pegou Tiro Pesado") e chip do HUD. Demais kinds mandam weaponId undefined.
        this.emitDebug("pickup", { playerId: pid, kind: c.kind, weaponId: c.weaponId || undefined });
        switch (c.kind) {
          case "speed_up":
            this.effects.apply(pid, p, "speed_up", now);
            break;
          case "coin_buff":
            p.coins += Math.round(COIN_BUFF_AMOUNT * this.coinMultiplier);
            break;
          case "farm_event":
            this.effects.apply(pid, p, "xp_boost", now);
            break;
          case "hp_orb":
            // SPEC-0010 (T-034): +HP fixo pequeno, nunca acima do maxHp.
            p.hp = Math.min(p.maxHp, p.hp + HP_ORB_AMOUNT);
            break;
          case "shield_temp":
            // SPEC-0010 (T-035): escudo temporário — reduz dano recebido por SHIELD_TEMP_MS.
            this.effects.apply(pid, p, "damage_reduction", now);
            break;
          case "weapon":
            // SPEC-0011 (T-039): troca o lançador NA HORA pelo sorteado no spawn. A arma some
            // (já deletada acima) e o respawn é agendado com cooldown sorteado [15s,30s] — enquanto
            // isso, não há arma no chão (WEAPON_MAX = 1 garantido pelo timer + countKind).
            if (c.weaponId && LAUNCHERS[c.weaponId]) p.launcher = c.weaponId;
            this.nextWeaponSpawnAt = now + weaponRespawnDelay(Math.random);
            break;
          case "xp_orb":
            // T-043 (SPEC-0011): combo de XP. Coletas consecutivas sem tomar dano formam combo.
            // A partir da XP_COMBO_START-ésima coleta o orbe vale o dobro (XP_COMBO_MULT).
            // O limite do combo é sorteado na 1ª coleta; ao atingir, a coleta ainda dá bônus
            // e o combo reseta (novo sorteio no próximo início). Outros kinds NÃO zeram o combo.
            {
              const prevCount = this.xpComboCount.get(pid) ?? 0;
              const newCount = prevCount + 1;
              // Se ainda não há limite sorteado (início de sequência), sorteia agora.
              if (!this.xpComboLimitMap.has(pid) || prevCount === 0) {
                this.xpComboLimitMap.set(pid, xpComboLimit(Math.random));
              }
              const limit = this.xpComboLimitMap.get(pid)!;
              const boosted = newCount >= XP_COMBO_START;
              const xpAmount = boosted ? XP_PICKUP_AMOUNT * XP_COMBO_MULT : XP_PICKUP_AMOUNT;
              this.grantXp(pid, p, xpAmount);
              this.emitDebug("xp_combo", { playerId: pid, count: newCount, boosted, limit });
              // Verifica se atingiu o limite: a coleta atual ainda deu bônus; agora reseta.
              if (newCount >= limit) {
                this.xpComboCount.set(pid, 0);
                this.xpComboLimitMap.delete(pid);
              } else {
                this.xpComboCount.set(pid, newCount);
              }
            }
            break;
          case "box":
            // bônus forte no round (vs. 1 do level-up normal)
            this.effects.addAttrPoints(pid, p, {
              agilidade: BOX_ATTR_BONUS_EACH,
              forca: BOX_ATTR_BONUS_EACH,
              vitalidade: BOX_ATTR_BONUS_EACH,
            });
            // T-004b: persistência entre partidas (ADR-012) — memória volátil, painel dev (F3).
            if (!p.isBot) {
              let prog = memDB.get(p.playerToken);
              if (!prog) prog = { forca: 0, agilidade: 0, vitalidade: 0 };
              prog.forca += BOX_ATTR_BONUS_EACH;
              prog.agilidade += BOX_ATTR_BONUS_EACH;
              prog.vitalidade += BOX_ATTR_BONUS_EACH;
              memDB.set(p.playerToken, prog);
              console.log(`[arena] ${p.name} progresso persistente:`, prog);
            }
            // T-029: mesmo acumulador persiste DE VERDADE na conta (PlayerStats), quando a
            // plataforma está ligada e o join trouxe um JWT válido (accountId). Guardrail
            // inalterado: só estatística — não afeta `addAttrPoints` acima nem o round atual.
            if (process.env.PLATFORM_ENABLED === "1" && p.accountId) {
              void platformClient.reportProgress(p.accountId, {
                forca: BOX_ATTR_BONUS_EACH,
                agilidade: BOX_ATTR_BONUS_EACH,
                vitalidade: BOX_ATTR_BONUS_EACH,
              });
            }
            // T-017: box também sorteia uma skill que falte (fecha a decisão do CD em
            // growth.md — "quando lançadores existirem, box passa a também sortear").
            // RNG aqui é aceitável: box é drop raro de zona de guerra (risco→recompensa).
            {
              const missing = Object.keys(SKILLS).filter((s) => !p.skills.includes(s));
              if (missing.length > 0) {
                const skill = missing[Math.floor(Math.random() * missing.length)];
                p.skills.push(skill);
                this.emitDebug("box_skill", { playerId: pid, skill });
              }
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

    // SPEC-0010: passe de recursos de vida — escasso e espaçado, separado do genérico.
    // Cada kind tem teto próprio, distâncias mínimas próprias (player + mesmo-kind) e
    // cadência lenta. Só tenta quando abaixo do teto e o timer venceu.
    if (now >= this.nextHpSpawnAt && this.countKind("hp_orb") < HP_ORB_MAX) {
      if (this.spawnSurvivalItem("hp_orb", HP_ORB_MIN_PLAYER_DIST, HP_ORB_MIN_SELF_DIST)) {
        this.nextHpSpawnAt = now + HP_ORB_RESPAWN_MS;
      }
    }
    if (now >= this.nextShieldSpawnAt && this.countKind("shield_temp") < SHIELD_TEMP_MAX) {
      if (this.spawnSurvivalItem("shield_temp", SHIELD_TEMP_MIN_PLAYER_DIST, SHIELD_TEMP_MIN_SELF_DIST)) {
        this.nextShieldSpawnAt = now + SHIELD_TEMP_RESPAWN_MS;
      }
    }

    // SPEC-0011 (T-039): arma coletável — exatamente 1 no mapa por vez. Passe dedicado,
    // posição TOTALMENTE aleatória (walkable + alcançável, ignora zonas/pesos), só afasta
    // um pouco de qualquer player pra não nascer em cima de alguém. O timer só existe pra
    // segurar o respawn pós-coleta ([15s,30s]); enquanto houver arma no chão, não tenta.
    if (now >= this.nextWeaponSpawnAt && this.countKind("weapon") < WEAPON_MAX) {
      if (this.spawnWeapon()) {
        // nascida: sem próximo agendamento até ser coletada (respawn agendado na coleta).
        this.nextWeaponSpawnAt = Infinity;
      }
    }
  }

  /** SPEC-0010: quantas instâncias de um kind existem hoje no mapa. */
  private countKind(kind: CollectibleKind): number {
    let n = 0;
    this.state.collectibles.forEach((c) => {
      if (c.kind === kind) n += 1;
    });
    return n;
  }

  /**
   * SPEC-0010 (T-033): nº de inimigos VIVOS (fora matador e vítima) dentro do raio de combate
   * do matador no instante do abate. Proxy barato de "briga generalizada".
   */
  private countLivingEnemiesNear(killerId: string, victimId: string, kx: number, kz: number): number {
    let n = 0;
    this.state.players.forEach((p, id) => {
      if (id === killerId || id === victimId || p.hp <= 0) return;
      if (Math.hypot(p.x - kx, p.z - kz) <= COMBAT_THREAT_RADIUS) n += 1;
    });
    return n;
  }

  /**
   * SPEC-0010: coloca um recurso de vida respeitando distância mínima de QUALQUER player e
   * de outra instância do MESMO kind. Amostragem aleatória (mapa grande). Falha silenciosa
   * (sem drop este tick) se não achar célula boa — o timer não avança, tenta de novo.
   */
  private spawnSurvivalItem(kind: CollectibleKind, minPlayerDist: number, minSelfDist: number): boolean {
    for (let attempt = 0; attempt < 40; attempt++) {
      const tx = 1 + Math.floor(Math.random() * (this.map.w - 2));
      const tz = 1 + Math.floor(Math.random() * (this.map.h - 2));
      if (isWall(this.map, tx, tz)) continue;
      const cx = tx + 0.5;
      const cz = tz + 0.5;
      if (zoneAt(this.map, cx, cz) === "safe") continue; // recurso de sobrevivência é de campo aberto
      let blocked = false;
      this.state.players.forEach((p) => {
        if (Math.abs(p.x - cx) + Math.abs(p.z - cz) < minPlayerDist) blocked = true;
      });
      if (blocked) continue;
      this.state.collectibles.forEach((c) => {
        if (c.kind === kind && Math.abs(c.x - cx) + Math.abs(c.z - cz) < minSelfDist) blocked = true;
      });
      if (blocked) continue;
      this.createCollectible(cx, cz, kind);
      return true;
    }
    return false;
  }

  /**
   * SPEC-0011 (T-039): nasce a arma coletável em célula TOTALMENTE aleatória do mapa —
   * walkable (não-parede) E alcançável (BFS pré-computado), ignorando zonas/pesos. Só exige
   * distância mínima PEQUENA de qualquer player (WEAPON_MIN_PLAYER_DIST) pra não cair em cima
   * de alguém. O lançador da arma é sorteado AQUI (no spawn) entre os vantajosos e gravado no
   * schema (`weaponId`) — o cliente lê pra desenhar a arma certa. Falha silenciosa se não
   * achar célula boa (timer não avança, tenta no próximo tick).
   */
  private spawnWeapon(): boolean {
    for (let attempt = 0; attempt < 60; attempt++) {
      const tx = 1 + Math.floor(Math.random() * (this.map.w - 2));
      const tz = 1 + Math.floor(Math.random() * (this.map.h - 2));
      if (isWall(this.map, tx, tz)) continue; // walkable
      if (!this.reachable[tz * this.map.w + tx]) continue; // alcançável (nada de bolsão fechado)
      const cx = tx + 0.5;
      const cz = tz + 0.5;
      let blocked = false;
      this.state.players.forEach((p) => {
        if (Math.abs(p.x - cx) + Math.abs(p.z - cz) < WEAPON_MIN_PLAYER_DIST) blocked = true;
      });
      if (blocked) continue;
      const weaponId = WEAPON_PICKUP_LAUNCHERS[Math.floor(Math.random() * WEAPON_PICKUP_LAUNCHERS.length)];
      this.createCollectible(cx, cz, "weapon", weaponId);
      return true;
    }
    return false;
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

  /**
   * SPEC-0016 (T-065): ponto de respawn dentro da zona do evento ativo (`state.event`),
   * sorteado entre as células alcançáveis a até `zoneRadius` do centro (`zoneX`/`zoneZ`) —
   * 100% genérico (só lê os campos já sincronizados no schema, nenhum conhecimento de Battle
   * Royale). Raio 0 ou nenhuma célula alcançável dentro dele ⇒ cai na célula walkable mais
   * próxima do centro (`nearestReachableCell`, mesmo fallback usado pela bandeira na T-040).
   */
  private pickZoneSpawnPoint(): { x: number; z: number } {
    const { zoneX, zoneZ, zoneRadius } = this.state.event;
    const candidates: Array<{ x: number; z: number }> = [];
    for (let z = 0; z < this.map.h; z++) {
      for (let x = 0; x < this.map.w; x++) {
        if (!this.reachable[z * this.map.w + x]) continue;
        const cx = x + 0.5;
        const cz = z + 0.5;
        if (Math.hypot(cx - zoneX, cz - zoneZ) <= zoneRadius) candidates.push({ x: cx, z: cz });
      }
    }
    if (candidates.length === 0) return nearestReachableCell(this.map, zoneX, zoneZ, this.reachable);
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /**
   * SPEC-0016 (T-065): pipeline de morte extraído do bloco antigo (comportamento "default"
   * byte-a-byte idêntico) — a morte em si (nível zera, build apaga, bandeira derruba) é
   * processada UMA VEZ sempre; só o QUE acontece depois (respawn imediato, dentro da zona, ou
   * segurado até o fim do evento) muda conforme `director.respawnPolicyFor(id)`. Sem evento
   * ativo (registry vazio nesta task), a política é sempre "default".
   */
  private handleDeath(id: string, p: Player, killerByVictim: Map<string, string>, now: number) {
    this.emitDebug("death", { playerId: id, levelBefore: p.level });
    this.metrics.addDeath(id);
    this.director.recordDeath(now);

    // T-021: morte do portador derruba a bandeira no local (antes do respawn mover p.x/p.z).
    if (this.state.flagEnabled && this.state.flag.carrierId === id) {
      this.flagSystem.drop(this.state.flag, p.x, p.z, now);
      this.emitDebug("flag_drop", { playerId: id, reason: "death" });
      this.emitTelemetry({
        ...this.telemetryBase(),
        type: "flag_possession",
        playerToken: p.playerToken,
        action: "drop",
        pos: { x: p.x, z: p.z },
      });
    }

    // SPEC-0005: a morte ZERA o nível (volta ao 1) — antes perdia só uma fração
    // (lossFraction). Risco real ao máximo: morrer apaga toda a progressão do round.
    p.level = 1;
    p.xp = 0;
    this.effects.resetAttrToLevel(id, p, p.level);
    // T-016/T-017: morte apaga a build — ofertas pendentes e skills morrem junto
    // (pilar risco real: especializar é apostar). Avisa o cliente pra fechar o menu
    // de card aberto — sem isso a janela ficava travada na tela após a morte.
    if (this.pendingUpgrade.delete(id)) {
      this.clients.find((c) => c.sessionId === id)?.send("upgrade_offer_closed");
    }
    p.pendingUpgrades = 0;
    p.skills = new ArraySchema<string>();
    // SPEC-0011 (T-039): a morte devolve o lançador padrão — a arma coletada não persiste
    // (pilar risco real, mesma regra da build). O ciclo de spawn repõe a arma no mapa.
    p.launcher = DEFAULT_LAUNCHER;

    const policy = this.director.respawnPolicyFor(id);
    if (policy === "hold_until_end") {
      // SPEC-0016: morte processada, mas o respawn fica em espera — o evento ativo libera
      // todos os `waitingRespawn` juntos, no mesmo tick, ao terminar (T-066).
      p.waitingRespawn = true;
      // T-066: segurado fica fora do jogo — congela input/tiro no local da morte (o handler
      // de "input" também ignora mensagens enquanto `waitingRespawn`).
      p.inputX = 0;
      p.inputZ = 0;
      p.firing = false;
      this.emitDebug("respawn_held", { playerId: id, killerId: killerByVictim.get(id) ?? null });
      console.log(`[arena] ${p.name} morreu e aguarda o fim do evento.`);
      return;
    }

    const spawn = policy === "inside_zone" ? this.pickZoneSpawnPoint() : this.pickRespawnPoint(id);
    this.respawnPlayer(id, p, spawn, now, killerByVictim.get(id) ?? null);
  }

  /**
   * SPEC-0016 (T-066): libera TODOS os `waitingRespawn` no MESMO tick — chamado pelo evento
   * ativo ("hold_until_end") ao entrar em "ending". Respawn default (spawn seguro +
   * spawn protection normal), exatamente como uma morte comum liberaria. Devolve quantos
   * liberou (o `holdCount` da telemetria `event_end`). Público: faz parte do `EventRoom`.
   */
  releaseHeldRespawns(now: number): number {
    let released = 0;
    this.state.players.forEach((p, id) => {
      if (!p.waitingRespawn) return;
      released += 1;
      this.respawnPlayer(id, p, this.pickRespawnPoint(id), now, null);
    });
    return released;
  }

  /** SPEC-0016 (T-065): respawn em si, extraído pra ser reutilizável tanto pelo caminho
   * "default"/"inside_zone" (chamado direto de `handleDeath`) quanto pela liberação em massa
   * de `waitingRespawn` ao fim de um evento "hold_until_end" (T-066). */
  private respawnPlayer(
    id: string,
    p: Player,
    spawn: { x: number; z: number },
    now: number,
    killerId: string | null = null
  ) {
    p.x = spawn.x;
    p.z = spawn.z;
    p.hp = p.maxHp;
    p.inputX = 0;
    p.inputZ = 0;
    p.firing = false;
    p.spawnProtectedUntil = now + SPAWN_PROTECTION_MS; // SPEC-0005: imune ao renascer
    p.waitingRespawn = false;

    this.emitDebug("respawn", {
      playerId: id,
      killerId,
      levelAfter: p.level,
      x: spawn.x,
      z: spawn.z,
    });
    console.log(`[arena] ${p.name} morreu. Respawn no nível ${p.level} em (${spawn.x}, ${spawn.z}).`);
  }

  /** XP → nível → oferta de cards (T-003/T-016). Loop cobre XP suficiente p/ vários níveis de uma vez.
   * Público desde a T-066 (SPEC-0016): bônus de evento (`EventRoom.grantXp`) usa o pipeline completo. */
  grantXp(id: string, p: Player, amount: number) {
    p.xp += amount * p.xpMult * this.xpMultiplier; // xp_boost (farm_event) dobra o ganho — T-004

    while (p.xp >= xpToNext(p.level)) {
      p.xp -= xpToNext(p.level);
      p.level += 1;
      // T-016: os 3 pts do nível agora vêm de ESCOLHA (cards); timeout → auto-pick
      // equilibrado (mesmo preset de antes — quem ignora o menu evolui igual à v1).
      this.queueUpgradeOffer(id, p);
    }
  }

  /** T-016: um level-up = uma oferta na fila; a primeira abre na hora, o resto espera resolução. */
  private queueUpgradeOffer(id: string, p: Player) {
    let pending = this.pendingUpgrade.get(id);
    if (!pending) {
      pending = { levels: [], cards: [], expiresAt: 0 };
      this.pendingUpgrade.set(id, pending);
    }
    pending.levels.push(p.level);
    p.pendingUpgrades = pending.levels.length;
    if (pending.levels.length === 1) this.sendUpgradeOffer(id, p, pending);
  }

  private sendUpgradeOffer(id: string, p: Player, pending: { levels: number[]; cards: UpgradeCard[]; expiresAt: number }) {
    pending.expiresAt = Date.now() + UPGRADE_CHOICE_TIMEOUT_MS;
    const level = pending.levels[0];
    pending.cards = this.buildCards(p, level);
    const client = this.clients.find((c) => c.sessionId === id);
    client?.send("upgrade_offer", {
      level,
      cards: pending.cards,
      timeoutMs: UPGRADE_CHOICE_TIMEOUT_MS,
    });
    this.emitTelemetry({
      ...this.telemetryBase(),
      type: "upgrade_offer",
      playerToken: p.playerToken,
      level,
      offeredCardIds: pending.cards.map((c) => c.id),
    });
  }

  /**
   * T-017/addendum: nos marcos (`SKILL_MILESTONE_LEVELS`, mais frequentes que o 4/8/12
   * original) a oferta vira [skill, atributo, atributo] — a skill é uma opção a mais, não
   * força escolher entre 2 skills. Skill do marco já possuída é substituída pela próxima
   * que falte; sem skill faltando, a oferta volta a ser só de atributos.
   */
  private buildCards(p: Player, level: number): UpgradeCard[] {
    const attrCards = upgradeCardsForLevel(level);
    if (!SKILL_MILESTONE_LEVELS.includes(level)) return attrCards;

    const owned = new Set(Array.from(p.skills));
    const missing = Object.keys(SKILLS).filter((s) => !owned.has(s));
    if (missing.length === 0) return attrCards;

    const preferred = SKILL_MILESTONE_SKILL[level];
    const skillId = preferred && !owned.has(preferred) ? preferred : missing[0];
    const skillCard: UpgradeCard = {
      id: `skill_${skillId}`,
      label: `★ ${SKILLS[skillId].name} — ${SKILLS[skillId].desc}`,
      points: {},
      skill: skillId,
    };
    return [skillCard, attrCards[0], attrCards[1]];
  }

  /**
   * T-016: aplica a escolha (ou o auto-pick, com `cardId = null` no timeout).
   * Escolha inválida (card fora da oferta / sem oferta aberta) é ignorada SEM
   * consumir a oferta — cliente malicioso não ganha nada tentando.
   */
  private resolveUpgrade(id: string, p: Player, cardId: string | null, now: number) {
    const pending = this.pendingUpgrade.get(id);
    if (!pending || pending.levels.length === 0) return;
    const level = pending.levels[0];
    // T-017: valida contra a oferta REAL enviada (pending.cards) — nunca recomputa
    // Bug corrigido: desde que a oferta passou a ser sorteada (constants.ts:149-153),
    // "equilibrado" nem sempre está entre as 3 cartas oferecidas — usar UPGRADE_AUTO_PICK
    // direto no timeout podia aplicar uma carta que o jogador nunca viu na tela. Auto-pick
    // agora sempre resolve para uma carta que estava de fato na oferta: prefere "equilibrado"
    // quando ele foi sorteado (mantém o preset de sempre) e cai pra uma sorteada entre as
    // oferecidas quando não foi (continua "sem política" — nenhuma carta é favorecida).
    const card: UpgradeCard | undefined =
      cardId === null
        ? pending.cards.find((c) => c.id === UPGRADE_AUTO_PICK.id) ??
          pending.cards[Math.floor(Math.random() * pending.cards.length)]
        : pending.cards.find((c) => c.id === cardId);
    if (!card) return;

    pending.levels.shift();
    p.pendingUpgrades = pending.levels.length;
    if (card.skill) {
      // T-017: card de marco concede a skill (idempotente — nunca duplica)
      if (!p.skills.includes(card.skill)) p.skills.push(card.skill);
    } else {
      this.effects.addAttrPoints(id, p, card.points);
    }
    this.emitDebug("upgrade", { playerId: id, level, cardId: card.id, auto: cardId === null });
    this.clients.find((c) => c.sessionId === id)?.send("upgrade_applied", {
      cardId: card.id,
      label: card.label,
      level,
      auto: cardId === null,
    });
    this.emitTelemetry({
      ...this.telemetryBase(),
      type: "upgrade_choice",
      playerToken: p.playerToken,
      level,
      chosenCardId: card.id,
      declinedCardIds: pending.cards.filter((c) => c.id !== card.id).map((c) => c.id),
      autoPick: cardId === null,
    });

    if (pending.levels.length > 0) this.sendUpgradeOffer(id, p, pending);
    else this.pendingUpgrade.delete(id);
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

  /**
   * `forceKind` presente (SPEC-0010) = spawn direto desse kind (recursos de vida têm passe
   * próprio, sem peso de zona). Ausente = caminho original: sorteia pelo peso da zona.
   */
  private createCollectible(x: number, z: number, forceKind?: CollectibleKind, weaponId?: string) {
    const zone = zoneAt(this.map, x, z);
    const weights = zone === "safe" ? SAFE_WEIGHTS : zone === "war" ? WAR_WEIGHTS : FIELD_WEIGHTS;
    const kind = forceKind ?? pickWeighted(Math.random, weights);
    const c = new Collectible();
    c.x = x;
    c.z = z;
    c.kind = kind;
    // SPEC-0011 (T-039): só a arma carrega qual lançador concede (sorteado no spawn).
    if (kind === "weapon" && weaponId) c.weaponId = weaponId;
    const id = `c${this.collectibleSeq++}`;
    this.state.collectibles.set(id, c);
    this.emitDebug("spawn", { id, x, z, kind, zone, weaponId: c.weaponId || undefined });
    if (kind === "farm_event") this.broadcast("announce", { kind: "farm_event", x, z });
  }

  /** Público desde a T-065 (SPEC-0016) pelo mesmo motivo de `emitTelemetry` acima. */
  emitDebug(type: string, payload: any) {
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
