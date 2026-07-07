# Sessão atual — ponteiro de continuidade

> **Substituir este arquivo inteiro** ao fim de cada sessão de trabalho.
> Não é histórico — histórico fica em `DEVLOG.md` e `docs/prompts/`.

**Atualizado em:** 2026-07-07
**Branch:** `main`. **Marco:** V1.

**Sessão 47 (agente worker): PROMPT-0064 — Mobile: HUD compacto + tela cheia paisagem**
Pedido direto do CD (fora de fase, T-064): tela cheia mobile, jogar com o celular deitado,
roster só com a contagem de players (não a lista cheia) e componentes responsivos no mobile
sem afetar a jogabilidade. Tela cheia já existia (T-048); reusei a heurística de dispositivo
touch do perfil de controle (`isCoarsePointerDevice`, ADR-015, `input/manager.ts`, agora
exportada) pra ligar `body.mobile-layout` no boot (`immersion.ts`). Roster (`hud.ts`) troca a
lista completa por `👥 N` quando essa classe está ativa; HUD/roster/auth-widget encolhem via
CSS em `index.html`. Tela cheia num device touch tenta `screen.orientation.lock("landscape")`
(best-effort, silencioso se o navegador recusar/não suportar — iOS Safari e desktop, por
exemplo); `main.ts` ganhou reforço de resize no evento `orientationchange`. Decisão consciente:
**sem** overlay bloqueante de "gire o celular" em retrato — não foi pedido proibir retrato, só
viabilizar paisagem. `tsc` (client+server) limpo, shared 49/49, `vite build` OK. Verificado via
preview headless com estilos computados (HUD 244px→168px, roster→pill 54×30px) — screenshot do
preview travou nesse sandbox (parece limitação do Electron local, não regressão).
**Follow-up mesmo dia** (CD testou num iPhone real, achou 2 problemas): (1) tocar em tela
cheia desligava os analógicos — bug pré-existente do T-048 (`#fullscreen-toggle` sendo pego
pelo seletor de botões de perfil em `main.ts`, disparava troca pra perfil `mouse`); corrigido
restringindo o seletor a `button[data-profile]`. (2) tela cheia não escondia a barra de URL —
**não é bug**, iOS Safari nunca suportou Fullscreen API pra elemento genérico; único jeito real
é instalar via Tela de Início. `immersion.ts` agora detecta isso e orienta por toast em vez de
falhar em silêncio; `index.html` ganhou meta tags `apple-mobile-web-app-*` +
`viewport-fit=cover` (+ safe-area nos analógicos pro notch em paisagem). Corrigido também um
bug de `.catch()` fora de optional chaining (lançava TypeError) em dois lugares. `tsc`/build
limpos; preview confirma o fix do bug (1). **Pendência: bug (2) é limitação de plataforma —
sem "teste que passa" além de confirmar visualmente instalado num iPhone real**; `screen.
orientation.lock` também segue não testado em device físico. Ver `docs/DEVLOG.md`
(Sessão 47) e `docs/prompts/PROMPT-0064.md`.

**Sessão 46 (agente worker): PROMPT-0063 — Deploy simples passa a subir Django + Postgres**
Pedido do CD: `script/deploy-vps-sem-dominio.sh` também inicializar Django e banco, ambiente
de produção já funcionando com o backend. Mudanças: instala Docker (só pro Postgres do
backend, dev/test já usava)/Python3-venv; prepara `backend/.venv` + `requirements.txt`; gera
`backend/.env` de produção na 1ª execução (secrets aleatórios via `openssl`, mantidos nas
reexecuções; `DJANGO_ALLOWED_HOSTS`/`CORS_ALLOWED_ORIGINS` reajustados com o IP público a
cada rodada); gera chaves JWT se faltarem; sobe Postgres via `docker compose` (bind
`127.0.0.1` — fix de segurança, `ufw` não bloqueia porta publicada por Docker; antes ficava
em `0.0.0.0`); aplica `migrate` + `import_maps`; sobe backend via `gunicorn`/pm2
(`aop-backend`); game server sobe com `PLATFORM_ENABLED=1` + `PLATFORM_URL`/`SERVICE_TOKEN`
apontando pro backend local (sem isso o Django subiria mas o jogo continuaria guest-only).
Backend é sempre ligado agora (sem flag de opt-out, pedido explícito do CD) — diferente de
`-b` (bots), que continua opcional. Caveat documentado (não corrigido): `/admin/` do Django
não funciona bem sem TLS (`SESSION_COOKIE_SECURE`/`CSRF_COOKIE_SECURE` em `prod.py` exigem
HTTPS); não afeta jogo↔backend (service token/JWT sem cookie). `bash -n` limpo; **não
testado numa VPS real ainda** — pendência pro próximo prompt. Ver `docs/DEVLOG.md` (Sessão
46) e `docs/prompts/PROMPT-0063.md` (decisões completas + pendências).

**Sessão 45 (agente worker): PROMPT-0062 — Hotfix lobby (NotFoundError insertBefore)**
Regressão T-057×T-062: `card.insertBefore(tabs, body)` lançava NotFoundError porque `body` era neto
de `card` (após T-062), não filho direto. Fix: montagem linear explícita `tabs → panels → footer`
via `appendChild`. Console limpo, tabs funcionando, 182 testes sem regressão.

**Sessão 44 (agente worker): PROMPT-0061 — Arqueiro: "pegada" do arco + animação de disparo**
entregue (fora da numeração do BACKLOG, follow-up direto do CD em cima da PROMPT-0051):
causa raiz achada por simulação headless — o arco (filho do cotovelo esquerdo) herdava a rotação
do braço e ficava quase deitado no disparo full-pull (~72° da vertical). Fix: contra-rotação do
arco por frame, mantendo-o ereto (~5.7° constante) em qualquer pose. Pose de repouso "pronto pra
atirar" (braço já levantado, não mais caído); disparo agora mira o ponto de ancoragem perto da
cabeça/bochecha; corda ganhou tensão real (geometria por instância, exceção barata à regra de
compartilhar tudo); arco ganhou grip + encoches. `tsc --noEmit` limpo (client) · `vite build` OK ·
draw calls inalterados (13/personagem). Ver `docs/DEVLOG.md` (Sessão 44) e
`docs/prompts/PROMPT-0061.md`.

**Sessão 43 (agente worker, Frente L): T-062 (SPEC-0015) — Ranking/stats no lobby** entregue:
aba discreta dentro do card do lobby, acessível via botão "Ranking" nas tabs.
Consumir `GET /api/v1/stats/me` (JWT, com timeout 3s) e `GET /api/v1/ranking` (público, paginado).
Graceful degrade: Django fora → aba mostra estado vazio/"indisponível". Stats pessoais em box amarelo
(kills/deaths/K-D/partidas); ranking em tabela (posição, nome, kills, deaths). Tab switch lazy-loads o ranking.
tsc ×3 limpo · shared 49/49 · server 98/98 · bots 35/35 · `build @aop/client` OK · `bots 2 10` sem erro.
Ver `docs/DEVLOG.md` (Sessão 43) e `docs/prompts/PROMPT-0060.md`.
