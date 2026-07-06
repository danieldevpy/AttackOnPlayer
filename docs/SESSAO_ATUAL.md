# Sessão atual — ponteiro de continuidade

> **Substituir este arquivo inteiro** ao fim de cada sessão de trabalho.
> Não é histórico — histórico fica em `DEVLOG.md` e `docs/prompts/`.

**Atualizado em:** 2026-07-06
**Branch:** `evolução` @ `337ae08`. **Marco:** V1.
**Sessão 19:** SPEC-0011 (T-037..T-045, feedback de gameplay #2) implementada por 4 agentes em 2 etapas paralelas, **perdida num reset acidental e recuperada por replay dos transcripts** (85 ops, 0 falhas) — commit `337ae08`.

---

## ⚠️ Avisos operacionais

- Sessão paralela na branch `aci`: `packages/aci/` não versionado + `snapshot-test.sh` soltos = resíduos de outra esteira, **não mexer**. Portas 2567/5173 podem estar ocupadas por ela — smokes usam `PORT=2599+`.
- Branches de resgate criadas pelo CD durante o incidente: `funcional-0705` (= `7c9e28e`) e `trabalho-agente-interrompido` (= `185eb53`) — podem ser apagadas quando o CD quiser, `evolução` já contém tudo.
- **Regra nova (incidente S19): commitar ao fim de cada frente verde.** Transcripts de subagentes (`~/.claude/projects/<projeto>/<sessão>/subagents/`) são backup de última instância — replay só funciona sobre o mesmo commit-base.

## Onde paramos

**Concluído e commitado (`337ae08`):** as 9 tasks da SPEC-0011 — detalhe por task com dials de calibração na seção **F2.6 do `docs/BACKLOG.md`**:
- Bots: aura atrai ameaça (percepção ×1.6/×2.5, engage ×1.25/×1.5 com teto), coragem com vida cheia, fuga só com rota de cura (T-037).
- Projéteis: `sceneryRadius` 0.22 passa diagonal (T-038); `heavy_shot`/`rapid_shot` + arma coletável única com respawn 15–30 s (T-039).
- Bandeira: assenta só em célula alcançável (T-040); acesa/apagada/some (T-041); abandono 5 s → cooldown 60 s → centro (T-042).
- Feedback: combo de XP 2× (3ª+ coleta, limite sorteado 3–5, dano zera) (T-043); popups discretos (T-044); materialização de spawn + fade (T-045).

**Gates:** shared 25/25 · server 49/49 · bots 35/35 · tsc limpo ×3.

## Próximo passo (paralelizável, escopos fechados no BACKLOG — dimensionados p/ Sonnet)

1. **T-046 — smoke de integração da SPEC-0011** (QA; servidor porta livre + 8–12 bots ≥3 min; observar weapon/flag-cooldown/xp_combo/aura ao vivo; só observar e relatar).
2. **T-047 — doc de mecânica da bandeira** (`docs/mechanics/flag.md`, ciclo completo + constantes-dial; docs-only).
   → T-046 e T-047 têm arquivos disjuntos: podem rodar em paralelo, um agente cada.
3. Depois, retomar a fila V1 original: **T-025** (CLI de mapas, SPEC-0007).

## Pendências reais do lado do CD (não bloqueiam a esteira)

| Item | Notas |
|---|---|
| Veredito de sensação da SPEC-0011 | dials por task na F2.6: multiplicadores de aura (`personality.ts`), números dos lançadores/respawn da arma, `FLAG_COOLDOWN_MS`, booster do combo |
| Veredito visual: arma no chão, bandeira acesa/apagada, popups, materialização | WebGL não screenshota headless |
| Vereditos anteriores acumulados (S13/S14/S15, F2.5, T-036) | ver DEVLOG |

## Comandos úteis agora

```bash
npm run test -w @aop/shared && (cd packages/server && npx vitest run) && (cd packages/bots && npx vitest run)  # 25 + 49 + 35
for p in server client bots; do (cd packages/$p && npx tsc --noEmit) && echo "$p ok"; done
PORT=2601 DEBUG=1 npm run dev:server   # smoke (2567/5173 podem estar ocupadas)
```

## Leituras se a sessão nova for só conversa

- Esta sessão → `docs/prompts/PROMPT-0039.md` (inclui o incidente/recuperação) + `specs/SPEC-0011-feedback-gameplay-2.md`
- Escopo por task + dials → `docs/BACKLOG.md` seção F2.6
- Fila V1 → `docs/BACKLOG.md` (T-037..T-045 ✅; pendentes T-046/T-047; depois T-025)
