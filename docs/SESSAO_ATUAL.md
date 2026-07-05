# Sessão atual — ponteiro de continuidade

> **Substituir este arquivo inteiro** ao fim de cada sessão de trabalho.
> Não é histórico — histórico fica em `DEVLOG.md` e `docs/prompts/`.

**Atualizado em:** 2026-07-05
**Branch:** `evolução` — working directory original (o worktree `v1-continue` de sessões anteriores já foi mergeado nela e removido; nada pendente de merge quanto a isso).
**Marco:** V1 (lançamento público) — PROPOSAL-0002 aprovada; T-019/T-019b/T-020/T-008b/**T-021** concluídas; seguindo em ordem pelo BACKLOG sem intervenção do CD a cada task.

---

## ⚠️ Sessão concorrente conhecida

Existe (ou existiu) uma sessão paralela na branch `aci` (`.claude/worktrees/aci`, scaffold `packages/aci`/PROPOSAL-0003 — módulo isolado, sem relação com a V1). Há também uma pasta `packages/aci/` **não versionada** na working directory original (`node_modules`/`.aci-cache`/`src` soltos) — resíduo de antes do isolamento em worktree; **não mexer nela**, não é trabalho desta esteira. Antes de qualquer limpeza, checar se a sessão `aci` ainda está ativa (`git branch -a`, `git worktree list`).

## Onde paramos

**Concluído nesta sessão (execução autônoma, sem pausar para aprovação a cada task):**
- **T-021 (PROMPT-0031):** bandeira "rei do mapa" — `FlagSystem` no servidor (pickup por distância, segue o portador, derruba na morte, volta ao centro após abandono), XP passivo em dobro pro portador, toggle `flagEnabled` por room (default ON). Cliente: mesh dinâmico + glow (`THREE.PointLight`) + indicador no HUD/roster. Bots: `disputar_bandeira` entrou em `decision.ts` (novo peso `objective` em `Personality`, novo score data-driven).

**Concluído em sessões anteriores:** T-019/T-019b (perfis de controle), T-020 (arquitetura de IA dos bots), T-008b (perfis nomeados + boss) — ver `DEVLOG.md`.

## Próximo passo

1. `Executar T-022` — VFX nomeados: registry de partículas data-driven derivado de eventos existentes (regra de intensidade: automático = leve, escolha manual = "aura" chamativa) + puxar itens do backlog vivo `docs/mechanics/vfx-juice-backlog.md`.
2. Depois: T-023 (HUD dev/prod + reveal-on-hit + toasts) → F3..F6 (ver seção V1 do `BACKLOG.md`).
3. **Pendências reais (só o CD resolve, não bloqueiam a esteira):** veredito humano num browser com GPU dos perfis de controle; smoke manual em dispositivo touch real; sentir o "peso" dos bots/boss e da disputa de bandeira em jogo real (mapa é grande — bots não convergiram pra bandeira no smoke multiplayer curto rodado nesta sessão; `objective` dos perfis é chute inicial, T-026/telemetria pode confirmar depois).

## Veredito do Creative Director

| Item | Status | Notas |
|---|---|---|
| PROPOSAL-0002 + ajustes §9 | ✅ aprovada (2026-07-05) | specs SPEC-0006..0009 derivadas |
| T-019 / T-019b (perfis de controle) | ⬜ pendente teste manual (GPU/touch real) | PROMPT-0027/0028 |
| T-020 (arquitetura de IA dos bots) | ⬜ pendente veredito de "sensação" | PROMPT-0029; gates automáticos verdes |
| T-008b (perfis nomeados + boss) | ⬜ pendente veredito de "sensação"/ameaça do boss | PROMPT-0030; gates + smoke automático verdes |
| T-021 (bandeira "rei do mapa") | ⬜ pendente veredito de "sensação" da disputa em jogo real | PROMPT-0031; gates + smoke end-to-end (pickup/XP) verdes |

## Comandos úteis agora

```bash
npm run test -w @aop/shared && (cd packages/server && npx vitest run) && (cd packages/bots && npx vitest run)  # 13/13 + 25/25 + 20/20
npm run dev:server && npm run dev:client
BOT_VERBOSE=1 npm run bots -- 4 30            # perfis sorteados no log
BOT_BOSS=1 BOT_VERBOSE=1 npm run bots -- 4 20 # bot-0 vira boss (nível 6-8)
```

## Leituras se a sessão nova for só conversa

- Plano-mãe → `docs/proposals/PROPOSAL-0002-v1-lancamento.md` (§9 = ajustes finais do CD)
- Specs executáveis → `specs/SPEC-0006..0009`
- Teoria + implementação dos bots → `docs/ai/bot-architecture.md` + `docs/ai/bots.md`
- Decisões novas → DECISION_LOG ADR-015 (controles) e ADR-016 (fronteira Django)
- Tasks → seção V1 do `docs/BACKLOG.md` (T-019/T-019b/T-020/T-008b/T-021 ✅, T-022..T-032 pendentes)
- Última leva → `docs/prompts/PROMPT-0031.md`
