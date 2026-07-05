import type { ActionKind, DecisionResult, Perception, Personality } from "./types";

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

// Margem de inércia (bot-architecture.md §3): só troca de ação se a nova superar a atual
// por essa margem — evita oscilação de decisão a cada tick.
const SWITCH_MARGIN = 0.08;

/** T-021: sentinela de targetId da bandeira — não é um id de entidade real (só 1 por room). */
export const FLAG_TARGET_ID = "flag";

/**
 * Camada 3 — Decisão (Utility AI). Função PURA: snapshot → escolha (testável isolada).
 * Cada ação candidata recebe um escore = produto de considerações normalizadas 0..1.
 * `nivel_alvo`/`vantagem_build` do doc são combinados aqui numa única `advantageConf`
 * (simplificação de V1; calibrar com telemetria real na T-026 antes de separar de novo).
 */
export function decide(perception: Perception, personality: Personality, prevAction: ActionKind | null): DecisionResult {
  const { self, enemies, collectibles, flag } = perception;
  const hpFrac = self.maxHp > 0 ? clamp01(self.hp / self.maxHp) : 0;

  const nearestFightable = enemies.find((e) => e.zone !== "safe");
  const nearestEnemy = enemies[0];

  let engageScore = 0;
  let engageTargetId: string | undefined;
  if (nearestFightable) {
    const distConf = clamp01(1 - nearestFightable.dist / personality.engageRange);
    const advantageConf = clamp01(0.5 + 0.12 * (self.level - nearestFightable.level));
    engageScore = personality.aggression * hpFrac * distConf * advantageConf;
    engageTargetId = nearestFightable.id;
  }

  let fleeScore = 0;
  if (nearestEnemy) {
    const threatConf = clamp01(1 - nearestEnemy.dist / (personality.engageRange * 1.6));
    fleeScore = personality.caution * (1 - hpFrac) * threatConf;
  }

  let collectScore = 0;
  let collectTargetId: string | undefined;
  const nearestCollectible = collectibles[0];
  if (nearestCollectible) {
    const distConf = 1 / (1 + nearestCollectible.dist * 0.15);
    collectScore = personality.greed * distConf;
    collectTargetId = nearestCollectible.id;
  }

  const wanderScore = personality.wander * 0.2; // piso sempre disponível (fallback nunca-vazio)

  // T-021 (bot-architecture.md §3): score(disputar_bandeira) = W_objetivo × conf(dist) × conf(risco_zona).
  // Carregando a própria bandeira não há o que "disputar" — as outras ações cuidam do resto.
  let flagScore = 0;
  if (flag && !flag.carriedBySelf) {
    const distConf = clamp01(1 - flag.dist / (personality.engageRange * 1.6));
    const riskConf = flag.zone === "war" ? 0.7 : flag.zone === "safe" ? 1 : 0.85;
    flagScore = personality.objective * distConf * riskConf;
  }

  const scores: Record<ActionKind, number> = {
    engage: engageScore,
    flee: fleeScore,
    collect: collectScore,
    wander: wanderScore,
    flag: flagScore,
  };

  let bestAction: ActionKind = "wander";
  let bestScore = -Infinity;
  for (const action of Object.keys(scores) as ActionKind[]) {
    const inertiaBonus = action === prevAction ? SWITCH_MARGIN : 0;
    const effective = scores[action] + inertiaBonus;
    if (effective > bestScore) {
      bestScore = effective;
      bestAction = action;
    }
  }

  const targetId =
    bestAction === "engage"
      ? engageTargetId
      : bestAction === "collect"
      ? collectTargetId
      : bestAction === "flag"
      ? FLAG_TARGET_ID
      : undefined;
  return { action: bestAction, targetId, scores };
}
