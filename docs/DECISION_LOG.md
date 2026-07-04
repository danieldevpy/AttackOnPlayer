# Decision Log (ADRs)

Formato: contexto → decisão → consequência. Decisões são reversíveis via novo ADR.

## ADR-001 — Stack: Three.js + Node/Colyseus + TypeScript (monorepo)
**Data:** 2026-07-04 · **Status:** Aprovado (CD)
Navegador garante multiplataforma sem instalação e permite teste agêntico headless. Colyseus dá salas/sync/matchmaking prontos. Monorepo npm workspaces: `shared`, `server`, `client`, `bots`.
**Consequência:** limite de performance do browser aceito; mitigado por placeholders e orçamento de render.

## ADR-002 — Servidor autoritativo desde M0
**Data:** 2026-07-04 · **Status:** Aprovado (CD)
Cliente envia input; servidor simula a 20 ticks/s e é dono do estado (posição, drop, nível). Evita retrabalho de migração e trapaça.
**Consequência:** cliente usa interpolação; predição completa fica para quando o combate exigir.

## ADR-003 — Debug First como princípio oficial
**Data:** 2026-07-04 · **Status:** Aprovado (CD)
Toda feature nasce com cápsula/cubo/esfera e UI placeholder. Arte só após diversão validada.

## ADR-004 — Spec Kit / Dotcontext substituídos por processo leve in-repo
**Data:** 2026-07-04 · **Status:** Proposto pela IA, aprovado tacitamente — reversível
Em vez de instalar ferramentas externas: `specs/` (especificações curtas com template), `docs/` como memória permanente, ADRs e DEVLOG. Mesmos benefícios, zero dependência, menos tokens por leitura.
**Consequência:** se o projeto crescer, migrar para spec-kit oficial é trivial (as specs já seguem o formato).

## ADR-005 — Aura = oportunidade, não sorte
**Data:** 2026-07-04 · **Status:** Aprovado (CD, via discussão de concepção)
Aura é ganha executando bem mecânicas (esquivas, streaks, precisão) e aumenta a **qualidade potencial** de drops em áreas vazias — não dá poder direto nem multiplica RNG bruto. Anti pay-to-win, anti snowball.

## ADR-006 — Recursos valiosos nascem longe de jogadores
**Data:** 2026-07-04 · **Status:** Aprovado (CD)
O spawner divide o mapa em células, mede densidade de jogadores por célula e gera coletáveis nas vazias. Espalha jogadores naturalmente e cria mapa "vivo". Implementado desde M0 de forma simples (raio mínimo de distância).
