# SPEC-0012 — Imersão de navegador (tela cheia + blindagem contra ações acidentais)

**Status:** aprovada · **Marco:** V1 (fora de fase, pedido direto do CD) · **Data:** 2026-07-06

## Problema / objetivo
Jogado no navegador, o jogo hoje fica exposto a interações do próprio browser que não
fazem parte do jogo: menu de contexto no clique direito, zoom por pinça/scroll+ctrl,
seleção de texto ao arrastar o mouse rápido, pull-to-refresh em mobile, fechar/recarregar
a aba sem querer no meio de uma partida. Cada uma dessas "sai do jogo" ou quebra a
imersão. O pedido do CD: antes de continuar o backlog, o jogo precisa se comportar como
um app em tela cheia — atalhos e cliques errados do navegador não devem atrapalhar.

## Comportamento esperado
- Um botão visível (⛶) permite entrar/sair de tela cheia a qualquer momento; o ícone
  reflete o estado atual.
- Clique direito em qualquer lugar da tela do jogo NÃO abre o menu de contexto do navegador.
- Clique do meio (scroll button) NÃO ativa o ícone de auto-scroll do navegador.
- Arrastar o mouse durante o jogo NÃO seleciona texto/elementos da página.
- Pinça (mobile) e Ctrl+scroll (desktop) NÃO dão zoom na página.
- Puxar a tela para baixo em mobile NÃO aciona pull-to-refresh.
- Arrastar imagens/canvas com o mouse NÃO inicia um drag nativo do navegador.
- Com uma partida em andamento (sala conectada), fechar/recarregar a aba pede confirmação
  do navegador antes de sair — evita perder a partida por engano.
- Nenhuma dessas proteções interfere nos perfis de controle existentes (mouse/teclado/touch)
  nem no overlay de debug (F3, só em dev).

## Fora de escopo
- Pointer Lock API (mira 360° já funciona por raycast; não é sobre isso).
- Impedir F5/Ctrl+R/Ctrl+W — navegadores modernos ignoram `preventDefault` nesses atalhos
  por segurança; o `beforeunload` é a proteção possível para reload/fechar.
- PWA / instalação como app / modo standalone — fica para SPEC-0009 (empacotamento).
- Forçar tela cheia automaticamente sem gesto do usuário — a Fullscreen API exige clique;
  não dá para pular esse passo.

## Critérios de aceite
- [ ] Botão de tela cheia funcional (entra/sai), ícone reflete o estado (`fullscreenchange`).
- [ ] `contextmenu` suprimido no documento inteiro durante o jogo.
- [ ] Seleção de texto (`user-select`) desativada fora do overlay de debug.
- [ ] `touch-action`/`overscroll-behavior` bloqueiam pinch-zoom e pull-to-refresh globalmente
      (hoje só `body.touch-profile` tinha `touch-action: none`).
- [ ] `beforeunload` dispara confirmação nativa só enquanto há sala conectada (liga no
      join, desliga no leave/erro) — não testável por bot headless (é API de browser),
      verificado manualmente.
- [ ] Gates existentes (shared/server/bots/tsc) inalterados — mudança é só client-side/UI.

## Decisão do Creative Director
Aprovada — pedido direto do CD em 2026-07-06, antes de continuar T-028: "quero que o jogo
ganhe uma imersão no navegador, estilo tela cheia, sem que atalhos, cliques errados etc,
atrapalhem o jogador."

## Notas da IA
- Tudo client-only (`packages/client/src/immersion.ts` novo + CSS em `index.html`); zero
  mudança de contrato de rede ou de servidor — não compete com a fila de T-028.
- Sem ADR: não é decisão arquitetural, é blindagem de UX que qualquer perfil de controle já
  respeitava parcialmente (ex.: espaço/setas já tinham `preventDefault` pontual nos profiles).
- Verificação é majoritariamente manual (browser real) — Fullscreen API e `beforeunload`
  não são exercitáveis por bots headless nem pelo preview sem GPU (mesma limitação já
  registrada em `SESSAO_ATUAL.md`).
