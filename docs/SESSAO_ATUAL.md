# Sessão atual — ponteiro de continuidade

> **Substituir este arquivo inteiro** ao fim de cada sessão de trabalho.
> Não é histórico — histórico fica em `DEVLOG.md` e `docs/prompts/`.

**Atualizado em:** 2026-07-05
**Branch:** `evolução` — working directory original.
**Marco:** V1 (lançamento público). **Passe visual (T-036) implementado** nesta sessão. Antes: F2.5/SPEC-0010 (T-033..T-035). F3 (conteúdo) segue pendente a partir da T-025.

---

## ⚠️ Sessão concorrente conhecida

Existe (ou existiu) uma sessão paralela na branch `aci` (`.claude/worktrees/aci`, scaffold de `packages/aci`/PROPOSAL-0003 — módulo isolado). Pasta `packages/aci/` **não versionada** + `snapshot-test.sh` solto: resíduos de outra esteira, **não mexer**. Há um dev server dessa outra sessão ocupando as portas de preview (2567/5173) — por isso o smoke da S17 usou `PORT=2599` e a verificação de HUD da S18 usou um preview estático em porta livre (config `hud-mock` já removida do launch.json).

## Onde paramos

**Concluído na Sessão 18 (T-036, PROMPT-0038) — passe visual (só cliente):**
- **Coletáveis reconhecíveis (F2 composição):** cada tipo virou um `THREE.Group` de primitivas com forma intuitiva — cruz=vida, domo azul=escudo, seta=velocidade, moeda em pé=coins, seta dupla=2×XP, baú=box, gema=xp (`collectibleParts` em `visuals.ts`, geo/mat singletons).
- **VFX de cura/escudo:** `heal_pop` (verde) e `shield_gain` (azul) no registry + popup "+X" verde — fecham a lacuna de feedback da SPEC-0010. Escudo temp entrou no anel de cooldown de buff.
- **HUD gamificado:** painel com badge de nível + barras HP (cor por fração) / XP + chips de efeito, no lugar do texto cru (`hud.ts` + CSS em `index.html`). Regra "só exibe estado" e dev/prod da T-023 preservadas.
- **Verificado:** typecheck server/client/bots · gates 25/28/24 · HUD conferido em screenshot (mockup com CSS real). 3D pendente de veredito visual humano (WebGL não screenshota headless).

**Sessões anteriores:** SPEC-0010/sobrevivência (S17/PROMPT-0037), T-024 registry de objetos/mapa v1 (S16/PROMPT-0036) — ver `DEVLOG.md`.

## Próximo passo

1. **Retomar a F3 (SPEC-0007): executar T-025** — CLI de mapas (`gen|save|save-current|update|list|preview`), depende da T-024. Contexto: `docs/BACKLOG.md` (T-025), `specs/SPEC-0007-*.md`.
2. Passe visual e F2.5 já entregues; faltam só vereditos de sensação/visual do CD (abaixo) — não bloqueiam a esteira.

## Pendências reais do lado do CD (não bloqueiam a esteira, só ele resolve)

| Item | Status | Notas |
|---|---|---|
| Veredito visual do passe (T-036) — coletáveis 3D, VFX cura/escudo, HUD em movimento | ⬜ pendente | WebGL não screenshota no headless; cores/formas ajustáveis por CSS/constante |
| Veredito de sensação da F2.5 (SPEC-0010) — 4 tunables | ⬜ pendente | `KILL_HEAL_MISSING_FRAC_BASE`, `COMBAT_THREAT_RADIUS`, `HP_ORB_AMOUNT`, `SHIELD_TEMP_DAMAGE_MULT` |
| Touch em dispositivo real | ⬜ pendente | bots não cobrem |
| Sessão mais longa com vários humanos | ⬜ pendente | testado até aqui: CD sozinho + bots, ou smokes headless |
| Vereditos de sensação anteriores (progressão S13, VFX S14, reveal/toasts S15) | ⬜ pendente | implementados e verificados por smoke; falta "sentir" jogando |

## Veredito do Creative Director

| Item | Status | Notas |
|---|---|---|
| T-036 (passe visual) | ✅ implementado, HUD verificado em screenshot | PROMPT-0038 — pendente veredito visual do 3D |
| SPEC-0010 / F2.5 (T-033..T-035) | ✅ implementado, smoke real | PROMPT-0037 / ADR-017 — pendente veredito de sensação |
| T-024 (registry de objetos + mapa v1) | ✅ implementado, smoke real | PROMPT-0036 |

## Comandos úteis agora

```bash
npm run test -w @aop/shared && (cd packages/server && npx vitest run) && (cd packages/bots && npx vitest run)  # 25 + 28 + 24
for p in server client bots; do (cd packages/$p && npx tsc --noEmit) && echo "$p ok"; done
npm run dev:server && npm run dev:client   # (portas 2567/5173 podem estar ocupadas pela sessão concorrente)
```

## Leituras se a sessão nova for só conversa

- Passe visual → `docs/prompts/PROMPT-0038.md` + `packages/client/src/visuals.ts` (`collectibleParts`), `vfx.ts` (`VFX_DEFS`), `hud.ts` (`buildHudShell`/`updateHud`), `instrucoes/FASES_VISUAIS.md` (nota T-036)
- Backlog vivo de VFX → `docs/mechanics/vfx-juice-backlog.md` (CD adiciona itens quando quiser)
- Mecânica de sobrevivência → `specs/SPEC-0010-*.md` + `docs/mechanics/combat.md`/`collectibles.md` + ADR-017
- Fila V1 → seção V1 do `docs/BACKLOG.md` (T-019..T-024 ✅, T-033..T-036 ✅; próxima: T-025)
