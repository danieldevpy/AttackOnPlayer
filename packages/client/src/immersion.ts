/**
 * T-048 (SPEC-0012): imersão de navegador — tela cheia + blindagem contra ações do
 * browser que não são do jogo (menu de contexto, zoom, seleção de texto, auto-scroll do
 * meio do mouse, drag nativo, fechar/recarregar sem querer no meio da partida).
 * Client-only: zero mudança de contrato de rede/servidor.
 */

const fullscreenBtn = document.getElementById("fullscreen-toggle") as HTMLButtonElement | null;

function isFullscreen(): boolean {
  return document.fullscreenElement != null;
}

function updateFullscreenIcon(): void {
  if (!fullscreenBtn) return;
  fullscreenBtn.classList.toggle("active", isFullscreen());
  fullscreenBtn.title = isFullscreen() ? "Sair da tela cheia" : "Tela cheia";
}

function toggleFullscreen(): void {
  if (isFullscreen()) {
    document.exitFullscreen?.();
  } else {
    document.documentElement.requestFullscreen?.().catch(() => {
      // navegador recusou (ex.: sem gesto do usuário) — botão continua disponível pra tentar de novo
    });
  }
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
  document.addEventListener("fullscreenchange", updateFullscreenIcon);
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
}
