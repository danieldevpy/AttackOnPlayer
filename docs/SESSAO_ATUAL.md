# Sessão atual — ponteiro de continuidade

> **Substituir este arquivo inteiro** ao fim de cada sessão de trabalho.
> Não é histórico — histórico fica em `DEVLOG.md` e `docs/prompts/`.

**Atualizado em:** 2026-07-06
**Branch:** `evolução`. **Marco:** V1.
**Sessão 21:** 3 correções pedidas pelo CD antes de continuar o backlog — bandeira (já estava
certa, F3 ganhou texto de estado), SPEC-0010 (confirmada funcional ao vivo), cards de level-up
(mais variedade + sorteio, reverte T-016). Ver `docs/DEVLOG.md` (Sessão 21) e
`docs/prompts/PROMPT-0041.md`.

---

## ⚠️ Avisos operacionais

- Sessão paralela na branch `aci`: `packages/aci/` não versionado + `snapshot-test.sh` soltos = resíduos de outra esteira, **não mexer**. Portas 2567/5173 podem estar ocupadas por ela.
- **Preview headless não renderiza WebGL nesta config:** confirmado nesta sessão que `document.hidden === true` no browser de preview pausa o `requestAnimationFrame` do client (`main.ts`) — sem loop de render, sem screenshot útil. Verificação visual de 3D/UI precisa do CD num browser de verdade. `.claude/launch.json` tem `server-verify` (2604) / `client-verify` (5299) prontos pra isso, com override `?port=NNNN` no cliente.
- Branches de resgate do incidente S19: `funcional-0705` (= `7c9e28e`) e `trabalho-agente-interrompido` (= `185eb53`) — podem ser apagadas quando o CD quiser.
- **Regra (incidente S19): commitar ao fim de cada frente verde.**

## Onde paramos

**F3 (SPEC-0007) fechada** desde a sessão 20. Nesta sessão (21), 3 correções pontuais:
- **Bandeira:** T-041/T-042 já cobriam o pedido do CD (livre/carregada/cooldown); F3 ganhou linha
  de estado textual pra dar um veredito sem depender de screenshot.
- **SPEC-0010:** confirmada funcional via smoke ao vivo (8 bots/100s) — números batendo a spec.
- **Cards de level-up:** pool 6→12, oferta sorteada por level-up (não mais fixa por nível).
  Perfis de bot atualizados com `preferredCardIds` extras.

**Gates:** shared 30/30 · server 49/49 · bots 35/35 · tsc limpo ×3.

## Próximo passo

Retomar a fila V1: **F4 — Plataforma (SPEC-0008)**:
1. **T-026** — Telemetria estruturada p/ IA (NDJSON versionado, `npm run analyze`, watchdog de tick).
2. **T-027** — Backend Django: accounts/maps/gameops/telemetry + admin (ADR-016 — fronteira Node×Django).
3. **T-028** — Auth: anônimo default + Google + "registre-se" (JWT no join; guest vincula ao logar) · depende: T-027.
4. **T-029** — ADR-012 liga na conta (estatística, nunca poder in-round) · depende: T-028.

## Pendências reais do lado do CD (não bloqueiam a esteira)

| Item | Notas |
|---|---|
| Veredito de sensação: cards sorteados (12 no pool) | se ficar "sortido demais" e diluir identidade de build, dá pra reduzir pool ou pesar sorteio |
| Veredito visual da bandeira (livre/carregada/cooldown) | pendente desde T-041 — precisa de browser real, F3 agora mostra o estado em texto como atalho |
| Veredito de sensação da SPEC-0011 (aura, arsenal, bandeira, combo) | dials na F2.6 do BACKLOG |
| Vereditos anteriores acumulados (S13/S14/S15, F2.5, T-036) | ver DEVLOG |
| SPEC-0007 critério de aceite #2 (editar JSON à mão) | já coberto pelo loader+validação da T-024 |

## Comandos úteis agora

```bash
npm run test -w @aop/shared && (cd packages/server && npx vitest run) && (cd packages/bots && npx vitest run)  # 30 + 49 + 35
for p in server client bots; do (cd packages/$p && npx tsc --noEmit) && echo "$p ok"; done
npm run map -- list                    # mapas curados salvos
BOT_MAP_ID=arena-teste npm run bots -- 4 30   # joga um mapa curado com bots
```

## Leituras se a sessão nova for só conversa

- Esta sessão → `docs/prompts/PROMPT-0041.md` + `docs/LEAD_DESIGNER_NOTES.md`/`CREATIVE_DIRECTOR_NOTES.md` (entradas 2026-07-06)
- Escopo por task + dials da SPEC-0011 → `docs/BACKLOG.md` seção F2.6
- Fila V1 → `docs/BACKLOG.md` (T-037..T-025 ✅; F3 fechada; próxima: F4/T-026)
