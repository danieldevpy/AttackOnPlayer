/**
 * T-028c (SPEC-0008) → ajuste posterior (a pedido do CD): login/registro por email+senha.
 * Guest continua o default de 1 clique (ADR-016: conta é só identidade/estatística, nunca
 * poder in-round). Google fica fora de escopo por ora. Ao logar/registrar, tenta herdar as
 * estatísticas do guest local via `/auth/link` (T-027c) — falha aí é best-effort, nunca trava.
 *
 * Este módulo é DOM-free: apenas lógica de rede + persistência local. A UI de login/registro
 * mora no lobby (`lobby.ts`), montada dentro do card pré-sala — não existe mais widget flutuante
 * no canto da tela durante a partida.
 */

const JWT_KEY = "aop_jwt";
const ACCOUNT_KEY = "aop_account";
const PLAYER_TOKEN_KEY = "aop_token";

export interface Account {
  display_name: string;
}

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

function persistSession(token: string, account: Account): void {
  localStorage.setItem(JWT_KEY, token);
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
}

export function clearSession(): void {
  localStorage.removeItem(JWT_KEY);
  localStorage.removeItem(ACCOUNT_KEY);
}

export function getAuthToken(): string | null {
  return localStorage.getItem(JWT_KEY);
}

export function getAccount(): Account | null {
  const raw = localStorage.getItem(ACCOUNT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Account;
  } catch {
    return null;
  }
}

/** Atualiza só o display_name da conta persistida (ex.: valor sanitizado devolvido pelo
 * servidor ao salvar settings) — não mexe no JWT. No-op se não houver conta logada. */
export function updateAccountDisplayName(displayName: string): void {
  const account = getAccount();
  if (!account) return;
  account.display_name = displayName;
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
}

/** Faz login por email+senha, persiste a sessão e tenta herdar stats do guest local. */
export async function login(email: string, password: string): Promise<Account> {
  const data = await apiPost("/api/v1/auth/login", { email, password });
  persistSession(data.token, data.account);
  await tryLinkGuestStats(data.token);
  return data.account as Account;
}

/** Registra conta nova por email+senha, persiste a sessão e tenta herdar stats do guest local. */
export async function register(
  email: string,
  password: string,
  displayName: string,
): Promise<Account> {
  const data = await apiPost("/api/v1/auth/register", {
    email,
    password,
    display_name: displayName,
  });
  persistSession(data.token, data.account);
  await tryLinkGuestStats(data.token);
  return data.account as Account;
}
