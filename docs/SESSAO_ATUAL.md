# Sessão atual — ponteiro de continuidade

> **Substituir este arquivo inteiro** ao fim de cada sessão de trabalho.
> Não é histórico — histórico fica em `DEVLOG.md` e `docs/prompts/`.

**Atualizado em:** 2026-07-05
**Branch:** `evolução` — SPECs 0003/0004/0005 implementadas; **V1 aprovada e documentada, pronta para executar**.
**Marco:** V1 (lançamento público) — PROPOSAL-0002 ✅ aprovada com ajustes; SPEC-0006..0009 criadas.

---

## Onde paramos

**PROPOSAL-0002 aprovada pelo CD com 3 ajustes (§9), tudo incorporado e a documentação executável está completa:**

- **A1 — Controles por perfil (ADR-015):** o jogo é estilo Valorant 3D leve/simplista; "CS 2D" = liberdade de movimento + tiro com lógica realista. Perfis `mouse` (crosshair 360° + strafe), `keyboard` (rotação por teclas) e `touch` (twin-stick) — todos produzem `{move, aim, fire}`; rotação é atributo do perfil; servidor não muda. Fim do vaivém de ADRs sobre mira.
- **A2 — Bot é arquitetura de IA (novo doc `docs/ai/bot-architecture.md`):** Percepção → Memória → Decisão (Utility AI) → Context Steering (borda/strafe) → Humanizador → Atuação; `Personality` = JSON; perfis/boss/Guardian = presets. T-020 implementa o doc.
- **A3 — Mapas & objetos:** registry `ObjectDef` (código agora, sistema/Django depois); mapa = instâncias de objetos por id; CLI ganha `save-current` (salva o mapa da partida atual para reajustar depois). IA cura mapas em sessão com o CD — nunca geração automática.
- **A4 — Juice contínuo (adição final):** backlog vivo `docs/mechanics/vfx-juice-backlog.md` — o CD adiciona efeitos quando sentir necessidade, qualquer leva puxa via registry da T-022. Regra de intensidade: automático = leve; escolha manual = "aura" chamativa. Toasts (`toast_text`) entram no T-023. **Plano da V1 FINALIZADO.**

**Documentos criados/atualizados nesta sessão:** PROPOSAL-0002 (§9 ajustes, status aprovada) · `docs/ai/bot-architecture.md` · ADR-015 e ADR-016 no DECISION_LOG · `specs/SPEC-0006-sensacao-e-leitura.md` (F1+F2) · `SPEC-0007-mapas-e-objetos.md` (F3) · `SPEC-0008-plataforma-django-auth.md` (F4) · `SPEC-0009-empacotamento-e-lancamento.md` (F5+F6) · BACKLOG (T-019/T-019b/T-020/T-024/T-025 revisadas, seção V1 aprovada) · ROADMAP.

## Próximo passo sugerido

**Começar o desenvolvimento da V1, em ordem:**

1. `Executar T-019 do docs/BACKLOG.md` — camada de perfis de controle + perfil `mouse` (SPEC-0006, ADR-015).
2. Sequência da F1: T-019 → T-020 (IA de bot) → T-019b → depois F2 (T-021 bandeira → T-022 VFX → T-023 HUD) → T-008b.
3. **Herdado:** veredito no browser das SPECs 3/4/5 + merge `evolução` → `main` — idealmente antes da T-019 (a T-019 mexe exatamente no input que a SPEC-0005 acabou de mudar; melhor congelar o estado atual em `main` primeiro).

Questões que o CD ainda pode ajustar em teste (defaults valem): bônus de atributo da bandeira (default: só 2×XP), duração do reveal (4s), formas do skin placeholder, canal de divulgação (T-032).

## Veredito do Creative Director

| Item | Status | Notas |
|---|---|---|
| PROPOSAL-0002 + ajustes §9 | ✅ aprovada (2026-07-05) | specs SPEC-0006..0009 derivadas |
| SPEC-0005 (gameplay) / SPEC-0004 / SPEC-0003 | ⬜ pendente teste no browser | herdadas; checklists no QA.md |
| Merge `evolução` → `main` | ⬜ pendente | recomendado antes da T-019 |

## Comandos úteis agora

```bash
npm run test && (cd packages/server && npx vitest run)   # 13/13 + 19/19
npm run dev:server && npm run dev:client                  # estado atual (facing por movimento)
npm run bots -- 4 30
```

## Leituras se a sessão nova for só conversa

- Plano-mãe → `docs/proposals/PROPOSAL-0002-v1-lancamento.md` (§9 = ajustes finais do CD)
- Specs executáveis → `specs/SPEC-0006..0009`
- Teoria dos bots → `docs/ai/bot-architecture.md`
- Decisões novas → DECISION_LOG ADR-015 (controles) e ADR-016 (fronteira Django)
- Tasks → seção V1 do `docs/BACKLOG.md` (T-019..T-032)
