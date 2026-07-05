# Sessão atual — ponteiro de continuidade

> **Substituir este arquivo inteiro** ao fim de cada sessão de trabalho.
> Não é histórico — histórico fica em `DEVLOG.md` e `docs/prompts/`.

**Atualizado em:** 2026-07-05
**Branch:** `evolução` — working directory original.
**Marco:** V1 (lançamento público) — PROPOSAL-0002 aprovada; T-019..T-021 concluídas **e aprovadas no 1º teste manual do CD** (Sessão 12/PROMPT-0032); fila segue na T-022.

---

## ⚠️ Sessão concorrente conhecida

Existe (ou existiu) uma sessão paralela na branch `aci` (`.claude/worktrees/aci`, scaffold `packages/aci`/PROPOSAL-0003 — módulo isolado, sem relação com a V1). Há também uma pasta `packages/aci/` **não versionada** na working directory original + um `snapshot-test.sh` solto — resíduos de outra esteira; **não mexer neles**. Antes de qualquer limpeza, checar se a sessão `aci` ainda está ativa (`git branch -a`, `git worktree list`).

## Onde paramos

**Concluído nesta sessão (QA do 1º teste manual do CD — PROMPT-0032, aprovado):**
- **Keyboard = tank controls:** W/S pela rotação, A/D strafe relativo, setas giram; mira enviada todo tick; dica do HUD por perfil ativo.
- **Bots simulam players:** portador da bandeira = alvo de engage (atira!, bônus `1+objective`, alcance estendido); alvos "compartilhados" via `targetBias` por (bot, inimigo); encurralado → vira e luta; kite (atira fugindo); separação anti-empilhamento; **dosagem individual** por bot sobre o preset sorteado.
- **Infra:** bots todos na mesma sala (`joinById` após o primeiro; sala cheia = erro alto); `MAX_PLAYERS` 8→16; bandeira abandonada volta ao centro em **5s**; warning `announce` silenciado.
- Docs de IA atualizadas: `docs/ai/bot-architecture.md §3` e `docs/ai/bots.md`.

**Sessões anteriores:** T-021 bandeira (Sessão 11), T-020/T-008b bots (Sessão 10), T-019/T-019b perfis (Sessão 10) — ver `DEVLOG.md`.

## Próximo passo

1. `Executar T-022` — VFX nomeados: registry de partículas data-driven derivado de eventos existentes (regra de intensidade: automático = leve, escolha manual = "aura" chamativa) + puxar itens do backlog vivo `docs/mechanics/vfx-juice-backlog.md`.
2. Depois: T-023 (HUD dev/prod + reveal-on-hit + toasts) → F3..F6 (ver seção V1 do `BACKLOG.md`).
3. **Calibração pendente (não bloqueia):** knobs novos dos bots (`1+objective` do portador, `targetBias` 0.8..1.2, `SEPARATION_DIST` 1.8, `CORNERED_BORDER_DIST` 3) são chute inicial aprovado por sensação — T-026/telemetria confirma com dados. Smoke manual em dispositivo touch real continua pendente.

## Veredito do Creative Director

| Item | Status | Notas |
|---|---|---|
| PROPOSAL-0002 + ajustes §9 | ✅ aprovada (2026-07-05) | specs SPEC-0006..0009 derivadas |
| T-019 / T-019b (perfis de controle) | ✅ testado manualmente — keyboard refeito como tank controls e aprovado | PROMPT-0027/0028/0032 |
| T-020 + T-008b (IA/perfis dos bots) | ✅ testado manualmente — aprovado após refinamentos ("simular players") | PROMPT-0029/0030/0032 |
| T-021 (bandeira "rei do mapa") | ✅ testado manualmente — disputa agora atira no portador; retorno 5s | PROMPT-0031/0032 |
| Touch em dispositivo real | ⬜ pendente | bots não cobrem |

## Comandos úteis agora

```bash
npm run test -w @aop/shared && (cd packages/server && npx vitest run) && (cd packages/bots && npx vitest run)  # 13/13 + 25/25 + 24/24
npm run dev:server && npm run dev:client
npm run bots -- 10 0                          # 10 bots para sempre, MESMA sala, dosagem no log
BOT_BOSS=1 BOT_VERBOSE=1 npm run bots -- 4 20 # bot-0 vira boss (nível 6-8)
```

## Leituras se a sessão nova for só conversa

- Plano-mãe → `docs/proposals/PROPOSAL-0002-v1-lancamento.md` (§9 = ajustes finais do CD)
- Specs executáveis → `specs/SPEC-0006..0009`
- Teoria + implementação dos bots → `docs/ai/bot-architecture.md` + `docs/ai/bots.md` (refinamentos da Sessão 12 incluídos)
- Feedback do CD no teste manual → `docs/CREATIVE_DIRECTOR_NOTES.md` (2026-07-05) + `docs/prompts/PROMPT-0032.md`
- Tasks → seção V1 do `docs/BACKLOG.md` (T-019..T-021 ✅, T-022..T-032 pendentes)
