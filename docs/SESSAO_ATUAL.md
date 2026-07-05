# Sessão atual — ponteiro de continuidade

> **Substituir este arquivo inteiro** ao fim de cada sessão de trabalho.
> Não é histórico — histórico fica em `DEVLOG.md` e `docs/prompts/`.

**Atualizado em:** 2026-07-05
**Branch:** `evolução` (à frente de `main` por 2 commits: T-019 e T-019b) — **execução agêntica sequencial da V1 em andamento**.
**Marco:** V1 (lançamento público) — PROPOSAL-0002 aprovada; T-019 e T-019b concluídas; seguindo em ordem pelo BACKLOG sem intervenção do CD a cada task.

---

## Onde paramos

**Concluído nesta sessão (execução autônoma, sem pausar para aprovação a cada task):**
1. Gates herdados rodados na íntegra + merge fast-forward `evolução` → `main` (24 commits).
2. **T-019 (PROMPT-0027):** camada de perfis de controle (ADR-015) + perfil `mouse` — WASD strafe, crosshair 360° por raycast, câmera com leve offset de mira. Servidor inalterado.
3. **T-019b (PROMPT-0028):** perfis `keyboard` (WASD + setas giram a mira + espaço) e `touch` (twin-stick virtual por Pointer Events) + `ProfileManager` (auto-detecção + seletor manual persistido em `localStorage`) + UI `#profile-selector` sempre visível.

Todos os 3 perfis foram verificados automaticamente (gates + lógica isolada via `preview_eval`, já que o ambiente de preview desta sessão não tem GPU para screenshot — ver PROMPT-0027/0028 para o método). **Nenhum veredito humano real ainda** (browser com GPU, e sobretudo dispositivo touch de verdade).

## Próximo passo

1. `Executar T-020` — arquitetura de IA dos bots (`docs/ai/bot-architecture.md`): percepção filtrada → memória → decisão utility → context steering → humanizador → atuação; `Personality` em JSON; testes puros de decisão/steering. Não depende de veredito humano prévio — pode seguir direto.
2. Sequência da F1 restante: T-020 → T-008b (perfis/boss de bot, presets de `Personality`) → depois F2 (T-021 bandeira → T-022 VFX → T-023 HUD/toasts) → F3..F6 (ver seção V1 do `BACKLOG.md`).
3. **Pendências reais (só o CD resolve, não bloqueiam a esteira):**
   - Veredito humano num browser com GPU dos 3 perfis de controle (critério "circular um alvo mantendo o crosshair nele" / "jogável do início ao fim de um round").
   - **Smoke manual em dispositivo touch real** para o perfil `touch` (bots não cobrem; registrado como risco desde a SPEC-0006).

## Veredito do Creative Director

| Item | Status | Notas |
|---|---|---|
| PROPOSAL-0002 + ajustes §9 | ✅ aprovada (2026-07-05) | specs SPEC-0006..0009 derivadas |
| Merge `evolução` → `main` | ✅ feito na sessão anterior | fast-forward, 24 commits; `evolução` agora 2 commits à frente (T-019/T-019b) |
| T-019 (perfil mouse) | ⬜ pendente teste manual no browser (GPU) | lógica verificada automaticamente; PROMPT-0027 |
| T-019b (perfis keyboard/touch + seletor) | ⬜ pendente teste manual (touch real) | lógica verificada automaticamente; PROMPT-0028 |
| SPEC-0005 / SPEC-0004 / SPEC-0003 (herdadas) | ⬜ pendente teste no browser | não bloqueou o merge anterior (gates automáticos cobrem regressão) |

## Comandos úteis agora

```bash
npm run test && (cd packages/server && npx vitest run)   # 13/13 + 19/19
npm run dev:server && npm run dev:client                  # 3 perfis: seletor no topo (🖱️⌨️📱)
npm run bots -- 4 30
```

## Leituras se a sessão nova for só conversa

- Plano-mãe → `docs/proposals/PROPOSAL-0002-v1-lancamento.md` (§9 = ajustes finais do CD)
- Specs executáveis → `specs/SPEC-0006..0009`
- Teoria dos bots (próxima task, T-020) → `docs/ai/bot-architecture.md`
- Decisões novas → DECISION_LOG ADR-015 (controles) e ADR-016 (fronteira Django)
- Tasks → seção V1 do `docs/BACKLOG.md` (T-019 ✅, T-019b ✅, T-020..T-032 pendentes)
- Última leva → `docs/prompts/PROMPT-0028.md`
