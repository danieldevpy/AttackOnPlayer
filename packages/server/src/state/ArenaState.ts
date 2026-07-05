import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") name = "player";
  @type("number") x = 0;
  @type("number") z = 0;
  @type("number") level = 1;
  @type("number") xp = 0; // progresso dentro do nível atual (T-003)
  @type("number") coins = 0;
  @type("boolean") isBot = false;
  @type("number") speed = 1; // multiplicador efetivo (ADR-009) — servidor calcula
  @type("number") strength = 1; // multiplica dano (combat.md, T-005)
  @type("number") vitality = 1; // multiplica vida máxima (combat.md, T-006)
  @type("number") attackSpeed = 1; // T-015 (cadência): multiplica cooldown do lançador — <1 = atira mais rápido
  @type("number") reach = 1; // T-015 (alcance): multiplica range do projétil
  @type("number") xpMult = 1; // farm_event (T-004): XP em dobro por 20s
  @type(["string"]) effects = new ArraySchema<string>(); // kinds ativos, só p/ HUD
  @type("number") hp = 100; // T-005
  @type("number") maxHp = 100; // T-005
  @type("string") launcher = "basic_shot"; // T-005
  @type("number") dir = 0; // T-009: facing (rad), híbrido mira/movimento — nunca zera
  @type("number") pendingUpgrades = 0; // T-016: ofertas de card na fila (HUD mostra badge)
  @type(["string"]) skills = new ArraySchema<string>(); // T-017: skills de projétil do round (morte apaga)
  @type("number") spawnProtectedUntil = 0; // SPEC-0005: timestamp (ms) até quando é imune ao nascer/renascer
  @type("number") revealedUntil = 0; // T-023: timestamp (ms) até quando nameplate+HP ficam visíveis (reveal-on-hit)

  // não sincronizado (uso interno do servidor)
  inputX = 0;
  inputZ = 0;
  playerToken = ""; // T-004b: ADR-012
  firing = false; // T-010: gatilho — direção do tiro vem de `dir` (facing), não do input
  lastFireAt = 0; // T-005
}

export class Flag extends Schema {
  @type("number") x = 0;
  @type("number") z = 0;
  @type("string") carrierId = ""; // "" = ninguém carrega (T-021)
}

export class Collectible extends Schema {
  @type("number") x = 0;
  @type("number") z = 0;
  @type("string") kind = "xp_orb"; // xp_orb | speed_up | coin_buff | farm_event | box (T-004)
}

export class Projectile extends Schema {
  @type("number") x = 0;
  @type("number") z = 0;
  @type("string") launcherId = "";
  
  // uso interno
  dirX = 0;
  dirZ = 0;
  ownerId = "";
  distanceTraveled = 0;
  maxRange = 0; // T-015: range efetivo congelado no disparo (launcher.range × reach do atirador)
  damageMult = 1; // T-017: fator de dano das skills (ex.: tiro_duplo 0.65)
  pierceLeft = 0; // T-017: quantos alvos ainda atravessa
  speedMult = 1; // T-017: fator de velocidade das skills (ex.: fôlego 1.2)
  hitIds: string[] = []; // T-017: alvos já atingidos (pierce não re-acerta o mesmo alvo)
}

export class ArenaState extends Schema {
  // ADR-007: mapa definido por 3 números; cliente reconstrói com buildMap(w,h,seed)
  @type("number") mapW = 0;
  @type("number") mapH = 0;
  @type("number") mapSeed = 0;
  // T-024: não-vazio = mapa curado (arquivo); cliente/bots então esperam a mensagem
  // "map_data" (JSON completo) em vez de reconstruir por buildMap(mapW,mapH,mapSeed).
  @type("string") mapId = "";
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: Collectible }) collectibles = new MapSchema<Collectible>();
  @type({ map: Projectile }) projectiles = new MapSchema<Projectile>();
  @type("boolean") flagEnabled = true; // T-021: toggle por room (default ON)
  @type(Flag) flag = new Flag();
}
