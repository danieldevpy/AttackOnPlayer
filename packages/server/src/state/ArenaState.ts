import { Schema, MapSchema, type } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") name = "player";
  @type("number") x = 0;
  @type("number") z = 0;
  @type("number") level = 1;
  @type("boolean") isBot = false;

  // não sincronizado (uso interno do servidor)
  inputX = 0;
  inputZ = 0;
}

export class Collectible extends Schema {
  @type("number") x = 0;
  @type("number") z = 0;
  @type("string") kind = "stat_up";
}

export class ArenaState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: Collectible }) collectibles = new MapSchema<Collectible>();
}
