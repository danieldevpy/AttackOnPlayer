// ADR-009: atributo efetivo = base × efeitos ativos, sempre no servidor.
// T-003: atributos de nível (força/velocidade/vitalidade) entram como camada
// PERMANENTE do round no mesmo pipeline — nunca lógica de atributo solta no Room.
// T-015 (SPEC-0004/ADR-013): atributos viram tabela data-driven (ATTR_DEFS, 5 atributos
// com valor/pt e teto próprios) — inclui cadência (cooldown) e alcance (range).
import { ArraySchema } from "@colyseus/schema";
import { Player } from "../state/ArenaState";
import {
  SPEED_BOOST_MULT,
  SPEED_BOOST_MS,
  SPEED_MAX_MULT,
  XP_BOOST_MULT,
  XP_BOOST_MS,
  ATTR_POINTS_PER_LEVEL_EACH,
  PLAYER_BASE_HP,
  attrMult,
  AttrKey,
  KILL_RUSH_MULT,
  KILL_RUSH_MS,
} from "@aop/shared";

export type EffectKind = "speed_up" | "xp_boost" | "launcher_slow" | "kill_rush";

interface ActiveEffect {
  kind: EffectKind;
  expiresAt: number;
  magnitude?: number; // T-012: multiplicador dinâmico (ex.: lentidão por lançador) — kinds de valor fixo ignoram
}

export type AttrPoints = Record<AttrKey, number>;

interface PlayerEffectState {
  active: ActiveEffect[];
  attr: AttrPoints;
}

const DURATION: Record<EffectKind, number> = {
  speed_up: SPEED_BOOST_MS,
  xp_boost: XP_BOOST_MS, // farm_event (T-004)
  launcher_slow: 0, // não usado — duração vem do LauncherDef via applySlow()
  kill_rush: KILL_RUSH_MS, // T-017: skill impulso — boost curto ao matar
};

function zeroAttr(): AttrPoints {
  return { forca: 0, vitalidade: 0, agilidade: 0, cadencia: 0, alcance: 0 };
}

export class EffectSystem {
  private byPlayer = new Map<string, PlayerEffectState>();

  private stateFor(playerId: string): PlayerEffectState {
    let s = this.byPlayer.get(playerId);
    if (!s) {
      s = { active: [], attr: zeroAttr() };
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

  /**
   * T-012: gancho de mobilidade por lançador — lentidão temporária com magnitude/duração
   * vindas do próprio `LauncherDef.movement`, não de uma constante fixa. `factor >= 1` ou
   * `durationMs <= 0` é neutro (não aplica nada) — cobre o default de `basic_shot`.
   */
  applySlow(playerId: string, player: Player, factor: number, durationMs: number, now: number) {
    if (factor >= 1 || durationMs <= 0) return;
    const s = this.stateFor(playerId);
    const existing = s.active.find((e) => e.kind === "launcher_slow");
    if (existing) {
      existing.expiresAt = now + durationMs;
      existing.magnitude = factor;
    } else {
      s.active.push({ kind: "launcher_slow", expiresAt: now + durationMs, magnitude: factor });
    }
    this.recompute(player, s);
  }

  /** Soma pontos de atributo permanentes do round (level-up, cards e box chamam isto — T-003/T-004/T-016). */
  addAttrPoints(playerId: string, player: Player, points: Partial<AttrPoints>) {
    const s = this.stateFor(playerId);
    (Object.keys(points) as AttrKey[]).forEach((k) => {
      s.attr[k] += points[k] ?? 0;
    });
    this.recompute(player, s);
  }

  /** Coins compram isto (T-004): redistribui o TOTAL de pontos já ganho entre os 5 atributos (T-015). */
  rerollAttrPoints(playerId: string, player: Player) {
    const s = this.stateFor(playerId);
    const keys = Object.keys(s.attr) as AttrKey[];
    const total = keys.reduce((sum, k) => sum + s.attr[k], 0);
    // n−1 cortes ordenados dividem o total em n fatias; piso + distribuição do resto
    // garante soma EXATA e nenhuma fatia negativa (Math.round podia estourar o total).
    const cuts = Array.from({ length: keys.length - 1 }, () => Math.random()).sort((a, b) => a - b);
    const bounds = [0, ...cuts, 1];
    const next = zeroAttr();
    let used = 0;
    keys.forEach((k, i) => {
      const share = Math.floor(total * (bounds[i + 1] - bounds[i]));
      next[k] = share;
      used += share;
    });
    for (let i = 0; used < total; i = (i + 1) % keys.length) {
      next[keys[i]] += 1;
      used += 1;
    }
    s.attr = next;
    this.recompute(player, s);
  }

  /**
   * Reseta atributos para o preset equilibrado do nível (T-006: morte). Perde
   * customizações (rerolls/cards) do round; cadência/alcance zeram — só voltam
   * por escolha (T-016). Pilar "risco real": a build é o que se perde ao morrer.
   */
  resetAttrToLevel(playerId: string, player: Player, level: number) {
    const s = this.stateFor(playerId);
    const points = (level - 1) * ATTR_POINTS_PER_LEVEL_EACH;
    s.attr = { ...zeroAttr(), forca: points, vitalidade: points, agilidade: points };
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

  /** Cópia dos pontos atuais (testes e painel debug F3 — nunca usar para lógica de jogo no Room). */
  attrPointsFor(playerId: string): AttrPoints {
    return { ...this.stateFor(playerId).attr };
  }

  private recompute(player: Player, s: PlayerEffectState) {
    // T-015: cada atributo com valor/pt e teto próprios (ATTR_DEFS) — escala assimétrica ADR-013
    let speed = attrMult("agilidade", s.attr.agilidade);
    if (s.active.some((e) => e.kind === "speed_up")) speed *= SPEED_BOOST_MULT;
    if (s.active.some((e) => e.kind === "kill_rush")) speed *= KILL_RUSH_MULT; // T-017: impulso
    speed = Math.min(speed, SPEED_MAX_MULT);
    // T-012: lentidão de lançador se aplica por cima do teto — reduz o efetivo, não o disputa
    const slow = s.active.find((e) => e.kind === "launcher_slow");
    if (slow?.magnitude) speed *= slow.magnitude;
    player.speed = speed;
    player.strength = attrMult("forca", s.attr.forca);
    player.vitality = attrMult("vitalidade", s.attr.vitalidade);
    player.attackSpeed = attrMult("cadencia", s.attr.cadencia); // <1 = cooldown menor (T-015)
    player.reach = attrMult("alcance", s.attr.alcance); // >1 = projétil vai mais longe (T-015)
    player.maxHp = Math.round(PLAYER_BASE_HP * player.vitality);
    player.hp = Math.min(player.hp, player.maxHp);
    player.xpMult = s.active.some((e) => e.kind === "xp_boost") ? XP_BOOST_MULT : 1;
    player.effects = new ArraySchema<string>(...s.active.map((e) => e.kind));
  }
}
