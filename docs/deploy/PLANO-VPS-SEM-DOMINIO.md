# Plano — AttackOnPlayer numa VPS, por IP público, sem domínio

**Escopo:** subir o jogo (game server Colyseus + client) numa VPS pra jogar com amigos,
acessando direto pelo IP público, sem comprar domínio nem configurar TLS. Isso é mais
simples e mais restrito que o lançamento oficial V1 (`SPEC-0009`, marco M5), que prevê
domínio + Caddy/TLS + Docker + backend Django completo. Os dois fluxos coexistem — este
aqui é um atalho pra testar com o grupo antes/em paralelo do lançamento público.

## 1. Dá pra rodar tudo só no IP público, sem domínio?

**Sim.** Confirmado no código:

- O game server (`packages/server/src/index.ts`) faz `httpServer.listen(port)` sem
  especificar host — em Node isso escuta em todas as interfaces (`0.0.0.0`), então já
  fica acessível em `http(s)://IP:2567` sem nenhuma mudança.
- O client é só HTML/JS/CSS estático (build do Vite) — qualquer servidor estático
  (nginx, `pm2 serve`, `python -m http.server`) serve em `http://IP:PORTA`.
- Sem HTTPS na página, o navegador aceita WebSocket **não-criptografado** (`ws://`) sem
  bloqueio de "mixed content" (esse bloqueio só existe quando a página é `https://` e o
  recurso é `http`/`ws`). Ou seja: página em `http://IP:5173` conectando em
  `ws://IP:2567` funciona normalmente.
- Certificado TLS confiável (Let's Encrypt) exige domínio — é exatamente o que estamos
  evitando aqui. Sem domínio, a alternativa seria certificado autoassinado (avisos feios
  no navegador) ou nada de TLS. Pra jogar com amigos, nada de TLS é a escolha certa.
- Backend Django (`backend/`, autenticação/plataforma) **passou a subir sempre** com este
  script (decisão do CD, 2026-07-07 — ver `docs/prompts/PROMPT-0063.md`): Postgres via
  Docker (`backend/docker-compose.yml`, só o `db`, bind em `127.0.0.1`), Django fora do
  Docker (venv + `gunicorn` gerenciado por pm2, igual ao Node), migrations e
  `import_maps` aplicados, e o game server sobe com `PLATFORM_ENABLED=1` já apontando pro
  backend local. Contas, JWT, stats e ranking funcionam de verdade neste deploy — não é
  mais preciso migrar pro fluxo oficial (T-030/SPEC-0009) só pra ter backend.
  Exceção: `/admin/` do Django não funciona bem sem TLS (ver §2) — nada que afete o jogo
  em si (service token / JWT não dependem de cookie de sessão).

**Único ajuste de código necessário (já aplicado neste repo):** o client tinha uma regra
fixa em `packages/client/src/main.ts` que assumia `wss://` (TLS) pra qualquer host que não
fosse `localhost`/`192.x`. Isso quebraria a conexão num IP público sem TLS. Foi adicionado
um override por variável de build (`VITE_SERVER_URL`) que, quando setada, força `ws://`
explícito pro host:porta do server — sem mexer no caminho oficial com domínio/TLS (que
não seta essa variável e continua caindo na regra antiga). Validado com `tsc --noEmit` e
um `vite build` real gerando o bundle com o IP fixo dentro.

## 2. Trade-offs de rodar sem domínio/TLS

- Tráfego (posição, chat se houver, token de guest, **e agora também login/JWT do
  backend**) trafega **sem criptografia** — visível pra quem estiver no meio do caminho da
  rede. Aceitável pra uma partida casual com amigos; não é o que se quer pro lançamento
  público (por isso o SPEC-0009 exige TLS).
- Sem domínio, o IP pode mudar se a VPS for recriada — amigos precisam do IP novo (o
  script reajusta `DJANGO_ALLOWED_HOSTS`/`CORS_ALLOWED_ORIGINS` sozinho ao rodar de novo).
- `/admin/` do Django exige `SESSION_COOKIE_SECURE`/`CSRF_COOKIE_SECURE` (hardcoded em
  `config/settings/prod.py`), que só funcionam sob HTTPS — login por sessão no navegador
  não persiste em `http://`. Pra tarefas administrativas nesta VPS, use
  `(cd backend && .venv/bin/python manage.py shell)` ou `createsuperuser` + `dbshell`
  direto na VPS. A API do jogo (service token / JWT, sem cookie) não é afetada.

## 3. Plano de estudo (antes de colocar no ar)

Se quiser entender o que está por trás do script antes de só rodar, os tópicos, em ordem:

1. **SSH e acesso à VPS** — chave pública/privada, primeiro login, usuário não-root.
2. **Firewall** — `ufw` (nível do SO) *e* o firewall do painel do provedor (nível de rede)
   — os dois precisam liberar as portas, um não substitui o outro.
3. **Node.js em produção** — diferença entre `npm run dev` (watch/hot-reload) e
   `npm run start` (processo direto); por que não rodar Colyseus atrás de `nodemon`/`tsx watch`
   em produção.
4. **Gerenciador de processo (`pm2`)** — restart automático se o processo cair, sobreviver
   a reboot (`pm2 startup` + `pm2 save`), logs centralizados (`pm2 logs`).
5. **Serving estático de SPA** — por que `--spa` importa (fallback pra `index.html` em
   rotas desconhecidas), diferença entre isso e servir os arquivos do Vite dev server.
6. **WebSocket sem proxy reverso** — o que muda vs. o modelo do SPEC-0009 (Caddy na frente
   fazendo TLS termination); por que aqui o navegador fala direto com a porta 2567.
7. **Variáveis de build vs. variáveis de runtime** — por que `VITE_SERVER_URL` precisa
   existir *no momento do `vite build`* (vira string fixa no bundle), diferente de `PORT`
   no server (lido em runtime via `process.env`).

## 4. Passo a passo (com o script)

Na VPS (Ubuntu/Debian recomendado), como root ou usuário com sudo:

```bash
git clone <url-do-repo> attackonplayer
cd attackonplayer
chmod +x script/deploy-vps-sem-dominio.sh
./script/deploy-vps-sem-dominio.sh        # detecta o IP público sozinho
# ou, se preferir fixar:
./script/deploy-vps-sem-dominio.sh 203.0.113.10
# com bots headless (espelha o run.sh de dev — -b liga, -c qtd, -t duração em s, 0 = pra sempre):
./script/deploy-vps-sem-dominio.sh -b -c 3 -t 60 203.0.113.10
```

O script (`script/deploy-vps-sem-dominio.sh`) faz, nessa ordem:

1. Detecta o IP público (ou usa o passado por argumento).
2. Instala Node 20 se não tiver.
3. Instala `pm2`, Docker (só pro Postgres) e Python3/venv se não tiverem.
4. `git pull` (se for um clone git).
5. `npm install` na raiz (workspaces).
6. **Backend Django:** cria/reusa `.venv`, instala `requirements.txt`, gera
   `backend/.env` de produção na 1ª execução (`DJANGO_SECRET_KEY`/`SERVICE_TOKEN`
   aleatórios, `DJANGO_DEBUG=false`) e nas seguintes garante que `DJANGO_ALLOWED_HOSTS`/
   `CORS_ALLOWED_ORIGINS` incluem o IP público atual; gera par de chaves JWT se faltar;
   sobe Postgres (`docker compose up -d db`, bind em `127.0.0.1`) e espera ficar healthy;
   aplica `migrate` e `import_maps`.
7. `vite build` do client com `VITE_SERVER_URL=ws://IP:2567` — fixa o endereço certo no bundle.
8. Sobe, via pm2: o backend (`aop-backend`, gunicorn, porta 8000), o game server
   (`aop-server`, porta 2567, já com `PLATFORM_ENABLED=1`/`PLATFORM_URL`/`SERVICE_TOKEN`
   apontando pro backend local) e o client estático (`aop-client`, `pm2 serve --spa`,
   porta 5173).
9. Se `-b` foi passado, sobe os bots headless via pm2 (`aop-bots`) — conectam em
   `ws://localhost:2567` (mesma VPS, não precisa do IP público). Duração finita
   (`-t` != 0) desliga o auto-restart do pm2, pra não ficar reiniciando em loop depois
   que os bots terminam; `-t 0` (padrão) roda pra sempre, igual `script/run.sh`. Sem `-b`,
   qualquer `aop-bots` de uma rodada anterior é removido.
10. `pm2 save` + imprime o comando de `pm2 startup` (rodar uma vez pra sobreviver a reboot).
11. Libera as portas no `ufw` — `BACK_PORT`, `FRONT_PORT`, `DJANGO_PORT` (Postgres fica só
    em `127.0.0.1`, não precisa abrir) — e avisa pra conferir o firewall do provedor também.
12. Checa `/health` do server e `/healthz` do backend, e imprime as URLs finais (+ status
    dos bots).

**Rodar de novo** (pra atualizar depois de um `git push`, ou pra ligar/desligar bots) é o
mesmo comando — o script é idempotente: atualiza código, rebuilda, reaplica migrations e
reinicia os processos pm2 (backend inclusive). Rodar sem `-b` depois de já ter rodado com
`-b` desliga e remove os bots.

### Comandos úteis pós-deploy

```bash
pm2 status                 # os processos (server, client, backend, bots se ativos), uptime, restarts
pm2 logs aop-server         # logs do game server em tempo real
pm2 logs aop-client         # logs do servidor estático
pm2 logs aop-backend        # logs do Django/gunicorn
pm2 logs aop-bots           # logs dos bots (se ativos)
pm2 restart aop-server      # reiniciar só o server
pm2 monit                   # CPU/memória ao vivo

# tarefas administrativas do backend (admin/ não funciona sem TLS — ver §2):
cd backend && .venv/bin/python manage.py createsuperuser
cd backend && .venv/bin/python manage.py shell
```

## 5. Especificação de VPS

Servidor é leve por princípio de design do jogo (tick 20Hz, payload mínimo, sem física de
engine — ver `docs/multiplayer/architecture.md`). Pra uma partida casual com um punhado de
amigos, 1 vCPU / 1GB RAM (ex.: menor plano de qualquer provedor — DigitalOcean, Hetzner,
Vultr, Oracle Cloud free tier) é suficiente. Ubuntu 22.04 ou 24.04 LTS.

## 6. Quando migrar pro fluxo oficial (domínio + TLS)

Esse deploy simples não substitui `SPEC-0009` (T-030/T-031/T-032, ainda não iniciadas no
BACKLOG) — ele é um atalho pra jogar com amigos *antes* disso, e desde 2026-07-07 já sobe
com backend Django + Postgres funcionando (contas, JWT, stats, ranking). Migrar pro fluxo
oficial faz sentido quando:

- Quiser divulgar publicamente (link compartilhável sem aviso de "conexão não segura" nem
  depender de decorar um IP) — e/ou precisar do admin do Django funcionando no navegador
  (exige HTTPS, ver §2).
- Quiser Docker também pro backend/Node (ambientes reproduzíveis, rollback por tag de
  imagem) e hardening completo (rate-limit, backup de Postgres — T-031).

Nesse ponto, seguir o plano já aprovado em `specs/SPEC-0009-empacotamento-e-lancamento.md`.
