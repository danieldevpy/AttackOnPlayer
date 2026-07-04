# Sessão atual — ponteiro de continuidade

> **Substituir este arquivo inteiro** ao fim de cada sessão de trabalho.  
> Não é histórico — histórico fica em `DEVLOG.md` e `docs/prompts/`.

**Atualizado em:** 2026-07-04  
**Branch:** `continuar_antrigravity` (5 commits à frente de `main`: T-004b → T-007 + bugfix respawn/hitbox)  
**Marco:** M1 — T-001..T-007 concluídos; próximo T-008

---

## Onde paramos

Última entrega fechada:

- **T-007** — modo debug: overlay F3, `GET /debug/rooms`, ring buffer, `BOT_VERBOSE=1`
- **Bugfix pós-teste CD** — respawn por distância/risco, colisão de projétil por segmento, evento `safe_block`, `maxHp` por vitalidade

Commits recentes:

- `be7cc0a` fix(combat): respawn estratégico e hitbox após morte
- `1ad69ec` T-007: Modo debug dinâmico

## Próximo passo sugerido

**T-008 — Bots de combate** (`docs/BACKLOG.md`): mirar, atirar, fugir com vida baixa, skill parametrizável. Depende de T-005/T-006 (prontos).

Prompt típico:

> Executar T-008 do docs/BACKLOG.md

## Veredito do Creative Director

| Fluxo | Status | Notas |
|---|---|---|
| Combate manual (2 abas) | ✅ testado | Relato originou bugfix respawn/safe_block |
| Debug F3 + `/debug/rooms` | ✅ validado na sessão | |
| Reroll (R) | ⬜ não registrado veredito formal | ver `PLAYER_LOOP.md` |
| Merge para `main` | ⬜ pendente | checklist em `QA.md` |

## Comandos úteis agora

```bash
npm run test
npm run dev:server    # DEBUG=1 opcional
npm run dev:client
npm run bots -- 3 30
```

## Leituras se a sessão nova for só conversa

- Gameplay FAQ → `docs/mechanics/PLAYER_LOOP.md`
- Testes / merge → `docs/QA.md`
- Visão do produto → `docs/VISAO-ATUAL.md`
