// HUD do jogo (T-016) — extraído de main.ts (dívida registrada em LEAD_DESIGNER_NOTES).
// Regra: HUD só EXIBE estado sincronizado; nunca calcula atributo (ADR-009) e nunca
// decide nada — escolha de card é enviada ao servidor, que valida tudo.
import { xpToNext, UpgradeCard } from "@aop/shared";
import type { Room } from "colyseus.js";

export interface HudCtx {
  getRoom(): Room | undefined;
  getSessionId(): string;
  getPing(): number;
  getProfileId(): string;
}

// Dica de controles por perfil ativo (ADR-015/T-019b) — o HUD só reflete o perfil.
const CONTROL_HINTS: Record<string, string> = {
  mouse: "WASD=mover • mouse=mira • espaço/click=atirar",
  keyboard: "W/S=avançar/recuar • A/D=strafe • setas=girar • espaço=atirar",
  touch: "alavanca esq=mover • alavanca dir=mirar/atirar",
};

interface UpgradeOffer {
  level: number;
  cards: UpgradeCard[];
  timeoutMs: number;
}

// T-023 (SPEC-0006): HUD dev/prod. Build prod = painel compacto (ping discreto, HP/nível),
// sem F3/roster/feeds; atributos completos só aparecem segurando [Tab]. Dev mantém tudo
// sempre visível (import.meta.env.DEV é injetado pelo Vite: true em `npm run dev`, false
// no build de produção — nenhuma flag nova pra manter em sincronia).
const IS_DEV = import.meta.env.DEV;

let ctx: HudCtx;
const hudEl = document.getElementById("hud")!;
const rosterEl = document.getElementById("roster")!;
const cardsEl = document.getElementById("upgrade-cards")!;

if (!IS_DEV) rosterEl.remove(); // T-023: roster é artefato de dev — não existe em build prod

let attrsHeld = IS_DEV; // dev sempre mostra; prod só enquanto [Tab] estiver pressionado
if (!IS_DEV) {
  addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      attrsHeld = true;
    }
  });
  addEventListener("keyup", (e) => {
    if (e.key === "Tab") attrsHeld = false;
  });
}

let currentOffer: UpgradeOffer | null = null;

export function initHud(c: HudCtx) {
  ctx = c;
}

// ---------- Toasts (T-023) ----------
// Substitui os textos crus que ficavam soltos no HUD (streak, card escolhido, farm_event):
// fila não invasiva no canto (nunca no centro), fade/slide via CSS, nunca bloqueia clique.
const toastStackEl = document.getElementById("toast-stack")!;
const TOAST_LIFE_MS = 2600;
const TOAST_MAX = 5; // orçamento — a fila nunca cresce sem limite
interface Toast {
  el: HTMLDivElement;
  bornAt: number;
  removing: boolean;
}
const toasts: Toast[] = [];

export function pushToast(text: string) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = text;
  toastStackEl.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  toasts.push({ el, bornAt: performance.now(), removing: false });
  while (toasts.length > TOAST_MAX) {
    const old = toasts.shift()!;
    old.el.remove();
  }
}

function updateToasts(now: number) {
  for (let i = toasts.length - 1; i >= 0; i--) {
    const t = toasts[i];
    if (t.removing || now - t.bornAt < TOAST_LIFE_MS) continue;
    t.removing = true;
    t.el.classList.remove("show");
    setTimeout(() => t.el.remove(), 260);
    toasts.splice(i, 1);
  }
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
  pushToast(msg.auto ? `⏱ auto: ${msg.label}` : `✔ ${msg.label}`); // T-023: toast, não mais texto cru no HUD
}

/** Morte cancela a oferta pendente no servidor (build apaga junto) — fecha o menu sem
 * flash de card aplicado, já que nenhuma escolha foi feita. */
export function closeUpgradeOffer() {
  currentOffer = null;
  cardsEl.classList.remove("active");
  cardsEl.innerHTML = "";
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
    if (streak >= 2) pushToast(`🔥 ${streak} kills sem morrer!`); // T-023: toast, não mais texto cru
  } else if (ev.type === "death" && ev.payload?.playerId === myId) {
    streak = 0;
  }
}

// ---------- HUD principal + roster ----------

let rosterNext = 0;
export function updateHud(now: number) {
  updateToasts(now);

  const st: any = ctx.getRoom()?.state;
  const me = st?.players?.get?.(ctx.getSessionId());
  const fx: string[] = me?.effects ? Array.from(me.effects) : [];
  const xpNeed = me ? xpToNext(me.level) : 0;
  const ping = ctx.getPing();
  // T-021: bandeira "rei do mapa" — só existe leitura quando a room liga o toggle.
  const flagCarrierId: string | undefined = st?.flagEnabled ? st?.flag?.carrierId : undefined;

  // T-023: linha sempre visível (dev e prod) — ping discreto + HP/nível + tags de efeito.
  let text =
    `ping: ${ping < 0 ? "..." : ping + "ms"}\n` +
    `nível: ${me?.level ?? "-"} (xp ${Math.floor(me?.xp ?? 0)}/${xpNeed})  HP: ${Math.ceil(me?.hp ?? 0)}/${me?.maxHp ?? 100}` +
    (fx.includes("speed_up") ? `  ⚡x${me.speed?.toFixed(1)}` : "") +
    (fx.includes("xp_boost") ? `  2xXP` : "");

  // T-023: painel próprio compacto em prod — atributos/skills/coins só aparecem em dev
  // ou segurando [Tab]; em dev fica tudo sempre visível, como antes.
  if (attrsHeld) {
    text +=
      `\nforça ${me?.strength?.toFixed(2) ?? "-"}  vel ${me?.speed?.toFixed(2) ?? "-"}  vita ${me?.vitality?.toFixed(2) ?? "-"}  cad ${me?.attackSpeed?.toFixed(2) ?? "-"}  alc ${me?.reach?.toFixed(2) ?? "-"}` +
      (me?.skills?.length ? `\n★ ${Array.from(me.skills).join(" • ")}` : "") +
      `\ncoins: ${me?.coins ?? 0}  (R=reroll • ${CONTROL_HINTS[ctx.getProfileId()] ?? CONTROL_HINTS.mouse})`;
  } else if (!IS_DEV) {
    text += `\n[Tab] atributos`;
  }

  text +=
    (me?.pendingUpgrades > 1 ? `\n📶 +${me.pendingUpgrades - 1} level-up na fila` : "") +
    (flagCarrierId && flagCarrierId === ctx.getSessionId() ? `\n🚩 você carrega a bandeira (2×XP)!` : "");

  hudEl.textContent = text;

  if (!IS_DEV || now < rosterNext || !st?.players) return;
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
      ${flagCarrierId === id ? `<span class="tag">🚩</span>` : ""}
      <span class="lvl">lv${p.level}</span>
      <span class="hp">${Math.ceil(p.hp)}/${p.maxHp}</span>
    </div>`;
  });
  rosterEl.innerHTML = html;
}
