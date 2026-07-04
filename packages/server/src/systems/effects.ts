// ADR-009: atributo efetivo = base × efeitos ativos, sempre no servidor.
// T-003: atributos de nível (força/velocidade/vitalidade) entram como camada
// PERMANENTE do round no mesmo pipeline — nunca lógica de atributo solta no Room.
import { ArraySchema } from "@colyseus/schema";
import { Player } from "../state/ArenaState";
import {
  SPEED_BOOST_MULT,
  SPEED_BOOST_MS,
  SPEED_MAX_MULT,
  ATTR_POINT_VALUE,
  XP_BOOST_MULT,
  XP_BOOST_MS,
  ATTR_POINTS_PER_LEVEL_EACH,
  PLAYER_BASE_HP,
} from "@aop/shared";

export type EffectKind = "speed_up" | "xp_boost";

interface ActiveEffect {
  kind: EffectKind;
  expiresAt: number;
}

interface AttrPoints {
  velocidade: number;
  forca: number;
  vitalidade: number;
}

interface PlayerEffectState {
  active: ActiveEffect[];
  attr: AttrPoints;
}

const DURATION: Record<EffectKind, number> = {
  speed_up: SPEED_BOOST_MS,
  xp_boost: XP_BOOST_MS, // farm_event (T-004)
};

export class EffectSystem {
  private byPlayer = new Map<string, PlayerEffectState>();

  private stateFor(playerId: string): PlayerEffectState {
    let s = this.byPlayer.get(playerId);
    if (!s) {
      s = { active: [], attr: { velocidade: 0, forca: 0, vitalidade: 0 } };
      this.byPlayer.set(playerId, s);
    }
    return s;
  }

  /** Aplica (ou renova) um efeito temporário e recalcula atributos. */
  apply(playerId: string, player: Player, kind: EffectKind, now: number) {
    const s = this.stateFor(playerId);
    const existing = s.active.find((e) => e.kind === kind);
    if (existing) existing.expiresAt = now + DURATION[kind];
    else s.active.push({ kind, expiresAt: now + DURATION[kind] });
    this.recompute(player, s);
  }

  /** Soma pontos de atributo permanentes do round (level-up e box chamam isto — T-003/T-004). */
  addAttrPoints(playerId: string, player: Player, points: Partial<AttrPoints>) {
    const s = this.stateFor(playerId);
    s.attr.velocidade += points.velocidade ?? 0;
    s.attr.forca += points.forca ?? 0;
    s.attr.vitalidade += points.vitalidade ?? 0;
    this.recompute(player, s);
  }

  /** Coins compram isto (T-004): redistribui o TOTAL de pontos já ganho entre os 3 atributos. */
  rerollAttrPoints(playerId: string, player: Player) {
    const s = this.stateFor(playerId);
    const total = s.attr.velocidade + s.attr.forca + s.attr.vitalidade;
    const cuts = [Math.random(), Math.random()].sort((a, b) => a - b);
    const velocidade = Math.round(total * cuts[0]);
    const forca = Math.round(total * (cuts[1] - cuts[0]));
    const vitalidade = total - velocidade - forca;
    s.attr = { velocidade, forca, vitalidade };
    this.recompute(player, s);
  }

  /** Reseta atributos para o padrão do nível (T-006: morte). Perde customizações (rerolls) do round. */
  resetAttrToLevel(playerId: string, player: Player, level: number) {
    const s = this.stateFor(playerId);
    const points = (level - 1) * ATTR_POINTS_PER_LEVEL_EACH;
    s.attr = { velocidade: points, forca: points, vitalidade: points };
    this.recompute(player, s);
  }

  /** Expira efeitos vencidos. Chamar a cada tick. */
  tick(players: { forEach(cb: (p: Player, id: string) => void): void }, now: number) {
    players.forEach((p, id) => {
      const s = this.byPlayer.get(id);
      if (!s || s.active.length === 0) return;
      const active = s.active.filter((e) => e.expiresAt > now);
      if (active.length !== s.active.length) {
        s.active = active;
        this.recompute(p, s);
      }
    });
  }

  clear(playerId: string) {
    this.byPlayer.delete(playerId);
  }

  private recompute(player: Player, s: PlayerEffectState) {
    let speed = 1 + s.attr.velocidade * ATTR_POINT_VALUE;
    if (s.active.some((e) => e.kind === "speed_up")) speed *= SPEED_BOOST_MULT;
    player.speed = Math.min(speed, SPEED_MAX_MULT);
    player.strength = 1 + s.attr.forca * ATTR_POINT_VALUE;
    player.vitality = 1 + s.attr.vitalidade * ATTR_POINT_VALUE;
    player.maxHp = Math.round(PLAYER_BASE_HP * player.vitality);
    player.hp = Math.min(player.hp, player.maxHp);
    player.xpMult = s.active.some((e) => e.kind === "xp_boost") ? XP_BOOST_MULT : 1;
    player.effects = new ArraySchema<string>(...s.active.map((e) => e.kind));
  }
}
