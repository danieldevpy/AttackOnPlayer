# Sessão atual — ponteiro de continuidade

> **Substituir este arquivo inteiro** ao fim de cada sessão de trabalho.
> Não é histórico — histórico fica em `DEVLOG.md` e `docs/prompts/`.

**Atualizado em:** 2026-07-05
**Branch:** `v1-continue` — **worktree isolado** em `.claude/worktrees/v1-continue`, criado a partir de `evolução` (que está 3 commits atrás desta branch: T-019, T-019b, T-020; mais 2 commits nesta branch: fix de lockfile + T-008b). **`evolução`/`main` na working directory original NÃO foram atualizadas ainda** — fazer merge quando a sessão concorrente (branch `aci`) liberar o diretório.
**Marco:** V1 (lançamento público) — PROPOSAL-0002 aprovada; T-019/T-019b/T-020/T-008b concluídas; seguindo em ordem pelo BACKLOG sem intervenção do CD a cada task.

---

## ⚠️ Leia isto primeiro se a sessão nova for na working directory original

Esta sessão está isolada num **git worktree** (`.claude/worktrees/v1-continue`, branch `v1-continue`) porque outra sessão/agente estava operando concorrentemente na working directory original (branch `aci`, scaffold `packages/aci`/PROPOSAL-0003 — ver DEVLOG desta sessão). Antes de continuar:

1. Verificar se a branch `aci` ainda existe e se a sessão concorrente ainda está ativa (`git branch -a`, `git log aci --oneline -3`).
2. Se o worktree `v1-continue` ainda existir (`git worktree list`) e estiver à frente de `evolução`, mergear: `git checkout evolução && git merge v1-continue --ff-only` (deve ser fast-forward — ninguém mais commitou em `evolução` desde a criação do worktree).
3. Depois do merge, o worktree pode ser removido (`git worktree remove .claude/worktrees/v1-continue`) e o trabalho continua normalmente na working directory original.
4. **Ferramentas `preview_*` não seguem o `cwd` do worktree** (achado desta sessão) — se testar dentro de um worktree, suba o servidor manualmente via Bash e confirme com `lsof -ti :2567` + `/proc/<pid>/cwd` que é o processo certo antes de confiar no resultado.

## Onde paramos

**Concluído nesta sessão (execução autônoma, sem pausar para aprovação a cada task):**
1. Gates herdados + merge fast-forward `evolução` → `main` (24 commits) — feito ANTES da descoberta da sessão concorrente, na working directory original.
2. **T-019 (PROMPT-0027):** camada de perfis de controle (ADR-015) + perfil `mouse`.
3. **T-019b (PROMPT-0028):** perfis `keyboard`/`touch` + `ProfileManager`.
4. **T-020 (PROMPT-0029):** arquitetura de IA dos bots em 6 camadas.
5. **T-008b (PROMPT-0030):** perfis nomeados (agressivo/cauteloso/caçador/equilibrado) + política de cards determinística + boss (servidor autoritativo, nível 6-8 + build concentrada + skill de marco).

## Próximo passo

1. **Resolver o worktree primeiro** (ver seção de aviso acima) — mergear `v1-continue` → `evolução` assim que o diretório original estiver livre.
2. `Executar T-021` — bandeira "rei do mapa": 2×XP/s, glow global, toggle por room (default ON), derruba na morte, retorna ao centro se abandonada. Quando existir, `disputar_bandeira` pode finalmente entrar em `decision.ts` (hoje de propósito fora — sem dado, sem consideração de utility).
3. Depois: T-022 VFX → T-023 HUD/toasts → F3..F6 (ver seção V1 do `BACKLOG.md`).
4. **Pendências reais (só o CD resolve, não bloqueiam a esteira):** veredito humano num browser com GPU dos perfis de controle; smoke manual em dispositivo touch real; sentir o "peso" dos bots/boss em jogo real.

## Veredito do Creative Director

| Item | Status | Notas |
|---|---|---|
| PROPOSAL-0002 + ajustes §9 | ✅ aprovada (2026-07-05) | specs SPEC-0006..0009 derivadas |
| Merge `evolução` → `main` (24 commits) | ✅ feito | fast-forward; **merge de `v1-continue` (2 commits extras) ainda pendente** |
| T-019 / T-019b (perfis de controle) | ⬜ pendente teste manual (GPU/touch real) | PROMPT-0027/0028 |
| T-020 (arquitetura de IA dos bots) | ⬜ pendente veredito de "sensação" | PROMPT-0029; gates automáticos verdes |
| T-008b (perfis nomeados + boss) | ⬜ pendente veredito de "sensação"/ameaça do boss | PROMPT-0030; gates + smoke automático verdes |

## Comandos úteis agora (dentro do worktree)

```bash
cd .claude/worktrees/v1-continue
npm run test && (cd packages/server && npx vitest run) && (cd packages/bots && npx vitest run)  # 13/13 + 19/19 + 17/17
npm run dev:server && npm run dev:client
BOT_VERBOSE=1 npm run bots -- 4 30            # perfis sorteados no log
BOT_BOSS=1 BOT_VERBOSE=1 npm run bots -- 4 20 # bot-0 vira boss (nível 6-8)
```

## Leituras se a sessão nova for só conversa

- Plano-mãe → `docs/proposals/PROPOSAL-0002-v1-lancamento.md` (§9 = ajustes finais do CD)
- Specs executáveis → `specs/SPEC-0006..0009`
- Teoria + implementação dos bots → `docs/ai/bot-architecture.md` + `docs/ai/bots.md`
- Decisões novas → DECISION_LOG ADR-015 (controles) e ADR-016 (fronteira Django)
- Tasks → seção V1 do `docs/BACKLOG.md` (T-019/T-019b/T-020/T-008b ✅, T-021..T-032 pendentes)
- Última leva → `docs/prompts/PROMPT-0030.md`
