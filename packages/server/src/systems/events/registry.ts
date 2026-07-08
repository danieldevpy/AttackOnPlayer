import { EventDefinition } from "./types";
import { BattleRoyaleEvent } from "./battleRoyale";

/**
 * SPEC-0016: catálogo dos eventos de sessão plugáveis. Um evento novo é sempre uma nova
 * entrada aqui (arquivo novo + linha nova) — zero mudança no `EventDirector` ou no `ArenaRoom`.
 * T-066 registrou o primeiro: Battle Royale relâmpago.
 */
export const EVENT_REGISTRY: Record<string, EventDefinition> = {
  [BattleRoyaleEvent.id]: BattleRoyaleEvent,
};
