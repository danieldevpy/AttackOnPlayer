# Sessão atual — ponteiro de continuidade

> **Substituir este arquivo inteiro** ao fim de cada sessão de trabalho.
> Não é histórico — histórico fica em `DEVLOG.md` e `docs/prompts/`.

**Atualizado em:** 2026-07-04
**Branch:** `movimento_e_direcao` (SPEC-0003 completa, sobre o que já tinha T-001..T-008 mergeado). Merge para `main` continua pendente (checklist em `QA.md`).
**Marco:** M1 — combate base pronto (T-001..T-008); **SPEC-0003 (facing/mira/gatilhos) implementada por completo (T-009..T-013)**.

---

## Onde paramos

`specs/SPEC-0003-facing-mira-gatilhos.md` está com as 5 tasks ✅:

- **T-009** — `Player.dir` sincronizado, facing híbrido (mira > movimento > mantém o último).
- **T-010** — protocolo `{x,z,aimX?,aimZ?,fire?}`; tiro sempre sai do facing, nunca do input.
- **T-011** — nariz placeholder visível + rotação interpolada no cliente.
- **T-013** — bots migrados pro protocolo novo (mira contínua + gatilho); voltaram a atirar/matar.
- **T-012** — ganchos de mobilidade em `LauncherDef` (`movement?`), `EffectSystem` ganhou efeito de magnitude dinâmica (`launcher_slow`), lançador de teste `heavy_shot_dev` atrás de `dev_launcher` + `DEBUG=1`.

**Bugfix crítico no meio do caminho (T-011):** `.js` compilados obsoletos sentados do lado de `.ts` em `client/shared/bots` venciam silenciosamente os `.ts` reais na resolução de módulo do Vite. Removidos; `npm run test` corrigido de "10/10" (5 testes em dobro) para **5/5** real. Guarda automática em `QA.md`.

Detalhe completo por task: `docs/prompts/PROMPT-0014.md` a `PROMPT-0018.md`.

## Próximo passo sugerido

A spec está tecnicamente fechada. Falta decisão do Creative Director, não código:

1. **Veredito do CD** nos fluxos marcados como pendente nos PROMPTs (facing por mouse/teclado/parado, disparo espaço/clique, nariz girando, `heavy_shot_dev` reduzindo velocidade) — testar ao vivo no browser.
2. **Merge `movimento_e_direcao` → `main`** — checklist em `docs/QA.md` (gates automáticos já rodados e limpos nesta sessão).
3. Se quiser continuar construindo: próxima spec nova (nada da SPEC-0003 ficou pendente) ou `T-OPTIONAL 1` do `BACKLOG.md` (balance/métricas).

Prompt típico: `Testar SPEC-0003 no browser e dar veredito` ou `Preparar merge de movimento_e_direcao para main`

## Veredito do Creative Director

| Fluxo | Status | Notas |
|---|---|---|
| Facing por mouse/teclado/parado (T-009) | ⬜ pendente teste do CD | verificado por IA via preview no browser |
| Disparo por espaço/clique idênticos (T-010) | ⬜ pendente teste do CD | verificado por IA via preview no browser |
| Nariz visível girando (T-011) | ⬜ pendente teste do CD | verificado por IA via preview no browser |
| Bots atirando/matando de novo (T-013) | ✅ verificado (headless) | `bot-4 morreu` confirmado no log |
| `heavy_shot_dev` reduz velocidade e expira sozinho (T-012) | ✅ verificado (teste unitário determinístico) | janela de 700ms não capturada em screenshot (preview throttled); teste é a prova mais confiável |
| Merge para `main` | ⬜ pendente | checklist em `QA.md` — gates locais já limpos |

## Comandos úteis agora

```bash
npm run test                        # 5/5
npm run dev:server                  # DEBUG=1 habilita feed F3, /debug/rooms e dev_launcher
npm run dev:client
npm run bots -- 3 30                # combate completo (tiro/dano/morte) funcionando
```

## Leituras se a sessão nova for só conversa

- Spec ativa (fechada, aguardando veredito) → `specs/SPEC-0003-facing-mira-gatilhos.md`
- Facing/movimento → `docs/mechanics/movement.md`
- Mira/gatilho/combate/ganchos de mobilidade → `docs/mechanics/combat.md`
- Efeitos (inclui `launcher_slow`) → `docs/mechanics/skills.md`
- Bots / combate → `docs/ai/bots.md`
- Testes / merge → `docs/QA.md` (tem a guarda contra `.js` órfão)
