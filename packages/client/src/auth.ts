/**
 * T-028c (SPEC-0008): janela discreta de conta no canto — nunca modal, nunca some com o
 * jogo em andamento. Guest continua o default de 1 clique (ADR-016: conta é só identidade/
 * estatística, nunca poder in-round). Login/registro são por email+senha; Google fica fora
 * de escopo por ora (a pedido do CD). Ao logar/registrar, tenta herdar as estatísticas do
 * guest local via `/auth/link` (T-027c) — falha aí é best-effort, nunca trava a UI.
 */

const JWT_KEY = "aop_jwt";
const ACCOUNT_KEY = "aop_account";
const PLAYER_TOKEN_KEY = "aop_token";

type Mode = "login" | "register";

const widget = document.getElementById("auth-widget")!;
const panel = document.getElementById("auth-panel")!;
const pill = document.getElementById("auth-pill")!;
const pillLabel = document.getElementById("auth-pill-label")!;
const logoutBtn = document.getElementById("auth-logout") as HTMLButtonElement;
const tabLogin = document.getElementById("auth-tab-login") as HTMLButtonElement;
const tabRegister = document.getElementById("auth-tab-register") as HTMLButtonElement;
const form = document.getElementById("auth-form") as HTMLFormElement;
const emailInput = document.getElementById("auth-email") as HTMLInputElement;
const passwordInput = document.getElementById("auth-password") as HTMLInputElement;
const displayNameInput = document.getElementById("auth-display-name") as HTMLInputElement;
const submitBtn = document.getElementById("auth-submit") as HTMLButtonElement;
const cancelBtn = document.getElementById("auth-cancel") as HTMLButtonElement;
const errorEl = document.getElementById("auth-error")!;

let mode: Mode = "login";

function authBaseUrl(): string {
  const override = new URLSearchParams(location.search).get("authPort");
  if (location.hostname === "localhost" || location.hostname.startsWith("192.")) {
    return `http://${location.hostname}:${override ?? 8000}`;
  }
  return `${location.protocol}//${location.host}`;
}

function extractErrorMessage(data: unknown): string {
  const body = (data ?? {}) as Record<string, unknown>;
  if (typeof body.detail === "string") return body.detail;
  const firstKey = Object.keys(body)[0];
  const firstValue = firstKey ? body[firstKey] : undefined;
  if (Array.isArray(firstValue) && typeof firstValue[0] === "string") {
    return firstValue[0];
  }
  return "não deu pra completar — tenta de novo";
}

async function apiPost(path: string, body: unknown, token?: string): Promise<any> {
  const res = await fetch(`${authBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMessage(data));
  return data;
}

/** Registra o guest local no Django (best-effort, silencioso) — só assim o `/auth/link`
 * encontra o `player_token` depois, se o jogador vier a registrar/logar (aceite #5). Django
 * fora do ar não afeta o guest local em nada (aceite #3: degradação graciosa). */
export async function ensureGuestRegistered(): Promise<void> {
  if (getAuthToken()) return;
  const playerToken = localStorage.getItem(PLAYER_TOKEN_KEY);
  if (!playerToken) return;
  try {
    await apiPost("/api/v1/auth/guest", { player_token: playerToken });
  } catch (e) {
    console.warn("[auth] guest não registrado no Django (segue local):", e);
  }
}

/** Best-effort: nunca bloqueia login/registro se o guest não tiver stats pra herdar. */
async function tryLinkGuestStats(token: string): Promise<void> {
  const playerToken = localStorage.getItem(PLAYER_TOKEN_KEY);
  if (!playerToken) return;
  try {
    await apiPost("/api/v1/auth/link", { player_token: playerToken }, token);
  } catch (e) {
    console.warn("[auth] não foi possível vincular estatísticas do guest:", e);
  }
}

function persistSession(token: string, account: { display_name: string }): void {
  localStorage.setItem(JWT_KEY, token);
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
}

function clearSession(): void {
  localStorage.removeItem(JWT_KEY);
  localStorage.removeItem(ACCOUNT_KEY);
}

export function getAuthToken(): string | null {
  return localStorage.getItem(JWT_KEY);
}

function renderSessionState(): void {
  const raw = localStorage.getItem(ACCOUNT_KEY);
  const account = raw ? (JSON.parse(raw) as { display_name: string }) : null;
  pill.classList.toggle("logged-in", account != null);
  pillLabel.textContent = account?.display_name ?? "guest";
  logoutBtn.style.display = account ? "inline" : "none";
}

function openPanel(): void {
  if (getAuthToken()) return; // logado: nada pra abrir, só o botão de sair
  widget.classList.add("open");
  panel.classList.add("open");
  errorEl.textContent = "";
  emailInput.focus();
}

function closePanel(): void {
  widget.classList.remove("open");
  panel.classList.remove("open");
  form.reset();
}

function setMode(next: Mode): void {
  mode = next;
  tabLogin.classList.toggle("active", mode === "login");
  tabRegister.classList.toggle("active", mode === "register");
  displayNameInput.style.display = mode === "register" ? "block" : "none";
  submitBtn.textContent = mode === "login" ? "Entrar" : "Registrar";
  passwordInput.autocomplete = mode === "login" ? "current-password" : "new-password";
  errorEl.textContent = "";
}

async function handleSubmit(e: SubmitEvent): Promise<void> {
  e.preventDefault();
  errorEl.textContent = "";
  submitBtn.disabled = true;
  try {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const path = mode === "login" ? "/api/v1/auth/login" : "/api/v1/auth/register";
    const body =
      mode === "login"
        ? { email, password }
        : { email, password, display_name: displayNameInput.value.trim() };
    const data = await apiPost(path, body);
    persistSession(data.token, data.account);
    await tryLinkGuestStats(data.token);
    renderSessionState();
    closePanel();
  } catch (e) {
    errorEl.textContent = (e as Error).message;
  } finally {
    submitBtn.disabled = false;
  }
}

function handleLogout(): void {
  clearSession();
  renderSessionState();
}

export function initAuth(): void {
  renderSessionState();
  setMode("login");
  void ensureGuestRegistered();

  pill.addEventListener("click", (e) => {
    if (e.target === logoutBtn) return;
    openPanel();
  });
  tabLogin.addEventListener("click", () => setMode("login"));
  tabRegister.addEventListener("click", () => setMode("register"));
  cancelBtn.addEventListener("click", closePanel);
  logoutBtn.addEventListener("click", handleLogout);
  form.addEventListener("submit", (e) => void handleSubmit(e));
}
