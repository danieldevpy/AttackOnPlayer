// HUD do jogo (T-016) — extraído de main.ts (dívida registrada em LEAD_DESIGNER_NOTES).
// Regra: HUD só EXIBE estado sincronizado; nunca calcula atributo (ADR-009) e nunca
// decide nada — escolha de card é enviada ao servidor, que valida tudo.
import { xpToNext, UpgradeCard } from "@aop/shared";
import type { Room } from "colyseus.js";

export interface HudCtx {
  getRoom(): Room | undefined;
  getSessionId(): string;
  getPing(): number;
  getAnnounceUntil(): number;
}

interface UpgradeOffer {
  level: number;
  cards: UpgradeCard[];
  timeoutMs: number;
}

let ctx: HudCtx;
const hudEl = document.getElementById("hud")!;
const rosterEl = document.getElementById("roster")!;
const cardsEl = document.getElementById("upgrade-cards")!;

let currentOffer: UpgradeOffer | null = null;
let flashUntil = 0;
let flashLabel = "";

export function initHud(c: HudCtx) {
  ctx = c;
}

// ---------- Cards de level-up (T-016) ----------

export function showUpgradeOffer(offer: UpgradeOffer) {
  currentOffer = offer;
  const buttons = offer.cards
    .map(
      (card, i) => `
      <button class="upgrade-card" data-card="${card.id}">
        <span class="key">${i + 1}</span>
        <span class="title">${card.label}</span>
      </button>`
    )
    .join("");
  cardsEl.innerHTML = `
    <div class="upgrade-header">NÍVEL ${offer.level} — escolha (1/2/3)</div>
    <div class="upgrade-row">${buttons}</div>
    <div class="upgrade-timer"><div class="upgrade-timer-fill"></div></div>`;
  cardsEl.classList.add("active");

  cardsEl.querySelectorAll<HTMLButtonElement>(".upgrade-card").forEach((btn) => {
    // mousedown (não click): o mouseup pode acontecer fora após um clique segurado de tiro
    btn.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      const id = btn.dataset.card;
      if (id) sendChoice(id);
    });
  });

  // barra de tempo: anima via transition — zero JS por frame
  const fill = cardsEl.querySelector<HTMLDivElement>(".upgrade-timer-fill")!;
  fill.style.transition = "none";
  fill.style.width = "100%";
  requestAnimationFrame(() => {
    fill.style.transition = `width ${offer.timeoutMs}ms linear`;
    fill.style.width = "0%";
  });
}

/** Escolha por tecla 1/2/3 (main.ts encaminha). Retorna true se consumiu a tecla. */
export function chooseUpgradeByIndex(index: number): boolean {
  if (!currentOffer || index < 0 || index >= currentOffer.cards.length) return false;
  sendChoice(currentOffer.cards[index].id);
  return true;
}

function sendChoice(cardId: string) {
  ctx.getRoom()?.send("choose_upgrade", cardId);
  // não esconde ainda — servidor confirma com "upgrade_applied" (fonte da verdade)
}

export function onUpgradeApplied(msg: { cardId: string; label: string; level: number; auto: boolean }) {
  currentOffer = null;
  cardsEl.classList.remove("active");
  cardsEl.innerHTML = "";
  // T-018 vai evoluir isto; feedback mínimo já nasce aqui (flash textual no HUD)
  flashLabel = msg.auto ? `⏱ auto: ${msg.label}` : `✔ ${msg.label}`;
  flashUntil = performance.now() + 2000;
}

export function hasOpenOffer(): boolean {
  return currentOffer !== null;
}

// ---------- Kill streak (T-018) ----------
// Derivado do feed de eventos que o servidor já transmite (debug_event) — nenhum
// tráfego novo. Streak = kills sem morrer; insumo visual do hit_streak do M2 (aura).
let streak = 0;

export function onCombatEvent(ev: { type: string; payload: any }, myId: string) {
  if (!myId) return;
  if (ev.type === "hit" && ev.payload?.isKill && ev.payload.shooterId === myId) {
    streak += 1;
    if (streak >= 2) {
      flashLabel = `🔥 ${streak} kills sem morrer!`;
      flashUntil = performance.now() + 2500;
    }
  } else if (ev.type === "death" && ev.payload?.playerId === myId) {
    streak = 0;
  }
}

// ---------- HUD principal + roster ----------

let rosterNext = 0;
export function updateHud(now: number) {
  const st: any = ctx.getRoom()?.state;
  const me = st?.players?.get?.(ctx.getSessionId());
  const fx: string[] = me?.effects ? Array.from(me.effects) : [];
  const xpNeed = me ? xpToNext(me.level) : 0;
  const ping = ctx.getPing();
  hudEl.textContent =
    `ping: ${ping < 0 ? "..." : ping + "ms"}\n` +
    `nível: ${me?.level ?? "-"} (xp ${Math.floor(me?.xp ?? 0)}/${xpNeed})  HP: ${Math.ceil(me?.hp ?? 0)}/${me?.maxHp ?? 100}` +
    (fx.includes("speed_up") ? `  ⚡x${me.speed?.toFixed(1)}` : "") +
    (fx.includes("xp_boost") ? `  2xXP` : "") +
    `\nforça ${me?.strength?.toFixed(2) ?? "-"}  vel ${me?.speed?.toFixed(2) ?? "-"}  vita ${me?.vitality?.toFixed(2) ?? "-"}  cad ${me?.attackSpeed?.toFixed(2) ?? "-"}  alc ${me?.reach?.toFixed(2) ?? "-"}` +
    (me?.skills?.length ? `\n★ ${Array.from(me.skills).join(" • ")}` : "") +
    `\ncoins: ${me?.coins ?? 0}  (R=reroll • WASD=mover • mouse=mira • espaço/click=atirar)` +
    (streak >= 2 ? `\n🔥 streak: ${streak}` : "") +
    (me?.pendingUpgrades > 1 ? `\n📶 +${me.pendingUpgrades - 1} level-up na fila` : "") +
    (now < flashUntil ? `\n${flashLabel}` : "") +
    (now < ctx.getAnnounceUntil() ? `\n🔥 farm_event na zona de guerra!` : "");

  if (now < rosterNext || !st?.players) return;
  rosterNext = now + 250;
  let html = `<div class="title">PLAYERS</div>`;
  st.players.forEach((p: any, id: string) => {
    const self = id === ctx.getSessionId();
    const fx2: string[] = p.effects ? Array.from(p.effects) : [];
    html += `<div class="row">
      <span class="dot ${self ? "self" : "enemy"}"></span>
      <span class="name">${p.name}${self ? " (você)" : ""}</span>
      ${p.isBot ? `<span class="tag">BOT</span>` : ""}
      ${fx2.includes("speed_up") ? `<span class="tag">⚡</span>` : ""}
      ${fx2.includes("xp_boost") ? `<span class="tag">2xXP</span>` : ""}
      <span class="lvl">lv${p.level}</span>
      <span class="hp">${Math.ceil(p.hp)}/${p.maxHp}</span>
    </div>`;
  });
  rosterEl.innerHTML = html;
}
