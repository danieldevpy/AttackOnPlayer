# Sessão atual — ponteiro de continuidade

> **Substituir este arquivo inteiro** ao fim de cada sessão de trabalho.
> Não é histórico — histórico fica em `DEVLOG.md` e `docs/prompts/`.

**Atualizado em:** 2026-07-06
**Branch:** `evolução`. **Marco:** V1.
**Sessão 27 (design):** PROPOSAL-0004 aprovada (som procedural + classe `archer` low poly +
lobby pré-sala + fechamento backend/admin + console staff opcional) — tasks **T-049..T-063**
e T-D13/D14/D15 no BACKLOG; alocação de modelo por task em `instrucoes/GUIA_MODELOS_CLAUDE.md`.
Ver `docs/DEVLOG.md` (Sessão 27) e `docs/prompts/PROMPT-0044.md`.
**Sessão 28 (agente worker, Frente S): T-049 — AudioSystem + registry procedural** entregue
(`packages/client/src/audio.ts` novo, espelha `vfx.ts`). Ver `docs/DEVLOG.md` (Sessão 28) e
`docs/prompts/PROMPT-0045.md`.
**Sessão 29 (agente worker, Frente S): T-050+T-051 — mapeamento evento→som completo (27 sons)
+ áudio posicional/ducking/volumes persistidos.** **Frente S (Som, SPEC-0013) fechada** (T-049/
T-050/T-051 ✅). Ver `docs/DEVLOG.md` (Sessão 29) e `docs/prompts/PROMPT-0046.md`.
**Sessão 30 (agente worker, Frente C): T-052 — Registry de classes (contrato)** entregue:
`packages/shared/src/classes.ts` (`ClassDef`/`CLASS_REGISTRY` só `archer`/
`resolveClassSelection`), `Player.classId`/`skinId` no schema, join valida (inválido/ausente ⇒
default, nunca rejeita). 12 testes novos, shared 38/38 · server 80/80 · tsc ×3 limpo. Ver
`docs/DEVLOG.md` (Sessão 30) e `docs/prompts/PROMPT-0047.md`.
**Sessão 31 (agente worker, Frente C): T-053 — Arqueiro low poly procedural (F2)** entregue:
`packages/client/src/characters.ts` novo (`createCharacterVisual` — 8 partes nomeadas,
`flatShading`, geometrias singleton + materiais em cache por classe/skin), `visuals.ts`
`VISUAL_PHASE` 1→2 e `createPlayerVisual` bifurca F1/F2. tsc client+server limpo · vite build OK
· shared 38/38 · bots 9×120 sem regressão. Draw calls (análise): 9/player, ~90 com 10 players
(<200). Screenshot/F3 pro CD **pendente** — preview roda oculto (rAF pausado, ver avisos). Ver
`docs/DEVLOG.md` (Sessão 31) e `docs/prompts/PROMPT-0048.md`.
**Sessão 32 (agente worker, Frente C): T-054 — Animações procedurais** entregue: update central
por frame em `characters.ts` (`updateCharacterAnimation`/`triggerCharacterShoot`, sem clock
novo, sem alocação) — idle (respiração), walk (contra-fase por velocidade derivada do
deslocamento renderizado), shoot (puxar arco no spawn de projétil), spawn/death integra com o
scale-in da T-045 (morte = respawn imediato no servidor). tsc client+server limpo · vite build OK
· shared 38/38 · bots 4×12 sem regressão · **teste headless da animação 11/11**. Screenshot dos
4 estados pro CD **pendente** (preview oculto). Ver `docs/DEVLOG.md` (Sessão 32) e
`docs/prompts/PROMPT-0049.md`. Outras frentes (T-055 flechas, T-056 skins, T-060 Backend) podem
estar em andamento em paralelo por outros agentes — conferir BACKLOG antes de assumir status.

---

## ⚠️ Avisos operacionais

- **Backend em `backend/`** (T-027/T-028, Django+DRF+Postgres, pip+venv) — NÃO é workspace npm;
  roda isolado. `cd backend && ./dev.sh` sobe tudo (venv/deps/`.env`/chaves JWT na primeira vez;
  Postgres+migrate+runserver sempre). Container Postgres (`backend-db-1`, porta 5432) sobe via
  `docker compose -f backend/docker-compose.yml up -d db` — para derrubar, `... down`.
- **`backend/.env` ganhou `CORS_ALLOWED_ORIGINS` com 2 origens** (5173 dev padrão + 5299
  client-verify) — se o Django já estava no ar de uma sessão anterior, precisa reiniciar
  (`pkill -f "manage.py runserver"` + `./dev.sh` de novo) pra pegar o valor novo, porque o
  autoreloader do Django não observa mudanças em `.env`.
- `packages/aci/` (PROPOSAL-0003, ADR-018) segue isolado — nenhum pacote do jogo o importa. `npm run
  aci:test` 39/39. `snapshot-test.sh`/`run.sh` soltos na raiz são resíduo não relacionado, ainda
  não investigado (não tocar).
- **Preview headless renderiza WebGL nesta config** (contrário do que uma nota de sessão anterior
  registrou) — `server-verify` (2604) + `client-verify` (5299) mostraram o mundo 3D e o HUD
  normalmente durante a verificação da T-028c. Se voltar a falhar, investigar de novo antes de
  assumir que é preciso um browser real. Tela cheia de fato e o diálogo nativo do `beforeunload`
  (T-048) continuam exigindo gesto real de usuário — esses dois ainda pendem de confirmação do CD.
  - **Ressalva (Sessão 31, T-053):** na sessão de preview usada para verificar o T-053 a janela
    veio **oculta** (`document.hidden === true`, `visibilityState === "hidden"`), com o
    `requestAnimationFrame` **pausado** (0 frames em 800 ms) — o WebGL não pinta, então
    `preview_screenshot` dá timeout e `renderer.info` (draw calls) fica congelado no 1º frame.
    Ou seja: **depende do estado da janela do preview**. Para captura visual / medição de draw
    calls confiável, garantir a janela visível/focada ou rodar `dev:client` num browser real.
- **`location.reload()`/atribuir a mesma URL a `location.href` via `preview_eval` não recarregam
  a página** neste ambiente — o JS antigo continua rodando (mesma sessão Colyseus, mesmo estado).
  Pra testar fluxo de "carga inicial" de verdade, ou usar um browser fora do preview, ou validar
  a lógica via curl direto no backend (foi o que foi feito pra cadeia guest→registro→link da T-028).
- **Cuidado com `cd` + comandos em sequência no Bash tool:** um `cd` feito num comando anterior pode
  deixar o cwd em um workspace errado e fazer `npm run <script-da-raiz>` resolver o script errado.
  Preferir `npm --prefix <caminho-absoluto>` quando o cwd não for garantido.
- **Regra (incidente S19): commitar ao fim de cada frente verde.**

## Onde paramos

**F3 (SPEC-0007) fechada** desde a sessão 20. **F4 (SPEC-0008)** entregou T-026/T-027 (sessões
22/24) e agora **T-028 — Auth email+senha** (sessão 26, 3 sub-tasks incrementais, cada uma com
gate verde e commit próprio):
- **T-028a (Django):** `POST /auth/register` + `/auth/login`, reaproveitando
  `Account.objects.create_user`/`jwt.sign_account` da T-027c. Email único + senha forte
  (validators já configurados); login rejeita conta guest e senha errada. 9 testes novos.
- **T-028b (Colyseus):** `packages/server/src/platform/authVerifier.ts` (lib `jose`,
  `createRemoteJWKSet` contra o JWKS do Django, cache interno — sem round-trip por join).
  `ArenaRoom.onJoin` virou `async`, aceita `authToken` opcional atrás de `PLATFORM_ENABLED`
  (mesma flag da T-027g); token válido seta `Player.accountId` (não sincronizado) + nome da
  conta; inválido/expirado cai pra guest sem rejeitar o join. 6 testes novos. Verificado com
  token real emitido pelo Django rodando de verdade.
- **T-028c (client):** `packages/client/src/auth.ts` — pill discreta no canto (nunca modal,
  guest é o default de 1 clique), painel Entrar/Registrar, guest local registrado no Django
  em best-effort (`ensureGuestRegistered`), login/registro chamam `/auth/link` pra herdar
  stats, guarda o JWT (`aop_jwt`) pro próximo join. Verificado no preview (registrar/logout/
  login certo-errado, partida nunca interrompida — HUD subiu de nível 1→6 o tempo todo) +
  cadeia guest→registro→link validada via curl direto no Django.
- **Fora de escopo (ADR-020):** Google OAuth — adiado a pedido do CD, vira `T-028-google` no
  BACKLOG (opcional, fora de fase). `Account.google_sub` já reservado, sem migração pendente.

Sessão anterior (25) foi uma interrupção direta do CD fora da fila V1: **T-048 — Imersão de
navegador (SPEC-0012)** — tela cheia + blindagens contra ações do browser + confirmação de saída
em partida. Ver `docs/DEVLOG.md` (Sessão 25).

**Gates:** shared 30/30 · server 76/76 (+6 de authVerifier) · bots 35/35 · tsc limpo ×3 ·
backend pytest 79/79 (+9 de register/login, Postgres real) · `ruff check` limpo ·
`makemigrations --check` limpo.

**Fora da fila V1 (paralelo):** `packages/aci` — infraestrutura de contexto para agentes
(PROPOSAL-0003, ADR-018), F0-F3 prontos. Próximo: F4 (contexto por feature) e F5 (servidor MCP) —
ver `docs/proposals/PROPOSAL-0003-aci-infra-contexto-ia.md` §6.

## Próximo passo

**PROPOSAL-0004 (Sessão 27) — frentes abertas:**
1. **T-D13/D14/D15** 〔docs〕 — gerar SPEC-0013 (som), SPEC-0014 (personagens) e SPEC-0015
   (lobby) a partir da proposal (modelo barato, ver GUIA_MODELOS_CLAUDE.md). SPEC-0013 ainda
   não existe como arquivo — T-049 seguiu direto pela descrição do BACKLOG.
2. **Frente S (Som) fechada:** T-049 ✅ · T-050 ✅ · T-051 ✅ (Sessões 28/29).
3. **Frente C (Personagens):** T-052 ✅ (Sessão 30 — contrato) · T-053 ✅ (Sessão 31 — visual
   procedural do arqueiro em F2) · T-054 ✅ (Sessão 32 — animação procedural idle/walk/shoot/
   spawn em `characters.ts`). Próximas: **T-055** (projéteis/flecha) · **T-056** (skins por
   paleta) — dependem de T-053 ✅. **T-060** (KDA/ranking) paralelizável. Lobby (T-057+, reusa
   `createCharacterVisual` no preview) só depois de T-053 ✅ e T-061.

**F4 — Plataforma (SPEC-0008), continuação:**
1. **T-029** 〔P〕 — ADR-012 liga na conta: a progressão persistente (acumulador da box, hoje
   scaffold dev-mode) passa a alimentar `PlayerStats` de verdade — só estatística, nunca poder
   in-round. Só agora faz sentido testar o `/auth/link` com dados reais (hoje ele migra um
   scaffold vazio). · depende: T-028 ✅
2. **T-028-google** 〔M〕 — Google OAuth, opcional/fora de fase, quando o CD pedir.

## Pendências reais do lado do CD (não bloqueiam a esteira)

| Item | Notas |
|---|---|
| Confirmar tela cheia + `beforeunload` (T-048) num browser de verdade | ambiente automatizado não exercita gesto real de clique nem o diálogo nativo |
| Sensação dos cards sorteados (12 no pool) | aprovado sem ter jogado (sessão 21); reabrir se destoar jogando |
| Visual da bandeira (livre/carregada/cooldown) | aprovado sem ter jogado (sessão 21); F3 mostra o estado em texto |
| Sensação da SPEC-0011 (aura, arsenal, bandeira, combo) | dials na F2.6 do BACKLOG |
| Vereditos anteriores acumulados (S13/S14/S15, F2.5, T-036) | ver DEVLOG |
| SPEC-0007 critério de aceite #2 (editar JSON à mão) | já coberto pelo loader+validação da T-024; admin do `MapEntry` (T-027d) também edita |
| Quando retomar Google OAuth | plugar no mesmo endpoint de emissão de JWT (T-028a); sem migração nova |

## Comandos úteis agora

```bash
npm run test -w @aop/shared && (cd packages/server && npx vitest run) && (cd packages/bots && npx vitest run)  # 30 + 76 + 35
for p in server client bots; do (cd packages/$p && npx tsc --noEmit) && echo "$p ok"; done
npm run analyze -- --list              # partidas com telemetria disponível
npm run analyze                        # relatório da partida mais recente
npm run map -- list                    # mapas curados salvos
npm run aci -- doctor                  # ACI: diagnóstico do ambiente (PROPOSAL-0003)
npm run aci -- search <query>          # ACI: acha símbolo/spec/ADR sem abrir arquivo inteiro
npm run aci:test                       # ACI: suíte de testes (39/39)

# Backend Django (T-027/T-028)
cd backend && ./dev.sh                              # sobe tudo (venv/deps/.env/chaves na 1ª vez)
python -m pytest                                     # 79 testes, contra Postgres real
python manage.py makemigrations --check --dry-run
ruff check .

# Verificar auth ponta a ponta (Django em :8000)
curl -s -X POST http://localhost:8000/api/v1/auth/register -H "Content-Type: application/json" \
  -d '{"email":"x@aop.dev","password":"SenhaForte123","display_name":"X"}'
```

## Leituras se a sessão nova for só conversa

- Esta sessão → `docs/DEVLOG.md` (Sessão 26) e `docs/DECISION_LOG.md` (ADR-020)
- Sessão anterior (T-048) → `docs/DEVLOG.md` (Sessão 25) e `docs/prompts/PROMPT-0043.md`
- Backend Django (T-027) → `docs/DEVLOG.md` (Sessão 24) e ADR-019
- Escopo por task + dials da SPEC-0011 → `docs/BACKLOG.md` seção F2.6
- Fila V1 → `docs/BACKLOG.md` (T-028 ✅; próxima: T-029 — ADR-012 liga na conta)
- F4 em detalhe → `specs/SPEC-0008-plataforma-django-auth.md`
- Backend → `backend/README.md` (como rodar, chaves JWT, gates)
