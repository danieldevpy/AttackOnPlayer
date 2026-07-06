# PROMPT-0043 — T-048: imersão de navegador (SPEC-0012) · 2026-07-06

## Pedido (resumo fiel do CD)
"Antes de desenvolver novas tasks, quero que o jogo ganhe uma imersão no navegador, estilo
tela cheia, sem que atalhos, cliques errados e etc, atrapalhem o jogador." Pedido direto, fora
da fila V1 (que estava em T-028 — auth Google/registro).

## Decisões tomadas (e por quem)
- **Spec curta antes de implementar (IA, seguindo o processo de `AGENTS.md` §Processo de
  feature):** feature fora do backlog vira `specs/SPEC-0012-imersao-navegador.md` mesmo sendo
  pequena — o pedido do CD no chat já conta como a aprovação (registrada na própria spec).
- **Sem ADR (IA):** é blindagem de UX client-only, não decisão arquitetural — os profiles de
  controle (mouse/teclado) já faziam `preventDefault` pontual (espaço, setas); isto generaliza
  o princípio pro documento inteiro, não muda contrato de rede nem estado.
- **Módulo novo dedicado (`packages/client/src/immersion.ts`), não espalhado em `main.ts`
  (IA):** as blindagens (contextmenu, clique-do-meio, ctrl+scroll, gesturestart, dragstart) são
  sempre-ativas e independentes de perfil de controle ou de conexão — meter no `main.ts` junto
  com lógica de rede/render misturaria duas responsabilidades sem necessidade.
- **Botão de tela cheia dentro do `#profile-selector` existente, não um novo canto da tela
  (IA):** os cantos já estão ocupados (HUD top-left, roster top-right, toasts bottom-right) —
  reusar a barra de perfis (topo-centro) evita colisão de layout e seguiu o padrão visual já
  existente (mesmo grupo de botões, divisória sutil `border-left`).
- **`beforeunload` liga só com sala conectada, não sempre (IA):** confirmação de saída em toda
  visita à página (antes mesmo de conectar) seria intrusiva sem propósito — a guarda liga no
  `client.joinOrCreate` bem-sucedido e desliga em `room.onLeave`/`room.onError` (novos handlers,
  não existiam antes neste arquivo).
- **Ícone único do botão, sem troca de glifo por estado (IA):** glifos de "compress/expand"
  variam de suporte por fonte/SO; a classe `.active` (cor/borda âmbar, mesmo padrão dos botões
  de perfil) já comunica o estado ligado sem depender de um glifo específico renderizar igual
  em todo navegador.
- **`user-select: none` global com exceção só no overlay de debug (IA):** overlay F3 é dev-only
  e frequentemente usado pra copiar valores de estado ao depurar — `#debug-overlay, #debug-overlay *
  { user-select: text }` sobrescreve a regra global só ali.

## Resultado verificado
- **Gates inalterados** (mudança é 100% client-side): shared **30/30** · server **70/70** ·
  bots **35/35** · `tsc --noEmit` limpo em `packages/client`.
- **Verificação em browser real (preview, `server-verify`:2604 + `client-verify`:5299)**, já
  que Fullscreen API/`beforeunload` não são exercitáveis por bots headless nem screenshot no
  ambiente sem GPU (mesma limitação de `document.hidden` já registrada em `SESSAO_ATUAL.md`):
  - HUD renderizou de ponta a ponta com o servidor real (nível/HP/XP/atributos/toasts) — conexão
    e `setUnloadGuard` não quebraram o fluxo de join.
  - `#fullscreen-toggle` presente no DOM, clicável, sem erro de console (a rejeição da
    Fullscreen API por falta de gesto real do usuário no ambiente automatizado é engolida pelo
    `.catch()`, como esperado).
  - Disparo sintético de `contextmenu`/`wheel` (ctrl)/`dragstart` no documento: os três chegam
    com `defaultPrevented === true`.
  - `getComputedStyle(html)`: `touch-action: none` e `user-select: none` confirmados globais;
    `#debug-state` confirma `user-select: text` (exceção do overlay preservada).
- **Não verificável neste ambiente (fica para o CD num browser de verdade):** entrar de fato em
  tela cheia (exige gesto real de clique) e o diálogo nativo de confirmação do `beforeunload`
  ao fechar/recarregar a aba.

## Docs atualizados
`specs/SPEC-0012-imersao-navegador.md` (nova) · `docs/BACKLOG.md` (T-048) · `docs/DEVLOG.md` ·
`docs/SESSAO_ATUAL.md`.
