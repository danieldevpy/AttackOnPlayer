import type { ControlProfile, Intent } from "./types";

export interface TouchProfileDeps {
  moveBaseEl: HTMLElement;
  moveKnobEl: HTMLElement;
  aimBaseEl: HTMLElement;
  aimKnobEl: HTMLElement;
}

const STICK_RADIUS_PX = 45; // deve bater com o raio visual em index.html

interface StickState {
  pointerId: number | null;
  originX: number;
  originY: number;
  dx: number; // -1..1
  dy: number; // -1..1
}

function freshStick(): StickState {
  return { pointerId: null, originX: 0, originY: 0, dx: 0, dy: 0 };
}

/**
 * Perfil `touch` v1 (SPEC-0006/ADR-015, T-019b): twin-stick virtual — metade esquerda
 * da tela move, metade direita mira e atira (presença de toque = fire). Origem fixa no
 * centro da base visual; o vetor é a diferença toque-atual↔centro, limitada ao raio.
 * Sem aim (toque parado no centro), o servidor cai no fallback de facing por movimento.
 */
export class TouchControlProfile implements ControlProfile {
  readonly id = "touch";

  private move = freshStick();
  private aim = freshStick();

  constructor(private deps: TouchProfileDeps) {}

  private baseCenter(el: HTMLElement) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  private updateStick(stick: StickState, clientX: number, clientY: number, knobEl: HTMLElement) {
    let dx = clientX - stick.originX;
    let dy = clientY - stick.originY;
    const len = Math.hypot(dx, dy);
    if (len > STICK_RADIUS_PX) {
      dx = (dx / len) * STICK_RADIUS_PX;
      dy = (dy / len) * STICK_RADIUS_PX;
    }
    stick.dx = dx / STICK_RADIUS_PX;
    stick.dy = dy / STICK_RADIUS_PX;
    knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  private resetStick(stick: StickState, knobEl: HTMLElement) {
    stick.pointerId = null;
    stick.dx = 0;
    stick.dy = 0;
    knobEl.style.transform = "translate(0px, 0px)";
  }

  private onPointerDown = (e: PointerEvent) => {
    const isMove = e.clientX < innerWidth / 2;
    const stick = isMove ? this.move : this.aim;
    if (stick.pointerId !== null) return; // essa metade já tem um dedo
    e.preventDefault();
    const knobEl = isMove ? this.deps.moveKnobEl : this.deps.aimKnobEl;
    const baseEl = isMove ? this.deps.moveBaseEl : this.deps.aimBaseEl;
    stick.pointerId = e.pointerId;
    const c = this.baseCenter(baseEl);
    stick.originX = c.x;
    stick.originY = c.y;
    this.updateStick(stick, e.clientX, e.clientY, knobEl);
  };

  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerId === this.move.pointerId) {
      e.preventDefault();
      this.updateStick(this.move, e.clientX, e.clientY, this.deps.moveKnobEl);
    } else if (e.pointerId === this.aim.pointerId) {
      e.preventDefault();
      this.updateStick(this.aim, e.clientX, e.clientY, this.deps.aimKnobEl);
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerId === this.move.pointerId) this.resetStick(this.move, this.deps.moveKnobEl);
    else if (e.pointerId === this.aim.pointerId) this.resetStick(this.aim, this.deps.aimKnobEl);
  };

  attach(): void {
    addEventListener("pointerdown", this.onPointerDown, { passive: false });
    addEventListener("pointermove", this.onPointerMove, { passive: false });
    addEventListener("pointerup", this.onPointerUp);
    addEventListener("pointercancel", this.onPointerUp);
    document.body.classList.add("touch-profile");
  }

  detach(): void {
    removeEventListener("pointerdown", this.onPointerDown);
    removeEventListener("pointermove", this.onPointerMove);
    removeEventListener("pointerup", this.onPointerUp);
    removeEventListener("pointercancel", this.onPointerUp);
    document.body.classList.remove("touch-profile");
    this.resetStick(this.move, this.deps.moveKnobEl);
    this.resetStick(this.aim, this.deps.aimKnobEl);
  }

  poll(): Intent {
    const fire = this.aim.pointerId !== null;
    let aimX: number | undefined;
    let aimZ: number | undefined;
    if (fire && (this.aim.dx !== 0 || this.aim.dy !== 0)) {
      aimX = this.aim.dx;
      aimZ = this.aim.dy;
    }
    return { moveX: this.move.dx, moveZ: this.move.dy, aimX, aimZ, fire };
  }
}
