import * as THREE from "three";
import type { ControlProfile, Intent } from "./types";

export interface MouseProfileDeps {
  camera: THREE.Camera;
  crosshairEl: HTMLElement;
  getPlayerPos(): { x: number; z: number } | null;
}

/**
 * Perfil `mouse` (ADR-015 / SPEC-0006): WASD strafe (movimento não depende da mira) +
 * crosshair 360° via raycast do cursor no chão (y=0) + gatilho por clique/espaço.
 * A rotação/mira é atributo deste perfil — o servidor continua recebendo só
 * `{x,z,aimX?,aimZ?,fire?}` (contrato inalterado desde SPEC-0003).
 */
export class MouseControlProfile implements ControlProfile {
  readonly id = "mouse";

  private keys = new Set<string>();
  private firing = false;
  private mouseNdc = new THREE.Vector2(0, 0);
  private mouseInside = false;
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private hit = new THREE.Vector3();
  /** Último vetor de mira válido (para a câmera dar leve offset — main.ts). */
  lastAim: { x: number; z: number } | null = null;

  constructor(private deps: MouseProfileDeps) {}

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.key.toLowerCase());
    if (e.key === " ") {
      e.preventDefault(); // espaço não deve rolar a página
      this.firing = true;
    }
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
    if (e.key === " ") this.firing = false;
  };
  private onMouseDown = () => (this.firing = true);
  private onMouseUp = () => (this.firing = false);
  private onMouseMove = (e: MouseEvent) => {
    this.mouseNdc.x = (e.clientX / innerWidth) * 2 - 1;
    this.mouseNdc.y = -(e.clientY / innerHeight) * 2 + 1;
    this.mouseInside = true;
    this.deps.crosshairEl.style.left = `${e.clientX}px`;
    this.deps.crosshairEl.style.top = `${e.clientY}px`;
  };
  private onMouseLeave = () => {
    this.mouseInside = false;
  };

  attach(): void {
    addEventListener("keydown", this.onKeyDown);
    addEventListener("keyup", this.onKeyUp);
    addEventListener("mousedown", this.onMouseDown);
    addEventListener("mouseup", this.onMouseUp);
    addEventListener("mousemove", this.onMouseMove);
    addEventListener("mouseleave", this.onMouseLeave);
    document.body.classList.add("cursor-hidden");
    this.deps.crosshairEl.classList.add("active");
  }

  detach(): void {
    removeEventListener("keydown", this.onKeyDown);
    removeEventListener("keyup", this.onKeyUp);
    removeEventListener("mousedown", this.onMouseDown);
    removeEventListener("mouseup", this.onMouseUp);
    removeEventListener("mousemove", this.onMouseMove);
    removeEventListener("mouseleave", this.onMouseLeave);
    document.body.classList.remove("cursor-hidden");
    this.deps.crosshairEl.classList.remove("active");
    this.keys.clear();
    this.firing = false;
  }

  poll(): Intent {
    const moveX =
      (this.keys.has("d") || this.keys.has("arrowright") ? 1 : 0) -
      (this.keys.has("a") || this.keys.has("arrowleft") ? 1 : 0);
    const moveZ =
      (this.keys.has("s") || this.keys.has("arrowdown") ? 1 : 0) -
      (this.keys.has("w") || this.keys.has("arrowup") ? 1 : 0);

    let aimX: number | undefined;
    let aimZ: number | undefined;
    const pos = this.mouseInside ? this.deps.getPlayerPos() : null;
    if (pos) {
      this.raycaster.setFromCamera(this.mouseNdc, this.deps.camera);
      if (this.raycaster.ray.intersectPlane(this.groundPlane, this.hit)) {
        aimX = this.hit.x - pos.x;
        aimZ = this.hit.z - pos.z;
        this.lastAim = { x: aimX, z: aimZ };
      }
    }

    return { moveX, moveZ, aimX, aimZ, fire: this.firing };
  }
}
