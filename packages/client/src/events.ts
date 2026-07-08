// SPEC-0016 (T-067): camada de UI de fases de evento — 100% event-agnostic, dirigida pelo
// schema sincronizado (`state.event`, T-065). Novo evento = nova entrada em EVENT_LABELS,
// zero mudança de código aqui. Nenhuma lógica de jogo: só leitura de estado + countdown
// derivado de `phaseEndsAt` a cada frame (nunca timer próprio — reconexão/atraso não dessincroniza).
import type { Room } from "colyseus.js";

export interface EventsCtx {
  getRoom(): Room | undefined;
}

// Nome de exibição por `event.id` — fallback pro id cru se o evento ainda não tiver entrada.
const EVENT_LABELS: Record<string, string> = {
  battle_royale: "BATTLE ROYALE",
};

interface EventResultMsg {
  survivorNames: string[];
  reason: string;
}

let ctx: EventsCtx;
export function initEvents(c: EventsCtx) {
  ctx = c;
}

interface EventRefs {
  banner: HTMLElement;
  bannerName: HTMLElement;
  bannerCountdown: HTMLElement;
  activeHud: HTMLElement;
  activeTime: HTMLElement;
  activeAlive: HTMLElement;
  resultBox: HTMLElement;
  resultText: HTMLElement;
}
let refs: EventRefs | undefined;

function buildShell(): EventRefs {
  const banner = document.getElementById("event-banner")!;
  banner.innerHTML =
    `<div class="event-banner-name" id="event-banner-name"></div>` +
    `<div class="event-banner-countdown" id="event-banner-countdown"></div>`;
  const activeHud = document.getElementById("event-hud")!;
  activeHud.innerHTML =
    `<span class="event-hud-time" id="event-hud-time"></span>` +
    `<span class="event-hud-alive" id="event-hud-alive"></span>`;
  const resultBox = document.getElementById("event-result")!;
  resultBox.innerHTML = `<div class="event-result-text" id="event-result-text"></div>`;
  const byId = (id: string) => document.getElementById(id)!;
  return {
    banner,
    bannerName: byId("event-banner-name"),
    bannerCountdown: byId("event-banner-countdown"),
    activeHud,
    activeTime: byId("event-hud-time"),
    activeAlive: byId("event-hud-alive"),
    resultBox,
    resultText: byId("event-result-text"),
  };
}

let currentPhase = "idle";
// Emitido pela T-066 (`event_result`) ao entrar no `ending` — tolerar ausência (reconexão no
// meio da fase, ou evento futuro que não emita): sem mensagem, mostra só "Evento encerrado".
let latestResult: EventResultMsg | null = null;

export function onEventResult(msg: EventResultMsg) {
  latestResult = msg;
}

export function updateEvents(_now: number) {
  const st: any = ctx.getRoom()?.state;
  const ev = st?.event;
  const phase: string = ev?.phase ?? "idle";

  // Sem evento (nunca disparou nesta sessão): zero DOM, zero custo por frame.
  if (phase === "idle" && currentPhase === "idle") return;

  if (!refs) refs = buildShell();

  if (phase !== currentPhase) {
    refs.banner.classList.toggle("active", phase === "warning");
    refs.activeHud.classList.toggle("active", phase === "active");
    refs.resultBox.classList.toggle("active", phase === "ending");
    if (phase === "warning") latestResult = null; // novo ciclo: descarta resultado do anterior
    currentPhase = phase;
  }

  if (phase === "idle") return;

  const remainingMs = Math.max(0, (ev.phaseEndsAt ?? 0) - Date.now());

  if (phase === "warning") {
    refs.bannerName.textContent = `⚠ ${EVENT_LABELS[ev.id] ?? ev.id}`;
    refs.bannerCountdown.textContent = (remainingMs / 1000).toFixed(1);
  } else if (phase === "active") {
    let alive = 0;
    st.players?.forEach?.((p: any) => {
      if (p.hp > 0 && !p.waitingRespawn) alive += 1;
    });
    refs.activeTime.textContent = `${(remainingMs / 1000).toFixed(1)}s`;
    refs.activeAlive.textContent = `👥 ${alive}`;
  } else if (phase === "ending") {
    refs.resultText.textContent = formatResult(latestResult);
  }
}

function formatResult(result: EventResultMsg | null): string {
  if (!result) return "Evento encerrado";
  const { survivorNames } = result;
  if (survivorNames.length === 0) return "Ninguém sobreviveu…";
  if (survivorNames.length === 1) return `🏆 SOBREVIVENTE: ${survivorNames[0]}`;
  return `🏆 SOBREVIVENTES: ${survivorNames.join(", ")}`;
}
