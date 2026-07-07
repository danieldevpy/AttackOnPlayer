# PROMPT-0055 — T-061 (SPEC-0008, Frente B): Auditoria + fechamento do admin · 2026-07-06

## Pedido (resumo fiel)

Segunda task da Frente B (T-060 ✅ → **T-061** → T-029, em série). **Task:** passar o pente em
`GameEvent`/`RoomConfig`/contas/nicks — o que falta pra operar eventos, salas, moderação de nick
e métricas 100% pelo admin, sem deploy; endpoint de settings do player (usado pela T-058).
**Contexto:** `backend/` · `packages/server/src/platform/platformClient.ts`. **Aceite:**
checklist da SPEC-0008 todo verde; criar evento novo pelo admin muda sala ao vivo. Depende de
T-060 ✅.

## Decisões tomadas (e por quem)

- **IA — auditoria (o que já estava OK vs. o que faltava):** `RoomConfigAdmin`/`GameEventAdmin`
  já eram CRUD completos (T-027e) — "operar eventos/salas pelo admin sem deploy" já funcionava
  na ESCRITA. O gap real era a LEITURA: `platformClient.getConfig()` só era chamado no
  `ArenaRoom.onCreate` (T-027g) — um evento criado no admin só valia pra próxima sala, nunca pra
  uma já em andamento. Isso é o que a task pede pra fechar ("muda sala ao vivo").
- **IA — config ao vivo:** `ArenaRoom.updateInner` (`packages/server/src/rooms/ArenaRoom.ts`)
  ganhou uma checagem periódica (`PLATFORM_SYNC_INTERVAL_MS=5s`, novo `nextPlatformSyncAt`) que
  rechama `platformClient.getConfig(now)` e aplica `xpMultiplier`/`coinMultiplier`/
  `state.flagEnabled` na sala corrente. **Não** mexi em `mapRotation`/`expectedPlayers` — esses só
  fazem sentido na criação do mapa (mudar o tamanho/rotação de uma sala com jogadores dentro não
  tem efeito seguro nem sentido de produto). `getConfig()` já tem TTL de 30s próprio (T-027g) —
  a checagem de 5s só decide a CADÊNCIA da pergunta; na prática, a maior parte das chamadas
  retorna o cache em memória sem rede. Fire-and-forget (`void ... .then(...)`) porque
  `updateInner` não é `async` (chamado por tick síncrono) — nunca bloqueia o tick, e o
  `platformClient` já nunca lança (degrada sozinho).
- **IA — moderação de nick:** hoje NÃO existia moderação nenhuma além de truncar por
  `max_length` — um nick com HTML/controle/emoji passava direto. Novo `sanitize_display_name()`
  (`accounts/services.py`) com whitelist de charset (`\w`, espaço, hífen, ponto; 1–32 chars);
  fora disso cai pro `fallback` **inteiro** (não tenta limpar caractere a caractere) — mesmo
  aceite já previsto pra T-058 ("nick malicioso vira fallback"). Aplicado em `register()`
  (fallback = prefixo do email) e no `PUT /accounts/settings` (fallback = nick atual — nunca
  apaga um nick bom por causa de uma tentativa ruim). Admin ganhou a ação `reset_nick`
  ("Moderação: resetar nick para o padrão") em `AccountAdmin` — staff modera um nick abusivo já
  existente sem deploy, mesmo fallback da sanitização.
- **IA — endpoint de settings do player:** `PlayerSettings` novo (`account` 1:1, `control_profile`
  enum mouse/keyboard/touch, `volume_master`/`volume_sfx` 0..1, `fullscreen_pref` bool) — os
  4 campos são exatamente os que a PROPOSAL-0004 §5 já promete pro lobby (perfil de controle
  ADR-015, volumes T-051, fullscreen T-048), não um blob JSON genérico inventado — reduz o risco
  de "adivinhar errado" o contrato que a T-058 vai consumir depois. `GET/PUT
  /api/v1/accounts/settings` (JWT, `PUT` parcial). Migração `0003_playersettings` nova.
- **IA — SPEC-0008, aceite/fora-de-escopo:** "ranking público" saiu do "fora de escopo" (T-060
  já entregou `/ranking` — a PROPOSAL-0004 §6, já aprovada pelo CD, é uma extensão explícita da
  SPEC-0008, então marcar esse bullet como obsoleto é só destravar a doc pra realidade aprovada,
  não uma decisão nova). Checklist: 4 de 5 bullets fecham de verdade; o de auth fica
  PARCIALMENTE marcado — não dá pra fechar 100% honestamente porque exige "login com Google",
  e Google OAuth está formalmente adiado (ADR-020, `T-028-google`, decisão do CD) — deixei a
  ressalva explícita no próprio arquivo em vez de forçar um `[x]` que não é verdade.
- **Fora de escopo (não tocado):** `mapRotation`/`expectedPlayers` ao vivo (ver acima); qualquer
  UI de client pra consumir `/accounts/settings` (isso é T-058, Frente L, fora da Frente B).

## Resultado verificado

- **Backend:** `accounts/models.py` (`PlayerSettings` + migração `0003`), `accounts/services.py`
  (`sanitize_display_name`), `accounts/serializers.py` (`PlayerSettingsSerializer`),
  `accounts/views.py` (`player_settings`, sanitização em `register`), `accounts/admin.py`
  (`PlayerSettingsInline`, ação `reset_nick`), `config/urls.py`
  (`GET/PUT /api/v1/accounts/settings`).
- **Server (Node):** `ArenaRoom.ts` (`PLATFORM_SYNC_INTERVAL_MS`, `nextPlatformSyncAt`, checagem
  em `updateInner`) — única mudança de comportamento fora do Django nesta task.
- **pytest:** 105/105 (88 anteriores + 17 novos: `test_services_nick.py` 9 casos de
  `sanitize_display_name`, +1 em `test_register_login.py` — nick malicioso no registro cai pro
  prefixo do email —, +5 em `test_views.py` — `player_settings` GET/PUT/validação/nick — e
  `test_admin.py` novo, 2 casos da ação `reset_nick`). `makemigrations --check --dry-run` limpo
  (migração `0003` já gerada e commitada) · `ruff check .` limpo.
- **vitest server:** 83/83 (80 anteriores + 3 novos: `platformSync.test.ts` — aplica config na
  sala já aberta quando o cache expira, não reconsulta antes do intervalo, fica inerte com
  `PLATFORM_ENABLED` off). `tsc --noEmit` limpo em server/client/bots.
- **Verificação viva (fora do pytest):** com o Django real de pé (mesma sessão da T-060), rodei
  `python manage.py shell` criando um `GameEvent` ativo (`xp_multiplier=5.0`) e confirmei
  `gameops.models.effective_config()` refletir a mudança na hora, sem reiniciar nada — prova o
  lado Django do "sem deploy". Não encadeei isso com uma sala Colyseus já aberta há minutos
  (a sala de smoke da T-060 já tinha sido descartada por inatividade entre os testes) — o lado
  Node dessa mesma garantia fica coberto pelos 3 testes novos de `platformSync.test.ts`, que
  simulam exatamente esse cenário com `platformClient.getConfig` mockado.
- `npm run aci -- index` rodado ao final.

## Regras que nascem daqui

- Quando uma "config que só valia na criação" precisa passar a valer ao vivo, o padrão de menor
  risco é: manter o `getConfig()`/cache/TTL como está (já testado, já degrada sozinho) e só
  ADICIONAR uma checagem periódica barata no tick que aplica o resultado — não reescrever o
  cliente de plataforma nem inventar um mecanismo de push/webhook novo.
- "Nick malicioso vira fallback" (não sanitização caractere a caractere) é o padrão adotado aqui
  E já esperado pela T-058 — task futura que mexer em nick deve seguir a mesma regra
  (`sanitize_display_name`), não reinventar.
- Quando uma task de spec mais nova (aqui, T-060 via PROPOSAL-0004) contradiz um "fora de
  escopo" de uma spec aprovada mais antiga (aqui, SPEC-0008 dizia "ranking público" fora), e a
  spec nova já foi aprovada pelo CD, é seguro atualizar o texto da spec antiga pra remover a
  contradição — não é uma decisão de escopo nova, é destravar a documentação pra bater com o que
  já foi aprovado.
