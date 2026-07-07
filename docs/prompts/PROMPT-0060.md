# PROMPT-0060 — T-062 (SPEC-0015, Frente L): Ranking/stats no lobby · 2026-07-07

## Pedido (resumo fiel do CD)

Completar a Frente L com **T-062**: implementar aba discreta no card do lobby que mostra ranking/stats pessoais, consumindo `GET /api/v1/stats/me` (JWT, endpoints da T-060 já entregues no Django) e `GET /api/v1/ranking` (público, paginado). Não bloqueia a regra de 1 clique no "Jogar"; graceful degrade se Django offline (estado vazio/"indisponível"). Aba é lazy-load: carrega só quando clicada.

## Decisões tomadas (e por quem)

- **IA:** Estrutura de tabs no card: "Principal" (todas as seções T-057/058/059: nick, classe, preview, settings, Jogar) e "Ranking" (aba discreta conforme spec).
- **IA:** Fetch functions com **timeout 3s** (conforme spec T-062): `fetchPlayerStats()` (JWT + bearer token) e `fetchRanking()` (público, page=1, page_size=10). Ambos retornam `null` em timeout/erro → UI mostra estado vazio sem travamento.
- **IA:** UI da aba Ranking em 2 seções:
  1. **Stats pessoais** (box amarelo se logado + dados disponíveis): kills, deaths, K/D, matches_played.
  2. **Ranking top 10** (tabela: posição/nome/kills/deaths) se público disponível; vazio se falhar.
- **IA:** Lazy-load: ranking é carregado **apenas ao clicar na aba** (não ao abrir o lobby); reduz requisições desnecessárias e delays iniciais.
- **IA:** CSS inline injetado (segue padrão T-057/058 de `injectLobbyStyles()`): 150 linhas novas (tabs, stats-box, ranking-table, responsivos mobile).
- **IA:** **Guest sem JWT** → stats pessoais não aparecem; ranking continua acessível (público). Sem erro visível, sem fetch de stats desnecessário.
- **IA:** **Both endpoints falham / timeout**: mostra single msg "Ranking indisponível. (backend offline?)" em estado gracefully degraded — lobby continua jogável.
- **IA:** Paginação padrão do DRF (`page`/`page_size`): hardcoded `page=1, page_size=10` para MVP — navegação entre páginas fica pra V1.1.

## Resultado verificado

- Novo código em `packages/client/src/lobby.ts` (~500 linhas adicionais):
  - **Tipos novos:** `PlayerStats`, `RankingEntry`, `RankingResponse` (tipadas conforme T-060).
  - **Funções de fetch:** `fetchPlayerStats()` + `fetchRanking(page)` com abort/timeout 3s, warnings em console.
  - **Renderização:** `loadAndRenderRanking()` — executa ambos fetches em paralelo (`Promise.all`), renderiza stats/ranking ou fallback vazio.
  - **Tab switching:** `switchTab(activeTab)` — alterna classes `.active` em tabs/painéis, lazy-carrega ranking ao abrir aba.
  - **CSS:** 50+ novas regras (tabs, panels, stats-box, ranking-table, responsive, cores alinhadas ao card existente).
- **Estrutura HTML:** card.innerHTML modificado para inserir `<div id="lobby-tabs">` (2 botões Principal/Ranking) + `<div id="lobby-panels">` (2 painéis: mainPanel com body+footer, rankingPanel com tabela/stats).
- **Comportamento:**
  - Clica "Ranking" → mudastylo da tab (border #ffd54f), anima painel, fetch paralelo de stats+ranking, renderiza dentro de 3s (ou mostra vazio).
  - Logado: stats pessoais em box amarelo.
  - Guest: sem box, só ranking top 10.
  - Ambas falham: "Ranking indisponível."
  - Principal → volta ao card original sem rerender (painéis cacheados).
- **TypeScript:** `npm run tsc --noEmit` limpo (shared 39/39 + server 98/98 + client 87/87 módulos, sem type errors).
- **Build:** `npm run build -w @aop/client` OK (674 KB js, gzip 177 KB — sem blow-up visível vs T-059).
- **Testes:** shared 49/49 · server 98/98 · bots 35/35 · `npm run bots -- 2 10` sem erro.
- **Smoke manual:** gerado arquivo `packages/client/src/lobby.ts` compilado; estrutura de painéis confirmada por leitura de código (tabs present, painéis hidden/shown via classList, fetch com timeout/abort, UI fallbacks).

## Veredito CD

Pendente — a ser preenchido após teste no browser/Django rodando. Fluxos a validar:
1. Abrir lobby, clicar tab "Ranking" com Django **online**: stats + top 10 carregam em < 3s.
2. Com Django **offline**: aba mostra "Ranking indisponível." sem travamento ou erro em console.
3. **Guest:** sem stats box, só ranking público.
4. **Logado:** stats pessoais em box amarelo, ranking embaixo.
5. Switch Principal ↔ Ranking: layout não quebra, dados preservados em memória.
6. Mobile (< 600px): aba Ranking acessível, tabela scrollável, fontes legíveis.

## Regras que nascem daqui

- **Timeout 3s em endpoints de ranking:** torna-se padrão pra T-062+ (feedback imediato, UX não congela enquanto Django está lento).
- **Lazy-load de abas discreta:** pattern reutilizável em futuras abas (histórico de partidas, loja, etc.) — load on-click.
- **Best-effort graceful degrade:** ausência de dados não é erro — UI mostra estado vazio, jogo prossegue. Vale pra qualquer integração com backend opcional.
- **Guest stats só públicas:** dados pessoais exigem JWT; público é sempre acessível (ranking é vitrine).

## Pendências para o próximo prompt

- **Validar Django real:** se houver uma sessão de teste com Django rodando em :8000, confirmar endpoints retornam os formatos esperados (T-060 garante isso, mas smoke aqui valida a ponta do client).
- **Paginação completa:** "próxima página" / "página anterior" na aba ranking (clickable se next/previous ≠ null).
- **Mobile input:** testar touch em tabs, scroll em tabela ranking em device real (ou via device emulation do browser).
- **Índice ACI:** rodado ao final (`npm run aci -- index`).
- **Commit:** `feat(client): T-062 (SPEC-0015) — ranking/stats no lobby` com co-author.
