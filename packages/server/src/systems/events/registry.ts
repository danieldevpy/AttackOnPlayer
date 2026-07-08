import { EventDefinition } from "./types";

/**
 * SPEC-0016 (T-065): nasce vazio — a sala se comporta exatamente como hoje (nenhum evento
 * pode disparar, `EventDirector` fica sempre `idle`). A T-066 registra "battle_royale" aqui;
 * um evento novo é sempre uma nova entrada — zero mudança no `EventDirector` ou no `ArenaRoom`.
 */
export const EVENT_REGISTRY: Record<string, EventDefinition> = {};
