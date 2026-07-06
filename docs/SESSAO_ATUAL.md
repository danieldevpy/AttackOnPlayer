# Sessão atual — ponteiro de continuidade

> **Substituir este arquivo inteiro** ao fim de cada sessão de trabalho.
> Não é histórico — histórico fica em `DEVLOG.md` e `docs/prompts/`.

**Atualizado em:** 2026-07-06
**Branch:** `evolução`. **Marco:** V1.
**Sessão 22:** T-026 concluída (telemetria estruturada por evento + `npm run analyze`) — abre a
fila F4 (SPEC-0008). Ver `docs/DEVLOG.md` (Sessão 22) e `docs/prompts/PROMPT-0042.md`.

---

## ⚠️ Avisos operacionais

- `packages/aci/` (PROPOSAL-0003, ADR-018) foi mergeado da branch dedicada `aci` direto para `evolução` — worktree `.claude/worktrees/aci` removido, desenvolvimento do ACI continua nesta branch a partir de agora. F0-F3 prontos (`npm run aci:test` 39/39). `snapshot-test.sh` solto na raiz é resíduo não relacionado, de outra sessão — ainda não investigado, mas não interfere no ACI nem no jogo.
- **Preview headless não renderiza WebGL nesta config:** `document.hidden === true` no browser de preview pausa o `requestAnimationFrame` do client — sem loop de render, sem screenshot útil. Verificação visual de 3D/UI precisa do CD num browser de verdade. `.claude/launch.json` tem `server-verify` (2604) / `client-verify` (5299) prontos, com override `?port=NNNN` no cliente.
- **Cuidado com `cd` + comandos em sequência no Bash tool:** um `cd` feito num comando anterior pode deixar o cwd em um workspace errado (ex.: `packages/bots`) e fazer `npm run <script-da-raiz>` resolver o script do workspace errado. Preferir `npm --prefix <caminho-absoluto>` quando o cwd não for garantido.
- Branches de resgate do incidente S19: `funcional-0705` (= `7c9e28e`) e `trabalho-agente-interrompido` (= `185eb53`) — podem ser apagadas quando o CD quiser.
- **Regra (incidente S19): commitar ao fim de cada frente verde.**

## Onde paramos

**F3 (SPEC-0007) fechada** desde a sessão 20. Sessão 21 fechou 3 correções (bandeira/SPEC-0010/
cards), todas aprovadas pelo CD. Sessão 22 (esta) entregou:
- **T-026 — Telemetria estruturada:** 1 NDJSON por partida (`packages/server/logs/telemetry/`),
  eventos de kill/upgrade/bandeira/quit/tick_slow/error com schema versionado; `npm run analyze
  -- [matchId|--list]` produz funil, cards mais recusados, heatmap de mortes e watchdog.
  Validado ponta a ponta com 8 bots reais.

**Gates:** shared 30/30 · server 62/62 · bots 35/35 · tsc limpo ×3.

**Fora da fila V1 (paralelo):** `packages/aci` — infraestrutura de contexto para agentes (PROPOSAL-0003, ADR-018), integrado nesta sessão via merge da branch `aci` (F0 scaffold, F1 índice de código, F2 índice de docs/corpus, F3 grafo de relações + resumos). `npm run aci:test` 39/39, tsc limpo, isolado (nenhum pacote do jogo importa `@aop/aci`). Próximo: F4 (contexto por feature) e F5 (servidor MCP) — ver `docs/proposals/PROPOSAL-0003-aci-infra-contexto-ia.md` §6.

## Próximo passo

**F4 — Plataforma (SPEC-0008), continuação:**
1. **T-027** — Backend Django: accounts/maps/gameops/telemetry + admin (ADR-016 — fronteira
   Node×Django). **Escopo bem maior que as tasks anteriores** (novo serviço/stack) — alinhar com
   o CD antes de começar (infra da VPS, se já há Django/Python configurado, etc.) em vez de só
   começar a codar.
2. **T-028** — Auth: anônimo default + Google + "registre-se" (JWT no join; guest vincula ao logar) · depende: T-027.
3. **T-029** — ADR-012 liga na conta (estatística, nunca poder in-round) · depende: T-028.

## Pendências reais do lado do CD (não bloqueiam a esteira)

| Item | Notas |
|---|---|
| Sensação dos cards sorteados (12 no pool) | aprovado sem ter jogado (sessão 21); reabrir se destoar jogando |
| Visual da bandeira (livre/carregada/cooldown) | aprovado sem ter jogado (sessão 21); F3 mostra o estado em texto |
| Sensação da SPEC-0011 (aura, arsenal, bandeira, combo) | dials na F2.6 do BACKLOG |
| Vereditos anteriores acumulados (S13/S14/S15, F2.5, T-036) | ver DEVLOG |
| SPEC-0007 critério de aceite #2 (editar JSON à mão) | já coberto pelo loader+validação da T-024 |
| **Decisão nova do CD antes de T-027** | Django precisa de decisões de infra (hospedagem, banco, se já existe algo configurado na VPS) — não é só código |

## Comandos úteis agora

```bash
npm run test -w @aop/shared && (cd packages/server && npx vitest run) && (cd packages/bots && npx vitest run)  # 30 + 62 + 35
for p in server client bots; do (cd packages/$p && npx tsc --noEmit) && echo "$p ok"; done
npm run analyze -- --list              # partidas com telemetria disponível
npm run analyze                        # relatório da partida mais recente
npm run map -- list                    # mapas curados salvos
npm run aci -- doctor                  # ACI: diagnóstico do ambiente (PROPOSAL-0003)
npm run aci -- search <query>          # ACI: acha símbolo/spec/ADR sem abrir arquivo inteiro
npm run aci:test                       # ACI: suíte de testes (39/39)
```

## Leituras se a sessão nova for só conversa

- Esta sessão → `docs/prompts/PROMPT-0042.md` (T-026)
- Sessão anterior → `docs/prompts/PROMPT-0041.md` (§Veredito CD: aprovado)
- Escopo por task + dials da SPEC-0011 → `docs/BACKLOG.md` seção F2.6
- Fila V1 → `docs/BACKLOG.md` (T-037..T-026 ✅; próxima: T-027, escopo maior — Django)
- F4 em detalhe → `specs/SPEC-0008-plataforma-django-auth.md`
