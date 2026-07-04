export interface LauncherDef {
  id: string;
  name: string;
  projectile: {
    speed: number;
    radius: number;
    range: number;
  };
  fire: {
    cooldownMs: number;
    pattern: "straight";
  };
  damage: number;
  onHitEffects: string[];
}

export const LAUNCHERS: Record<string, LauncherDef> = {
  basic_shot: {
    id: "basic_shot",
    name: "Tiro Básico",
    projectile: {
      speed: 12, // units per second
      radius: 0.4,
      range: 8,
    },
    fire: {
      cooldownMs: 600,
      pattern: "straight",
    },
    damage: 10,
    onHitEffects: [],
  },
};
