import type { ControlProfile, Intent } from "./types";

/**
 * Perfil `keyboard` (ADR-015/SPEC-0006, T-019b): para notebook sem mouse. Controle
 * "tanque": W/S avançam/recuam na direção da rotação do jogador, A/D fazem strafe
 * lateral relativo a ela; setas esquerda/direita giram a rotação a uma velocidade
 * angular fixa. A rotação é o estado central do perfil, então a mira é enviada em
 * todo tick (sem ela o facing por movimento do servidor viraria o boneco ao recuar).
 */
export class KeyboardControlProfile implements ControlProfile {
  readonly id = "keyboard";

  private static readonly ROTATE_SPEED = Math.PI * 1.4; // rad/s

  private keys = new Set<string>();
  private firing = false;
  private aimAngle = -Math.PI / 2; // nasce olhando para "cima" da tela (−z)
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

    if (this.keys.has("arrowleft")) this.aimAngle -= KeyboardControlProfile.ROTATE_SPEED * dt;
    if (this.keys.has("arrowright")) this.aimAngle += KeyboardControlProfile.ROTATE_SPEED * dt;

    const forward = (this.keys.has("w") ? 1 : 0) - (this.keys.has("s") ? 1 : 0);
    const strafe = (this.keys.has("d") ? 1 : 0) - (this.keys.has("a") ? 1 : 0);

    const cos = Math.cos(this.aimAngle);
    const sin = Math.sin(this.aimAngle);
    const moveX = forward * cos - strafe * sin;
    const moveZ = forward * sin + strafe * cos;

    return { moveX, moveZ, aimX: cos, aimZ: sin, fire: this.firing };
  }
}
