import type { Vec2 } from "./types";

export interface SteeringInput {
  /** Vetor (não precisa ser normalizado) rumo ao objetivo; {0,0} = sem preferência (perambular). */
  desired: Vec2;
  /** -1..1 — componente perpendicular ao alvo (strafe orbital em duelo); 0 = nenhum. */
  lateralBias?: number;
  /** Perigo 0..1 amostrado para uma direção candidata (borda/prop/projétil). Deve ser barato. */
  danger: (dir: Vec2) => number;
  /** Nº de direções candidatas ao redor do bot (default 12). */
  directions?: number;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function angleDiff(a: number, b: number): number {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

/**
 * Camada 4 — Context steering. Função PURA: considera N direções candidatas ao redor do
 * bot, cada uma com interesse (aponta pro objetivo, ou pro flanco em duelo) e perigo
 * (borda/prop, via `danger`); move-se na melhor direção líquida. Resolve o esbarrão na
 * borda (P1) — o anti-stuck vira rede de segurança raramente acionada, não o mecanismo
 * primário. Sem alvo (desired={0,0}), evita perigo com leve preferência uniforme.
 */
export function steer(input: SteeringInput): Vec2 {
  const n = input.directions ?? 12;
  const desiredLen = Math.hypot(input.desired.x, input.desired.z);
  const desiredAngle = desiredLen > 1e-4 ? Math.atan2(input.desired.z, input.desired.x) : null;
  const lateral = input.lateralBias ?? 0;

  let bestDir: Vec2 = { x: 0, z: 0 };
  let bestScore = -Infinity;

  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2;
    const dir = { x: Math.cos(angle), z: Math.sin(angle) };

    let interest = 0.15; // sem alvo: leve preferência uniforme (perambular decide o resto fora daqui)
    if (desiredAngle !== null) {
      interest = Math.max(0, Math.cos(angleDiff(angle, desiredAngle)));
      if (lateral !== 0) {
        const orbitAngle = desiredAngle + (Math.PI / 2) * Math.sign(lateral);
        const orbitInterest = Math.max(0, Math.cos(angleDiff(angle, orbitAngle)));
        const w = clamp01(Math.abs(lateral));
        interest = interest * (1 - w) + orbitInterest * w;
      }
    }

    const danger = clamp01(input.danger(dir));
    const score = interest * (1 - danger) - danger * 0.5;
    if (score > bestScore) {
      bestScore = score;
      bestDir = dir;
    }
  }

  if (bestScore <= 0.02) return { x: 0, z: 0 }; // nada de bom em nenhuma direção — melhor não empurrar
  return bestDir;
}
