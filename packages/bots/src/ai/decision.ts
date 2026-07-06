import { auraEngageMult } from "./personality";
import type { ActionKind, DecisionResult, Perception, Personality } from "./types";

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** T-037: HP >= isto (~vida cheia) + inimigo percebido ⇒ coragem: parte pra cima do mais
 * próximo (engage vence farm/wander). Gate no scoring, não hack fora do utility. */
export const FULL_HP_COURAGE_FRAC = 0.9;

/** T-037: kinds de coletável que contam como "rota de cura" — fugir só é opção se um deles
 * for percebido (pra onde correr). hp_orb é a cura direta; box também pode conter cura. */
const HEAL_COLLECTIBLE_KINDS = new Set(["hp_orb", "box"]);

// Margem de inércia (bot-architecture.md §3): só troca de ação se a nova superar a atual
// por essa margem — evita oscilação de decisão a cada tick.
const SWITCH_MARGIN = 0.08;

/** T-021: sentinela de targetId da bandeira — não é um id de entidade real (só 1 por room). */
export const FLAG_TARGET_ID = "flag";

/** Nº máx. de inimigos avaliados como candidatos a engage (os mais próximos fora de safe). */
const ENGAGE_CANDIDATES = 4;

/** Bot encostado na borda (< isto) com ameaça no raio: parar de fugir e virar pra lutar. */
const CORNERED_BORDER_DIST = 3;

export interface DecideOptions {
  /** Viés determinístico por (bot, inimigo) ~0.8..1.2 — espalha os alvos entre os bots
   * ("compartilhar" a jogatina) em vez de todos travarem no mesmo inimigo mais próximo. */
  targetBias?: (enemyId: string) => number;
  /** Alvo atual em memória — pequeno bônus de hysteresis na avaliação por candidato. */
  stickyTargetId?: string | null;
}

/**
 * Camada 3 — Decisão (Utility AI). Função PURA: snapshot → escolha (testável isolada).
 * Cada ação candidata recebe um escore = produto de considerações normalizadas 0..1.
 * `nivel_alvo`/`vantagem_build` do doc são combinados aqui numa única `advantageConf`
 * (simplificação de V1; calibrar com telemetria real na T-026 antes de separar de novo).
 */
export function decide(
  perception: Perception,
  personality: Personality,
  prevAction: ActionKind | null,
  opts: DecideOptions = {}
): DecisionResult {
  const { self, enemies, collectibles, flag } = perception;
  const hpFrac = self.maxHp > 0 ? clamp01(self.hp / self.maxHp) : 0;

  const nearestFightable = enemies.find((e) => e.zone !== "safe");
  const nearestEnemy = enemies[0];

  // Portador inimigo da bandeira é um alvo de engage privilegiado (peso `objective`),
  // não uma perseguição à parte — disputar a bandeira É atirar em quem a carrega.
  const enemyCarrierId = flag && !flag.carriedBySelf ? flag.carrierId : undefined;

  // Engage avalia os N mais próximos (não só o primeiro): o viés por bot e o bônus de
  // portador podem eleger um alvo diferente pra cada bot — combates se distribuem.
  let engageScore = 0;
  let engageTargetId: string | undefined;
  const candidates = enemies.filter((e) => e.zone !== "safe").slice(0, ENGAGE_CANDIDATES);
  const carrier = enemyCarrierId ? enemies.find((e) => e.id === enemyCarrierId && e.zone !== "safe") : undefined;
  if (carrier && !candidates.includes(carrier)) candidates.push(carrier);
  for (const e of candidates) {
    // portador é objetivo de mapa: alcance de caça estendido, como era na ação `flag`
    const range = e.id === enemyCarrierId ? personality.engageRange * 1.6 : personality.engageRange;
    const distConf = clamp01(1 - e.dist / range);
    if (distConf <= 0) continue;
    // T-037: aura atrai ameaça — o alvo forte (banda mid/high) é FAMA e vale ser caçado
    // mesmo em desvantagem de nível: a banda impõe um PISO em advantageConf (senão o "não
    // ataco quem é mais forte" zeraria justo o alvo que a spec quer perigoso — a dor do CD).
    const auraFloor = auraEngageMult(e.level) - 1; // 0 (none) / 0.25 (mid) / 0.5 (high)
    const advantageConf = Math.max(auraFloor, clamp01(0.5 + 0.12 * (self.level - e.level)));
    const bias = opts.targetBias?.(e.id) ?? 1;
    const sticky = opts.stickyTargetId === e.id ? 1.15 : 1;
    const carrierBonus = e.id === enemyCarrierId ? 1 + personality.objective : 1;
    // Peso extra por aura, COM TETO (auraEngageMult, ×1.25/×1.5 no máx.). targetBias e
    // distConf seguem valendo: "alvo forte recebe mais atenção", nunca "todos contra um".
    const auraBonus = auraEngageMult(e.level);
    const score = personality.aggression * hpFrac * distConf * advantageConf * bias * sticky * carrierBonus * auraBonus;
    if (score > engageScore) {
      engageScore = score;
      engageTargetId = e.id;
    }
  }

  // T-037: fuga só com plano — só é opção se existe um coletável de CURA percebido para
  // onde correr (hp_orb / box). Sem rota de cura ⇒ não foge: luta (kite/desespero seguem
  // valendo na atuação). Combina com o HP baixo já embutido em (1 - hpFrac).
  const hasHealRoute = collectibles.some((c) => c.kind !== undefined && HEAL_COLLECTIBLE_KINDS.has(c.kind));
  let fleeScore = 0;
  if (nearestEnemy && hasHealRoute) {
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
  // Só para bandeira NO CHÃO — carregada por inimigo vira bônus de engage no portador
  // (acima); carregando a própria não há o que disputar.
  let flagScore = 0;
  if (flag && !flag.carriedBySelf && !flag.carrierId) {
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

  // T-037: coragem com vida cheia — HP >= ~90% e inimigo (fora de safe) percebido ⇒ parte
  // pra cima do mais próximo. Gate no scoring: engage vence farm/wander/flag, mas só quando
  // a ação escolhida seria passiva (não sobrescreve uma fuga real — que a vida cheia já
  // torna improvável). Um alvo forte parado NÃO fica em paz.
  if (
    hpFrac >= FULL_HP_COURAGE_FRAC &&
    nearestFightable &&
    (bestAction === "collect" || bestAction === "wander" || bestAction === "flag")
  ) {
    // usa o melhor alvo de engage já pontuado (respeita targetBias/aura/portador);
    // sem candidato pontuado (ex.: fora de todo range), cai no fightable mais próximo.
    bestAction = "engage";
    if (!engageTargetId) engageTargetId = nearestFightable.id;
  }

  // Encurralado (colado na borda, ameaça dentro do raio): fugir só esfrega na parede —
  // vira e luta, como um player faria. hpFrac não entra aqui de propósito: é briga de
  // desespero, não de vantagem.
  if (
    bestAction === "flee" &&
    nearestFightable &&
    perception.nearestBorderDist < CORNERED_BORDER_DIST &&
    nearestFightable.dist < personality.engageRange
  ) {
    bestAction = "engage";
    engageTargetId = nearestFightable.id;
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
