/**
 * T-057 (SPEC-0015): Janela pré-sala — card único antes do join.
 * T-058 (SPEC-0015): Persistência de settings + nick.
 * T-062 (SPEC-0015): Ranking/stats em aba discreta.
 * Ajuste posterior (a pedido do CD): login/registro passam a morar aqui — não existe mais
 * widget flutuante de conta no canto da tela durante a partida.
 *
 * Seções:
 *   1. Identidade: guest/conta + nick editável + login/registro (email+senha)
 *   2. Seleção de classe + preview 3D girando (createCharacterVisual da T-053)
 *   3. Settings: perfil de controle, volumes, fullscreen
 *   4. Botão Jogar
 *   5. Aba Ranking: stats pessoais + top 10 (T-062, graceful degrade)
 *
 * Regra de ouro: 1 clique com defaults sensatos.
 * Escopo: client-only. Não envia join, não toca em schema/servidor.
 * Persistência localStorage: sempre (nick, classId, skinId, profile, volumes).
 * Sync Django (T-058): GET ao abrir card (merge com localStorage); PUT ao clicar Jogar.
 *   Ambos são best-effort — falha de rede → console.warn, segue com localStorage.
 * T-062: consumir GET /api/v1/stats/me (JWT) e GET /api/v1/ranking (público),
 *   timeout 3s → fallback com estado vazio. Aba é discreta (não bloqueia Jogar).
 * Join com seleções (T-059) é task separada.
 */

import * as THREE from "three";
import { CLASS_REGISTRY, DEFAULT_CLASS_ID } from "@aop/shared";
import { createCharacterVisual, updateCharacterAnimation } from "./characters";
import type { AudioSystem } from "./audio";
import type { ProfileId } from "./input/manager";
import { getAuthToken, getAccount, clearSession, updateAccountDisplayName, login, register } from "./auth";

// ─────────────────────────────────────────────────────────
// Tipos e constantes de persistência local
// ─────────────────────────────────────────────────────────

export interface LobbySelection {
  nick: string;
  classId: string;
  skinId: string;
  profile: ProfileId;
}

const NICK_KEY = "aop_lobby_nick";
const CLASS_KEY = "aop_lobby_class";
const SKIN_KEY = "aop_lobby_skin";

// ─────────────────────────────────────────────────────────
// Utilitários
// ─────────────────────────────────────────────────────────

function generateGuestNick(): string {
  const n = Math.floor(10000 + Math.random() * 90000);
  return `Guest#${n}`;
}

function sanitizeNick(raw: string): string {
  // Remove caracteres de controle e < >; colapsa espaços iniciais/finais
  return raw.replace(/[<>\x00-\x1F]/g, "").trim().slice(0, 20);
}

function isValidNick(s: string): boolean {
  return s.replace(/\s/g, "").length >= 1;
}

// ─────────────────────────────────────────────────────────
// T-058: Sync com Django (best-effort — nunca bloqueia UI)
// ─────────────────────────────────────────────────────────

/** Resposta do endpoint GET/PUT /api/v1/accounts/settings */
interface DjangoSettings {
  control_profile: string;
  volume_master: number;
  volume_sfx: number;
  fullscreen_pref: boolean;
  display_name: string;
}

/** Resposta do endpoint GET /api/v1/stats/me (T-060) */
interface PlayerStats {
  kills: number;
  deaths: number;
  matches_played: number;
}

/** Uma linha do ranking retornado por GET /api/v1/ranking (T-060) */
interface RankingEntry {
  id: number;
  display_name: string;
  kills: number;
  deaths: number;
  matches_played: number;
}

/** Paginação do ranking */
interface RankingResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: RankingEntry[];
}

function djangoBaseUrl(): string {
  const override = new URLSearchParams(location.search).get("authPort");
  if (location.hostname === "localhost" || location.hostname.startsWith("192.")) {
    return `http://${location.hostname}:${override ?? 8000}`;
  }
  return `${location.protocol}//${location.host}`;
}

/**
 * Carrega settings da conta Django. Retorna null em caso de falha (rede,
 * token inválido, servidor fora do ar) — caller trata como best-effort.
 */
async function fetchDjangoSettings(): Promise<DjangoSettings | null> {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const res = await fetch(`${djangoBaseUrl()}/api/v1/accounts/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as DjangoSettings;
  } catch (e) {
    console.warn("[lobby] não foi possível carregar settings do servidor:", e);
    return null;
  }
}

/**
 * Salva settings na conta Django (best-effort). Falha é silenciosa (console.warn).
 * Inclui o display_name para que o servidor sanitize nick malicioso (sanitize_display_name).
 * O display_name retornado pelo servidor é usado para atualizar o localStorage.
 */
async function saveDjangoSettings(payload: Partial<DjangoSettings>): Promise<string | null> {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const res = await fetch(`${djangoBaseUrl()}/api/v1/accounts/settings`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.warn("[lobby] falha ao salvar settings no servidor:", res.status);
      return null;
    }
    const data = (await res.json()) as DjangoSettings;
    // Atualiza o display_name na conta persistida com o valor sanitizado pelo servidor
    if (data.display_name) {
      updateAccountDisplayName(data.display_name);
      localStorage.setItem(NICK_KEY, data.display_name);
    }
    return data.display_name ?? null;
  } catch (e) {
    console.warn("[lobby] não foi possível salvar settings no servidor:", e);
    return null;
  }
}

// ─────────────────────────────────────────────────────────
// T-062: Ranking/stats (best-effort com timeout 3s)
// ─────────────────────────────────────────────────────────

/**
 * Carrega as próprias stats da conta. Retorna null em caso de falha, timeout ou guest.
 * Timeout: 3s (como na spec T-062).
 */
async function fetchPlayerStats(): Promise<PlayerStats | null> {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${djangoBaseUrl()}/api/v1/stats/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (!res.ok) return null;
    return (await res.json()) as PlayerStats;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      console.warn("[lobby] timeout ao carregar stats pessoais (3s)");
    } else {
      console.warn("[lobby] não foi possível carregar stats pessoais:", e);
    }
    return null;
  }
}

/**
 * Carrega o ranking público (top 10). Retorna null em caso de falha ou timeout.
 * Timeout: 3s (como na spec T-062).
 */
async function fetchRanking(page: number = 1): Promise<RankingResponse | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const url = new URL(`${djangoBaseUrl()}/api/v1/ranking`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", "10");

    const res = await fetch(url.toString(), {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (!res.ok) return null;
    return (await res.json()) as RankingResponse;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      console.warn("[lobby] timeout ao carregar ranking (3s)");
    } else {
      console.warn("[lobby] não foi possível carregar ranking:", e);
    }
    return null;
  }
}

// ─────────────────────────────────────────────────────────
// CSS do lobby — injetado uma única vez
// ─────────────────────────────────────────────────────────

function injectLobbyStyles(): void {
  if (document.getElementById("lobby-styles")) return;
  const style = document.createElement("style");
  style.id = "lobby-styles";
  style.textContent = `
    #lobby-overlay {
      position: fixed; inset: 0; z-index: 100;
      background: rgba(10,10,14,0.97);
      display: flex; align-items: center; justify-content: center;
      font-family: "Segoe UI", system-ui, sans-serif;
      padding: 12px;
      box-sizing: border-box;
      overflow-y: auto;
    }
    #lobby-card {
      width: 100%; max-width: 680px;
      background: rgba(20,22,32,0.98);
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 14px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.7);
      overflow: hidden;
    }
    #lobby-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 20px 12px;
      border-bottom: 1px solid rgba(255,255,255,0.07);
    }
    #lobby-header h1 {
      margin: 0; font-size: 15px; letter-spacing: 2px;
      color: #ffd54f; text-transform: uppercase; font-weight: 700;
    }
    #lobby-auth-badge {
      display: flex; align-items: center; gap: 8px;
      font-size: 11px; color: #aaa; font-family: monospace;
    }
    #lobby-auth-badge .dot {
      width: 6px; height: 6px; border-radius: 50%; background: #7a7a7a; flex: none;
    }
    #lobby-auth-badge.logged-in .dot { background: #7fffaa; }
    #lobby-auth-badge .name { max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #lobby-logout-btn {
      background: none; border: none; color: #ff8a80; font-family: monospace;
      font-size: 11px; cursor: pointer; padding: 0 0 0 6px; user-select: none;
    }
    #lobby-auth-toggle-btn {
      background: none; border: none; color: #ffd54f; font-family: monospace;
      font-size: 11px; cursor: pointer; padding: 0 0 0 6px; user-select: none;
    }
    #lobby-auth-panel {
      display: none; padding: 12px 20px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.07);
    }
    #lobby-auth-panel.open { display: block; }
    .lobby-auth-tabs { display: flex; gap: 4px; margin-bottom: 8px; max-width: 320px; }
    .lobby-auth-tabs button {
      flex: 1; padding: 6px 10px;
      background: rgba(255,255,255,0.04); border: 1px solid #333; border-radius: 6px;
      color: #999; font-family: monospace; font-size: 11px; cursor: pointer;
    }
    .lobby-auth-tabs button.active {
      background: rgba(255,213,79,.14); border-color: #ffd54f55; color: #ffd54f;
    }
    #lobby-auth-form { display: flex; flex-direction: column; gap: 6px; max-width: 320px; }
    #lobby-auth-form input {
      background: rgba(0,0,0,0.35); border: 1px solid #444; border-radius: 6px;
      color: #eee; font-family: monospace; font-size: 12px; padding: 6px 8px;
      outline: none; touch-action: auto;
    }
    #lobby-auth-form input:focus { border-color: #ffd54f88; }
    .lobby-auth-form-row { display: flex; gap: 6px; }
    #lobby-auth-submit {
      flex: 1; padding: 6px 14px;
      background: #2e7d32; border: none; border-radius: 6px;
      color: #fff; font-family: monospace; font-size: 12px; font-weight: 700; cursor: pointer;
    }
    #lobby-auth-submit:hover:not(:disabled) { background: #388e3c; }
    #lobby-auth-submit:disabled { background: #333; color: #888; cursor: default; }
    #lobby-auth-cancel {
      background: transparent; border: 1px solid #444; border-radius: 6px; color: #999;
      font-family: monospace; font-size: 12px; padding: 6px 10px; cursor: pointer;
    }
    #lobby-auth-error { color: #ff8a80; font-size: 10px; min-height: 12px; }
    #lobby-body {
      display: flex; gap: 0; flex-wrap: wrap;
    }
    #lobby-left {
      flex: 1 1 260px; padding: 18px 20px;
      border-right: 1px solid rgba(255,255,255,0.06);
      display: flex; flex-direction: column; gap: 18px;
    }
    #lobby-right {
      flex: 1 1 220px; padding: 18px 20px;
      display: flex; flex-direction: column; gap: 14px; align-items: stretch;
    }
    .lobby-section-label {
      font-size: 10px; letter-spacing: 1.5px; color: #666; text-transform: uppercase;
      margin-bottom: 4px; font-weight: 600;
    }
    #lobby-nick-input {
      width: 100%; box-sizing: border-box;
      background: rgba(0,0,0,0.35); border: 1px solid #444; border-radius: 6px;
      color: #eee; font-family: monospace; font-size: 13px; padding: 6px 8px;
      outline: none; touch-action: auto; user-select: text;
      -webkit-user-select: text;
    }
    #lobby-nick-input:focus { border-color: #ffd54f88; }
    #lobby-nick-error {
      font-size: 10px; color: #ff8a80; min-height: 13px; margin-top: 2px;
    }
    .lobby-radio-group {
      display: flex; flex-direction: column; gap: 5px;
    }
    .lobby-radio-row {
      display: flex; align-items: center; gap: 8px; cursor: pointer;
      color: #ccc; font-size: 12px; font-family: monospace;
    }
    .lobby-radio-row input[type="radio"] { accent-color: #ffd54f; cursor: pointer; }
    .lobby-class-cards {
      display: flex; gap: 8px; flex-wrap: wrap;
    }
    .lobby-class-card {
      flex: 1 1 80px; padding: 8px 10px;
      border: 1px solid #333; border-radius: 8px; cursor: pointer;
      background: transparent; color: #ccc; font-family: monospace; font-size: 11px;
      text-align: center; transition: border-color 0.15s, background 0.15s;
    }
    .lobby-class-card.selected {
      border-color: #ffd54f88; background: rgba(255,213,79,0.1); color: #ffd54f;
    }
    .lobby-skin-select {
      background: rgba(0,0,0,0.35); border: 1px solid #444; border-radius: 6px;
      color: #eee; font-family: monospace; font-size: 12px; padding: 5px 8px;
      outline: none; touch-action: auto; width: 100%; box-sizing: border-box;
    }
    .lobby-skin-select:focus { border-color: #ffd54f88; }
    #lobby-preview-wrap {
      width: 100%; aspect-ratio: 1 / 1; max-height: 180px;
      border-radius: 8px; overflow: hidden;
      background: rgba(0,0,0,0.35); border: 1px solid #333;
      position: relative; display: flex; align-items: center; justify-content: center;
    }
    #lobby-preview-canvas {
      display: block; width: 100% !important; height: 100% !important;
    }
    .lobby-slider-row {
      display: flex; align-items: center; gap: 8px;
      font-size: 11px; color: #aaa; font-family: monospace;
    }
    .lobby-slider-label { min-width: 52px; }
    .lobby-slider-val { min-width: 32px; text-align: right; color: #ffd54f; }
    .lobby-slider {
      flex: 1; accent-color: #ffd54f; cursor: pointer;
      touch-action: auto; user-select: none;
    }
    .lobby-fullscreen-row {
      display: flex; align-items: center; gap: 8px;
      font-size: 12px; color: #ccc; font-family: monospace; cursor: pointer;
    }
    .lobby-fullscreen-row input[type="checkbox"] { accent-color: #ffd54f; cursor: pointer; }
    #lobby-footer {
      padding: 14px 20px;
      border-top: 1px solid rgba(255,255,255,0.07);
      display: flex; gap: 12px; align-items: center; justify-content: center;
      flex-wrap: wrap;
    }
    #lobby-play-btn {
      flex: 1 1 160px; max-width: 320px;
      padding: 12px 24px;
      background: #2e7d32; border: none; border-radius: 8px;
      color: #fff; font-size: 15px; font-weight: 700; font-family: monospace;
      letter-spacing: 1px; cursor: pointer; text-transform: uppercase;
      transition: background 0.15s; touch-action: auto; user-select: none;
    }
    #lobby-play-btn:hover:not(:disabled) { background: #388e3c; }
    #lobby-play-btn:disabled { background: #333; color: #888; cursor: default; }
    #lobby-connecting { font-size: 11px; color: #aaa; font-family: monospace; min-width: 90px; }

    /* T-062: Aba de Ranking */
    #lobby-tabs {
      display: flex; gap: 0; border-bottom: 1px solid rgba(255,255,255,0.07);
      padding: 0 20px;
    }
    .lobby-tab {
      flex: 1; max-width: 150px; padding: 10px 14px;
      background: none; border: none; border-bottom: 2px solid transparent;
      color: #888; font-size: 11px; font-family: monospace; font-weight: 600;
      letter-spacing: 1px; cursor: pointer; text-transform: uppercase;
      transition: border-color 0.2s, color 0.2s;
    }
    .lobby-tab:hover { color: #aaa; }
    .lobby-tab.active { border-color: #ffd54f; color: #ffd54f; }

    #lobby-tab-main { flex: 0; }
    #lobby-tab-ranking { flex: 0; }

    #lobby-panels {
      position: relative; display: block;
    }
    .lobby-panel {
      display: none;
    }
    .lobby-panel.active {
      display: block;
    }
    #lobby-ranking-panel {
      padding: 16px 20px;
      max-height: 500px; overflow-y: auto;
    }

    .lobby-stats-box {
      background: rgba(255,213,79,0.08); border: 1px solid rgba(255,213,79,0.3);
      border-radius: 8px; padding: 12px 14px; margin-bottom: 14px;
      font-family: monospace; font-size: 12px; color: #ffd54f;
    }
    .lobby-stats-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 4px 0;
    }
    .lobby-stats-row > span:first-child { color: #999; }
    .lobby-stats-row > span:last-child { font-weight: 700; }

    .lobby-ranking-table {
      width: 100%; border-collapse: collapse;
      font-family: monospace; font-size: 11px; color: #ccc;
    }
    .lobby-ranking-table thead {
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .lobby-ranking-table th {
      text-align: left; padding: 8px 6px; color: #888; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.5px; font-size: 10px;
    }
    .lobby-ranking-table td {
      padding: 6px; border-bottom: 1px solid rgba(255,255,255,0.04);
    }
    .lobby-ranking-table tbody tr:hover {
      background: rgba(255,213,79,0.04);
    }
    .lobby-ranking-table .rank { color: #ffd54f; font-weight: 700; min-width: 24px; }
    .lobby-ranking-table .name { min-width: 100px; }
    .lobby-ranking-table .stat { text-align: right; }

    .lobby-ranking-empty {
      text-align: center; padding: 40px 20px;
      color: #666; font-family: monospace; font-size: 12px;
    }
    .lobby-ranking-loading {
      text-align: center; padding: 20px;
      color: #888; font-family: monospace; font-size: 11px;
    }

    @media (max-width: 599px) {
      #lobby-body { flex-direction: column; }
      #lobby-left { border-right: none; border-bottom: 1px solid rgba(255,255,255,0.06); padding: 14px 14px; }
      #lobby-right { padding: 14px 14px; }
      #lobby-preview-wrap { max-height: 150px; }
      #lobby-play-btn { max-width: 100%; }
      #lobby-header h1 { font-size: 12px; letter-spacing: 1.5px; }
      #lobby-ranking-panel { max-height: 300px; }
    }
  `;
  document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────
// Preview 3D girando
// ─────────────────────────────────────────────────────────

interface PreviewRenderer {
  setClass(classId: string, skinId: string): void;
  dispose(): void;
}

function createPreviewRenderer(canvas: HTMLCanvasElement): PreviewRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const previewScene = new THREE.Scene();
  const previewCamera = new THREE.PerspectiveCamera(40, 1, 0.1, 20);
  previewCamera.position.set(0, 1.2, 3.5);
  previewCamera.lookAt(0, 0.8, 0);

  previewScene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(3, 6, 4);
  previewScene.add(sun);

  let currentGroup: THREE.Group | null = null;
  let rafId = 0;
  let angle = 0;
  let lastTime = performance.now();

  function resizeToCanvas(): void {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w < 1 || h < 1) return;
    renderer.setSize(w, h, false);
    previewCamera.aspect = w / h;
    previewCamera.updateProjectionMatrix();
  }

  function tick(): void {
    rafId = requestAnimationFrame(tick);
    resizeToCanvas();
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    // ~2s por volta completa
    angle += dt * (Math.PI * 2 / 2.0);
    if (currentGroup) {
      currentGroup.rotation.y = angle;
      updateCharacterAnimation(currentGroup, angle * 20, 0, now);
    }
    renderer.render(previewScene, previewCamera);
  }

  function setClass(classId: string, skinId: string): void {
    if (currentGroup) {
      previewScene.remove(currentGroup);
      currentGroup = null;
    }
    currentGroup = createCharacterVisual(classId, skinId);
    currentGroup.position.set(0, 0, 0);
    previewScene.add(currentGroup);
  }

  function dispose(): void {
    cancelAnimationFrame(rafId);
    if (currentGroup) previewScene.remove(currentGroup);
    renderer.dispose();
  }

  rafId = requestAnimationFrame(tick);

  return { setClass, dispose };
}

// ─────────────────────────────────────────────────────────
// API pública
// ─────────────────────────────────────────────────────────

export interface LobbyOptions {
  /** Chamado quando o jogador clica em Jogar. A seleção é a escolha atual do card. */
  onPlay(selection: LobbySelection): void;
  /** Sistema de áudio — para destravar o AudioContext no clique de Jogar. */
  audio: AudioSystem;
  /** Perfil de controle ativo no momento (para sincronizar com o ProfileManager). */
  getCurrentProfile(): ProfileId;
  /** Muda o perfil de controle ativo (ProfileManager). */
  setProfile(id: ProfileId): void;
}

/**
 * Monta o overlay de lobby no body e retorna uma função de remoção.
 * Deve ser chamado antes de qualquer game loop (main.ts).
 */
export function showLobby(opts: LobbyOptions): Promise<LobbySelection> {
  injectLobbyStyles();

  return new Promise<LobbySelection>((resolve) => {
    // ── Estado inicial lido do localStorage ──
    const accountName = getAccount()?.display_name ?? null;
    const loggedInNow = getAuthToken() !== null;

    const storedNick = localStorage.getItem(NICK_KEY);
    let nick: string;
    if (storedNick) {
      nick = storedNick;
    } else if (accountName) {
      nick = accountName;
    } else {
      nick = generateGuestNick();
    }

    let classId = localStorage.getItem(CLASS_KEY) ?? DEFAULT_CLASS_ID;
    if (!CLASS_REGISTRY[classId]) classId = DEFAULT_CLASS_ID;

    const classDef = CLASS_REGISTRY[classId];
    let skinId = localStorage.getItem(SKIN_KEY) ?? classDef.skinIds[0];
    if (!classDef.skinIds.includes(skinId)) skinId = classDef.skinIds[0];

    let profile = opts.getCurrentProfile();

    // Aplica settings vindas do Django (merge servidor→UI), usada tanto no carregamento
    // inicial (jogador já logado) quanto logo após um login/registro bem-sucedido nesta sessão.
    function applyRemoteSettings(remote: DjangoSettings): void {
      // Nick: se servidor tiver valor não-vazio, usa (já sanitizado)
      if (remote.display_name) {
        nick = remote.display_name;
        localStorage.setItem(NICK_KEY, nick);
        const nickInputEl = document.getElementById("lobby-nick-input") as HTMLInputElement | null;
        if (nickInputEl) nickInputEl.value = nick;
      }

      // Perfil de controle
      if (remote.control_profile && ["mouse", "keyboard", "touch"].includes(remote.control_profile)) {
        profile = remote.control_profile as typeof profile;
        opts.setProfile(profile);
        const radios = document.querySelectorAll<HTMLInputElement>('input[name="lobby-profile"]');
        radios.forEach((r) => { r.checked = r.value === profile; });
      }

      // Volume master
      if (typeof remote.volume_master === "number") {
        opts.audio.setMasterVolume(remote.volume_master);
        const sliderEl = document.getElementById("lobby-master-slider") as HTMLInputElement | null;
        const valEl = document.getElementById("lobby-master-val");
        if (sliderEl) sliderEl.value = String(Math.round(remote.volume_master * 100));
        if (valEl) valEl.textContent = `${Math.round(remote.volume_master * 100)}%`;
      }

      // Volume SFX
      if (typeof remote.volume_sfx === "number") {
        opts.audio.setSfxVolume(remote.volume_sfx);
        const sliderEl = document.getElementById("lobby-sfx-slider") as HTMLInputElement | null;
        const valEl = document.getElementById("lobby-sfx-val");
        if (sliderEl) sliderEl.value = String(Math.round(remote.volume_sfx * 100));
        if (valEl) valEl.textContent = `${Math.round(remote.volume_sfx * 100)}%`;
      }

      // Fullscreen pref
      if (typeof remote.fullscreen_pref === "boolean") {
        const fsEl = document.getElementById("lobby-fs-check") as HTMLInputElement | null;
        if (fsEl) fsEl.checked = remote.fullscreen_pref;
      }
    }

    // T-058: carrega settings Django em background ao abrir o card (best-effort)
    // Faz merge sensato: servidor vence localStorage para jogador logado.
    if (loggedInNow) {
      fetchDjangoSettings().then((remote) => {
        if (remote) applyRemoteSettings(remote);
      });
    }

    // ── Overlay ──
    const overlay = document.createElement("div");
    overlay.id = "lobby-overlay";

    // ── Card ──
    const card = document.createElement("div");
    card.id = "lobby-card";
    overlay.appendChild(card);

    // ── Header ──
    const header = document.createElement("div");
    header.id = "lobby-header";
    header.innerHTML = `
      <h1>Attack on Player — Lobby</h1>
      <div id="lobby-auth-badge">
        <span class="dot"></span>
        <span class="name"></span>
      </div>
    `;
    card.appendChild(header);

    // ── Painel de login/registro (a pedido do CD: mora no lobby, não mais num widget
    // flutuante visível durante a partida) — colapsado, abre ao clicar em "entrar" no badge ──
    const authPanel = document.createElement("div");
    authPanel.id = "lobby-auth-panel";
    authPanel.innerHTML = `
      <div class="lobby-auth-tabs">
        <button type="button" class="active" id="lobby-auth-tab-login">Entrar</button>
        <button type="button" id="lobby-auth-tab-register">Registrar</button>
      </div>
      <form id="lobby-auth-form">
        <input id="lobby-auth-email" type="email" placeholder="email" autocomplete="email" required />
        <input id="lobby-auth-password" type="password" placeholder="senha" autocomplete="current-password" required />
        <input id="lobby-auth-display-name" type="text" placeholder="nome (opcional)" maxlength="32" style="display:none" />
        <div id="lobby-auth-error"></div>
        <div class="lobby-auth-form-row">
          <button type="submit" id="lobby-auth-submit">Entrar</button>
          <button type="button" id="lobby-auth-cancel">✕</button>
        </div>
      </form>
    `;
    card.appendChild(authPanel);

    // ── Painéis (tabs) ──
    const panels = document.createElement("div");
    panels.id = "lobby-panels";

    // Panel principal (classe, preview, settings)
    const mainPanel = document.createElement("div");
    mainPanel.className = "lobby-panel active";
    mainPanel.id = "lobby-panel-main";

    // ── Corpo do panel principal ──
    const body = document.createElement("div");
    body.id = "lobby-body";
    mainPanel.appendChild(body);

    // ─── Coluna esquerda: identidade + settings ───
    const left = document.createElement("div");
    left.id = "lobby-left";

    // Nick
    left.innerHTML += `
      <div>
        <div class="lobby-section-label">Seu Nick</div>
        <input id="lobby-nick-input" type="text" maxlength="20"
               autocomplete="username" value="${nick.replace(/"/g, "&quot;")}"
               placeholder="Guest#XXXXX" />
        <div id="lobby-nick-error"></div>
      </div>
    `;

    // Perfil de controle
    left.innerHTML += `
      <div>
        <div class="lobby-section-label">Perfil de Controle</div>
        <div class="lobby-radio-group">
          <label class="lobby-radio-row">
            <input type="radio" name="lobby-profile" value="mouse" ${profile === "mouse" ? "checked" : ""} />
            Mouse (WASD + mira 360°)
          </label>
          <label class="lobby-radio-row">
            <input type="radio" name="lobby-profile" value="keyboard" ${profile === "keyboard" ? "checked" : ""} />
            Teclado (setas)
          </label>
          <label class="lobby-radio-row">
            <input type="radio" name="lobby-profile" value="touch" ${profile === "touch" ? "checked" : ""} />
            Touch (twin-stick)
          </label>
        </div>
      </div>
    `;

    // Volumes
    const masterVol = Math.round(opts.audio.getMasterVolume() * 100);
    const sfxVol = Math.round(opts.audio.getSfxVolume() * 100);
    left.innerHTML += `
      <div>
        <div class="lobby-section-label">Áudio</div>
        <div class="lobby-slider-row">
          <span class="lobby-slider-label">Master</span>
          <input id="lobby-master-slider" class="lobby-slider" type="range" min="0" max="100" value="${masterVol}" />
          <span class="lobby-slider-val" id="lobby-master-val">${masterVol}%</span>
        </div>
        <div class="lobby-slider-row" style="margin-top:6px">
          <span class="lobby-slider-label">SFX</span>
          <input id="lobby-sfx-slider" class="lobby-slider" type="range" min="0" max="100" value="${sfxVol}" />
          <span class="lobby-slider-val" id="lobby-sfx-val">${sfxVol}%</span>
        </div>
      </div>
    `;

    // Fullscreen
    const fsActive = document.fullscreenElement != null;
    left.innerHTML += `
      <div>
        <div class="lobby-section-label">Display</div>
        <label class="lobby-fullscreen-row">
          <input id="lobby-fs-check" type="checkbox" ${fsActive ? "checked" : ""} />
          Tela cheia ⛶
        </label>
      </div>
    `;

    body.appendChild(left);

    // ─── Coluna direita: classe + preview ───
    const right = document.createElement("div");
    right.id = "lobby-right";

    // T-062: tabs para Main/Ranking
    const tabs = document.createElement("div");
    tabs.id = "lobby-tabs";
    tabs.innerHTML = `
      <button type="button" class="lobby-tab active" id="lobby-tab-main">Principal</button>
      <button type="button" class="lobby-tab" id="lobby-tab-ranking">Ranking</button>
    `;
    // tabs será appendado ao card após panels ser montado

    // Classe
    const classNames = Object.keys(CLASS_REGISTRY);
    const classCardsHtml = classNames
      .map((cid) => {
        const def = CLASS_REGISTRY[cid];
        const label = cid.charAt(0).toUpperCase() + cid.slice(1);
        return `<button type="button" class="lobby-class-card ${cid === classId ? "selected" : ""}" data-class="${cid}">${label}</button>`;
      })
      .join("");

    right.innerHTML += `
      <div>
        <div class="lobby-section-label">Classe</div>
        <div class="lobby-class-cards">${classCardsHtml}</div>
      </div>
    `;

    // Skin
    const skinsHtml = classDef.skinIds
      .map((sid) => {
        const label = sid.charAt(0).toUpperCase() + sid.slice(1);
        return `<option value="${sid}" ${sid === skinId ? "selected" : ""}>${label}</option>`;
      })
      .join("");
    right.innerHTML += `
      <div>
        <div class="lobby-section-label">Skin</div>
        <select id="lobby-skin-select" class="lobby-skin-select">${skinsHtml}</select>
      </div>
    `;

    // Preview 3D
    right.innerHTML += `
      <div>
        <div class="lobby-section-label">Preview</div>
        <div id="lobby-preview-wrap">
          <canvas id="lobby-preview-canvas"></canvas>
        </div>
      </div>
    `;

    body.appendChild(right);

    // Panel de Ranking (T-062)
    const rankingPanel = document.createElement("div");
    rankingPanel.className = "lobby-panel";
    rankingPanel.id = "lobby-panel-ranking";
    rankingPanel.innerHTML = '<div class="lobby-ranking-loading">Carregando ranking...</div>';

    panels.appendChild(mainPanel);
    panels.appendChild(rankingPanel);

    // ── Footer: botão Jogar ──
    const footer = document.createElement("div");
    footer.id = "lobby-footer";
    footer.innerHTML = `
      <button id="lobby-play-btn" type="button">▶ JOGAR</button>
      <span id="lobby-connecting"></span>
    `;

    // Montagem linear explícita: header → tabs → panels → footer
    card.appendChild(tabs);
    card.appendChild(panels);
    card.appendChild(footer);

    document.body.appendChild(overlay);

    // ── Referências DOM (obtidas após append) ──
    const nickInput = document.getElementById("lobby-nick-input") as HTMLInputElement;
    const nickError = document.getElementById("lobby-nick-error")!;
    const profileRadios = overlay.querySelectorAll<HTMLInputElement>('input[name="lobby-profile"]');
    const masterSlider = document.getElementById("lobby-master-slider") as HTMLInputElement;
    const masterVal = document.getElementById("lobby-master-val")!;
    const sfxSlider = document.getElementById("lobby-sfx-slider") as HTMLInputElement;
    const sfxVal = document.getElementById("lobby-sfx-val")!;
    const fsCheck = document.getElementById("lobby-fs-check") as HTMLInputElement;
    const classCardEls = overlay.querySelectorAll<HTMLButtonElement>(".lobby-class-card");
    const skinSelect = document.getElementById("lobby-skin-select") as HTMLSelectElement;
    const playBtn = document.getElementById("lobby-play-btn") as HTMLButtonElement;
    const connectingEl = document.getElementById("lobby-connecting")!;
    const authBadge = document.getElementById("lobby-auth-badge") as HTMLDivElement;
    const authBadgeName = authBadge.querySelector(".name") as HTMLSpanElement;
    const authPanelEl = document.getElementById("lobby-auth-panel") as HTMLDivElement;
    const authTabLogin = document.getElementById("lobby-auth-tab-login") as HTMLButtonElement;
    const authTabRegister = document.getElementById("lobby-auth-tab-register") as HTMLButtonElement;
    const authForm = document.getElementById("lobby-auth-form") as HTMLFormElement;
    const authEmail = document.getElementById("lobby-auth-email") as HTMLInputElement;
    const authPassword = document.getElementById("lobby-auth-password") as HTMLInputElement;
    const authDisplayName = document.getElementById("lobby-auth-display-name") as HTMLInputElement;
    const authSubmit = document.getElementById("lobby-auth-submit") as HTMLButtonElement;
    const authCancel = document.getElementById("lobby-auth-cancel") as HTMLButtonElement;
    const authError = document.getElementById("lobby-auth-error")!;

    // T-062: Ranking tab
    const tabMain = document.getElementById("lobby-tab-main") as HTMLButtonElement;
    const tabRanking = document.getElementById("lobby-tab-ranking") as HTMLButtonElement;
    const panelMain = document.getElementById("lobby-panel-main") as HTMLDivElement;
    const panelRanking = document.getElementById("lobby-panel-ranking") as HTMLDivElement;

    // ── T-062: Renderização do painel de Ranking ──
    async function loadAndRenderRanking(): Promise<void> {
      panelRanking.innerHTML = '<div class="lobby-ranking-loading">Carregando ranking...</div>';

      const [stats, ranking] = await Promise.all([
        fetchPlayerStats(),
        fetchRanking(1),
      ]);

      if (!stats && !ranking) {
        // Ambos falharam: mostrar estado vazio
        panelRanking.innerHTML = `
          <div class="lobby-ranking-empty">
            Ranking indisponível.<br/>
            <span style="font-size: 10px; color: #555;">(backend offline?)</span>
          </div>
        `;
        return;
      }

      let html = "";

      // Seção de stats pessoais (se logado e disponível)
      if (stats) {
        const kda = stats.deaths > 0 ? (stats.kills / stats.deaths).toFixed(2) : stats.kills.toFixed(2);
        html += `
          <div class="lobby-stats-box">
            <div class="lobby-stats-row">
              <span>Kills</span>
              <span>${stats.kills}</span>
            </div>
            <div class="lobby-stats-row">
              <span>Deaths</span>
              <span>${stats.deaths}</span>
            </div>
            <div class="lobby-stats-row">
              <span>K/D</span>
              <span>${kda}</span>
            </div>
            <div class="lobby-stats-row">
              <span>Partidas</span>
              <span>${stats.matches_played}</span>
            </div>
          </div>
        `;
      }

      // Tabela de ranking
      if (ranking && ranking.results.length > 0) {
        html += `
          <table class="lobby-ranking-table">
            <thead>
              <tr>
                <th style="width: 32px;">Pos</th>
                <th>Nome</th>
                <th class="stat" style="width: 48px;">Kills</th>
                <th class="stat" style="width: 48px;">Deaths</th>
              </tr>
            </thead>
            <tbody>
        `;

        ranking.results.forEach((entry, idx) => {
          const pos = idx + 1;
          html += `
            <tr>
              <td class="rank">#${pos}</td>
              <td class="name">${entry.display_name.substring(0, 20)}</td>
              <td class="stat">${entry.kills}</td>
              <td class="stat">${entry.deaths}</td>
            </tr>
          `;
        });

        html += `
            </tbody>
          </table>
        `;
      } else if (ranking) {
        html += '<div class="lobby-ranking-empty">Nenhuma entrada no ranking.</div>';
      }

      panelRanking.innerHTML = html;
    }

    // ── Preview 3D ──
    const previewCanvas = document.getElementById("lobby-preview-canvas") as HTMLCanvasElement;
    const preview = createPreviewRenderer(previewCanvas);
    preview.setClass(classId, skinId);

    // ── Eventos ──

    // T-062: Tab switching
    function switchTab(activeTab: string): void {
      const tabs = overlay.querySelectorAll<HTMLButtonElement>(".lobby-tab");
      const panels = overlay.querySelectorAll<HTMLDivElement>(".lobby-panel");

      tabs.forEach((t) => {
        const isActive = (t.id === "lobby-tab-main" && activeTab === "main") ||
                         (t.id === "lobby-tab-ranking" && activeTab === "ranking");
        t.classList.toggle("active", isActive);
      });

      panels.forEach((p) => {
        const isActive = (p.id === "lobby-panel-main" && activeTab === "main") ||
                         (p.id === "lobby-panel-ranking" && activeTab === "ranking");
        p.classList.toggle("active", isActive);
      });

      // Carrega ranking ao abrir a aba (lazy-load)
      if (activeTab === "ranking") {
        loadAndRenderRanking();
      }
    }

    tabMain.addEventListener("click", () => switchTab("main"));
    tabRanking.addEventListener("click", () => switchTab("ranking"));

    // ── Identidade: badge (guest/conta) + painel de login/registro ──

    function renderAuthBadge(): void {
      const account = getAccount();
      authBadge.classList.toggle("logged-in", account != null);
      authBadgeName.textContent = account ? account.display_name : "anônimo";
      authBadge.querySelector("#lobby-logout-btn")?.remove();
      authBadge.querySelector("#lobby-auth-toggle-btn")?.remove();

      const btn = document.createElement("button");
      btn.type = "button";
      if (account) {
        btn.id = "lobby-logout-btn";
        btn.textContent = "sair";
        btn.addEventListener("click", handleLogout);
      } else {
        btn.id = "lobby-auth-toggle-btn";
        btn.textContent = "entrar";
        btn.addEventListener("click", toggleAuthPanel);
      }
      authBadge.appendChild(btn);
    }

    function handleLogout(): void {
      clearSession();
      renderAuthBadge();
    }

    function setAuthMode(next: "login" | "register"): void {
      authTabLogin.classList.toggle("active", next === "login");
      authTabRegister.classList.toggle("active", next === "register");
      authDisplayName.style.display = next === "register" ? "block" : "none";
      authSubmit.textContent = next === "login" ? "Entrar" : "Registrar";
      authPassword.autocomplete = next === "login" ? "current-password" : "new-password";
      authError.textContent = "";
    }

    function openAuthPanel(): void {
      authPanelEl.classList.add("open");
      authError.textContent = "";
      authEmail.focus();
    }

    function closeAuthPanel(): void {
      authPanelEl.classList.remove("open");
      authForm.reset();
    }

    function toggleAuthPanel(): void {
      if (authPanelEl.classList.contains("open")) closeAuthPanel();
      else openAuthPanel();
    }

    authTabLogin.addEventListener("click", () => setAuthMode("login"));
    authTabRegister.addEventListener("click", () => setAuthMode("register"));
    authCancel.addEventListener("click", closeAuthPanel);

    async function handleAuthSubmit(e: SubmitEvent): Promise<void> {
      e.preventDefault();
      authError.textContent = "";
      authSubmit.disabled = true;
      try {
        const email = authEmail.value.trim();
        const password = authPassword.value;
        const isRegister = authTabRegister.classList.contains("active");
        const account = isRegister
          ? await register(email, password, authDisplayName.value.trim())
          : await login(email, password);

        renderAuthBadge();
        closeAuthPanel();

        // Se o nick ainda for o guest gerado automaticamente e não foi customizado, adota
        // o nome da conta recém-logada.
        if (nick.startsWith("Guest#")) {
          nick = account.display_name;
          localStorage.setItem(NICK_KEY, nick);
          nickInput.value = nick;
        }

        // Sincroniza settings remotas (perfil/volume/fullscreen) da conta recém-logada.
        const remote = await fetchDjangoSettings();
        if (remote) applyRemoteSettings(remote);
      } catch (err) {
        authError.textContent = (err as Error).message;
      } finally {
        authSubmit.disabled = false;
      }
    }

    authForm.addEventListener("submit", (e) => void handleAuthSubmit(e));

    renderAuthBadge();
    setAuthMode("login");

    // Nick
    nickInput.addEventListener("input", () => {
      const raw = nickInput.value;
      const sanitized = sanitizeNick(raw);
      nick = sanitized;
      if (!isValidNick(sanitized)) {
        nickError.textContent = "Nick não pode ficar em branco.";
      } else {
        nickError.textContent = "";
      }
      // Persiste ao digitar (best-effort; T-058 sincroniza com Django)
      if (isValidNick(sanitized)) localStorage.setItem(NICK_KEY, sanitized);
    });

    // Perfil de controle
    profileRadios.forEach((radio) => {
      radio.addEventListener("change", () => {
        if (radio.checked) {
          profile = radio.value as ProfileId;
          opts.setProfile(profile);
        }
      });
    });

    // Volumes
    masterSlider.addEventListener("input", () => {
      const v = Number(masterSlider.value) / 100;
      opts.audio.setMasterVolume(v);
      masterVal.textContent = `${masterSlider.value}%`;
    });
    sfxSlider.addEventListener("input", () => {
      const v = Number(sfxSlider.value) / 100;
      opts.audio.setSfxVolume(v);
      sfxVal.textContent = `${sfxSlider.value}%`;
    });

    // Fullscreen
    fsCheck.addEventListener("change", () => {
      if (fsCheck.checked) {
        document.documentElement.requestFullscreen?.().catch(() => {
          fsCheck.checked = false;
        });
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    });
    document.addEventListener("fullscreenchange", () => {
      fsCheck.checked = document.fullscreenElement != null;
    });

    // Seleção de classe
    function selectClass(cid: string): void {
      if (!CLASS_REGISTRY[cid]) return;
      classId = cid;
      localStorage.setItem(CLASS_KEY, classId);

      const def = CLASS_REGISTRY[classId];
      // Atualiza skins disponíveis
      skinId = def.skinIds[0];
      skinSelect.innerHTML = def.skinIds
        .map((sid) => {
          const label = sid.charAt(0).toUpperCase() + sid.slice(1);
          return `<option value="${sid}">${label}</option>`;
        })
        .join("");
      skinSelect.value = skinId;
      localStorage.setItem(SKIN_KEY, skinId);

      // Atualiza destaque dos cards
      classCardEls.forEach((el) => {
        el.classList.toggle("selected", el.dataset.class === classId);
      });

      // Atualiza preview
      preview.setClass(classId, skinId);
    }

    classCardEls.forEach((btn) => {
      btn.addEventListener("click", () => selectClass(btn.dataset.class ?? DEFAULT_CLASS_ID));
    });

    // Skin
    skinSelect.addEventListener("change", () => {
      skinId = skinSelect.value;
      localStorage.setItem(SKIN_KEY, skinId);
      preview.setClass(classId, skinId);
    });

    // Botão Jogar
    function handlePlay(): void {
      const cleanNick = sanitizeNick(nickInput.value);
      if (!isValidNick(cleanNick)) {
        nickError.textContent = "Nick não pode ficar em branco.";
        nickInput.focus();
        return;
      }
      nick = cleanNick;
      localStorage.setItem(NICK_KEY, nick);

      // Destrava o AudioContext (gesto de usuário — regra de autoplay dos browsers)
      opts.audio.unlock();

      playBtn.disabled = true;
      connectingEl.textContent = "Conectando...";

      const selection: LobbySelection = { nick, classId, skinId, profile };

      // T-058: sync settings para Django quando logado (best-effort, não bloqueia join)
      if (getAuthToken() !== null) {
        const payload: Partial<DjangoSettings> = {
          display_name: nick,
          control_profile: profile,
          volume_master: opts.audio.getMasterVolume(),
          volume_sfx: opts.audio.getSfxVolume(),
          fullscreen_pref: document.fullscreenElement != null,
        };
        // Fire-and-forget: atualiza nick local com valor sanitizado se disponível
        saveDjangoSettings(payload).then((sanitizedNick) => {
          if (sanitizedNick) selection.nick = sanitizedNick;
        });
      }

      // Remove overlay e resolve
      preview.dispose();
      overlay.remove();

      resolve(selection);
    }

    playBtn.addEventListener("click", handlePlay);

    // Ao recarregar, sincroniza estado com o fullscreen real
    document.addEventListener("fullscreenchange", () => {
      if (fsCheck) fsCheck.checked = document.fullscreenElement != null;
    }, { once: false });
  });
}
