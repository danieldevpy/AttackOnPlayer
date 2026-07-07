/**
 * T-027g (SPEC-0008/ADR-016): cliente fino do Node para a plataforma Django. Busca a config
 * efetiva de gameops (cache em memória + TTL) e envia batches de telemetria — ambos só ativos
 * atrás de `PLATFORM_ENABLED` (default off, ver ArenaRoom.onCreate). Degrada graciosamente:
 * Django fora do ar nunca derruba o jogo (aceite #3) — cai no cache existente ou nos defaults.
 */
import { TelemetryEvent } from "../telemetry/events";

export interface EffectiveConfig {
  flagEnabled: boolean;
  xpMultiplier: number;
  coinMultiplier: number;
  mapRotation: string[];
  expectedPlayers: number;
}

export const DEFAULT_CONFIG: EffectiveConfig = {
  flagEnabled: true,
  xpMultiplier: 1,
  coinMultiplier: 1,
  mapRotation: [],
  expectedPlayers: 4,
};

const CONFIG_TTL_MS = 30_000;
const TELEMETRY_FLUSH_INTERVAL_MS = 5_000;
// Teto do buffer em memória — se o Django ficar fora do ar por muito tempo, descarta os eventos
// mais antigos em vez de crescer sem limite (o NDJSON local do T-026 continua intacto).
const TELEMETRY_MAX_BUFFER = 500;

function baseUrl(): string {
  return process.env.PLATFORM_URL || "http://localhost:8000";
}

function authHeader(): string {
  return `ServiceToken ${process.env.SERVICE_TOKEN || ""}`;
}

export class PlatformClient {
  private cachedConfig: EffectiveConfig = DEFAULT_CONFIG;
  private cachedAt = 0;
  private telemetryBuffer: TelemetryEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  /** Cache com TTL; em falha de rede/HTTP mantém o último valor bom (ou os defaults, se nunca
   * buscou com sucesso) — nunca lança, nunca bloqueia a criação da room por muito tempo. */
  async getConfig(now: number = Date.now()): Promise<EffectiveConfig> {
    if (now - this.cachedAt < CONFIG_TTL_MS) return this.cachedConfig;
    try {
      const res = await fetch(`${baseUrl()}/api/v1/gameops/config/`, {
        headers: { Authorization: authHeader() },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.cachedConfig = (await res.json()) as EffectiveConfig;
      this.cachedAt = now;
    } catch (e) {
      console.error("[platform] falha ao buscar gameops/config — usando cache/defaults:", e);
    }
    return this.cachedConfig;
  }

  /** Enfileira 1 evento de telemetria para o próximo flush em batch. Nunca lança — telemetria
   * nunca pode derrubar uma room. */
  queueTelemetry(event: TelemetryEvent) {
    this.telemetryBuffer.push(event);
    if (this.telemetryBuffer.length > TELEMETRY_MAX_BUFFER) {
      this.telemetryBuffer.splice(0, this.telemetryBuffer.length - TELEMETRY_MAX_BUFFER);
    }
    this.ensureFlushTimer();
  }

  private ensureFlushTimer() {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => void this.flush(), TELEMETRY_FLUSH_INTERVAL_MS);
    this.flushTimer.unref?.();
  }

  /** Envia o buffer atual em 1 batch. Em falha, descarta (não devolve ao buffer) — Django
   * fora do ar não pode fazer o buffer crescer sem teto (aceite #3). */
  async flush(): Promise<void> {
    if (this.telemetryBuffer.length === 0) return;
    const events = this.telemetryBuffer.splice(0, this.telemetryBuffer.length);
    try {
      const res = await fetch(`${baseUrl()}/api/v1/telemetry/batch/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader() },
        body: JSON.stringify({ events }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      console.error("[platform] falha ao enviar batch de telemetria (descartado):", e);
    }
  }

  /** T-029 (ADR-012 → conta): envia 1 delta do acumulador persistente da box pra somar no
   * `PlayerStats` da conta. Best-effort — nunca lança, nunca bloqueia o tick que chamou (a box é
   * um drop raro; 1 request por pickup é aceitável, sem precisar de buffer/batch como a
   * telemetria de alta frequência). Guardrail inalterado: isto é só estatística, nunca afeta o
   * round em andamento — quem chama decide isso, este método só entrega o POST. */
  async reportProgress(
    accountId: string,
    delta: { forca: number; agilidade: number; vitalidade: number }
  ): Promise<void> {
    try {
      const res = await fetch(`${baseUrl()}/api/v1/accounts/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader() },
        body: JSON.stringify({ account_id: accountId, ...delta }),
      });
      if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      console.error("[platform] falha ao reportar progresso persistente (descartado):", e);
    }
  }

  /** Só para testes — evita timers pendurados entre casos. */
  stopFlushTimer() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = null;
  }
}

export const platformClient = new PlatformClient();
