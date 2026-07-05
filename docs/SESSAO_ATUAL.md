# Sessão atual — ponteiro de continuidade

> **Substituir este arquivo inteiro** ao fim de cada sessão de trabalho.
> Não é histórico — histórico fica em `DEVLOG.md` e `docs/prompts/`.

**Atualizado em:** 2026-07-05
**Branch:** `evolução` (à frente de `main` por 3 commits: T-019, T-019b, T-020) — **execução agêntica sequencial da V1 em andamento**.
**Marco:** V1 (lançamento público) — PROPOSAL-0002 aprovada; T-019/T-019b/T-020 concluídas; seguindo em ordem pelo BACKLOG sem intervenção do CD a cada task.

---

## Onde paramos

**Concluído nesta sessão (execução autônoma, sem pausar para aprovação a cada task):**
1. Gates herdados rodados na íntegra + merge fast-forward `evolução` → `main` (24 commits).
2. **T-019 (PROMPT-0027):** camada de perfis de controle (ADR-015) + perfil `mouse`.
3. **T-019b (PROMPT-0028):** perfis `keyboard`/`touch` + `ProfileManager` (auto-detecção + seletor).
4. **T-020 (PROMPT-0029):** arquitetura de IA dos bots em 6 camadas (`packages/bots/src/ai/`) — percepção → memória → decisão (Utility AI, pura) → steering contextual (pura) → humanizador → atuação. `PERSONALITY_BY_SKILL` é uma ponte temporária para os 3 níveis de skill (T-008); a T-020 **não** criou perfis nomeados novos (isso é escopo da T-008b, próxima).

Todo o trabalho client (T-019/T-019b) foi verificado automaticamente via `preview_eval` (sem GPU no preview headless para screenshot). O trabalho de bots (T-020) tem 11 testes unitários puros (decision/steering) + smoke com servidor real, sem depender de GPU. **Nenhum veredito humano real ainda** dos perfis de controle (browser com GPU, dispositivo touch de verdade).

## Próximo passo

1. `Executar T-008b` — personalidade, atributos e boss: substituir `PERSONALITY_BY_SKILL` (packages/bots/src/ai/personality.ts) por presets nomeados (agressivo/cauteloso/caçador/equilibrado) sorteados por sessão + política de escolha de cards por perfil (SPEC-0004) + modo boss (nível 6-8, build concentrada, skill `forte`). Depende de T-020 (pronta) e T-016 (pronta).
2. Depois: F2 (T-021 bandeira → T-022 VFX → T-023 HUD/toasts) → F3..F6 (ver seção V1 do `BACKLOG.md`).
3. **Pendências reais (só o CD resolve, não bloqueiam a esteira):**
   - Veredito humano num browser com GPU dos 3 perfis de controle (T-019/T-019b).
   - Smoke manual em dispositivo touch real (T-019b).
   - Sentir o "peso" dos bots em jogo real (T-020) — os testes automáticos garantem que a lógica funciona, não que a sensação ficou boa.

## Veredito do Creative Director

| Item | Status | Notas |
|---|---|---|
| PROPOSAL-0002 + ajustes §9 | ✅ aprovada (2026-07-05) | specs SPEC-0006..0009 derivadas |
| Merge `evolução` → `main` | ✅ feito na sessão anterior | fast-forward, 24 commits; `evolução` agora 3 commits à frente |
| T-019 (perfil mouse) | ⬜ pendente teste manual no browser (GPU) | PROMPT-0027 |
| T-019b (perfis keyboard/touch + seletor) | ⬜ pendente teste manual (touch real) | PROMPT-0028 |
| T-020 (arquitetura de IA dos bots) | ⬜ pendente veredito de "sensação" jogando | PROMPT-0029; gates automáticos verdes |
| SPEC-0005 / SPEC-0004 / SPEC-0003 (herdadas) | ⬜ pendente teste no browser | não bloqueou o merge anterior (gates automáticos cobrem regressão) |

## Comandos úteis agora

```bash
npm run test && (cd packages/server && npx vitest run) && (cd packages/bots && npx vitest run)  # 13/13 + 19/19 + 11/11
npm run dev:server && npm run dev:client                  # 3 perfis: seletor no topo (🖱️⌨️📱)
BOT_VERBOSE=1 npm run bots -- 4 30                        # vê decide/steer/humanizer em ação no log
```

## Leituras se a sessão nova for só conversa

- Plano-mãe → `docs/proposals/PROPOSAL-0002-v1-lancamento.md` (§9 = ajustes finais do CD)
- Specs executáveis → `specs/SPEC-0006..0009`
- Teoria dos bots (implementada na T-020) → `docs/ai/bot-architecture.md` + `docs/ai/bots.md`
- Decisões novas → DECISION_LOG ADR-015 (controles) e ADR-016 (fronteira Django)
- Tasks → seção V1 do `docs/BACKLOG.md` (T-019/T-019b/T-020 ✅, T-008b..T-032 pendentes)
- Última leva → `docs/prompts/PROMPT-0029.md`
