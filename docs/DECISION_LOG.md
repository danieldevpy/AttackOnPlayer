# Decision Log (ADRs)

Formato: contexto → decisão → consequência. Decisões são reversíveis via novo ADR.

## ADR-017 — ACI: infraestrutura de contexto para agentes (packages/aci)
**Data:** 2026-07-05 · **Status:** Aprovado (CD) — PROPOSAL-0003
Agentes gastavam tokens relendo AGENTS.md/DOC_MAP + abrindo arquivos inteiros para achar símbolos, decisões e specs; o roteamento "papel→arquivos" era manual e envelhecia. Decisão: criar um **módulo isolado** `packages/aci` que indexa código (tree-sitter), documentação/corpus (specs, ADRs, prompts, roadmap, backlog) e um grafo de relações doc↔código↔spec↔ADR, expondo busca e "contexto por feature" via **MCP** (padrão universal — serve Claude, Codex, Gemini, Cursor). **Sem embeddings/banco vetorial na V1** (corpus pequeno; janelas grandes tornam RAG vetorial custo>benefício) — núcleo estrutural + lexical + resumos com *progressive disclosure*; embeddings ficam como plugin da Fase 5+. Estende a ADR-004 (processo leve in-repo), não a contradiz.
**Consequência:** nenhum outro pacote importa `@aop/aci` — o jogo roda idêntico com ou sem ele (remoção trivial). Construído em branch dedicada `aci`, intercalado com a V1, sem tocar gameplay/rede. Índice com cache incremental por hash/mtime. Fica fora dos gates do jogo (gate próprio). Métricas próprias validam a economia estimada (~70–80% na orientação, ~90% ao localizar símbolo).

## ADR-014 — Presença viva, morte dura, invuln temporal, facing por movimento (SPEC-0005)
**Data:** 2026-07-04 · **Status:** Aprovado (CD) — pós-teste com bots, spec SPEC-0005
Seis ajustes de ritmo/controle pedidos pelo CD após jogar com bots: (1) **XP passivo** — todo player vivo ganha +1 XP/s (`XP_PER_SECOND`), o mapa nunca "esfria"; (2) **morte zera o nível** (volta a 1) — aposenta a perda parcial `lossFraction` do loop, risco real máximo; (3) **reroll (R) também dá XP** (+20, `REROLL_XP_REWARD`) — a tecla vira progressão ativa; (4) **zonas safe removidas** do mapa (cantos intocáveis travavam o combate) — o primitivo `zone.kind === "safe"` fica só nos testes; (5) **invulnerabilidade de nascimento** de 3s por player (`SPAWN_PROTECTION_MS`) substitui a safe zone, e **cai ao atirar** (anti "torre invulnerável"); (6) **facing pelo movimento** — a direção/visão do player deriva do movimento (WASD), calculada no servidor a partir de `inputX/inputZ`; o mouse **não** controla o facing (correção 2026-07-05: a primeira versão pôs sob o mouse; o CD pediu o oposto — mais eficiente, sem raycast por tick nem `aim` na rede; `aimX/aimZ` fica só para os bots).
**Consequência:** balance de pacing vira hipótese a re-medir com bots (XP passivo + morte-zera se equilibram); nenhum sistema de arquitetura novo — tudo entra em `grantXp`/`ProjectileSystem`/`buildZones`/input do cliente já existentes; `lossFraction` permanece exportada (testes/curva de balance, reintrodução por room possível).

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

## ADR-015 — Perfis de controle: rotação/mira resolvida por perfil, intenção única no protocolo
**Data:** 2026-07-05 · **Status:** Aprovado (CD, PROPOSAL-0002 §9-A1) — revisa ADR-014.6
O jogo é estilo Valorant em 3D leve top-down; jogabilidade divertida/pouco frustrante é o critério nº 1, e cada dispositivo pede um controle: `mouse` (WASD strafe + crosshair 360°), `keyboard` (notebook sem mouse: rotação de mira por teclas, fallback facing-por-movimento) e `touch` (twin-stick virtual). Todo perfil produz a MESMA intenção `{move, aim, fire}` — o protocolo da SPEC-0003 já é esse contrato e o servidor (facing híbrido, autoridade) não muda. Bots são "um perfil a mais" (mesma intenção). Auto-detecção + seletor manual.
**Consequência:** o vaivém das ADRs sobre mira (SPEC-0003 híbrido → ADR-014.6 movimento → isto) termina: mira não é uma regra global, é um atributo do PERFIL. Gatilho novo/dispositivo novo = perfil novo no cliente, zero mudança de servidor.

## ADR-016 — Fronteira de plataforma: tempo real no Node/Colyseus, plataforma no Django
**Data:** 2026-07-05 · **Status:** Aprovado (CD, PROPOSAL-0002)
Gameplay em tempo real (tick 20Hz, autoridade, salas) permanece 100% no Node/Colyseus. O Django (+DRF+admin+Postgres) é a PLATAFORMA: contas/auth (anônimo→Google→manual), perfis/estatísticas, registry de mapas e objetos salvos no sistema, gameops (config de rooms/eventos criados pelo admin sem deploy) e ingestão de telemetria. Comunicação por REST com service token; o game server CACHEIA config e degrada graciosamente (Django caído ≠ jogo caído).
**Consequência:** Node nunca acessa o Postgres direto; Django nunca decide gameplay em tempo real; conta NUNCA concede poder in-round (guardrail da constituição, reafirmado). Novo stack no repo (`backend/`) com CI/gates próprios.
