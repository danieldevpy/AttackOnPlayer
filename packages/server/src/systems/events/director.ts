// SPEC-0016 (T-065): EventDirector — observa a sessão e decide se/qual/quando disparar um
// evento (inspiração: AI Director de Left 4 Dead). Roda dentro do tick de `updateInner`, sem
// timer novo. Máquina de estados única por sala: idle → warning → active → ending → idle
// (o teto de "1 evento simultâneo" é automático — só existe 1 fase/1 evento ativo por vez).
import {
  DIRECTOR_EVAL_MS,
  DIRECTOR_TRIGGER_CHANCE,
  DIRECTOR_HOT_DEATHS_PER_MIN,
  DIRECTOR_FIRST_EVENT_AFTER_MS,
  EVENT_GLOBAL_COOLDOWN_MS,
  pickWeighted,
} from "@aop/shared";
import { EligibilityContext, EventDefinition, EventPhase, EventRoom, RespawnPolicy } from "./types";
import { EVENT_REGISTRY } from "./registry";

/**
 * Chance de disparo por avaliação, modulada pela "temperatura" da sessão (mortes/min):
 * sessão morna (poucas mortes) sobe até 2× a chance base; sessão quente cai até 0.5× ("logo
 * após pico, segura" — spec §Director). Curva contínua e monotônica, sem degrau; exportada
 * pura pra ser testável sem montar uma sala inteira.
 */
export function triggerChance(deathsPerMinute: number): number {
  const factor = Math.min(2, Math.max(0.5, 2 - deathsPerMinute / DIRECTOR_HOT_DEATHS_PER_MIN));
  return DIRECTOR_TRIGGER_CHANCE * factor;
}

export class EventDirector {
  private phase: EventPhase = "idle";
  private phaseEndsAt = 0;
  private activeId = "";
  private activeDef: EventDefinition | null = null;
  private pendingEndReason = "";
  private nextEvalAt = 0;
  private ownLastEndedAt = new Map<string, number>();
  // -Infinity (não 0): "nenhum evento terminou ainda" não pode ser confundido com "terminou
  // no instante 0" — senão o cooldown global bloquearia qualquer disparo nos primeiros
  // EVENT_GLOBAL_COOLDOWN_MS de vida da sala.
  private globalLastEndedAt = -Infinity;
  // Instante do primeiro tick da sala — base da garantia de primeira ativação
  // (DIRECTOR_FIRST_EVENT_AFTER_MS). -1 (não 0) = ainda não tickou — `now` pode ser
  // legitimamente 0 em teste, e um sentinela 0 seria re-setado no tick seguinte
  // (mesma classe de bug do `globalLastEndedAt` acima).
  private firstTickAt = -1;
  private deathTimestamps: number[] = [];
  // Cache do `room` do tick corrente — permite que `respawnPolicyFor` (chamado pelo pipeline
  // de morte, fora do `tick`) delegue ao hook do evento sem precisar receber `room` de novo.
  private room: EventRoom | null = null;

  constructor(private registry: Record<string, EventDefinition> = EVENT_REGISTRY) {}

  /** Chamado pelo pipeline de morte (`ArenaRoom.handleDeath`) — alimenta a "temperatura" da
   * sessão que modula a chance de disparo do Director. */
  recordDeath(now: number) {
    this.deathTimestamps.push(now);
    this.trimDeaths(now);
  }

  /** Consultado pelo pipeline de morte antes do respawn (T-065). Sem evento ativo, ou evento
   * sem hook `respawnPolicy`, devolve sempre "default" — comportamento atual intocado. */
  respawnPolicyFor(playerId: string): RespawnPolicy {
    if (this.phase === "idle" || !this.activeDef || !this.room) return "default";
    return this.activeDef.respawnPolicy?.(this.room, playerId, this.phase) ?? "default";
  }

  /** Roda a cada tick de `updateInner` — sem timer novo (spec §Director). */
  tick(room: EventRoom, dt: number, now: number) {
    this.room = room;
    if (this.firstTickAt < 0) this.firstTickAt = now;
    switch (this.phase) {
      case "idle":
        this.tickIdle(room, now);
        break;
      case "warning":
        this.tickWarning(room, dt, now);
        break;
      case "active":
        this.tickActive(room, dt, now);
        break;
      case "ending":
        this.tickEnding(room, now);
        break;
    }
  }

  /** Gatilho manual (mensagem `dev_event`, atrás de `DEBUG=1`) — ignora a avaliação periódica
   * e a chance probabilística, mas respeita elegibilidade e cooldowns como o caminho automático. */
  forceTrigger(eventId: string, room: EventRoom, now: number): { ok: true } | { ok: false; reason: string } {
    this.room = room;
    if (this.phase !== "idle") return { ok: false, reason: "event_in_progress" };
    const def = this.registry[eventId];
    if (!def) return { ok: false, reason: "unknown_event" };
    if (now < this.globalLastEndedAt + EVENT_GLOBAL_COOLDOWN_MS) return { ok: false, reason: "global_cooldown" };
    if (!def.checkEligibility(this.contextFor(def.id, room, now))) return { ok: false, reason: "not_eligible" };
    this.startWarning(def, room, now);
    return { ok: true };
  }

  private trimDeaths(now: number) {
    const cutoff = now - 60_000;
    while (this.deathTimestamps.length && this.deathTimestamps[0] < cutoff) this.deathTimestamps.shift();
  }

  private deathsPerMinute(now: number): number {
    this.trimDeaths(now);
    return this.deathTimestamps.length;
  }

  private tickIdle(room: EventRoom, now: number) {
    if (now < this.nextEvalAt) return;
    this.nextEvalAt = now + DIRECTOR_EVAL_MS;
    if (now < this.globalLastEndedAt + EVENT_GLOBAL_COOLDOWN_MS) return;

    const candidates = Object.values(this.registry).filter((def) =>
      def.checkEligibility(this.contextFor(def.id, room, now))
    );
    if (candidates.length === 0) return;

    // Primeira ativação determinística (pedido do CD): enquanto NENHUM evento rodou nesta
    // sala, o dado fica fora do jogo — o 1º minuto (DIRECTOR_FIRST_EVENT_AFTER_MS) é warm-up
    // sem evento, e o primeiro eval elegível depois disso dispara GARANTIDO. Quem sobe o
    // projeto pra testar vê o evento em ~1min, nem antes nem à mercê da sorte. Depois do 1º
    // evento (`globalLastEndedAt` setado), o ritmo probabilístico normal assume.
    if (this.globalLastEndedAt === -Infinity) {
      if (now < this.firstTickAt + DIRECTOR_FIRST_EVENT_AFTER_MS) return;
    } else if (Math.random() >= triggerChance(this.deathsPerMinute(now))) {
      return;
    }

    const weights: Array<[string, number]> = candidates.map((d) => [d.id, d.weight ?? 1]);
    const chosenId = pickWeighted(Math.random, weights);
    const chosen = candidates.find((d) => d.id === chosenId)!;
    this.startWarning(chosen, room, now);
  }

  private tickWarning(room: EventRoom, dt: number, now: number) {
    this.activeDef!.onWarningTick?.(room, dt, now);
    if (now >= this.phaseEndsAt) this.startActive(room, now);
  }

  private tickActive(room: EventRoom, dt: number, now: number) {
    const def = this.activeDef!;
    def.onTick?.(room, dt, now);
    const earlyReason = def.earlyEndCondition?.(room, now);
    if (earlyReason) {
      this.startEnding(room, now, earlyReason);
      return;
    }
    if (now >= this.phaseEndsAt) this.startEnding(room, now, "timeout");
  }

  private tickEnding(room: EventRoom, now: number) {
    if (now < this.phaseEndsAt) return;
    const def = this.activeDef!;
    def.onEnd?.(room, this.pendingEndReason, now);
    this.ownLastEndedAt.set(def.id, now);
    this.globalLastEndedAt = now;
    this.goIdle(room);
  }

  private startWarning(def: EventDefinition, room: EventRoom, now: number) {
    this.phase = "warning";
    this.activeId = def.id;
    this.activeDef = def;
    this.phaseEndsAt = now + def.warningMs;
    this.syncSchema(room);
    def.onWarningStart?.(room, now);
    room.emitDebug("event_phase", { id: def.id, phase: this.phase, phaseEndsAt: this.phaseEndsAt });
  }

  private startActive(room: EventRoom, now: number) {
    const def = this.activeDef!;
    this.phase = "active";
    this.phaseEndsAt = now + def.durationMs;
    this.syncSchema(room);
    def.onStart?.(room, now);
    room.emitDebug("event_phase", { id: def.id, phase: this.phase, phaseEndsAt: this.phaseEndsAt });
  }

  private startEnding(room: EventRoom, now: number, reason: string) {
    const def = this.activeDef!;
    this.phase = "ending";
    this.phaseEndsAt = now + def.endingMs;
    this.pendingEndReason = reason;
    this.syncSchema(room);
    def.onEndingStart?.(room, reason, now);
    room.emitDebug("event_phase", { id: def.id, phase: this.phase, phaseEndsAt: this.phaseEndsAt, reason });
  }

  private goIdle(room: EventRoom) {
    this.phase = "idle";
    this.activeId = "";
    this.activeDef = null;
    this.phaseEndsAt = 0;
    this.pendingEndReason = "";
    room.state.event.zoneX = 0;
    room.state.event.zoneZ = 0;
    room.state.event.zoneRadius = 0;
    this.syncSchema(room);
    room.emitDebug("event_phase", { id: "", phase: this.phase });
  }

  private syncSchema(room: EventRoom) {
    room.state.event.id = this.activeId;
    room.state.event.phase = this.phase;
    room.state.event.phaseEndsAt = this.phaseEndsAt;
  }

  private contextFor(eventId: string, room: EventRoom, now: number): EligibilityContext {
    let livingCount = 0;
    const positions: Array<{ id: string; x: number; z: number }> = [];
    room.state.players.forEach((p, id) => {
      if (p.hp <= 0) return;
      livingCount++;
      positions.push({ id, x: p.x, z: p.z });
    });
    return {
      now,
      livingCount,
      positions,
      deathsPerMinute: this.deathsPerMinute(now),
      lastEndedAt: this.ownLastEndedAt.get(eventId) ?? 0,
      enabled: true,
    };
  }
}
