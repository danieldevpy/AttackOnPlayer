# Sessão atual — ponteiro de continuidade

> **Substituir este arquivo inteiro** ao fim de cada sessão de trabalho.
> Não é histórico — histórico fica em `DEVLOG.md` e `docs/prompts/`.

**Atualizado em:** 2026-07-06
**Branch:** `evolução`. **Marco:** V1.
**Sessão 25:** T-048 concluída (imersão de navegador — SPEC-0012, fora de fase, pedido direto
do CD antes de retomar T-028). Ver `docs/DEVLOG.md` (Sessão 25) e `docs/prompts/PROMPT-0043.md`.

---

## ⚠️ Avisos operacionais

- **Backend novo em `backend/`** (T-027, Django+DRF+Postgres, pip+venv) — NÃO é workspace npm; roda
  isolado. `cd backend && ./dev.sh` sobe tudo (venv/deps/`.env`/chaves JWT na primeira vez; Postgres
  +migrate+runserver sempre). Container Postgres (`backend-db-1`, porta 5432) sobe via
  `docker compose -f backend/docker-compose.yml up -d db` — para derrubar, `... down`.
- `packages/aci/` (PROPOSAL-0003, ADR-018) segue isolado — nenhum pacote do jogo o importa. `npm run
  aci:test` 39/39. `snapshot-test.sh` solto na raiz é resíduo não relacionado, ainda não investigado.
- **Preview headless não renderiza WebGL nesta config:** `document.hidden === true` no browser de
  preview pausa o `requestAnimationFrame` do client — sem loop de render, sem screenshot útil.
  Verificação visual de 3D/UI precisa do CD num browser de verdade. `.claude/launch.json` tem
  `server-verify` (2604) / `client-verify` (5299) prontos, com override `?port=NNNN` no cliente.
  **Novo (T-048):** por essa mesma razão, tela cheia real (exige gesto de clique) e o diálogo
  nativo do `beforeunload` (fechar/recarregar aba) também não são verificáveis no ambiente
  automatizado — pendem de confirmação do CD num browser de verdade.
- **Cuidado com `cd` + comandos em sequência no Bash tool:** um `cd` feito num comando anterior pode
  deixar o cwd em um workspace errado e fazer `npm run <script-da-raiz>` resolver o script errado.
  Preferir `npm --prefix <caminho-absoluto>` quando o cwd não for garantido.
- Branches de resgate do incidente S19: `funcional-0705` (= `7c9e28e`) e `trabalho-agente-interrompido`
  (= `185eb53`) — podem ser apagadas quando o CD quiser.
- **Regra (incidente S19): commitar ao fim de cada frente verde.**

## Onde paramos

**F3 (SPEC-0007) fechada** desde a sessão 20. **F4 (SPEC-0008)** entregou T-026/T-027 (sessões
22/24) e está em T-028 (auth Google + registro). **Sessão 25 (esta)** foi uma interrupção
direta do CD, fora da fila V1, antes de retomar T-028:

- **T-048 — Imersão de navegador (SPEC-0012):** botão ⛶ de tela cheia no `#profile-selector`
  (Fullscreen API); `contextmenu`/clique-do-meio/`Ctrl+scroll`/`gesturestart`/`dragstart`
  suprimidos globalmente (não são mais atributo de perfil de controle — sempre ativos);
  `touch-action`/`overscroll-behavior`/`user-select` globais (antes só `body.touch-profile`
  tinha `touch-action`), com exceção de seleção de texto no overlay de debug (F3); `beforeunload`
  liga com sala conectada (`room.onLeave`/`onError` desliga) — confirmação nativa antes de
  fechar/recarregar no meio de uma partida. Tudo em `packages/client/src/immersion.ts` (novo),
  client-only, zero mudança de contrato de rede.
- **Gates:** shared 30/30 · server 70/70 · bots 35/35 · tsc limpo ×3 (inalterados — mudança é
  100% client). Verificado em browser real via preview (`server-verify`+`client-verify`):
  conexão ponta a ponta ok, `contextmenu`/`wheel(ctrl)`/`dragstart` confirmam `defaultPrevented`,
  estilos globais confirmados via computed style. Tela cheia de fato e o diálogo do
  `beforeunload` exigem gesto real de usuário — pendem de confirmação do CD.

**Fora da fila V1 (paralelo):** `packages/aci` — infraestrutura de contexto para agentes
(PROPOSAL-0003, ADR-018), F0-F3 prontos. Próximo: F4 (contexto por feature) e F5 (servidor MCP) —
ver `docs/proposals/PROPOSAL-0003-aci-infra-contexto-ia.md` §6.

## Próximo passo

**F4 — Plataforma (SPEC-0008), continuação:**
1. **T-028** 〔G〕 — Auth: provider Google (OAuth) + páginas de registro email/senha + janela de
   login no client + verificação do JWT no join do Colyseus. A fundação (emissão/validação JWT,
   guest, JWKS, link) já está pronta da T-027 — T-028 é consumo/UI, não infraestrutura nova.
   · depende: T-027 ✅.
2. **T-029** 〔P〕 — ADR-012 liga na conta (estatística, nunca poder in-round) · depende: T-028.

## Pendências reais do lado do CD (não bloqueiam a esteira)

| Item | Notas |
|---|---|
| Confirmar tela cheia + `beforeunload` (T-048) num browser de verdade | ambiente automatizado não exercita gesto real de clique nem o diálogo nativo |
| Sensação dos cards sorteados (12 no pool) | aprovado sem ter jogado (sessão 21); reabrir se destoar jogando |
| Visual da bandeira (livre/carregada/cooldown) | aprovado sem ter jogado (sessão 21); F3 mostra o estado em texto |
| Sensação da SPEC-0011 (aura, arsenal, bandeira, combo) | dials na F2.6 do BACKLOG |
| Vereditos anteriores acumulados (S13/S14/S15, F2.5, T-036) | ver DEVLOG |
| SPEC-0007 critério de aceite #2 (editar JSON à mão) | já coberto pelo loader+validação da T-024; admin do `MapEntry` (T-027d) também edita |

## Comandos úteis agora

```bash
npm run test -w @aop/shared && (cd packages/server && npx vitest run) && (cd packages/bots && npx vitest run)  # 30 + 70 + 35
for p in server client bots; do (cd packages/$p && npx tsc --noEmit) && echo "$p ok"; done
npm run analyze -- --list              # partidas com telemetria disponível
npm run analyze                        # relatório da partida mais recente
npm run map -- list                    # mapas curados salvos
npm run aci -- doctor                  # ACI: diagnóstico do ambiente (PROPOSAL-0003)
npm run aci -- search <query>          # ACI: acha símbolo/spec/ADR sem abrir arquivo inteiro
npm run aci:test                       # ACI: suíte de testes (39/39)

# Backend Django (T-027)
cd backend && ./dev.sh                              # sobe tudo (venv/deps/.env/chaves na 1ª vez)
python -m pytest                                     # 71 testes, contra Postgres real
python manage.py makemigrations --check --dry-run
ruff check .
```

## Leituras se a sessão nova for só conversa

- Esta sessão → `docs/DEVLOG.md` (Sessão 25) e `docs/prompts/PROMPT-0043.md`
- Sessão anterior → `docs/DEVLOG.md` (Sessão 24 — backend Django, ADR-019)
- Escopo por task + dials da SPEC-0011 → `docs/BACKLOG.md` seção F2.6
