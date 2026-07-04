export const LAUNCHERS = {
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
