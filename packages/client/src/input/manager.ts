import type { ControlProfile } from "./types";
import { MouseControlProfile, MouseProfileDeps } from "./mouseProfile";
import { KeyboardControlProfile } from "./keyboardProfile";
import { TouchControlProfile, TouchProfileDeps } from "./touchProfile";

export type ProfileId = "mouse" | "keyboard" | "touch";
const STORAGE_KEY = "aop_profile";

export interface ProfileManagerDeps {
  mouse: MouseProfileDeps;
  touch: TouchProfileDeps;
  onChange(id: ProfileId): void;
}

/** Heurística de dispositivo touch (ADR-015) — reusada pelo layout mobile compacto do HUD
 * (immersion.ts), já que é o mesmo "isto é um celular/tablet?" que decide o perfil padrão. */
export function isCoarsePointerDevice(): boolean {
  const coarsePointer = matchMedia("(pointer: coarse)").matches;
  const hasTouch = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  return coarsePointer && hasTouch;
}

/** Auto-detecção (ADR-015): dispositivo majoritariamente touch vira perfil `touch`; o resto, `mouse`. */
function detectDefaultProfile(): ProfileId {
  return isCoarsePointerDevice() ? "touch" : "mouse";
}

export class ProfileManager {
  private current: ControlProfile;
  private currentId!: ProfileId;

  constructor(private deps: ProfileManagerDeps) {
    const stored = localStorage.getItem(STORAGE_KEY) as ProfileId | null;
    const initial = stored ?? detectDefaultProfile();
    this.current = this.build(initial);
    this.currentId = initial;
    this.current.attach();
    this.deps.onChange(initial);
  }

  private build(id: ProfileId): ControlProfile {
    if (id === "keyboard") return new KeyboardControlProfile();
    if (id === "touch") return new TouchControlProfile(this.deps.touch);
    return new MouseControlProfile(this.deps.mouse);
  }

  get id(): ProfileId {
    return this.currentId;
  }

  poll() {
    return this.current.poll();
  }

  /** Seletor manual (ADR-015) — troca em tempo real, sem reconectar. */
  select(id: ProfileId): void {
    if (id === this.currentId) return;
    this.current.detach();
    this.current = this.build(id);
    this.currentId = id;
    this.current.attach();
    localStorage.setItem(STORAGE_KEY, id);
    this.deps.onChange(id);
  }
}
