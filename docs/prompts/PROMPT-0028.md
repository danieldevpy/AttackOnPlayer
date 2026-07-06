# PROMPT-0028 — T-019b: perfis keyboard/touch + auto-detecção + seletor (SPEC-0006, ADR-015) · 2026-07-05

## Pedido (resumo fiel do CD)
Continuação da execução autônoma sequencial da V1 — `Executar T-019b` após a T-019, sem pausar para aprovação.

## Decisões tomadas (e por quem)
- **Perfil `keyboard`** (`packages/client/src/input/keyboardProfile.ts`): WASD move (independe da mira); setas esquerda/direita giram um ângulo de mira interno a velocidade angular fixa (`ROTATE_SPEED = 1.4π rad/s`); espaço dispara. Sem nenhuma seta pressionada ainda, não há `aim` — cai no fallback de facing-por-movimento do servidor (mesmo contrato do ADR-015). Pensado para notebook sem mouse.
- **Perfil `touch`** (`touchProfile.ts`): twin-stick virtual por Pointer Events — metade esquerda da tela = stick de movimento, metade direita = stick de mira; presença de toque no lado da mira = `fire`. Origem do vetor é fixa no centro visual de cada stick (`getBoundingClientRect`), magnitude limitada a `STICK_RADIUS_PX=45` e normalizada para -1..1. Multitoque simples (1 dedo por metade, via `pointerId`).
- **`ProfileManager`** (`manager.ts`): auto-detecção (`matchMedia("(pointer: coarse)")` + `maxTouchPoints`) escolhe `touch` só quando o dispositivo é majoritariamente touch, senão `mouse`; escolha manual persiste em `localStorage` (`aop_profile`) e tem prioridade na próxima carga. `select(id)` troca em runtime: `detach()` do perfil antigo, `build()`+`attach()` do novo — sem reconectar a sala.
- **UI:** `#profile-selector` (3 botões fixos no topo, sempre visíveis — "leve sempre", sem menu escondido) + `#touch-move-base`/`#touch-aim-base` (círculos que só aparecem com `body.touch-profile`, via CSS, custo zero quando o perfil não é touch).
- **`main.ts`:** `activeProfile: ControlProfile` (T-019) virou `profileManager: ProfileManager`; `sendInput()` chama `profileManager.poll()`; debug F3 mostra `profileManager.id`.

## Resultado verificado
- **Gates:** shared 13/13 · server 19/19 · `tsc --noEmit` limpo ×3 · guarda `.js` órfão sem saída · `npm run bots -- 3 15` sem crash.
- **Client (preview headless sem GPU, mesma limitação da T-019):**
  - Auto-detecção: ambiente sem touch escolheu `mouse` por padrão (botão `mouse` com classe `active`).
  - Seletor: clicar em `keyboard`/`touch` troca em runtime, persiste em `localStorage`, alterna classes CSS (`cursor-hidden`/`crosshair.active` somem fora do perfil mouse; `touch-profile` mostra os sticks).
  - **Keyboard isolado** (`preview_eval` + import dinâmico da classe real): WASD produz `moveX/moveZ` correto e constante independente da mira; `ArrowRight` gira o ângulo (aim aparece só depois da 1ª tecla de rotação, confirmando o fallback); espaço liga `fire`.
  - **Touch isolado** (idem, com os elementos DOM reais da página): arrastar o stick de movimento produz `moveX=1` (clamped e normalizado); arrastar o stick de mira produz `aimX/aimZ` correto e `fire=true` enquanto o dedo estiver no lado da mira; soltar os dois zera tudo.
  - Nenhum erro no console em nenhuma das trocas/testes.

## Regras que nascem daqui
- **Perfil novo = 1 classe em `input/` + 1 branch no `ProfileManager.build()`.** Nenhuma mudança de rede, HUD ou servidor — confirma a promessa do ADR-015.
- **Auto-detecção decide o "primeiro contato"; a escolha manual do jogador sempre vence depois** (persistida). Evita forçar recarregar/perder a escolha entre sessões.
- **UI de controle sempre visível e leve** (3 botões fixos) em vez de menu escondido — decisão consciente para não esconder a troca de perfil atrás de um clique extra num jogo de sessão curta (2–3 min).

## Pendências para o próximo prompt
- **Smoke manual obrigatório em dispositivo touch real** (o risco já registrado na SPEC-0006 — bots não cobrem, `preview_eval` prova a lógica mas não a ergonomia do polegar).
- Veredito do CD no browser real dos 3 perfis (critério de aceite "jogável do início ao fim de um round").
- Próxima task da fila: **T-020** — arquitetura de IA dos bots (`docs/ai/bot-architecture.md`).
