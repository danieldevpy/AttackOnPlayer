# Sessão atual — ponteiro de continuidade

> **Substituir este arquivo inteiro** ao fim de cada sessão de trabalho.
> Não é histórico — histórico fica em `DEVLOG.md` e `docs/prompts/`.

**Atualizado em:** 2026-07-06
**Branch:** `evolução`. **Marco:** V1.
**Sessão 24:** T-027 concluída (backend Django completo: accounts/maps/gameops/telemetry + admin +
`platformClient` no Node) — fecha o backend da F4 (SPEC-0008). Ver `docs/DEVLOG.md` (Sessão 24) e
`docs/DECISION_LOG.md` (ADR-019).

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
- **Cuidado com `cd` + comandos em sequência no Bash tool:** um `cd` feito num comando anterior pode
  deixar o cwd em um workspace errado e fazer `npm run <script-da-raiz>` resolver o script errado.
  Preferir `npm --prefix <caminho-absoluto>` quando o cwd não for garantido.
- Branches de resgate do incidente S19: `funcional-0705` (= `7c9e28e`) e `trabalho-agente-interrompido`
  (= `185eb53`) — podem ser apagadas quando o CD quiser.
- **Regra (incidente S19): commitar ao fim de cada frente verde.**

## Onde paramos

**F3 (SPEC-0007) fechada** desde a sessão 20. Sessão 24 (esta) entregou **T-027 — Backend Django**
completo, em 7 sub-tasks incrementais (T-027a..g), cada uma com gate verde e commit próprio:
- **accounts:** `Account` (custom user, PK uuid) + `PlayerStats` + `GuestLink`; JWT RS256 (PyJWT) com
  JWKS público (`/auth/jwks.json`), guest por padrão (`/auth/guest`), perfil (`/auth/me`) e
  `/auth/link` (migra `PlayerStats` do guest pra conta registrada — aceite #5 da SPEC-0008).
- **maps:** registry (`MapEntry`) + `validate_map_file` (espelho Python das regras de bounds/objectId/
  spawns/flag de `mapFile.ts`) + `import_maps` (ingere `maps/*.map.json`) + `GET /maps/`/`GET /maps/<id>/`
  (devolve o `MapFileV1` byte-a-byte idêntico ao arquivo — verificado).
- **gameops:** `RoomConfig` (base) + `GameEvent` (override por janela) + `GET /gameops/config/` —
  verificado manualmente: `GameEvent` "XP ×2" ativo reflete na hora, sem deploy (aceite #2).
- **telemetry:** `POST /telemetry/batch/` valida schema T-026, ingestão tudo-ou-nada.
- **Node (`packages/server/src/platform/platformClient.ts`):** cache+TTL de `gameops/config` +
  batch de telemetria, atrás de `PLATFORM_ENABLED` (default off). `ArenaRoom.onCreate` virou `async`
  e aplica a config quando habilitada. Verificado: Django derrubado no meio → nova room cai no
  cache/defaults sem lançar (aceite #3).

**Gates:** shared 30/30 · server 70/70 · bots 35/35 · tsc limpo ×3 · backend pytest 71/71 (Postgres
real) · `ruff check` limpo · `makemigrations --check` limpo.

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

- Esta sessão → `docs/DEVLOG.md` (Sessão 24) e `docs/DECISION_LOG.md` (ADR-019)
- Sessão anterior → `docs/DEVLOG.md` (Sessão 23 — merge do ACI)
- Escopo por task + dials da SPEC-0011 → `docs/BACKLOG.md` seção F2.6
- Fila V1 → `docs/BACKLOG.md` (T-027 ✅; próxima: T-028 — Auth Google/registro/login)
- F4 em detalhe → `specs/SPEC-0008-plataforma-django-auth.md`
- Backend → `backend/README.md` (como rodar, chaves JWT, gates)
