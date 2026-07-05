import type { ActionKind, Personality, Vec2 } from "./types";

function randRange([lo, hi]: [number, number]): number {
  return lo + Math.random() * (hi - lo);
}

function shortestAngleDiff(from: number, to: number): number {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

/**
 * Camada 5 — Humanizador: suja a perfeição mecânica com os knobs do bot-architecture.md
 * (reactionMs, aimLerp+erro que decai, cadência com jitter, pausas de perambulação). Todo
 * estado é local a 1 instância por bot; não precisa ser puro (decision/steering são as
 * camadas testadas isoladas — ver decision.test.ts/steering.test.ts).
 */
export class Humanizer {
  private pendingAction: ActionKind | null = null;
  private acceptedAction: ActionKind | null = null;
  private reactionUntil = 0;

  private aimAngle: number | null = null;
  private aimErrorRad = 0;

  private nextFireAt = 0;

  private wanderDir: Vec2 = { x: 0, z: 0 };
  private wanderChangeAt = 0;
  private wanderPauseUntil = 0;

  constructor(private personality: Personality) {}

  /** Atraso de reação: só troca a ação "aceita" depois de reactionMs da mudança percebida. */
  reactToAction(action: ActionKind, now: number): ActionKind {
    if (action !== this.pendingAction) {
      this.pendingAction = action;
      this.reactionUntil = now + randRange(this.personality.reactionMsRange);
    }
    if (now >= this.reactionUntil) this.acceptedAction = this.pendingAction;
    return this.acceptedAction ?? action;
  }

  /** Mira persegue o ângulo ideal com lerp; erro decai enquanto o mesmo alvo é rastreado. */
  smoothAim(idealAngle: number, sameTarget: boolean): number {
    if (this.aimAngle === null || !sameTarget) {
      this.aimAngle = idealAngle;
      this.aimErrorRad = this.personality.aimErrorRad;
    } else {
      this.aimAngle += shortestAngleDiff(this.aimAngle, idealAngle) * this.personality.aimLerp;
      this.aimErrorRad *= 0.9; // decai enquanto rastreia — precisão não é constante
    }
    return this.aimAngle + (Math.random() * 2 - 1) * this.aimErrorRad;
  }

  /** Cadência com jitter (nunca 100% fixa — knob de personalidade, não só cooldown do lançador). */
  canFire(now: number): boolean {
    return now >= this.nextFireAt;
  }
  recordShot(now: number): void {
    this.nextFireAt = now + randRange(this.personality.fireIntervalMsRange);
  }

  /** Perambulação com pausas ("olha ao redor") em vez de vagar geométrico uniforme. */
  wanderVector(now: number): Vec2 {
    if (now < this.wanderPauseUntil) return { x: 0, z: 0 };
    if (now >= this.wanderChangeAt) {
      if (Math.random() < 0.25) {
        this.wanderPauseUntil = now + 400 + Math.random() * 800;
        this.wanderDir = { x: 0, z: 0 };
      } else {
        const angle = Math.random() * Math.PI * 2;
        this.wanderDir = { x: Math.cos(angle), z: Math.sin(angle) };
      }
      this.wanderChangeAt = now + 1500 + Math.random() * 2000;
    }
    return this.wanderDir;
  }
}
