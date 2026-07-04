# Sessão atual — ponteiro de continuidade

> **Substituir este arquivo inteiro** ao fim de cada sessão de trabalho.
> Não é histórico — histórico fica em `DEVLOG.md` e `docs/prompts/`.

**Atualizado em:** 2026-07-04
**Branch:** `task_008` (contém tudo de T-001..T-008 + camada de continuidade). `continuar_antrigravity` = até T-007; `main` defasado na era T-004 — **merge para `main` pendente** (checklist em `QA.md`).
**Marco:** M1 — T-001..T-008 concluídos; próximo T-008b (ou passe de balance T-OPTIONAL).

---

## Onde paramos

Última entrega fechada:

- **T-008 (mínimo)** — bots de combate: skill `fraco|medio|forte` (`BOT_SKILL` ou sorteio), miram com lead, atiram no alcance do launcher, fogem com HP baixo, ignoram alvos em zona safe. `forte` = caçador pelo mapa todo.
- Novo teste `packages/server/src/systems/projectiles.test.ts` (kill chain + bloqueio em safe).

Antes disso: T-007 (debug F3), bugfix respawn/hitbox — ver DEVLOG.

## Próximo passo sugerido

Escolher um:

- **T-008b** — personalidade/atributos sorteados + modo boss (gancho já pronto na camada de skill).
- **T-OPTIONAL** — passe de balance: TTK real e ajustar o limiar de fuga (kills são raros em janela curta hoje).
- **Merge → main** — rodar checklist de `QA.md` e consolidar branches.

Prompt típico: `Executar T-008b do docs/BACKLOG.md`

## Veredito do Creative Director

| Fluxo | Status | Notas |
|---|---|---|
| Combate bot×bot | ✅ verificado (headless) | 6 bots forte: 18 hits, 1 kill, 1 death; teste determinístico 2/2 |
| Combate manual (2 abas) | ✅ testado antes | originou bugfix respawn/safe_block |
| Debug F3 + `/debug/rooms` | ✅ validado | |
| Merge para `main` | ⬜ pendente | checklist em `QA.md` |

## Comandos úteis agora

```bash
npm run test
npm run dev:server                 # DEBUG=1 opcional (feed F3 e /debug/rooms)
npm run dev:client
BOT_SKILL=forte npm run bots -- 4 30   # 4 bots de combate por 30s
```

## Leituras se a sessão nova for só conversa

- Bots / combate → `docs/ai/bots.md`
- Gameplay FAQ → `docs/mechanics/PLAYER_LOOP.md`
- Testes / merge → `docs/QA.md`
- Visão do produto → `docs/VISAO-ATUAL.md`
