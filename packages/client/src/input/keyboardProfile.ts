import type { ControlProfile, Intent } from "./types";

/**
 * Perfil `keyboard` (ADR-015/SPEC-0006, T-019b): para notebook sem mouse. WASD move
 * (strafe, independe da mira); setas esquerda/direita giram a mira a uma velocidade
 * angular fixa. Sem nenhuma seta pressionada ainda nesta sessão, não há mira — o
 * facing cai no fallback do servidor (direção do movimento), como prevê o ADR-015.
 */
export class KeyboardControlProfile implements ControlProfile {
  readonly id = "keyboard";

  private static readonly ROTATE_SPEED = Math.PI * 1.4; // rad/s

  private keys = new Set<string>();
  private firing = false;
  private aimAngle = 0;
  private hasAim = false;
  private lastPollAt = performance.now();

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.key.toLowerCase());
    if (e.key === " ") {
      e.preventDefault();
      this.firing = true;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") e.preventDefault(); // não rolar a página
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
    if (e.key === " ") this.firing = false;
  };

  attach(): void {
    addEventListener("keydown", this.onKeyDown);
    addEventListener("keyup", this.onKeyUp);
    this.lastPollAt = performance.now();
  }

  detach(): void {
    removeEventListener("keydown", this.onKeyDown);
    removeEventListener("keyup", this.onKeyUp);
    this.keys.clear();
    this.firing = false;
  }

  poll(): Intent {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastPollAt) / 1000);
    this.lastPollAt = now;

    const moveX = (this.keys.has("d") ? 1 : 0) - (this.keys.has("a") ? 1 : 0);
    const moveZ = (this.keys.has("s") ? 1 : 0) - (this.keys.has("w") ? 1 : 0);

    if (this.keys.has("arrowleft")) {
      this.aimAngle -= KeyboardControlProfile.ROTATE_SPEED * dt;
      this.hasAim = true;
    }
    if (this.keys.has("arrowright")) {
      this.aimAngle += KeyboardControlProfile.ROTATE_SPEED * dt;
      this.hasAim = true;
    }

    let aimX: number | undefined;
    let aimZ: number | undefined;
    if (this.hasAim) {
      aimX = Math.cos(this.aimAngle);
      aimZ = Math.sin(this.aimAngle);
    }

    return { moveX, moveZ, aimX, aimZ, fire: this.firing };
  }
}
