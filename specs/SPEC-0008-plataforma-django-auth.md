# SPEC-0008 — V1/F4: Telemetria, plataforma Django + admin e autenticação

**Status:** aprovada · **Marco:** V1 (F4) · **Data:** 2026-07-05
**Origem:** PROPOSAL-0002 (§3 P5/P8/P9, §4 arquitetura) · ADR-016

## Problema / objetivo
O jogo não tem identidade de jogador (só token local), nenhum painel de operação, e os logs atuais (sessions.jsonl) não sustentam análise por IA nem diagnóstico rápido. Entregar a plataforma: telemetria estruturada, backend Django com admin (contas, mapas, gameops, telemetria) e login anônimo → Google → manual.

## Comportamento esperado
- **Telemetria (independe do Django):** eventos NDJSON com schema versionado (`matchId/roomId/mapId/playerToken/tick/posições`) cobrindo kills (posições de ambos), upgrades (card escolhido E recusados), posse de bandeira, quits, erros com contexto; rotação de arquivos; `npm run analyze` gera resumo por partida legível por IA (funil, heatmap ASCII de mortes, escolhas por nível); watchdog de tick.
- **Django (ADR-016):** `backend/` com apps `accounts`, `maps` (registry — recebe os JSONs da SPEC-0007), `gameops` (config de room/evento criada no admin sem deploy: `flagEnabled`, multiplicadores, mapa da rotação), `telemetry` (ingestão batch). Colyseus consome config via REST + service token, com cache e degradação (Django caído ≠ jogo caído).
- **Auth:** entrar sem login = guest instantâneo (token atual). Janela discreta no canto (nunca modal em partida): "Entrar com Google" + texto pequeno "registre-se" (email/senha em páginas do Django). JWT no join do Colyseus; guest herda estatísticas ao vincular; nome vem da conta. Logout/troca. Página de privacidade (LGPD mínima) antes do lançamento.
- **Guardrail:** conta = identidade/estatística/mapas — **nunca poder in-round**. Acumulador da box (ADR-012) migra para a conta como estatística.

## Fora de escopo
Skins/cosméticos comprados, matchmaking por nível, e-mail transacional além do necessário para registro. **Ranking público saiu do "fora de escopo" na extensão da Frente B (PROPOSAL-0004 §6, aprovada 2026-07-06) — ver T-060.**

## Critérios de aceite
- [x] 1 partida de bots → `npm run analyze` produz resumo que uma IA usa para responder "onde as mortes se concentram?" e "qual card é mais recusado?". (verificado de novo na T-061, sem regressão)
- [x] Admin cria um evento "XP ×2 fim de semana" e a **room respeita sem deploy — inclusive uma sala já aberta**, não só a próxima (T-061 estende o T-027g original: `ArenaRoom` reconsulta `platformClient.getConfig()` periodicamente, não só no `onCreate`).
- [x] Derrubar o Django com o jogo aberto: partidas seguem; novas rooms usam config cacheada. (`platformClient` degrada pro cache/defaults; sem crash em smoke real da T-060/T-061)
- [ ] Entrar anônimo continua 1 clique; ~~login com Google~~ no meio da sessão não derruba a partida; JWT inválido cai para guest. **Google OAuth segue adiado (ADR-020, `T-028-google`, decisão do CD) — este item só fecha 100% quando essa task entrar; o restante (guest 1 clique, JWT inválido → guest) já está coberto pela T-028.**
- [x] Guest joga, loga, e as estatísticas do guest aparecem na conta. (`link()`, T-027c/T-028)
- [x] Nenhum segredo commitado; envs documentadas. (`.env`/`secrets/` no `.gitignore`; `.env.example` completo)

## Decisão do Creative Director
Aprovada via PROPOSAL-0002 (2026-07-05). Confirmado Django na V1 (§7 Q4).

## Notas da IA
- Ordem interna: T-026 (telemetria local) primeiro — não depende de nada e melhora as fases seguintes; depois T-027 → T-028 → T-029.
- Colyseus valida JWT com a chave pública do Django (sem chamada por join) — join continua rápido offline.
- Stack novo = gates novos no QA.md (pytest + migrations check no `backend/`).

## Quebra em tasks
T-026 (telemetria) · T-027 (Django+admin) · T-028 (auth) · T-029 (ADR-012 → conta) — detalhes no BACKLOG.
