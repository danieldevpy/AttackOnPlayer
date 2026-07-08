// SPEC-0016 (T-065): contratos da camada de eventos de sessão (Event Director + plugins).
// Tudo aqui é genérico — nenhum tipo conhece Battle Royale (T-066) ou qualquer evento
// específico; a arquitetura plugável depende disso (evento novo = arquivo novo + entrada no
// registry, zero mudança nestes contratos).
import { GameMap } from "@aop/shared";
import { ArenaState, Player } from "../../state/ArenaState";

/** Fases do ciclo de vida de um evento — sincronizadas no schema (`ArenaState.event.phase`). */
export type EventPhase = "idle" | "warning" | "active" | "ending";

/**
 * O que fazer com um player morto enquanto essa fase de evento está ativa. Sem evento ativo
 * (ou evento sem hook `respawnPolicy`), o Director SEMPRE devolve "default" — comportamento
 * atual intocado.
 */
export type RespawnPolicy = "default" | "inside_zone" | "hold_until_end";

/**
 * Contexto que o EventDirector monta a cada avaliação de elegibilidade. `minPlayers`,
 * cooldown próprio etc. NÃO entram aqui — cada evento decide sozinho dentro de
 * `checkEligibility` (regras de ativação são dados do evento, não do Director; spec §Arquitetura).
 */
export interface EligibilityContext {
  now: number;
  livingCount: number; // players vivos, bots inclusos
  positions: Array<{ id: string; x: number; z: number }>; // só dos vivos
  deathsPerMinute: number;
  lastEndedAt: number; // última vez que ESTE evento (por id) terminou; 0 = nunca rodou
  enabled: boolean; // reservado ao painel Django (T-071); sempre true até lá
}

/**
 * Superfície mínima que um evento (e o próprio Director) precisam da sala. `ArenaRoom`
 * satisfaz isto estruturalmente — este pacote nunca importa `rooms/ArenaRoom` (evita import
 * circular e mantém a camada de eventos isolada/plugável, mesmo espírito do ACI/ADR-018).
 */
export interface EventRoom {
  state: ArenaState;
  /** Mapa da sala + células alcançáveis (BFS pré-computado no onCreate) — eventos espaciais
   * (ex.: zona do Battle Royale) snapam centro/spawn em célula walkable com isto (T-066). */
  map: GameMap;
  reachable: Uint8Array;
  emitDebug(type: string, payload: any): void;
  emitTelemetry(event: any): void;
  /** Campos-base da telemetria (v/ts/tick/matchId) — todo emitTelemetry de evento espalha isto. */
  telemetryBase(): Record<string, any>;
  /** Broadcast Colyseus pra todos os clientes (ex.: `event_result` no fim do evento — T-067 lê). */
  broadcast(type: string, message?: any): void;
  /** XP pelo pipeline completo (multiplicadores, level-up, oferta de card) — bônus de evento. */
  grantXp(id: string, p: Player, amount: number): void;
  /** Libera TODOS os `waitingRespawn` no MESMO tick (respawn default + spawn protection);
   * devolve quantos liberou — é o `holdCount` da telemetria de fim de evento. */
  releaseHeldRespawns(now: number): number;
}

/**
 * Contrato de um evento plugável (SPEC-0016). Só `id`, `checkEligibility` e as durações de
 * fase são obrigatórios — o Director precisa das durações pra rodar a máquina de estados sem
 * conhecer nada específico do evento; os hooks de comportamento são todos opcionais.
 */
export interface EventDefinition {
  id: string;
  /** Peso na escolha entre múltiplos eventos elegíveis ao mesmo tempo (default 1). */
  weight?: number;
  warningMs: number;
  durationMs: number; // duração da fase "active"
  endingMs: number;

  /** Pode disparar agora? Chamado tanto na avaliação periódica quanto no gatilho manual (dev_event). */
  checkEligibility(ctx: EligibilityContext): boolean;

  onWarningStart?(room: EventRoom, now: number): void;
  onStart?(room: EventRoom, now: number): void;
  onTick?(room: EventRoom, dt: number, now: number): void;
  /** Chamado 1× na transição active→ending (timeout OU earlyEndCondition) — é aqui que o
   * evento resolve o RESULTADO (bônus, full-heal, liberação dos `waitingRespawn`), enquanto
   * a fase "ending" exibe o destaque; `onEnd` só fecha o ciclo (cleanup) ao voltar pra idle. */
  onEndingStart?(room: EventRoom, reason: string, now: number): void;
  onEnd?(room: EventRoom, reason: string, now: number): void;

  /** Consultado pelo pipeline de morte (`handleDeath`) antes do respawn. Sem hook, cai em "default". */
  respawnPolicy?(room: EventRoom, playerId: string, phase: EventPhase): RespawnPolicy;

  /** Motivo (string) pra encerrar a fase "active" antes do tempo, ou false/undefined pra deixar
   * correr até `durationMs`. */
  earlyEndCondition?(room: EventRoom, now: number): string | false | undefined;
}
