# PROMPT-0035 — T-023 (SPEC-0006): HUD dev/prod + reveal-on-hit + toasts · 2026-07-05

## Pedido (resumo fiel do CD)
"Ok testei e está de acordo, vamos prosseguir agora com o desenvolvimento das próximas" — aprovação do T-022 (PROMPT-0034) e autorização para seguir a fila sem alinhamento a cada task. Próxima da fila era **T-023**, já fechada na SPEC-0006/backlog vivo: HUD dev/prod, reveal-on-hit autoritativo e `toast_text`.

## Decisões tomadas (e por quem)
- **`import.meta.env.DEV` (nativo do Vite) em vez de flag própria** — `true` em `npm run dev`, `false` no build de produção (`vite build` + `vite preview`). Evita criar uma configuração nova para manter em sincronia; exigiu `packages/client/src/vite-env.d.ts` (`/// <reference types="vite/client" />`) para o `tsc` reconhecer `ImportMeta.env`.
- **Prod = painel compacto sempre visível** (ping discreto + nível/xp/HP + tags de efeito) **+ atributos completos só segurando `[Tab]`** (`hud.ts`) — roster e overlay de debug (F3) são removidos do DOM inteiramente em prod (`rosterEl.remove()`, `debugOverlay.remove()`), não só escondidos por CSS; o handler de F3 em `main.ts` ganhou `if (!IS_DEV) return;` como segunda barreira. **Dev mantém tudo sempre visível**, como antes — nenhuma regressão pro fluxo de desenvolvimento/QA.
- **Reveal-on-hit é um campo autoritativo simples, não uma relação por-observador:** `Player.revealedUntil` (novo `@type("number")` em `ArenaState.ts`, mesmo padrão de `spawnProtectedUntil`) — timestamp global por jogador, setado em **ambos os lados** (vítima e atirador) sempre que dano real (não bloqueado) acontece, renovado a cada novo hit (`REVEAL_ON_HIT_MS = 4000`, novo em `shared/constants.ts`). "Inimigo é só skin até trocar dano com ele": nameplate (nome + barra de HP, sprite com textura de canvas, mesma técnica dos popups de dano da T-018) só aparece enquanto `revealedUntil > now`.
- **Toasts substituem todo texto cru que aparecia solto no HUD** (streak de kills, card aplicado/auto-pick, `farm_event`) — fila não invasiva no canto inferior direito (`#toast-stack`), nunca no centro, `pointer-events: none` (nunca bloqueia clique), fade/slide via CSS (`transition`, zero JS por frame de animação), orçamento fixo (`TOAST_MAX = 5`, mais antigo cai fora), vida de 2.6s. Entrega o item `toast_text` do backlog vivo de VFX/juice.
- **Sem novo tráfego de rede** — `revealedUntil` é só mais um campo do Schema já sincronizado automaticamente pelo Colyseus; toasts são 100% derivados de eventos que já chegavam ao cliente (`upgrade_applied`, `debug_event` tipo `hit`/`death`, `announce`).

## Resultado verificado
- **Gates:** shared 13/13 · server 25/25 (sem novo teste unitário — `revealedUntil` é lógica inline no `ArenaRoom.ts`, mesmo padrão de verificação por smoke real usado em T-021/bugfix da T-016) · `tsc --noEmit` limpo em client e server.
- **Smoke em DEV real:** servidor + cliente reais, HUD completo sempre visível (roster, F3, atributos) sem regressão.
- **Smoke em PROD real** (`vite build` + `vite preview`, configuração temporária `client-prod` no `.claude/launch.json`, removida ao final): confirmado visualmente via screenshot que (1) o HUD nasce compacto (sem roster, sem dica de F3); (2) segurar `[Tab]` revela o bloco completo de atributos/skills/coins e soltar esconde de volta; (3) nameplate com barra de HP ("bot-0") aparece sobre o inimigo exatamente ao trocar dano com ele, e some depois de ~4s sem novo hit; (4) toast de `farm_event` e toast de upgrade automático aparecem deslizando no canto inferior direito; (5) o menu de escolha manual de card continua funcionando normalmente no build de produção.
- Essa é a primeira task da fila verificada contra o **bundle de produção real**, não só o dev server — validação mais forte que o padrão anterior, já que HUD dev/prod é exatamente o que muda entre os dois builds.

## Regras que nascem daqui
- **Dev vs. prod no cliente sempre via `import.meta.env.DEV`** — nenhuma flag customizada nova; qualquer feature "só dev" (debug overlay, roster, atalhos de diagnóstico) se registra atrás desse mesmo flag, removendo o elemento do DOM em vez de só escondê-lo por CSS.
- **Reveal-on-hit é o padrão para qualquer "inimigo é só skin até X" futuro:** campo autoritativo `@type` no Schema do jogador (nunca por-observador), setado no servidor no momento do evento relevante, lido no cliente como `campo > Date.now()`. Mesmo molde de `spawnProtectedUntil`.
- **Texto solto no HUD vira toast, não mais concatenado na string principal** — `pushToast(text)` é o único canal daqui pra frente para eventos pontuais (streak, upgrade, announces); o HUD principal (`updateHud`) fica reservado para estado contínuo (ping, nível, HP, atributos).
- **Verificação de mudanças dev/prod exige rodar os dois builds**, não só o dev server — confirmado nesta task que só testar em dev teria deixado passar qualquer bug específico do `IS_DEV=false`.

## Pendências para o próximo prompt
- Fase **F2 da V1 está completa** (T-019..T-023) — próxima é **F3** (T-024: registry de objetos + formato de mapa v1).
- Veredito de sensação do CD sobre o tempo de reveal (4s) e o timing dos toasts (2.6s) — números são chute inicial, mesma ressalva já registrada para VFX (T-022) e progressão (Sessão 13); ajustável por constante única (`REVEAL_ON_HIT_MS`, `TOAST_LIFE_MS`) se o CD sentir necessidade jogando.
- Nenhuma pendência de código conhecida para o que foi pedido.
