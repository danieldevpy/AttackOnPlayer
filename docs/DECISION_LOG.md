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

## ADR-007 — Mapa dinâmico com mínimo 5× o base
**Data:** 2026-07-04 · **Status:** Aprovado (CD, PROMPT-0002)
Tamanho decidido na criação da sala via `mapSizeFor(players)`: mínimo 75×65 (5× o 15×13), cresce com jogadores esperados. Gerado por seed sincronizado — cliente reconstrói o mapa idêntico localmente (payload mínimo: 3 números). Obstáculos extras só em cruzamentos e nunca adjacentes (preserva conectividade sem pathfinding). Sensação de distância: câmera follow + fog + grid.
**Consequência:** mapa NUNCA redimensiona no meio do round; ajuste por população acontece entre rounds (matchmaking, M3). Coletáveis escalam com a área.

## ADR-008 — Evolução visual em 4 fases com ponto de troca único
**Data:** 2026-07-04 · **Status:** Aprovado (CD, PROMPT-0002)
F1 primitivas → F2 composição → F3 sprites 3D (billboards) → F4 low-poly GLTF. Detalhes em `instrucoes/FASES_VISUAIS.md`. Toda criação de visual passa pelas fábricas de `packages/client/src/visuals.ts`; trocar de fase = editar um arquivo.

## ADR-009 — Skills/atributos via EffectSystem servidor-autoritativo
**Data:** 2026-07-04 · **Status:** Aprovado (CD, PROMPT-0002)
Atributo efetivo = base × efeitos ativos, recalculado no servidor a cada tick. Efeitos têm duração, renovação e teto (speed máx 2×). Lista de efeitos sincronizada só para HUD. Nova skill = novo `EffectKind` — proibido lógica de atributo solta no Room.

## ADR-010 — Pivô: campo aberto com props e zonas (substitui blocos Bomberman)
**Data:** 2026-07-04 · **Status:** Aprovado (CD, PROMPT-0003)
O mapa deixa de ser labirinto de pilares e vira campo aberto com objetos de cenário (props) esparsos: colidíveis (pedra, árvore, muro, caixa) e decorativos. O mapa ganha ZONAS: safe (spawn, sem combate, pouco loot) e guerra (loot raro, box, spawn acelerado). **Mantém-se intacto:** grid de colisão por tile, seed sync (props e zonas derivam do mesmo seed), tamanho dinâmico (ADR-007), spawner longe de jogadores (ADR-006).
**Consequência:** só `buildMap()` e visuais mudam; rede/colisão/bots intocados. Zonas dinâmicas (rotacionar entre rounds) ficam para depois.

## ADR-011 — Lançadores data-driven
**Data:** 2026-07-04 · **Status:** Aprovado (CD, PROMPT-0003)
Toda arma é uma `LauncherDef` (dados em shared): projétil (velocidade, raio, alcance), disparo (cooldown, padrão: straight | spread | lob | homing...), dano e efeitos on-hit (reusa EffectSystem/ADR-009). Atributos do jogador (força etc.) multiplicam os valores base. Servidor simula projéteis (`ProjectileSystem`).
**Consequência:** arma/skill nova = nova entrada no registro + visual em visuals.ts. Proibido hardcode de arma no Room.

## ADR-006 — Recursos valiosos nascem longe de jogadores
**Data:** 2026-07-04 · **Status:** Aprovado (CD)
O spawner divide o mapa em células, mede densidade de jogadores por célula e gera coletáveis nas vazias. Espalha jogadores naturalmente e cria mapa "vivo". Implementado desde M0 de forma simples (raio mínimo de distância).

## ADR-012 — Scaffold de progressão persistente entre rooms (dev-mode only)
**Data:** 2026-07-04 · **Status:** Aprovado (CD, PROMPT-0004) — escopo delimitado pela IA, ver LEAD_DESIGNER_NOTES
CD quer que a box (T-004) contribua para progresso que sobrevive entre partidas, e não só dentro do round — tensiona com a constituição ("progressão por round") e com a recomendação anterior da IA (persistência só cosmética). Decisão do CD prevalece. Implementado como **scaffold**: `playerToken` gerado e persistido no cliente (localStorage), enviado no join; servidor mantém `PersistentProgress` (pontos de atributo acumulados) por token, em memória (sem DB ainda). Visível apenas com `DEV_MODE` ativo (painel no overlay F3, T-007).
**Consequência:** NÃO afeta o poder dentro do round nem o balanceamento entre salas ainda — isso depende do sistema de matchmaking/múltiplas salas do M3. Quando M3 chegar, a peça já existe para ser "ligada" de fato (ex.: influenciar `mapSizeFor`/spawns por nível médio da sala). Até lá é só instrumentação visível em dev.

## ADR-013 — Escala de poder: TTK alvo, atributos assimétricos data-driven e builds por escolha
**Data:** 2026-07-04 · **Status:** Aprovado (CD) — origem PROPOSAL-0001, spec SPEC-0004
Diagnóstico: TTK era matematicamente constante (10 tiros em qualquer nível) porque força e vitalidade escalavam na mesma taxa. Decisões: (1) **TTK alvo explícito** — 5 tiros em níveis iguais, 3–4 com especialização, nunca one-shot; (2) atributos viram **tabela data-driven** (`ATTR_DEFS`: valor/pt e teto próprios por atributo, escala assimétrica dano > HP), com 2 novos — Cadência e Alcance; (3) level-up por **cards de escolha** (3 pontos, determinísticos por nível, timeout 5s → auto-pick, jogo nunca pausa); (4) **multishot/pierce são skills discretas** em marcos de nível (nunca atributo linear) via modificadores em `LauncherDef` (ADR-011); (5) bots usam o mesmo pipeline com política de escolha fixa por perfil (T-008b) — determinística e explorável; player permanece protagonista (reroll, escolha livre, Aura no M2).
**Consequência:** balance vira hipótese testável (relatório de TTK por bots na T-014, re-medição pós-skills); morte continua apagando a build (pilar risco real); tetos por atributo substituem o medo de snowball; nenhum sistema novo de arquitetura — tudo entra em EffectSystem/ProjectileSystem/LauncherDef existentes.
