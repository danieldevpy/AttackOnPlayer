# Sessão atual — ponteiro de continuidade

> **Substituir este arquivo inteiro** ao fim de cada sessão de trabalho.
> Não é histórico — histórico fica em `DEVLOG.md` e `docs/prompts/`.

**Atualizado em:** 2026-07-06
**Branch:** `evolução`. **Marco:** V1.
**Sessão 20:** fix de boot dos bots + fechamento de T-046/T-047 (SPEC-0011) + T-025 (CLI de mapas,
fecha F3/SPEC-0007). Ver `docs/DEVLOG.md` (Sessão 20) e `docs/prompts/PROMPT-0040.md` para detalhe.

---

## ⚠️ Avisos operacionais

- Sessão paralela na branch `aci`: `packages/aci/` não versionado + `snapshot-test.sh` soltos = resíduos de outra esteira, **não mexer**. Portas 2567/5173 podem estar ocupadas por ela — smokes usam `PORT=2601+`.
- Branches de resgate do incidente S19: `funcional-0705` (= `7c9e28e`) e `trabalho-agente-interrompido` (= `185eb53`) — podem ser apagadas quando o CD quiser, `evolução` já contém tudo.
- **Regra (incidente S19): commitar ao fim de cada frente verde.**

## Onde paramos

**F3 (SPEC-0007) fechada.** Concluído e commitado nesta sessão:
- Fix do bug de boot dos bots (`"type": "module"` faltando em `packages/shared/package.json`).
- **T-046** — smoke de integração da SPEC-0011 (QA, sem mudança de código): ciclo completo da arma/bandeira/combo de XP validado ao vivo. Relatório em `docs/prompts/PROMPT-0039.md` §Resultado T-046.
- **T-047** — `docs/mechanics/flag.md` criado.
- **T-025** — CLI de mapas (`npm run map -- gen|save|save-current|update|list|preview`), testada ponta a ponta com servidor+bots reais. 2 mapas curados no repo (`maps/arena-teste.map.json`, `maps/arena-live-capture.map.json`). Detalhes em `docs/prompts/PROMPT-0040.md`.

**Gates:** shared 29/29 · server 49/49 · bots 35/35 · tsc limpo ×3.

## Próximo passo

F3 encerrada. Abre **F4 — Plataforma (SPEC-0008)**:
1. **T-026** — Telemetria estruturada p/ IA (NDJSON versionado, `npm run analyze`, watchdog de tick).
2. **T-027** — Backend Django: accounts/maps/gameops/telemetry + admin (ADR-016 — fronteira Node×Django).
3. **T-028** — Auth: anônimo default + Google + "registre-se" (JWT no join; guest vincula ao logar) · depende: T-027.
4. **T-029** — ADR-012 liga na conta (estatística, nunca poder in-round) · depende: T-028.

## Pendências reais do lado do CD (não bloqueiam a esteira)

| Item | Notas |
|---|---|
| Veredito de sensação da SPEC-0011 | dials por task na F2.6 do BACKLOG: multiplicadores de aura (`personality.ts`), números dos lançadores/respawn da arma, `FLAG_COOLDOWN_MS`, booster do combo |
| Veredito visual: arma no chão, bandeira acesa/apagada, popups, materialização | WebGL não screenshota headless |
| Vereditos anteriores acumulados (S13/S14/S15, F2.5, T-036) | ver DEVLOG |
| SPEC-0007 critério de aceite #2 (editar JSON à mão) | já coberto pelo loader+validação da T-024; só falta o CD confirmar por conta própria se quiser |

## Comandos úteis agora

```bash
npm run test -w @aop/shared && (cd packages/server && npx vitest run) && (cd packages/bots && npx vitest run)  # 29 + 49 + 35
for p in server client bots; do (cd packages/$p && npx tsc --noEmit) && echo "$p ok"; done
PORT=2601 DEBUG=1 npm run dev:server   # smoke (2567/5173 podem estar ocupadas)
npm run map -- list                    # mapas curados salvos
npm run map -- preview arena-teste     # preview ASCII de um mapa
BOT_MAP_ID=arena-teste npm run bots -- 4 30   # joga um mapa curado com bots
```

## Leituras se a sessão nova for só conversa

- Esta sessão → `docs/prompts/PROMPT-0040.md` (T-025) + `docs/prompts/PROMPT-0039.md` §Resultado T-046 + `docs/mechanics/flag.md`
- Escopo por task + dials da SPEC-0011 → `docs/BACKLOG.md` seção F2.6
- Fila V1 → `docs/BACKLOG.md` (T-037..T-025 ✅; F3 fechada; próxima: F4/T-026)
