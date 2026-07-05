# Sessão atual — ponteiro de continuidade

> **Substituir este arquivo inteiro** ao fim de cada sessão de trabalho.
> Não é histórico — histórico fica em `DEVLOG.md` e `docs/prompts/`.

**Atualizado em:** 2026-07-05
**Branch:** `evolução` (== `main`, merge fast-forward feito nesta sessão) — **execução agêntica sequencial da V1 em andamento**.
**Marco:** V1 (lançamento público) — PROPOSAL-0002 aprovada; T-019 concluída; seguindo em ordem pelo BACKLOG sem intervenção do CD a cada task.

---

## Onde paramos

**Herdado desta sessão, já fechado:**
- Gates automáticos rodados na íntegra (shared 13/13, server 19/19, tsc ×3, guarda `.js` órfão, smoke de bots) — todos verdes.
- Merge fast-forward `evolução` → `main` (24 commits, sem conflitos). `main` e `evolução` estão no mesmo commit agora.

**T-019 concluída (PROMPT-0027):** camada de perfis de controle (ADR-015) + perfil `mouse` — `packages/client/src/input/{types,mouseProfile}.ts`, `main.ts` delegando input ao perfil ativo, crosshair 360° no `index.html`, câmera com leve offset de mira. Servidor inalterado (já aceitava `aimX/aimZ`). Ver detalhes/verificação em `docs/prompts/PROMPT-0027.md`.

**Execução autônoma em curso:** esta sessão está seguindo a ordem sugerida da SPEC-0006 sem pausar para aprovação a cada task (só pergunta se houver bloqueio genuíno). Próxima: **T-019b**.

## Próximo passo

1. `Executar T-019b` — perfis `keyboard` (rotação por teclas) e `touch` v1 (twin-stick) + auto-detecção e seletor manual. Depende de T-019 (pronta).
2. Sequência da F1: T-019b → T-020 (arquitetura de IA dos bots) → T-008b (perfis/boss de bot) → depois F2 (T-021 bandeira → T-022 VFX → T-023 HUD/toasts) → F3..F6 (ver seção V1 do `BACKLOG.md`).
3. **Pendência real (só o CD resolve):** veredito humano num browser com GPU do perfil mouse — critério "circular um alvo mantendo o crosshair nele" (o preview headless desta sessão não tem GPU; a lógica foi validada isolando a classe via `preview_eval`, não por screenshot).

## Veredito do Creative Director

| Item | Status | Notas |
|---|---|---|
| PROPOSAL-0002 + ajustes §9 | ✅ aprovada (2026-07-05) | specs SPEC-0006..0009 derivadas |
| Merge `evolução` → `main` | ✅ feito nesta sessão | fast-forward, 24 commits |
| T-019 (perfil mouse) | ⬜ pendente teste manual no browser (GPU) | lógica verificada automaticamente; ver PROMPT-0027 |
| SPEC-0005 / SPEC-0004 / SPEC-0003 (herdadas) | ⬜ pendente teste no browser | checklists no QA.md — não bloqueou o merge (gates automáticos cobrem regressão) |

## Comandos úteis agora

```bash
npm run test && (cd packages/server && npx vitest run)   # 13/13 + 19/19
npm run dev:server && npm run dev:client                  # perfil mouse: WASD + mira/crosshair pelo cursor
npm run bots -- 4 30
```

## Leituras se a sessão nova for só conversa

- Plano-mãe → `docs/proposals/PROPOSAL-0002-v1-lancamento.md` (§9 = ajustes finais do CD)
- Specs executáveis → `specs/SPEC-0006..0009`
- Teoria dos bots (T-020 vai implementar) → `docs/ai/bot-architecture.md`
- Decisões novas → DECISION_LOG ADR-015 (controles) e ADR-016 (fronteira Django)
- Tasks → seção V1 do `docs/BACKLOG.md` (T-019 ✅, T-019b..T-032 pendentes)
- Última leva → `docs/prompts/PROMPT-0027.md`
