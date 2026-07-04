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
  @type("number") xpMult = 1; // farm_event (T-004): XP em dobro por 20s
  @type(["string"]) effects = new ArraySchema<string>(); // kinds ativos, só p/ HUD

  // não sincronizado (uso interno do servidor)
  inputX = 0;
  inputZ = 0;
}

export class Collectible extends Schema {
  @type("number") x = 0;
  @type("number") z = 0;
  @type("string") kind = "xp_orb"; // xp_orb | speed_up | coin_buff | farm_event | box (T-004)
}

export class ArenaState extends Schema {
  // ADR-007: mapa definido por 3 números; cliente reconstrói com buildMap(w,h,seed)
  @type("number") mapW = 0;
  @type("number") mapH = 0;
  @type("number") mapSeed = 0;
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: Collectible }) collectibles = new MapSchema<Collectible>();
}
