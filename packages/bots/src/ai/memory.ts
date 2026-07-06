/**
 * Camada 2 (bot-architecture.md): curta e barata — só o alvo atual (com timestamp de
 * aquisição) e quem me bateu por último. Dá hysteresis (não troca de alvo a cada tick) e
 * permite desistência (abandona alvo sem progresso). Funções puras sobre estado explícito
 * — fáceis de testar, mesmo não sendo exigidas como puras pelo doc (só decision/steering são).
 */
export interface MemoryState {
  currentTargetId: string | null;
  targetAcquiredAt: number;
  lastDamagedBy: { id: string; t: number } | null;
}

export function initMemory(): MemoryState {
  return { currentTargetId: null, targetAcquiredAt: 0, lastDamagedBy: null };
}

/**
 * Reordena a lista (já ordenada por distância) pondo o alvo em memória na frente, se ainda
 * estiver na percepção (vivo, no raio) — dá hysteresis sem a decisão precisar saber de
 * memória. Se o alvo sumiu (morreu/saiu do raio), a lista volta como veio.
 */
export function applyStickiness<T extends { id: string }>(entities: T[], memory: MemoryState): T[] {
  if (!memory.currentTargetId) return entities;
  const idx = entities.findIndex((e) => e.id === memory.currentTargetId);
  if (idx <= 0) return entities;
  const sticky = entities[idx];
  return [sticky, ...entities.slice(0, idx), ...entities.slice(idx + 1)];
}

export function shouldGiveUp(memory: MemoryState, now: number, giveUpMs: number): boolean {
  return memory.currentTargetId !== null && now - memory.targetAcquiredAt > giveUpMs;
}

export function updateTarget(memory: MemoryState, targetId: string | undefined, now: number): void {
  if (!targetId) {
    memory.currentTargetId = null;
    return;
  }
  if (memory.currentTargetId !== targetId) {
    memory.currentTargetId = targetId;
    memory.targetAcquiredAt = now;
  }
}

export function recordDamage(memory: MemoryState, fromId: string, now: number): void {
  memory.lastDamagedBy = { id: fromId, t: now };
}
