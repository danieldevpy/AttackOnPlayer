# PROMPT-0054 — T-060 (SPEC-0008, Frente B): KDA + ranking · 2026-07-06

## Pedido (resumo fiel)

CD pediu a **Frente B — Fechamento backend/painel** por completo (T-060 → T-061 → T-029, nessa
ordem, série dentro da frente). Este prompt cobre **T-060**: agregar kills/deaths da telemetria
(T-026/T-027) em `PlayerStats`; endpoints `GET /stats/me` e `GET /ranking` (paginado); admin list
com busca. **Contexto:** `backend/` (apps `telemetry`, `accounts`) · schema NDJSON da T-026.
**Aceite:** pytest de agregação; partida real de bots reflete no ranking.

## Decisões tomadas (e por quem)

- **IA:** agregação acontece **na ingestão** do batch de telemetria (`telemetry/views.py:
  ingest_batch`, dentro da mesma `transaction.atomic()` do `bulk_create`), não num job separado —
  `apply_telemetry_stats(events)` novo em `accounts/services.py`. Reflexo é imediato (mesmo
  batch que grava os eventos já atualiza `PlayerStats`), o que casa com "partida real de bots
  reflete no ranking" sem precisar de scheduler novo.
- **IA:** resolução de token → conta usa o `GuestLink` já existente (T-027c) — `killerToken`/
  `victimToken` (evento `kill`) e `playerToken` (evento `quit`) são o MESMO `player_token` que o
  client usa em `/auth/guest`. Token sem `GuestLink` (bot com token `bot_<sessionId>`, guest que
  nunca chamou `ensureGuestRegistered`) é **ignorado silenciosamente** — o batch continua sendo
  ingerido por completo; nunca falha a request por causa de atribuição de estatística.
- **IA:** `matches_played` incrementa no evento `quit` (T-026), não em `match_end` — `match_end`
  é por ROOM (`playerCount` agregado, sem lista de tokens), enquanto `quit` é por JOGADOR
  (dispara no disconnect) — é o único sinal do schema atual equivalente a "sessão encerrada" por
  player. Não inventei evento novo (fora de escopo — mudaria o protocolo/schema da T-026).
- **IA:** `GET /ranking` é **público** (`AllowAny`, sem JWT) — ranking é vitrine, não dado
  sensível; `GET /stats/me` exige JWT (`IsAuthenticated`), igual ao `me`/`link` já existentes.
  Paginação via `PageNumberPagination` padrão do DRF (`page`/`page_size`, teto 100) — sem
  reinventar paginação custom.
- **IA:** `RankingEntrySerializer` novo (não reusa `PlayerStatsSerializer`) porque a linha do
  ranking precisa do `display_name` da CONTA (join), enquanto `PlayerStatsSerializer` existente
  (usado em `/stats/me`, `/auth/me`, `/auth/guest`, `/auth/link`) não expõe nome — mantém os dois
  contratos de resposta desacoplados (ranking pode evoluir campos sem afetar os outros 4 call
  sites do serializer de stats).
- **IA:** `PlayerStats` ganhou `@admin.register` PRÓPRIO (`PlayerStatsAdmin`, `search_fields`
  por nick/email da conta, `ordering=("-kills",)`) — a inline em `AccountAdmin` (já existente)
  continua para editar no contexto da conta; o registro novo é pra "admin list com busca" citado
  literalmente na task (consulta/operação direta de ranking pelo staff, sem abrir cada conta).
- **Fora de escopo (não tocado):** nenhuma mudança em `packages/server`/protocolo — a task é
  100% backend Django; o pipeline Node→telemetria (T-026/T-027g) já emitia `killerToken`/
  `victimToken`/`playerToken` exatamente como a agregação espera.

## Resultado verificado

- Novo `backend/accounts/services.py` (`apply_telemetry_stats`), `telemetry/views.py` chama no
  `ingest_batch`. Novo `accounts.views.stats_me`/`ranking` + `RankingPagination` +
  `RankingEntrySerializer`. Novas rotas em `config/urls.py`: `GET /api/v1/stats/me`,
  `GET /api/v1/ranking`. `PlayerStatsAdmin` novo em `accounts/admin.py`.
- **pytest de agregação:** `accounts/tests/test_services.py` novo (5 casos: kill incrementa
  killer/victim, múltiplos kills acumulam, quit incrementa matches_played, token desconhecido é
  ignorado sem lançar, outros tipos de evento não tocam stats) + `accounts/tests/test_views.py`
  (+3: `stats/me` exige auth, retorna a própria stats, ranking público ordenado/paginado) +
  `telemetry/tests/test_views.py` (+1: batch com o payload EXATO que o `ArenaRoom` real emite
  atualiza `PlayerStats` e aparece no `/ranking`). **88/88** (79 anteriores + 9 novos) ·
  `makemigrations --check --dry-run` limpo (T-060 não mudou schema) · `ruff check .` limpo.
- **Partida real de bots reflete no ranking (smoke fim a fim, fora do pytest):** Django real
  (`runserver :8000`, Postgres via `docker compose up -d db`) + Colyseus real
  (`PORT=2604 PLATFORM_ENABLED=1 PLATFORM_URL=http://localhost:8000
  SERVICE_TOKEN=dev-service-token-change-me npm run dev -w @aop/server`, porta isolada da sessão
  de dev paralela em `:2567` — nunca derrubada). `npm run start -w @aop/bots -- 6 40`: pipeline
  completo sem NENHUM erro (`gameops/config` buscado no `onCreate`, `telemetry/batch` chegando a
  cada ~5s com 201). Nenhum bot morreu nesses 40s (perfis defensivos + TTK do balance atual —
  não é regressão desta task), então não dava pra provar ATRIBUIÇÃO de kill só com bots headless
  (o framework de bots não aceita um `token` customizado — usa sempre `bot_<sessionId>`, que
  nunca tem `GuestLink`). Para fechar a prova de atribuição com o servidor/Django REAIS (não
  pytest), registrei 2 contas via `POST /auth/guest` (tokens `smoke-tok-A`/`smoke-tok-B`) e
  postei 1 evento `kill` real no formato exato do `KillEvent` (`packages/server/src/telemetry/
  events.ts`) direto no `/api/v1/telemetry/batch/` do Django rodando de verdade: `PlayerStats`
  atualizou e `GET /api/v1/ranking` refletiu (`kills:1`/`deaths:1`) imediatamente.
- `npm run aci -- index` rodado ao final.

## Regras que nascem daqui

- O framework de bots headless (`packages/bots`) não expõe um `token` de join customizável —
  qualquer task futura que precise de bots com conta Django vinculada (ex.: smoke de ranking
  100% via bots, sem chamada manual) precisa adicionar essa opção lá primeiro (fora desta frente).
- Para provar "pipeline X→Y reflete de verdade" quando o gerador de tráfego real (bots) não
  cobre o caso (aqui, atribuição de kill por token de conta), é válido simular o PAYLOAD exato
  que o produtor real emitiria e postar direto no serviço real rodando (não só via pytest) — mais
  forte que só pytest, mais barato que instrumentar o gerador de tráfego pra um caso pontual.
