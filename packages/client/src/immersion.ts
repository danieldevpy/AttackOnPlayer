/**
 * T-048 (SPEC-0012): imersão de navegador — tela cheia + blindagem contra ações do
 * browser que não são do jogo (menu de contexto, zoom, seleção de texto, auto-scroll do
 * meio do mouse, drag nativo, fechar/recarregar sem querer no meio da partida).
 * Client-only: zero mudança de contrato de rede/servidor.
 */

import { isCoarsePointerDevice } from "./input/manager";
import { pushToast } from "./hud";

const fullscreenBtn = document.getElementById("fullscreen-toggle") as HTMLButtonElement | null;

// iOS Safari nunca implementou Fullscreen API pra elemento genérico (só <video>, via API
// própria) — nem em modo standalone (PWA). `requestFullscreen` simplesmente não existe lá,
// em qualquer versão. O único jeito real de esconder a barra de URL no iPhone é abrir o jogo
// por um ícone adicionado à Tela de Início (`apple-mobile-web-app-capable`, ver index.html).
const hasFullscreenApi = !!document.documentElement.requestFullscreen;
const isIOSStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true;

function isFullscreen(): boolean {
  return document.fullscreenElement != null;
}

function updateFullscreenIcon(): void {
  if (!fullscreenBtn) return;
  fullscreenBtn.classList.toggle("active", isFullscreen() || isIOSStandalone);
  if (isIOSStandalone) {
    fullscreenBtn.title = "Já em tela cheia (instalado na Tela de Início)";
  } else if (!hasFullscreenApi) {
    fullscreenBtn.title = "iOS: adicione à Tela de Início pra jogar em tela cheia";
  } else {
    fullscreenBtn.title = isFullscreen() ? "Sair da tela cheia" : "Tela cheia";
  }
}

/** Mobile: trava paisagem só faz sentido em tela cheia num dispositivo touch — em desktop
 * o navegador nem expõe `lock` (ou rejeita), então isto é sempre best-effort/silencioso. */
type LockableOrientation = ScreenOrientation & { lock?(orientation: string): Promise<void> };

function tryLockLandscape(): void {
  const orientation = screen.orientation as LockableOrientation | undefined;
  // `?.catch` (não só `?.lock?.`): se `lock` não existir, a chamada encurta pra
  // `undefined` e `.catch` direto nele derrubava com TypeError — bug real achado em
  // device físico (T-064), quebrava o handler de fullscreenchange inteiro.
  orientation?.lock?.("landscape")?.catch(() => {
    // iOS Safari e a maioria dos desktops não suportam/permitem — o botão de tela cheia
    // já resolve a imersão; o lock é só um extra quando o navegador aceita.
  });
}

function onFullscreenChange(): void {
  updateFullscreenIcon();
  if (isFullscreen() && document.body.classList.contains("mobile-layout")) {
    tryLockLandscape();
  } else {
    (screen.orientation as LockableOrientation | undefined)?.unlock?.();
  }
}

function toggleFullscreen(): void {
  if (isFullscreen()) {
    document.exitFullscreen?.();
    return;
  }
  if (!hasFullscreenApi) {
    // iOS Safari: não adianta chamar e falhar silenciosamente — orienta o real caminho
    // (a API não existe aqui, instalado ou não; só a Tela de Início muda a experiência).
    if (!isIOSStandalone) {
      pushToast("📲 Adicione à Tela de Início (compartilhar ⬆️) pra jogar em tela cheia");
    }
    return;
  }
  // `?.catch` (não só `?.()`): navegador sem `requestFullscreen` faria `?.()` encurtar pra
  // `undefined` e `.catch` direto nele derrubava com TypeError — já coberto por
  // `hasFullscreenApi` acima, mas mantém a chamada seguindo o mesmo padrão defensivo.
  document.documentElement.requestFullscreen?.()?.catch(() => {
    // navegador recusou (ex.: sem gesto do usuário) — botão continua disponível pra tentar de novo.
  });
}

/** Layout compacto de mobile (roster só com contagem, painéis menores): mesma heurística de
 * dispositivo touch do perfil de controle (ADR-015) — dispositivo, não o perfil escolhido. */
function applyMobileLayout(): void {
  document.body.classList.toggle("mobile-layout", isCoarsePointerDevice());
}

/** Blindagens sempre ativas — não dependem de estado de conexão. */
function attachAlwaysOn(): void {
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  // clique do meio: evita o ícone de auto-scroll do navegador (Windows/Linux).
  document.addEventListener("mousedown", (e) => {
    if (e.button === 1) e.preventDefault();
  });
  // Ctrl/Cmd+scroll não deve dar zoom na página durante o jogo.
  document.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    },
    { passive: false }
  );
  // Safari (iOS/macOS trackpad) dispara gesturestart/change/end para pinch-zoom.
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  document.addEventListener("dragstart", (e) => e.preventDefault());

  fullscreenBtn?.addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", onFullscreenChange);
  updateFullscreenIcon();
}

/** Confirmação nativa de saída (fechar/recarregar aba) — só liga com partida em andamento. */
function onBeforeUnload(e: BeforeUnloadEvent): void {
  e.preventDefault();
  e.returnValue = "";
}

export function setUnloadGuard(active: boolean): void {
  removeEventListener("beforeunload", onBeforeUnload);
  if (active) addEventListener("beforeunload", onBeforeUnload);
}

export function initImmersion(): void {
  attachAlwaysOn();
  applyMobileLayout();
}
