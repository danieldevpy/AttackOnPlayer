import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema";
import { CLASS_REGISTRY, DEFAULT_CLASS_ID } from "@aop/shared";

export class Player extends Schema {
  @type("string") name = "player";
  @type("string") classId = DEFAULT_CLASS_ID; // T-052 (SPEC-0014): join valida contra CLASS_REGISTRY, nunca rejeita
  @type("string") skinId = CLASS_REGISTRY[DEFAULT_CLASS_ID].skinIds[0]; // T-052: paleta dentro da classe (T-056 expande)
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
  @type("number") damageTakenMult = 1; // SPEC-0010 (T-035): <1 = escudo temporário reduz dano recebido
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
  // SPEC-0016 (T-065): morte processada (nível zerado etc.) mas respawn SEGURO até o evento
  // ativo liberar (política "hold_until_end") — sem evento, nunca setado (fica sempre false).
  @type("boolean") waitingRespawn = false;

  // não sincronizado (uso interno do servidor)
  inputX = 0;
  inputZ = 0;
  playerToken = ""; // T-004b: ADR-012
  accountId = ""; // T-028b: sub do JWT verificado (conta) — "" = guest; nunca poder in-round
  firing = false; // T-010: gatilho — direção do tiro vem de `dir` (facing), não do input
  lastFireAt = 0; // T-005
}

export class Flag extends Schema {
  @type("number") x = 0;
  @type("number") z = 0;
  @type("string") carrierId = ""; // "" = ninguém carrega (T-021)
  // SPEC-0011 (T-042): "active" = no jogo (livre ou carregada); "cooldown" = fora do jogo
  // (invisível, sem pickup) por FLAG_COOLDOWN_MS antes de renascer no centro. O cliente usa
  // pra esconder o mesh e trocar o feedback (acesa vs. fora do mapa).
  @type("string") state = "active"; // FlagState (@aop/shared)
}

export class Collectible extends Schema {
  @type("number") x = 0;
  @type("number") z = 0;
  @type("string") kind = "xp_orb"; // xp_orb | speed_up | coin_buff | farm_event | box | hp_orb | shield_temp | weapon
  // SPEC-0011 (T-039): só o kind "weapon" preenche — qual lançador a arma concede, definido
  // NO SPAWN (sorteio entre os vantajosos). Vazio para todos os outros kinds. O cliente lê
  // isto para desenhar a arma certa; a coleta troca `player.launcher` por este valor.
  @type("string") weaponId = "";
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

// SPEC-0016 (T-065): estado sincronizado do evento de sessão ativo (Event Director). "" em
// `id`/`phase="idle"` = nenhum evento rodando — o cliente não desmonta nada até ver "idle"
// explícito. `zoneX/zoneZ/zoneRadius` só têm sentido pra eventos espaciais (0 = não usa).
export class ActiveEvent extends Schema {
  @type("string") id = ""; // "" = idle (sem evento)
  @type("string") phase = "idle"; // idle | warning | active | ending
  @type("number") phaseEndsAt = 0; // timestamp ms — cliente deriva countdown/progresso
  @type("number") zoneX = 0;
  @type("number") zoneZ = 0;
  @type("number") zoneRadius = 0; // raio atual (server interpola; cliente só desenha)
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
  @type(ActiveEvent) event = new ActiveEvent(); // SPEC-0016 (T-065)
}
