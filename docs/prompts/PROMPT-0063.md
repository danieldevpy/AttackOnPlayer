# PROMPT-0063 — Deploy simples (sem domínio) passa a subir Django + Postgres · 2026-07-07

## Pedido (resumo fiel do CD)
"Quero que no script de produção, também inicialize o Django e banco de dados. Quero que o
ambiente de produção já funcione com o backend."

## Decisões tomadas (e por quem)
- **Escopo = `script/deploy-vps-sem-dominio.sh`** (o único script de "produção" do repo). O
  `run.sh`/`script/run.sh` são de dev e não foram tocados.
- **Backend fora do Docker, Postgres dentro** (IA): o resto do stack (Node) já roda via
  venv/pm2 direto no host neste script — manter o mesmo padrão pro Django (venv + gunicorn
  + pm2) em vez de construir/rodar a imagem `backend/Dockerfile`, que exigiria compose
  próprio pro backend (isso é o T-030 oficial, Docker completo). Só o Postgres usa Docker,
  reaproveitando `backend/docker-compose.yml` que já existia pra dev/test.
- **Backend passa a ser sempre ligado**, sem flag de opt-out (pedido explícito do CD — "eu
  quero que sempre"), diferente de `-b` (bots), que continua opcional.
- **`PLATFORM_ENABLED=1` no game server** (pm2 `aop-server`), com `PLATFORM_URL` e
  `SERVICE_TOKEN` (gerado e persistido em `backend/.env`) injetados via env — sem isso o
  Django subiria mas o jogo continuaria em modo guest (flag lida em `ArenaRoom.onCreate`
  via `process.env.PLATFORM_ENABLED`).
- **Secrets gerados na 1ª execução** (`DJANGO_SECRET_KEY`, `SERVICE_TOKEN` via `openssl
  rand`) e persistidos em `backend/.env` — reexecuções não trocam os secrets, só ajustam
  `DJANGO_ALLOWED_HOSTS`/`CORS_ALLOWED_ORIGINS` pra incluir o IP público atual (idempotente,
  sobrevive a troca de IP se a VPS for recriada).
- **Fix de segurança encontrado no caminho** (IA, fora do pedido original mas necessário pra
  não abrir um buraco): `backend/docker-compose.yml` publicava Postgres em `0.0.0.0:5432`.
  `ufw` **não** bloqueia portas publicadas pelo Docker (ele mexe direto no iptables/DOCKER
  chain) — isso exporia o Postgres com credenciais padrão (`aop`/`aop`) pra internet assim
  que o script rodasse. Corrigido pra `127.0.0.1:5432:5432` (Django continua conectando via
  `localhost` normalmente) + `restart: unless-stopped` pra sobreviver a reboot da VPS (pm2
  já cobria os processos Node/gunicorn via `pm2 startup`, faltava o container).
- **`/admin/` do Django não funciona bem sem TLS**, achado ao revisar `config/settings/
  prod.py`: `SESSION_COOKIE_SECURE`/`CSRF_COOKIE_SECURE` são `True` fixo, e sem HTTPS o
  navegador não persiste esse cookie — login por sessão falha. Isso **não afeta** a
  integração jogo↔backend (service token / JWT, sem cookie de sessão). Decisão: documentar
  o caveat (script avisa no output final + `docs/deploy/PLANO-VPS-SEM-DOMINIO.md`) em vez de
  enfraquecer o hardening de prod só pra fazer o admin funcionar sem TLS — mudança de
  segurança dessas é decisão do CD, não da IA, e o pedido original não exigia admin via
  navegador.
- **Sem spec nova em `specs/`**: tratado como extensão do fluxo documentado em
  `docs/deploy/PLANO-VPS-SEM-DOMINIO.md` (que já cumpre o papel de "spec" pra esse script
  específico) em vez de abrir uma SPEC-00NN nova — mudança é de infra/ops, escopo contido a
  um script + um compose file, sem gameplay/arquitetura nova.
- **Seed de dados**: adicionado `manage.py import_maps` (idempotente, `update_or_create`)
  depois do `migrate`, pra registry de mapas não ficar vazio no Postgres novo. `gameops`
  já semeia `RoomConfig` default via migration de dados (0002), não precisou de comando
  extra.

## Resultado verificado
- `bash -n script/deploy-vps-sem-dominio.sh` — sintaxe OK.
- Revisão manual do diff completo do script e do `docker-compose.yml` linha a linha
  (variáveis, `$SUDO`, aspas, idempotência do `sed`/grep no `.env`).
- **Não executado numa VPS real** nesta sessão (ambiente sandbox não tem uma VPS Ubuntu
  disponível pra rodar o script fim-a-fim) — próximo deploy real na VPS é o teste de fato;
  ver "Pendências" abaixo.

## Veredito CD (preencher após teste no browser)
- Testado em: _(pendente — rodar numa VPS real)_
- Fluxos: deploy do zero (VPS nova) / redeploy (idempotência) / jogo autenticado (JWT) /
  stats persistindo em `PlayerStats` / ranking
- Resultado: _(pendente)_
- Observações:

## Regras que nascem daqui
- Portas publicadas por `docker compose`/Docker **sempre** com bind explícito em
  `127.0.0.1` quando o serviço só deve ser acessado do próprio host — `ufw` não protege
  contra publicação de porta feita pelo Docker.
- Mudança em `config/settings/prod.py` (hardening) não deve ser feita "de passagem" pra
  destravar uma conveniência (ex.: admin sem TLS) — é decisão explícita do CD.

## Pendências para o próximo prompt
- Rodar o script numa VPS real e validar: subida do zero, redeploy idempotente, login de
  jogador com conta (JWT) integrado ao Django, stats persistindo.
- Se o CD quiser `/admin/` acessível de fato neste deploy sem domínio, decidir
  explicitamente entre (a) aceitar HTTP puro pro admin (relaxar os dois `*_COOKIE_SECURE`
  só quando não há TLS) ou (b) esperar o fluxo oficial (SPEC-0009/T-030) com domínio+TLS.
