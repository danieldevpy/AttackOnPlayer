#!/usr/bin/env bash
#
# redeploy-vps.sh — atualiza um deploy que já foi feito com
# script/deploy-vps-sem-dominio.sh: git pull + rebuild do client + migrations + restart
# dos processos pm2. NÃO instala nada (Node/pm2/Docker/Python/ufw) e não usa sudo —
# pensado pra rodar rápido, direto por SSH, sem ficar digitando senha.
#
# Pré-requisito: já ter rodado script/deploy-vps-sem-dominio.sh pelo menos uma vez nesta
# VPS (ele deixa o usuário no grupo `docker`, necessário pro Postgres subir sem sudo
# aqui). Se `docker` reclamar de permissão, é porque o grupo ainda não pegou nesta sessão
# de shell — rode `newgrp docker` (ou abra uma sessão SSH nova) e tente de novo.
#
# Uso na VPS (a partir da raiz do repo clonado):
#   ./script/redeploy-vps.sh [-l] [-b] [-c qtd_bots] [-t duracao_s] [IP_PUBLICO]
#
# Flags (mesmas do deploy-vps-sem-dominio.sh):
#   -l            usa localhost em vez de IP público (pra testar prod localmente)
#   -b            sobe bots headless via pm2 (padrão: desativado)
#   -c qtd_bots   quantidade de bots quando -b está ativo (padrão: 2)
#   -t duracao_s  duração dos bots em segundos, 0 = para sempre (padrão: 0)
#
# Se IP_PUBLICO não for passado, reaproveita o que já está salvo em
# backend/.env (DJANGO_ALLOWED_HOSTS) ou detecta de novo.
# Portas (sobrescrevíveis por env): BACK_PORT=2567 FRONT_PORT=5173 DJANGO_PORT=8000
#
set -euo pipefail

BACK_PORT="${BACK_PORT:-2567}"
FRONT_PORT="${FRONT_PORT:-5173}"
DJANGO_PORT="${DJANGO_PORT:-8000}"

BOTS_ON=0
BOT_COUNT=2
BOT_DURATION=0
USE_LOCALHOST=0

log()  { echo -e "\n\033[1;36m==> $*\033[0m"; }
warn() { echo -e "\033[1;33m[aviso] $*\033[0m"; }
die()  { echo -e "\033[1;31m[erro] $*\033[0m"; exit 1; }

usage() {
  grep '^#' "$0" | sed -e 's/^#!\/usr\/bin\/env bash//' -e 's/^# \{0,1\}//'
  exit 1
}

while getopts "lbc:t:h" opt; do
  case "$opt" in
    l) USE_LOCALHOST=1 ;;
    b) BOTS_ON=1 ;;
    c) BOT_COUNT="$OPTARG" ;;
    t) BOT_DURATION="$OPTARG" ;;
    h) usage ;;
    *) usage ;;
  esac
done
shift $((OPTIND - 1))

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR" || die "não achei a raiz do repo a partir de $0"
[[ -f package.json ]] || die "esperado rodar dentro do repo (package.json não encontrado em $REPO_DIR)"

BACKEND_DIR="$REPO_DIR/backend"
BACKEND_ENV="$BACKEND_DIR/.env"
[[ -f "$BACKEND_ENV" ]] || die "backend/.env não existe — rode script/deploy-vps-sem-dominio.sh primeiro (este aqui é só pra redeploy)."
[[ -d "$BACKEND_DIR/.venv" ]] || die "backend/.venv não existe — rode script/deploy-vps-sem-dominio.sh primeiro."
[[ -f "$BACKEND_DIR/secrets/jwt_private.pem" ]] || die "chaves JWT ausentes — rode script/deploy-vps-sem-dominio.sh primeiro."

# ---------- 0. docker sem sudo ----------
docker info >/dev/null 2>&1 \
  || die "'docker' sem sudo falhou — rode 'newgrp docker' (ou abra uma sessão SSH nova; o grupo docker só pega depois do 1º deploy) e tente de novo."

# ---------- 1. IP/Host ----------
if [[ "$USE_LOCALHOST" -eq 1 ]]; then
  SERVER_HOST="localhost"
  log "Modo localhost: server em ws://localhost:$BACK_PORT, jogo em http://localhost:$FRONT_PORT"
else
  SERVER_HOST="${1:-}"
  if [[ -z "$SERVER_HOST" ]]; then
    SERVER_HOST="$(grep '^DJANGO_ALLOWED_HOSTS=' "$BACKEND_ENV" | cut -d= -f2- | tr ',' '\n' | grep -vE '^(localhost|127\.0\.0\.1)?$' | head -1)"
  fi
  if [[ -z "$SERVER_HOST" ]]; then
    log "Detectando IP público..."
    SERVER_HOST="$(curl -fsS4 ifconfig.me || curl -fsS4 ipinfo.io/ip || true)"
    [[ -n "$SERVER_HOST" ]] || die "não consegui detectar o IP público — rode com ./script/redeploy-vps.sh SEU_IP"
  fi
  log "IP público: $SERVER_HOST (server em ws://$SERVER_HOST:$BACK_PORT, jogo em http://$SERVER_HOST:$FRONT_PORT)"
fi

# ---------- 2. Atualizar código ----------
if [[ -d .git ]]; then
  log "git pull..."
  git pull --ff-only || warn "git pull falhou/pulado — seguindo com o código já presente"
else
  warn "não é um clone git — pulando atualização automática de código"
fi

# ---------- 3. Dependências ----------
log "npm install (workspaces)..."
npm install

log "Instalando dependências do backend (requirements.txt)..."
"$BACKEND_DIR/.venv/bin/pip" install -q -r "$BACKEND_DIR/requirements.txt"

# ---------- 4. Hosts/CORS (idempotente, sobrevive a troca de IP) ----------
CURRENT_HOSTS="$(grep '^DJANGO_ALLOWED_HOSTS=' "$BACKEND_ENV" | cut -d= -f2-)"
if [[ "$CURRENT_HOSTS" != *"$SERVER_HOST"* ]]; then
  NEW_HOSTS="${CURRENT_HOSTS:+$CURRENT_HOSTS,}${SERVER_HOST},localhost,127.0.0.1"
  sed -i "s#^DJANGO_ALLOWED_HOSTS=.*#DJANGO_ALLOWED_HOSTS=${NEW_HOSTS}#" "$BACKEND_ENV"
fi

CLIENT_ORIGIN="http://${SERVER_HOST}:${FRONT_PORT}"
CURRENT_CORS="$(grep '^CORS_ALLOWED_ORIGINS=' "$BACKEND_ENV" | cut -d= -f2-)"
if [[ "$CURRENT_CORS" != *"$CLIENT_ORIGIN"* ]]; then
  NEW_CORS="${CURRENT_CORS:+$CURRENT_CORS,}${CLIENT_ORIGIN}"
  sed -i "s#^CORS_ALLOWED_ORIGINS=.*#CORS_ALLOWED_ORIGINS=${NEW_CORS}#" "$BACKEND_ENV"
fi

SERVICE_TOKEN="$(grep '^SERVICE_TOKEN=' "$BACKEND_ENV" | cut -d= -f2-)"
[[ -n "$SERVICE_TOKEN" ]] || die "SERVICE_TOKEN vazio em backend/.env."

# ---------- 5. Postgres (docker compose, sem sudo) ----------
log "Subindo Postgres (docker compose)..."
(cd "$BACKEND_DIR" && docker compose up -d db)

log "Aguardando Postgres ficar healthy..."
db_ok=0
for _ in $(seq 1 30); do
  status="$(cd "$BACKEND_DIR" && docker compose ps db --format '{{.Health}}' 2>/dev/null || true)"
  if [[ "$status" == "healthy" ]]; then db_ok=1; break; fi
  sleep 1
done
[[ "$db_ok" -eq 1 ]] || die "Postgres não ficou healthy em 30s — rode '(cd backend && docker compose logs db)'."

# ---------- 6. Migrations + seed de mapas ----------
log "Aplicando migrations do backend..."
(cd "$BACKEND_DIR" && DJANGO_SETTINGS_MODULE=config.settings.prod "$BACKEND_DIR/.venv/bin/python" manage.py migrate --noinput)

log "Coletando arquivos estáticos (WhiteNoise)..."
(cd "$BACKEND_DIR" && DJANGO_SETTINGS_MODULE=config.settings.prod "$BACKEND_DIR/.venv/bin/python" manage.py collectstatic --noinput)

log "Importando mapas para o registry (import_maps)..."
(cd "$BACKEND_DIR" && DJANGO_SETTINGS_MODULE=config.settings.prod "$BACKEND_DIR/.venv/bin/python" manage.py import_maps) \
  || warn "import_maps falhou — confira maps/*.map.json na raiz do repo."

# ---------- 7. Build do client com o IP fixo no bundle ----------
log "Build do client (VITE_SERVER_URL=ws://$SERVER_HOST:$BACK_PORT, VITE_DJANGO_URL=http://$SERVER_HOST:$DJANGO_PORT)..."
VITE_SERVER_URL="ws://$SERVER_HOST:$BACK_PORT" VITE_DJANGO_URL="http://$SERVER_HOST:$DJANGO_PORT" \
  npm run build -w @aop/client

# ---------- 8. Restart dos processos pm2 ----------
log "Reiniciando backend Django (aop-backend)..."
pm2 delete aop-backend >/dev/null 2>&1 || true
DJANGO_SETTINGS_MODULE=config.settings.prod pm2 start "$BACKEND_DIR/.venv/bin/gunicorn" \
  --name aop-backend --cwd "$BACKEND_DIR" --interpreter none \
  -- config.wsgi:application --bind "0.0.0.0:$DJANGO_PORT" --workers 3

log "Reiniciando game server (aop-server)..."
pm2 delete aop-server >/dev/null 2>&1 || true
PORT="$BACK_PORT" PLATFORM_ENABLED=1 PLATFORM_URL="http://localhost:$DJANGO_PORT" SERVICE_TOKEN="$SERVICE_TOKEN" \
  pm2 start npm --name aop-server --cwd "$REPO_DIR" -- run start -w @aop/server

log "Reiniciando client estático (aop-client)..."
pm2 delete aop-client >/dev/null 2>&1 || true
pm2 serve "$REPO_DIR/packages/client/dist" "$FRONT_PORT" --name aop-client --spa

pm2 delete aop-bots >/dev/null 2>&1 || true
if [[ "$BOTS_ON" -eq 1 ]]; then
  log "Subindo bots (aop-bots): ${BOT_COUNT} bot(s), duração ${BOT_DURATION}s (0 = para sempre)..."
  BOT_PM2_FLAGS=()
  [[ "$BOT_DURATION" != "0" ]] && BOT_PM2_FLAGS+=(--no-autorestart)
  pm2 start npm --name aop-bots --cwd "$REPO_DIR" "${BOT_PM2_FLAGS[@]}" -- run bots -- "$BOT_COUNT" "$BOT_DURATION"
else
  log "Bots: desativados (use -b pra ativar, -c qtd, -t duração)"
fi

pm2 save

# ---------- 9. Health check ----------
log "Checando /health do server..."
ok=0
for _ in $(seq 1 15); do
  if curl -fsS "http://127.0.0.1:$BACK_PORT/health" >/dev/null 2>&1; then ok=1; break; fi
  sleep 1
done
[[ "$ok" -eq 1 ]] && log "Server respondendo." || warn "Server não respondeu em 15s — rode 'pm2 logs aop-server'."

log "Checando /healthz do backend..."
ok_backend=0
for _ in $(seq 1 15); do
  if curl -fsS "http://127.0.0.1:$DJANGO_PORT/healthz" >/dev/null 2>&1; then ok_backend=1; break; fi
  sleep 1
done
[[ "$ok_backend" -eq 1 ]] && log "Backend respondendo." || warn "Backend não respondeu em 15s — rode 'pm2 logs aop-backend'."

echo
echo "========================================================"
echo " Jogo:    http://$SERVER_HOST:$FRONT_PORT"
echo " Server:  ws://$SERVER_HOST:$BACK_PORT  (HTTP: /health, /metrics/summary)"
echo " Backend: http://$SERVER_HOST:$DJANGO_PORT  (/healthz, /api/v1/...)"
if [[ "$BOTS_ON" -eq 1 ]]; then
  echo " Bots:    ${BOT_COUNT} bot(s), duração ${BOT_DURATION}s (0 = para sempre) — pm2 logs aop-bots"
else
  echo " Bots:    desativados (rodar de novo com -b pra ativar)"
fi
echo " Logs:    pm2 logs aop-server | pm2 logs aop-client | pm2 logs aop-backend | pm2 logs aop-bots"
echo " Status:  pm2 status"
echo "========================================================"
