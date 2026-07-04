import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") name = "player";
  @type("number") x = 0;
  @type("number") z = 0;
  @type("number") level = 1;
  @type("boolean") isBot = false;
  @type("number") speed = 1; // multiplicador efetivo (ADR-009) — servidor calcula
  @type(["string"]) effects = new ArraySchema<string>(); // kinds ativos, só p/ HUD

  // não sincronizado (uso interno do servidor)
  inputX = 0;
  inputZ = 0;
}

export class Collectible extends Schema {
  @type("number") x = 0;
  @type("number") z = 0;
  @type("string") kind = "level_up"; // level_up | speed_up
}

export class ArenaState extends Schema {
  // ADR-007: mapa definido por 3 números; cliente reconstrói com buildMap(w,h,seed)
  @type("number") mapW = 0;
  @type("number") mapH = 0;
  @type("number") mapSeed = 0;
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: Collectible }) collectibles = new MapSchema<Collectible>();
}
