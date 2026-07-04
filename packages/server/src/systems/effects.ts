// ADR-009: atributo efetivo = base × efeitos ativos, sempre no servidor.
import { ArraySchema } from "@colyseus/schema";
import { Player } from "../state/ArenaState";
import { SPEED_BOOST_MULT, SPEED_BOOST_MS, SPEED_MAX_MULT } from "@aop/shared";

export type EffectKind = "speed_up";

interface ActiveEffect {
  kind: EffectKind;
  expiresAt: number;
}

const DURATION: Record<EffectKind, number> = {
  speed_up: SPEED_BOOST_MS,
};

export class EffectSystem {
  private byPlayer = new Map<string, ActiveEffect[]>();

  /** Aplica (ou renova) um efeito e recalcula atributos. */
  apply(playerId: string, player: Player, kind: EffectKind, now: number) {
    const list = this.byPlayer.get(playerId) ?? [];
    const existing = list.find((e) => e.kind === kind);
    if (existing) existing.expiresAt = now + DURATION[kind];
    else list.push({ kind, expiresAt: now + DURATION[kind] });
    this.byPlayer.set(playerId, list);
    this.recompute(player, list);
  }

  /** Expira efeitos vencidos. Chamar a cada tick. */
  tick(players: { forEach(cb: (p: Player, id: string) => void): void }, now: number) {
    players.forEach((p, id) => {
      const list = this.byPlayer.get(id);
      if (!list || list.length === 0) return;
      const active = list.filter((e) => e.expiresAt > now);
      if (active.length !== list.length) {
        this.byPlayer.set(id, active);
        this.recompute(p, active);
      }
    });
  }

  clear(playerId: string) {
    this.byPlayer.delete(playerId);
  }

  private recompute(player: Player, list: ActiveEffect[]) {
    let speed = 1;
    if (list.some((e) => e.kind === "speed_up")) speed *= SPEED_BOOST_MULT;
    player.speed = Math.min(speed, SPEED_MAX_MULT);
    player.effects = new ArraySchema<string>(...list.map((e) => e.kind));
  }
}
