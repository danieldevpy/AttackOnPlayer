# PROMPT-0056 — T-029 (ADR-012 → conta): progressão persistente vira estatística real · 2026-07-06

## Pedido (resumo fiel)

Terceira e última task da Frente B (T-060 ✅ → T-061 ✅ → **T-029**, fim da série). **Task:** a
progressão persistente (acumulador da box, hoje scaffold dev-mode) passa a alimentar
`PlayerStats` de verdade — só estatística, nunca poder in-round. Depende de T-028 ✅.

## Decisões tomadas (e por quem)

- **IA:** o scaffold ADR-012 (`memDB`/`PersistentProgress` em memória volátil, painel dev F3,
  `packages/server/src/rooms/ArenaRoom.ts`) **não foi removido nem substituído** — continua
  intacto pra visualização em dev. T-029 é **aditiva**: quando a plataforma está ligada
  (`PLATFORM_ENABLED=1`) e o player tem `accountId` (JWT verificado no join, T-028b — "" para
  guest sem token/plataforma off), o MESMO delta do pickup de box (`BOX_ATTR_BONUS_EACH` em cada
  atributo) é reportado pro Django via `platformClient.reportProgress()` novo, além do `memDB`.
  Reduz risco: zero mudança na lógica de gameplay (`addAttrPoints`), só um POST a mais fora do
  caminho crítico.
- **IA — schema:** `PlayerStats` (não um model novo) ganha `forca`/`agilidade`/`vitalidade`
  (`PositiveIntegerField`, default 0) — a própria doc do model já apontava "migração real do
  ADR-012 é a T-029" (comentário desde T-027b), então usar o MESMO model que já é "o acumulador
  de estatística da conta" é a leitura mais direta do texto da task ("alimentar `PlayerStats` de
  verdade"), não um design novo. Exposto em `/stats/me`/`/auth/*` (mesmo serializer) e somado no
  `link()` (guest→conta) igual aos 4 campos que já existiam ali.
- **IA — endpoint novo:** `POST /api/v1/accounts/progress` (service token — mesma fronteira de
  `gameops`/`telemetry`, não JWT de conta, porque quem chama é o Node, não o browser do jogador).
  Delta incremental via `F()` (evita race condition entre pickups concorrentes de players
  diferentes) — filtra por `account_id`; conta/stats inexistente devolve `204` sem erro (nunca
  pode derrubar o pickup no round por causa de um estado de conta inconsistente).
- **IA — Node:** `PlatformClient.reportProgress()` novo — 1 request por pickup (não bufferiza
  como a telemetria de alta frequência) porque box é um drop raro (risco→recompensa, "zona de
  guerra"), então o volume nunca justifica um buffer/flush; fire-and-forget (`void ...then()`),
  nunca lança, nunca bloqueia o tick que fez o pickup — mesmo padrão de degradação graciosa do
  `getConfig()`/`queueTelemetry()` já existentes.
- **Fora de escopo (não tocado):** "ligar" de fato o acumulador em algo que afete matchmaking/
  spawn por nível médio — isso é explicitamente M3 (ADR-012 já registra isso como "fora daqui");
  T-029 só fecha a PERSISTÊNCIA como estatística, guardrail continua "nunca poder in-round".
  `memDB`/painel F3 continuam existindo tal e qual (nenhuma regressão pro dev-mode).

## Resultado verificado

- **Backend:** `PlayerStats.forca/agilidade/vitalidade` (migração `0004`, aplicada e testada
  contra Postgres real via `migrate`, não só a DB de teste do pytest). `PlayerStatsSerializer`
  atualizado (+3 campos — exigiu ajustar 4 testes pré-existentes que comparavam o dict de stats
  por igualdade exata: `test_register_login.py`, `test_views.py` ×3). `link()` soma os 3 campos
  novos (teste atualizado com valores não-zero pra provar a soma, não só padding). `services.py`
  não mudou (T-029 não mexe em agregação de telemetria, isso já fechou na T-060).
  `POST /api/v1/accounts/progress` novo (`ProgressReportSerializer`, `report_progress` view).
- **pytest:** 112/112 (105 anteriores + 7 novos, `accounts/tests/test_progress.py`: incrementa
  stats existentes, acumula em múltiplas chamadas, ignora silenciosamente conta sem
  `PlayerStats`/conta inexistente — 204 —, rejeita delta negativo — 400 —, default 0 pra campos
  ausentes). `makemigrations --check --dry-run` limpo (migração `0004` já commitada) · `ruff
  check .` limpo.
- **Node:** `platformClient.ts` (`reportProgress`), `ArenaRoom.ts` (chamada no pickup de "box",
  ao lado do `memDB` já existente). **vitest server 89/89** (83 anteriores + 6 novos:
  3 em `platformClient.test.ts` — posta `account_id`+delta corretos, trata 204 como sucesso,
  nunca lança em falha de rede — e 3 em `progressPersistence.test.ts` novo — insere um
  `Collectible` real de kind `"box"` na posição do player e roda `room.update()` de verdade
  (mesmo caminho de colisão do jogo, não um mock do pickup): reporta com o delta certo quando
  `accountId` + `PLATFORM_ENABLED` presentes, não reporta sem `accountId` — guest sem JWT —, não
  reporta com a plataforma off). `tsc --noEmit` limpo em server/client/bots.
- **Verificação viva fim a fim (fora do pytest, achado real durante a verificação):** ao testar
  contra o Postgres de DEV real (não o de teste do pytest), `POST /auth/guest` quebrou com
  `ProgrammingError: column "forca" ... does not exist` — as migrações `0003`/`0004` **não
  tinham sido aplicadas** nesse banco (só geradas/testadas contra a DB efêmera do pytest). Rodei
  `python manage.py migrate` (aplicou as duas limpo) e refiz o smoke: criei uma conta guest real
  via `/auth/guest`, chamei `/api/v1/accounts/progress` com um delta de 3/3/3 via `ServiceToken`
  real, e `GET /api/v1/stats/me` (JWT da própria conta) devolveu
  `{"forca":3,"agilidade":3,"vitalidade":3,...}` — pipeline Django ponta a ponta confirmado contra
  banco real, não só a DB de teste.
- `npm run aci -- index` rodado ao final.

## Regras que nascem daqui

- **pytest verde ≠ banco de dev migrado.** O pytest do Django roda contra uma DB efêmera
  (`config.settings.test`) recriada a cada rodada a partir das migrations do repo — então uma
  migração nova sempre "passa" no pytest mesmo que ninguém tenha rodado `migrate` na Postgres
  de desenvolvimento de verdade (a que os smoke tests/backend real usam). Sempre que uma task
  adicionar uma migração e o próximo passo for testar contra o Django "de verdade" (`runserver`
  já no ar, banco de dev), rodar `python manage.py migrate` primeiro — não assumir que gates
  verdes cobrem isso.
- Padrão consolidado nesta frente pra "Node chama Django": telemetria de alto volume usa
  buffer+flush (`queueTelemetry`); eventos raros usam 1 request direto (`reportProgress`,
  `getConfig`) — a escolha é pela FREQUÊNCIA do evento, não por analogia mecânica com o que já
  existe.
- Frente B (T-060 → T-061 → T-029) fechada. Ver `docs/prompts/PROMPT-0054.md` (T-060) e
  `PROMPT-0055.md` (T-061) pro histórico completo da frente.
