# PROMPT-0064 — Mobile: HUD compacto + tela cheia paisagem

**Data:** 2026-07-07 · **Sessão:** 47 · **Task:** T-064 (fora de fase, pedido direto do CD)

## Pedido do CD

> "Quero fazer um ajuste para o ambiente mobile (acessando pelo navegador) de conseguir
> colocar em full screen e jogar com o celular 'deitado', no mobile eu quero que apareça
> apenas a informação da quantidade de players, para a janela não ficar grande, deixa os
> componentes responsivos para o modo mobile sem afetar a jogabilidade."

## Contexto encontrado

- Tela cheia já existia (T-048/SPEC-0012, `immersion.ts` + botão `#fullscreen-toggle`) —
  não foi preciso criar do zero.
- Perfil de controle touch já tinha auto-detecção por heurística de dispositivo
  (`packages/client/src/input/manager.ts:detectDefaultProfile`, ADR-015):
  `matchMedia("(pointer: coarse)")` + `navigator.maxTouchPoints`/`ontouchstart`.
- HUD/roster são DOM puro (sem framework), CSS inline em `index.html`; único precedente de
  media query no client era `lobby.ts:468` (`max-width: 599px`).
- Roster (`hud.ts`) já mostrava lista completa (nome/HP/nível/tags) de todos os players —
  o pedido era substituir por só a contagem no mobile, não remover em geral (CD já havia
  pedido roster visível em produção, T-057).

## Decisões

1. **Detecção de mobile = dispositivo, não viewport.** Reusei a heurística já validada do
   perfil de controle (`isCoarsePointerDevice()`, extraída de `detectDefaultProfile` sem
   mudar comportamento) em vez de `max-width`. Um desktop com janela estreita não deve virar
   "mobile"; um celular deve, independente da largura da janela. Aplicada uma vez no boot
   via `document.body.classList.add("mobile-layout")` em `initImmersion()`.
2. **Roster → contagem no mobile.** `hud.ts` ganhou um branch cedo em `updateHud`: se
   `body.mobile-layout`, renderiza `<div class="roster-count">👥 N</div>` e retorna, sem
   montar a tabela de players. Nada mudou pro caminho desktop.
3. **CSS compacto sob `body.mobile-layout`** em `index.html`: HUD encolhe (244px→168px,
   badge/barras menores), roster perde `min-width`, `#auth-widget` sobe (172px) pra não
   flertar com a área do analógico de movimento (`#touch-move-base`, que ocupa até ~148px
   do rodapé). Hint "[Tab] atributos" (sem sentido em touch, não existe teclado) escondido.
4. **Paisagem no fullscreen (best-effort).** `immersion.ts` tenta
   `screen.orientation.lock("landscape")` só quando `mobile-layout` + fullscreen ativo;
   `.catch()` engole falha silenciosamente (iOS Safari e a maioria dos desktops rejeitam ou
   nem expõem `lock`) — o botão de tela cheia já resolve a imersão sozinho, o lock é um
   extra oportunista. Unlock no fullscreenchange quando sai da tela cheia.
5. **Resize em rotação.** `main.ts` já tinha `resize` pro canvas Three.js; adicionado
   `screen.orientation.addEventListener("change", ...)` com `setTimeout(50ms)` como reforço
   — alguns navegadores mobile atrasam o `resize` até o fim da animação de rotação do SO.
6. **Não fiz:** overlay bloqueante de "gire o celular" em modo retrato. O pedido foi
   viabilizar tela cheia + paisagem, não impedir jogar em retrato — bloquear seria "afetar a
   jogabilidade" sem ter sido pedido.

## Follow-up (mesmo dia): bugs achados pelo CD em device físico (iPhone)

CD testou num iPhone real e reportou dois problemas ao vivo: (1) tocar em tela cheia
desligava os analógicos touch; (2) a tela cheia nunca escondia a barra de URL/favoritos.

- **(1) Causa raiz — bug pré-existente do T-048, não desta sessão:** `#fullscreen-toggle`
  vive dentro do mesmo `#profile-selector` dos botões de perfil (`main.ts`). O código pegava
  `querySelectorAll("#profile-selector button")` (todos os botões do container) pra ligar
  clique → `profileManager.select(btn.dataset.profile)`. O botão de tela cheia não tem
  `data-profile`, então `select(undefined)` caía no `default` de `ProfileManager.build()`
  (perfil `mouse`) — todo toque em ⛶ trocava silenciosamente de touch pra mouse, desligando
  o joystick. **Fix:** seletor virou `#profile-selector button[data-profile]`
  (`main.ts:717`), excluindo o botão de tela cheia dessa lista. Confirmado em preview: clicar
  em ⛶ com perfil touch ativo não muda mais `body.touch-profile` nem o botão ativo do
  seletor.
- **(2) Causa raiz — limitação de plataforma, não bug:** iOS Safari nunca implementou
  Fullscreen API pra elemento genérico (só `<video>`), em nenhuma versão, standalone ou não.
  `document.documentElement.requestFullscreen` simplesmente não existe lá — o único jeito
  real de esconder a barra de URL é abrir o jogo por um ícone adicionado à Tela de Início
  (modo standalone). **Fix:** `immersion.ts` agora detecta `hasFullscreenApi` (feature
  detection) e `isIOSStandalone` (`navigator.standalone`); se a API não existe e não está
  standalone, o toque no botão mostra um toast orientando "adicione à Tela de Início" em vez
  de tentar e falhar em silêncio; o título/tooltip do botão já reflete isso sem precisar
  clicar. `index.html` ganhou as meta tags `apple-mobile-web-app-capable` +
  `apple-mobile-web-app-status-bar-style` + `apple-mobile-web-app-title` (ativam o modo
  standalone real quando adicionado à Tela de Início) e `viewport-fit=cover` (necessário pra
  `env(safe-area-inset-*)` funcionar).
- **Bônus de robustez (não reportado, achado ao revisar o código pra corrigir o acima):**
  `orientation?.lock?.("landscape").catch(...)` e
  `document.documentElement.requestFullscreen?.().catch(...)` tinham o mesmo padrão de bug —
  optional chaining protege a *chamada*, mas não o `.catch()` encadeado fora da cadeia: se
  `lock`/`requestFullscreen` não existisse, a expressão encurtava pra `undefined` e
  `undefined.catch(...)` lançava `TypeError`, quebrando o handler de `fullscreenchange`
  inteiro. Corrigido pra `?.catch(...)` (chaining também no catch) nos dois lugares.
- **Bônus de layout:** `.touch-stick-base` ganhou `env(safe-area-inset-*)` (bottom/left/right)
  — em paisagem no iPhone o notch/home indicator ficam nas laterais/embaixo; sem isso os
  analógicos ficariam parcialmente sob o recorte da tela. Zero efeito fora do iOS (a `env()`
  vale 0 sem `viewport-fit=cover`, que só foi adicionado agora).
- **Ainda não corrigível via código:** a barra de URL do Safari continuará aparecendo
  enquanto o jogo for acessado como aba normal (não instalado) — isso é esperado e não é bug.
  Vale considerar documentar/orientar o jogador (ex.: toast já cobre isso) ou, no futuro, um
  manifest.json completo pra virar PWA instalável de verdade (fora de escopo deste pedido).

## Gates

- `tsc --noEmit` em `packages/client` — limpo.
- `tsc --noEmit` em `packages/server` — limpo (não deveria ter sido afetado; confirmado).
- `npm run test -w @aop/shared` — 49/49 (não afetado, só confirma que nada vazou).
- `npm run build -w @aop/client` (vite build) — OK.
- Preview headless (`server-verify`/`client-verify`): `document.body.classList.add
  ("mobile-layout")` manual (o Electron/CDP deste sandbox não emula `pointer: coarse`) +
  estilos computados confirmam `#hud` 244px→168px, `#roster` lista→pill de 54×30px com
  "👥 N", `#auth-widget` bottom 172px. Screenshot do preview travou (timeout) neste
  sandbox — parece limitação de ambiente (Electron), não regressão: accessibility snapshot
  e estilos computados foram usados como prova alternativa.
- **Não testado em device físico real** (iOS/Android) — pendência natural de qualquer
  ajuste mobile feito em preview headless; recomendo o CD confirmar num celular real,
  principalmente o `screen.orientation.lock` (suporte varia muito por navegador).

- Gates do follow-up: `tsc --noEmit` limpo, `vite build` OK, preview headless confirma que
  clicar em ⛶ com perfil touch ativo não troca mais de perfil (bug 1) e não gera erro no
  console. Bug 2 é limitação de plataforma — não há "teste que passa" pra isso além de
  instalar na Tela de Início num iPhone real e confirmar visualmente (não feito nesta sessão,
  fica pro CD confirmar).

## Arquivos

`packages/client/src/{immersion,hud,input/manager,main}.ts`, `packages/client/index.html`.
