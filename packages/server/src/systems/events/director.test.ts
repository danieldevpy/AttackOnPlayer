import { describe, it, expect, vi, afterEach } from "vitest";
import { EventDirector, triggerChance } from "./director";
import { EventDefinition, EventRoom } from "./types";
import { ArenaState } from "../../state/ArenaState";
import {
  DIRECTOR_EVAL_MS,
  DIRECTOR_TRIGGER_CHANCE,
  DIRECTOR_HOT_DEATHS_PER_MIN,
  DIRECTOR_FIRST_EVENT_AFTER_MS,
  EVENT_GLOBAL_COOLDOWN_MS,
  buildMap,
} from "@aop/shared";

/**
 * T-065 (SPEC-0016): EventDirector testado isolado, com um `EventRoom` fake mínimo — sem
 * subir um `ArenaRoom` inteiro. `EventDirector` recebe o registry por injeção (default é o
 * `EVENT_REGISTRY` real, vazio nesta task); os testes usam um evento fake pra exercitar a
 * máquina de estados sem depender do Battle Royale (T-066).
 */
function makeRoom(): EventRoom {
  // stubs dos membros que a T-066 adicionou ao contrato `EventRoom` — o Director em si não
  // usa nenhum deles (são superfície pros hooks dos eventos concretos).
  const map = buildMap(20, 20, 42);
  return {
    state: new ArenaState(),
    map,
    reachable: new Uint8Array(map.w * map.h),
    emitDebug() {},
    emitTelemetry() {},
    telemetryBase: () => ({}),
    broadcast() {},
    grantXp() {},
    releaseHeldRespawns: () => 0,
  };
}

function makeDef(overrides: Partial<EventDefinition> = {}): EventDefinition {
  return {
    id: "test_event",
    warningMs: 100,
    durationMs: 200,
    endingMs: 50,
    checkEligibility: () => true,
    ...overrides,
  };
}

describe("EventDirector — máquina de estados (T-065)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("forceTrigger percorre idle→warning→active→ending→idle nos tempos certos", () => {
    const def = makeDef();
    const director = new EventDirector({ test_event: def });
    const room = makeRoom();
    const now = 1_000;

    const res = director.forceTrigger("test_event", room, now);
    expect(res.ok).toBe(true);
    expect(room.state.event.phase).toBe("warning");
    expect(room.state.event.id).toBe("test_event");
    expect(room.state.event.phaseEndsAt).toBe(now + def.warningMs);

    // ainda dentro do warning: nenhuma transição
    director.tick(room, 0.05, now + 50);
    expect(room.state.event.phase).toBe("warning");

    director.tick(room, 0.05, now + def.warningMs);
    expect(room.state.event.phase).toBe("active");

    director.tick(room, 0.05, now + def.warningMs + 50);
    expect(room.state.event.phase).toBe("active");

    director.tick(room, 0.05, now + def.warningMs + def.durationMs);
    expect(room.state.event.phase).toBe("ending");

    director.tick(room, 0.05, now + def.warningMs + def.durationMs + def.endingMs);
    expect(room.state.event.phase).toBe("idle");
    expect(room.state.event.id).toBe("");
  });

  it("earlyEndCondition encerra a fase active antes do tempo, repassando o motivo pro onEnd", () => {
    let endedReason = "";
    const def = makeDef({
      earlyEndCondition: () => "last_survivor",
      onEnd: (_room, reason) => {
        endedReason = reason;
      },
    });
    const director = new EventDirector({ test_event: def });
    const room = makeRoom();
    const now = 1_000;

    director.forceTrigger("test_event", room, now);
    director.tick(room, 0.05, now + def.warningMs); // → active
    director.tick(room, 0.05, now + def.warningMs + 1); // earlyEndCondition avaliada aqui
    expect(room.state.event.phase).toBe("ending");

    director.tick(room, 0.05, now + def.warningMs + 1 + def.endingMs);
    expect(room.state.event.phase).toBe("idle");
    expect(endedReason).toBe("last_survivor");
  });

  it("cooldown global (EVENT_GLOBAL_COOLDOWN_MS) bloqueia um novo forceTrigger logo após o fim", () => {
    const def = makeDef();
    const director = new EventDirector({ test_event: def });
    const room = makeRoom();
    const now = 1_000;

    director.forceTrigger("test_event", room, now);
    director.tick(room, 0.05, now + def.warningMs);
    director.tick(room, 0.05, now + def.warningMs + def.durationMs);
    const endedAt = now + def.warningMs + def.durationMs + def.endingMs;
    director.tick(room, 0.05, endedAt); // → idle

    const blocked = director.forceTrigger("test_event", room, endedAt + 1);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toBe("global_cooldown");

    const allowed = director.forceTrigger("test_event", room, endedAt + EVENT_GLOBAL_COOLDOWN_MS + 1);
    expect(allowed.ok).toBe(true);
  });

  it("dev_event com id desconhecido é ignorado (registry vazio, por exemplo)", () => {
    const director = new EventDirector({});
    const room = makeRoom();
    const res = director.forceTrigger("nao_existe", room, 1_000);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("unknown_event");
    expect(room.state.event.phase).toBe("idle");
  });

  it("dev_event respeita elegibilidade — não dispara se checkEligibility recusar (ex.: <minPlayers)", () => {
    const def = makeDef({ checkEligibility: (ctx) => ctx.livingCount >= 4 });
    const director = new EventDirector({ test_event: def });
    const room = makeRoom();

    const res = director.forceTrigger("test_event", room, 1_000);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("not_eligible");
    expect(room.state.event.phase).toBe("idle");
  });

  it("avaliação periódica só roda a cada DIRECTOR_EVAL_MS enquanto idle", () => {
    const def = makeDef();
    const director = new EventDirector({ test_event: def });
    const room = makeRoom();

    director.tick(room, 0.05, 0); // 1ª avaliação (t=0): warm-up da 1ª ativação segura
    expect(room.state.event.phase).toBe("idle");

    // reavalia (intervalo completo) 1ms antes do warm-up vencer: ainda idle
    director.tick(room, 0.05, DIRECTOR_FIRST_EVENT_AFTER_MS - 1);
    expect(room.state.event.phase).toBe("idle");

    // warm-up vencido, MAS o intervalo da última avaliação não completou → não reavalia
    director.tick(room, 0.05, DIRECTOR_FIRST_EVENT_AFTER_MS);
    expect(room.state.event.phase).toBe("idle");

    // intervalo completo → reavalia e a 1ª ativação garantida dispara
    director.tick(room, 0.05, DIRECTOR_FIRST_EVENT_AFTER_MS - 1 + DIRECTOR_EVAL_MS);
    expect(room.state.event.phase).toBe("warning");
  });

  it("primeira ativação determinística: warm-up sem evento até DIRECTOR_FIRST_EVENT_AFTER_MS, dispara garantido depois; daí volta ao dado", () => {
    const def = makeDef();
    const director = new EventDirector({ test_event: def });
    const room = makeRoom();
    const randomSpy = vi.spyOn(Math, "random");

    randomSpy.mockReturnValue(0); // a sorte SEMPRE dispararia — o warm-up tem que segurar
    director.tick(room, 0.05, 0); // 1º tick fixa a idade da sala
    expect(room.state.event.phase).toBe("idle");
    director.tick(room, 0.05, DIRECTOR_EVAL_MS); // reavalia dentro do warm-up — segue idle
    expect(room.state.event.phase).toBe("idle");

    randomSpy.mockReturnValue(0.999); // a partir daqui a sorte NUNCA dispararia

    director.tick(room, 0.05, DIRECTOR_FIRST_EVENT_AFTER_MS); // idade atingida → garantido
    expect(room.state.event.phase).toBe("warning");

    // ciclo completo até idle — a partir daqui a garantia não vale mais
    const t1 = DIRECTOR_FIRST_EVENT_AFTER_MS;
    director.tick(room, 0.05, t1 + def.warningMs);
    director.tick(room, 0.05, t1 + def.warningMs + def.durationMs);
    const tEnd = t1 + def.warningMs + def.durationMs + def.endingMs;
    director.tick(room, 0.05, tEnd);
    expect(room.state.event.phase).toBe("idle");

    // muito além da idade mínima e fora do cooldown global, mas com dado ruim: não dispara
    director.tick(room, 0.05, tEnd + EVENT_GLOBAL_COOLDOWN_MS + DIRECTOR_EVAL_MS * 10);
    expect(room.state.event.phase).toBe("idle");
  });

  it("respawnPolicyFor delega ao hook do evento ativo (por fase) e cai em default sem evento/hook", () => {
    const def = makeDef({
      respawnPolicy: (_room, _id, phase) => (phase === "active" ? "hold_until_end" : "default"),
    });
    const director = new EventDirector({ test_event: def });
    const room = makeRoom();

    expect(director.respawnPolicyFor("p1")).toBe("default"); // idle, sem evento

    director.forceTrigger("test_event", room, 1_000);
    expect(director.respawnPolicyFor("p1")).toBe("default"); // warning → hook devolve default

    director.tick(room, 0.05, 1_000 + def.warningMs); // → active
    expect(director.respawnPolicyFor("p1")).toBe("hold_until_end");
  });
});

describe("triggerChance — modulação por intensidade (T-065)", () => {
  it("é monotonicamente não-crescente em deathsPerMinute e fica dentro de [0.5×, 2×] da base", () => {
    const base = DIRECTOR_TRIGGER_CHANCE;
    expect(triggerChance(0)).toBeCloseTo(base * 2);
    expect(triggerChance(DIRECTOR_HOT_DEATHS_PER_MIN)).toBeCloseTo(base);
    expect(triggerChance(DIRECTOR_HOT_DEATHS_PER_MIN * 10)).toBeCloseTo(base * 0.5);
    expect(triggerChance(1)).toBeGreaterThanOrEqual(triggerChance(2));
  });
});
