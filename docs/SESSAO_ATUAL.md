# Sessão atual — ponteiro de continuidade

> **Substituir este arquivo inteiro** ao fim de cada sessão de trabalho.
> Não é histórico — histórico fica em `DEVLOG.md` e `docs/prompts/`.

**Atualizado em:** 2026-07-05
**Branch:** `evolução` — working directory original.
**Marco:** V1 (lançamento público) — PROPOSAL-0002 aprovada; **fase F2 completa** (T-019..T-023, todas aprovadas no 1º teste manual do CD ou verificadas por smoke real). Fila segue para F3 (T-024).

---

## ⚠️ Sessão concorrente conhecida

Existe (ou existiu) uma sessão paralela na branch `aci` (`.claude/worktrees/aci`, scaffold de `packages/aci`/PROPOSAL-0003 — módulo isolado, sem relação com a V1). Há também uma pasta `packages/aci/` **não versionada** na working directory original + um `snapshot-test.sh` solto — resíduos de outra esteira; **não mexer neles**. Antes de qualquer limpeza, checar se a sessão `aci` ainda está ativa (`git branch -a`, `git worktree list`).

## Onde paramos

**Concluído na Sessão 15 (T-023, PROMPT-0035):**
- **HUD dev/prod** via `import.meta.env.DEV` (nativo do Vite, sem flag nova): prod é painel compacto sempre visível (ping/nível/xp/HP/tags) + atributos completos só segurando `[Tab]`; roster e overlay de debug (F3) removidos do DOM em prod. Dev mantém tudo visível, como antes.
- **Reveal-on-hit autoritativo:** `Player.revealedUntil` (Schema, mesmo padrão de `spawnProtectedUntil`) setado em vítima+atirador a cada dano real, renovado a cada hit (`REVEAL_ON_HIT_MS=4000`). Nameplate (nome+HP) só aparece enquanto revelado — "inimigo é só skin até trocar dano com ele".
- **Toasts (`toast_text`)** — fila no canto inferior direito substitui todo texto cru do HUD (streak, card, farm_event). Fecha o item pendente do backlog vivo de VFX/juice.
- Verificado nos **dois builds**: dev (sem regressão) e **produção real** (`vite build`+`vite preview`) — primeira task da fila testada contra o bundle de prod de verdade, não só dev server. Screenshots confirmaram os 3 comportamentos funcionando.

**Sessões anteriores:** VFX nomeados (Sessão 14/PROMPT-0034), progressão de skill/atributo + bugfix do menu de level-up (Sessão 13/PROMPT-0033) — ver `DEVLOG.md` para o histórico completo (Sessões 10-14).

## Próximo passo

1. **Executar T-024** (início da F3/SPEC-0007) — registry de objetos (`ObjectDef` no shared) + formato de mapa v1 (instâncias `{objectId, x, z, ...}`, zonas, spawns, bandeira) + loader por `mapId` com validação/flood-fill. Contexto: `docs/BACKLOG.md` linha ~118, `specs/SPEC-0007-*.md`.
2. Depois de T-024, T-025 (CLI de mapas) depende diretamente dela.
3. **Calibração pendente (não bloqueia):** tempo de reveal-on-hit (4s) e vida do toast (2.6s) são chute inicial — mesma ressalva de VFX (T-022) e progressão (Sessão 13), ajustável por constante única se o CD sentir necessidade jogando.

## Pendências reais do lado do CD (não bloqueiam a esteira, só ele resolve)

| Item | Status | Notas |
|---|---|---|
| Touch em dispositivo real | ⬜ pendente | bots não cobrem; smoke só simula mouse/keyboard/servidor |
| Sessão mais longa com vários humanos | ⬜ pendente | tudo testado até aqui foi CD sozinho + bots, ou smokes headless/preview solo |
| Veredito dos novos números de progressão (Sessão 13) numa sessão de verdade | ⬜ pendente | aprovado por lógica/smoke; falta "sentir" jogando período longo |
| Veredito visual dos VFX (Sessão 14) — cores/intensidade/timing | ⬜ pendente | implementado e visto renderizar em screenshot; falta o CD jogar e dar veredito de "sensação" |
| Veredito do reveal-on-hit/toasts (Sessão 15) — timing de 4s/2.6s | ⬜ pendente | implementado e verificado em build de prod real; falta o CD jogar e sentir o ritmo |

## Veredito do Creative Director

| Item | Status | Notas |
|---|---|---|
| PROPOSAL-0002 + ajustes §9 | ✅ aprovada (2026-07-05) | specs SPEC-0006..0009 derivadas |
| T-019 / T-019b (perfis de controle) | ✅ testado manualmente | PROMPT-0027/0028/0032 |
| T-020 + T-008b (IA/perfis dos bots) | ✅ testado manualmente | PROMPT-0029/0030/0032 |
| T-021 (bandeira "rei do mapa") | ✅ testado manualmente | PROMPT-0031/0032 |
| Progressão de skill/atributo + bugfix menu (Sessão 13) | ✅ implementado, verificado por smoke real | PROMPT-0033 — pendente sensação de sessão longa |
| T-022 (VFX nomeados) | ✅ implementado, verificado por smoke real + screenshot | PROMPT-0034 — pendente veredito visual do CD |
| T-023 (HUD dev/prod + reveal-on-hit + toasts) | ✅ implementado, verificado em build dev+prod real + screenshots | PROMPT-0035 — pendente veredito de timing do CD |
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
- Specs executáveis → `specs/SPEC-0006-sensacao-e-leitura.md` (F1+F2, agora completa) + `SPEC-0007..0009` (F3 em diante)
- VFX: registry em `packages/client/src/vfx.ts` + backlog vivo `docs/mechanics/vfx-juice-backlog.md` (todos os itens iniciais ✔ entregues)
- Teoria + implementação dos bots → `docs/ai/bot-architecture.md` + `docs/ai/bots.md`
- Feedback do CD → `docs/CREATIVE_DIRECTOR_NOTES.md` + `docs/prompts/PROMPT-0032.md`, `PROMPT-0033.md`, `PROMPT-0034.md`, `PROMPT-0035.md`
- Tasks → seção V1 do `docs/BACKLOG.md` (T-019..T-023 ✅, T-024..T-032 pendentes)
