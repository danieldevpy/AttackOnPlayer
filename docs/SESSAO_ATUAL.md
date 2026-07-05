# Sessão atual — ponteiro de continuidade

> **Substituir este arquivo inteiro** ao fim de cada sessão de trabalho.
> Não é histórico — histórico fica em `DEVLOG.md` e `docs/prompts/`.

**Atualizado em:** 2026-07-05
**Branch:** `evolução` — working directory original.
**Marco:** V1 (lançamento público) — PROPOSAL-0002 aprovada; T-019..T-021 concluídas e aprovadas no 1º teste manual do CD (Sessão 12/PROMPT-0032); Sessão 13 resolveu 2 pontos de feedback extra; **Sessão 14 entregou T-022 (VFX nomeados)**. Fila segue para T-023.

---

## ⚠️ Sessão concorrente conhecida

Existe (ou existiu) uma sessão paralela na branch `aci` (`.claude/worktrees/aci`, scaffold de `packages/aci`/PROPOSAL-0003 — módulo isolado, sem relação com a V1). Há também uma pasta `packages/aci/` **não versionada** na working directory original + um `snapshot-test.sh` solto — resíduos de outra esteira; **não mexer neles**. Antes de qualquer limpeza, checar se a sessão `aci` ainda está ativa (`git branch -a`, `git worktree list`).

## Onde paramos

**Concluído na Sessão 14 (T-022, PROMPT-0034):**
- **Registry de VFX nomeados** (`packages/client/src/vfx.ts`, `VFX_DEFS`) — os 6 efeitos-base da SPEC-0006 (`muzzle_flash`, `hit_spark`, `death_burst`, `shield_pop`, `flag_aura`, `pickup_glint`) + os 5 da fila inicial do backlog vivo (`speed_up_trail`, `buff_cooldown_ring`, `blood_hit`, `level_up_auto`, `upgrade_chosen_aura`, todos marcados ✔ em `docs/mechanics/vfx-juice-backlog.md`). "Efeito novo = 1 entrada de dados" via `VFX_DEFS`, 1 pool único de partículas (`THREE.Points`, orçamento fixo `MAX_PARTICLES=260`) para o jogo inteiro.
- Todo efeito nasce de evento que o servidor já emite (`hit`/`death`/`pickup`/`upgrade` via `debug_event`, transição de `spawnProtectedUntil`, 1ª aparição de projétil) — **zero mudança de protocolo**. Novo helper `updateBuffCooldownRing` em `visuals.ts`.
- Verificado com smoke real (servidor+cliente reais, 1 humano + 6 bots, ~2min) sem erros de console + screenshot confirmando partículas renderizando na cena.
- `toast_text` (fila do backlog) ficou de fora **de propósito** — é parte da T-023.

**Sessões anteriores:** progressão de skill/atributo + bugfix do menu de level-up (Sessão 13/PROMPT-0033) — ver `DEVLOG.md` para o histórico completo (Sessões 10-13).

## Próximo passo

1. **Executar T-023** — HUD dev/prod + reveal-on-hit autoritativo (inimigo só mostra skin até trocar dano, nameplate+HP por ~4s renováveis) + **toasts** (`toast_text`: mensagens com efeito, fila no canto do HUD, substitui os textos crus de streak/card/farm_event). Depende de T-022 (pronto). Contexto: `specs/SPEC-0006-sensacao-e-leitura.md` linhas 14-15, `docs/BACKLOG.md`.
2. Depois de T-023, fase F2 da V1 está completa — próxima é F3 (T-024 registry de objetos + mapa v1, T-025 CLI de mapas).
3. **Calibração pendente (não bloqueia):** cores/contagens dos `VFX_DEFS` são chute inicial de "leve sempre" — CD ajusta por sensação jogando; ritmo de skill (3/6/9/12/15) e cards ×2 (Sessão 13) seguem com a mesma ressalva.

## Pendências reais do lado do CD (não bloqueiam a esteira, só ele resolve)

| Item | Status | Notas |
|---|---|---|
| Touch em dispositivo real | ⬜ pendente | bots não cobrem; smoke só simula mouse/keyboard/servidor |
| Sessão mais longa com vários humanos | ⬜ pendente | tudo testado até aqui foi CD sozinho + bots, ou smokes headless/preview solo |
| Veredito dos novos números de progressão (Sessão 13) numa sessão de verdade | ⬜ pendente | aprovado por lógica/smoke; falta "sentir" jogando período longo |
| Veredito visual dos VFX (Sessão 14) — cores/intensidade/timing | ⬜ pendente | implementado e visto renderizar em screenshot; falta o CD jogar e dar veredito de "sensação" |

## Veredito do Creative Director

| Item | Status | Notas |
|---|---|---|
| PROPOSAL-0002 + ajustes §9 | ✅ aprovada (2026-07-05) | specs SPEC-0006..0009 derivadas |
| T-019 / T-019b (perfis de controle) | ✅ testado manualmente | PROMPT-0027/0028/0032 |
| T-020 + T-008b (IA/perfis dos bots) | ✅ testado manualmente | PROMPT-0029/0030/0032 |
| T-021 (bandeira "rei do mapa") | ✅ testado manualmente | PROMPT-0031/0032 |
| Progressão de skill/atributo + bugfix menu (Sessão 13) | ✅ implementado, verificado por smoke real | PROMPT-0033 — pendente sensação de sessão longa |
| T-022 (VFX nomeados) | ✅ implementado, verificado por smoke real + screenshot | PROMPT-0034 — pendente veredito visual do CD |
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
- Specs executáveis → `specs/SPEC-0006-sensacao-e-leitura.md` (F1+F2 — T-022/T-023 aqui) + `SPEC-0007..0009`
- VFX: registry em `packages/client/src/vfx.ts` + backlog vivo `docs/mechanics/vfx-juice-backlog.md`
- Teoria + implementação dos bots → `docs/ai/bot-architecture.md` + `docs/ai/bots.md`
- Feedback do CD → `docs/CREATIVE_DIRECTOR_NOTES.md` + `docs/prompts/PROMPT-0032.md`, `PROMPT-0033.md`, `PROMPT-0034.md`
- Tasks → seção V1 do `docs/BACKLOG.md` (T-019..T-022 ✅, T-023..T-032 pendentes)
