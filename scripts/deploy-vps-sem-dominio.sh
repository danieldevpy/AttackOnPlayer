#!/usr/bin/env bash
#
# deploy-vps-sem-dominio.sh — PRIMEIRO deploy do AttackOnPlayer numa VPS usando só o IP
# público, sem domínio e sem TLS. Uso pra jogar com amigos, não é o fluxo oficial de
# lançamento (esse é SPEC-0009 / M5, com domínio + Caddy/TLS). Instala tudo que falta
# (Node, pm2, Docker, Python/venv) e pede senha de sudo pra isso. É idempotente — rodar de
# novo também funciona — mas pra atualizações do dia a dia (depois da 1ª vez) use
# script/redeploy-vps.sh, que não instala nada e não pede sudo.
#
# Também sobe o backend Django (contas, mapas, gameops, telemetria) + Postgres, e liga o
# game server nele (PLATFORM_ENABLED=1) — o ambiente sobe já integrado com o backend, sem
# passo manual. Backend roda fora do Docker (venv + gunicorn via pm2, igual ao Node); só o
# Postgres usa Docker (backend/docker-compose.yml).
#
# Uso na VPS (Ubuntu/Debian, como root ou com sudo, a partir da raiz do repo clonado):
#   ./script/deploy-vps-sem-dominio.sh [-l] [-b] [-c qtd_bots] [-t duracao_s] [IP_PUBLICO]
#
# Flags (espelham o script/run.sh de dev):
#   -l            usa localhost em vez de IP público (pra testar prod localmente)
#   -b            sobe bots headless via pm2 (padrão: desativado)
#   -c qtd_bots   quantidade de bots quando -b está ativo (padrão: 2)
#   -t duracao_s  duração dos bots em segundos, 0 = para sempre (padrão: 0)
#
# Se IP_PUBLICO não for passado, o script tenta detectar automaticamente.
# Portas (sobrescrevíveis por env): BACK_PORT=2567 FRONT_PORT=5173 DJANGO_PORT=8000
#
# Aviso: sem TLS, o admin do Django (`/admin/`) não funciona direito no navegador —
# `SESSION_COOKIE_SECURE`/`CSRF_COOKIE_SECURE` (config/settings/prod.py) exigem HTTPS, então
# o login por sessão não persiste em http://. A API do jogo (service token / JWT) não usa
# cookie de sessão e funciona normalmente. `/admin/` fica disponível só quando migrar pro
# fluxo oficial com domínio+TLS (SPEC-0009); até lá, use `manage.py shell`/`createsuperuser`
# na própria VPS para operações administrativas.
#
set -euo pipefail

BACK_PORT="${BACK_PORT:-2567}"
FRONT_PORT="${FRONT_PORT:-5173}"
DJANGO_PORT="${DJANGO_PORT:-8000}"
NODE_VERSION="20"

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

SUDO=""
[[ "$(id -u)" -ne 0 ]] && SUDO="sudo"

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR" || die "não achei a raiz do repo a partir de $0"
[[ -f package.json ]] || die "esperado rodar dentro do repo (package.json não encontrado em $REPO_DIR)"

# ---------- 1. IP/Host ----------
if [[ "$USE_LOCALHOST" -eq 1 ]]; then
  SERVER_HOST="localhost"
  log "Modo localhost: server em ws://localhost:$BACK_PORT, jogo em http://localhost:$FRONT_PORT"
else
  SERVER_HOST="${1:-}"
  if [[ -z "$SERVER_HOST" ]]; then
    log "Detectando IP público..."
    SERVER_HOST="$(curl -fsS4 ifconfig.me || curl -fsS4 ipinfo.io/ip || true)"
    [[ -n "$SERVER_HOST" ]] || die "não consegui detectar o IP público — rode com ./deploy-vps-sem-dominio.sh SEU_IP"
  fi
  log "IP público: $SERVER_HOST (server em ws://$SERVER_HOST:$BACK_PORT, jogo em http://$SERVER_HOST:$FRONT_PORT)"
fi

# ---------- 2. Node.js ----------
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/v//;s/\..*//')" -lt "$NODE_VERSION" ]]; then
  log "Instalando Node.js ${NODE_VERSION}.x..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | $SUDO bash -
  $SUDO apt-get install -y nodejs
else
  log "Node.js já presente: $(node -v)"
fi

# ---------- 3. pm2 (gerenciador de processo) ----------
if ! command -v pm2 >/dev/null 2>&1; then
  log "Instalando pm2..."
  npm install -g pm2
fi

# ---------- 3b. Docker (só pro Postgres do backend) ----------
if ! command -v docker >/dev/null 2>&1; then
  log "Instalando Docker..."
  curl -fsSL https://get.docker.com | $SUDO sh
else
  log "Docker já presente: $(docker --version)"
fi
$SUDO systemctl enable --now docker >/dev/null 2>&1 || true

# Coloca o usuário atual no grupo docker pra rodar "docker compose" sem sudo depois —
# necessário pro script/redeploy-vps.sh rodar sem pedir senha. Só faz efeito numa sessão
# de shell nova (logout/login ou "newgrp docker"); nesta mesma execução continuamos
# usando $SUDO pra garantir que funciona mesmo sem relogar.
if [[ -n "$SUDO" ]] && ! id -nG "$USER" | grep -qw docker; then
  log "Adicionando usuário '$USER' ao grupo docker (pra redeploy sem sudo)..."
  $SUDO usermod -aG docker "$USER"
  warn "Grupo docker adicionado — faça logout/login (ou rode 'newgrp docker') antes de usar script/redeploy-vps.sh."
fi

# ---------- 3c. Python (backend Django roda no host, fora do Docker) ----------
# Checagem por "venv --help" não é confiável (o módulo responde --help mesmo sem
# ensurepip instalado) — testa criando um venv descartável de verdade.
if command -v python3 >/dev/null 2>&1 && python3 -m venv "$(mktemp -d)/venv-check" >/dev/null 2>&1; then
  log "Python3/venv já presentes: $(python3 --version)"
  $SUDO apt-get install -y libpq5 >/dev/null 2>&1 || true
else
  log "Instalando Python3/venv/pip..."
  $SUDO apt-get update -y
  $SUDO apt-get install -y python3 python3-venv python3-pip libpq5
fi

# ---------- 4. Atualizar código (se for um clone git) ----------
if [[ -d .git ]]; then
  log "git pull..."
  git pull --ff-only || warn "git pull falhou/pulado — seguindo com o código já presente"
else
  warn "não é um clone git — pulando atualização automática de código"
fi

# ---------- 5. Dependências ----------
log "npm install (workspaces)..."
npm install

# ---------- 5b. Backend Django: venv + dependências ----------
BACKEND_DIR="$REPO_DIR/backend"
log "Preparando venv do backend..."
if [[ ! -d "$BACKEND_DIR/.venv" ]]; then
  python3 -m venv "$BACKEND_DIR/.venv"
fi
"$BACKEND_DIR/.venv/bin/pip" install -q --upgrade pip
log "Instalando dependências do backend (requirements.txt)..."
"$BACKEND_DIR/.venv/bin/pip" install -q -r "$BACKEND_DIR/requirements.txt"

# ---------- 5c. Backend: .env de produção (secrets gerados na 1ª execução) ----------
BACKEND_ENV="$BACKEND_DIR/.env"
if [[ ! -f "$BACKEND_ENV" ]]; then
  log "Criando backend/.env de produção (1ª execução)..."
  cp "$BACKEND_DIR/.env.example" "$BACKEND_ENV"
  SECRET_KEY_VAL="$(openssl rand -hex 50)"
  SERVICE_TOKEN_VAL="$(openssl rand -hex 32)"
  sed -i \
    -e "s#^DJANGO_SECRET_KEY=.*#DJANGO_SECRET_KEY=${SECRET_KEY_VAL}#" \
    -e "s#^DJANGO_DEBUG=.*#DJANGO_DEBUG=false#" \
    -e "s#^SERVICE_TOKEN=.*#SERVICE_TOKEN=${SERVICE_TOKEN_VAL}#" \
    "$BACKEND_ENV"
else
  log "backend/.env já existe — mantendo secrets, só ajustando hosts/CORS se preciso."
fi

# Garante que o IP público atual está em ALLOWED_HOSTS/CORS (idempotente — sobrevive a troca
# de IP se a VPS for recriada; não remove entradas antigas).
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
[[ -n "$SERVICE_TOKEN" ]] || die "SERVICE_TOKEN vazio em backend/.env — corrija antes de continuar."

# ---------- 5d. Backend: chaves JWT RS256 (se faltarem) ----------
if [[ ! -f "$BACKEND_DIR/secrets/jwt_private.pem" ]]; then
  log "Gerando par de chaves JWT (RS256)..."
  mkdir -p "$BACKEND_DIR/secrets"
  openssl genpkey -algorithm RSA -out "$BACKEND_DIR/secrets/jwt_private.pem" -pkeyopt rsa_keygen_bits:2048
  openssl rsa -in "$BACKEND_DIR/secrets/jwt_private.pem" -pubout -out "$BACKEND_DIR/secrets/jwt_public.pem"
fi

# ---------- 5e. Backend: Postgres (docker compose) ----------
log "Subindo Postgres (docker compose)..."
(cd "$BACKEND_DIR" && $SUDO docker compose up -d db)

log "Aguardando Postgres ficar healthy..."
db_ok=0
for _ in $(seq 1 30); do
  status="$(cd "$BACKEND_DIR" && $SUDO docker compose ps db --format '{{.Health}}' 2>/dev/null || true)"
  if [[ "$status" == "healthy" ]]; then db_ok=1; break; fi
  sleep 1
done
[[ "$db_ok" -eq 1 ]] || die "Postgres não ficou healthy em 30s — rode '(cd backend && docker compose logs db)'."

# ---------- 5f. Backend: migrations + seed de mapas ----------
log "Aplicando migrations do backend..."
(cd "$BACKEND_DIR" && DJANGO_SETTINGS_MODULE=config.settings.prod "$BACKEND_DIR/.venv/bin/python" manage.py migrate --noinput)

log "Importando mapas para o registry (import_maps)..."
(cd "$BACKEND_DIR" && DJANGO_SETTINGS_MODULE=config.settings.prod "$BACKEND_DIR/.venv/bin/python" manage.py import_maps) \
  || warn "import_maps falhou — confira maps/*.map.json na raiz do repo."

# ---------- 6. Build do client com o IP fixo no bundle ----------
log "Build do client (VITE_SERVER_URL=ws://$SERVER_HOST:$BACK_PORT, VITE_DJANGO_URL=http://$SERVER_HOST:$DJANGO_PORT)..."
VITE_SERVER_URL="ws://$SERVER_HOST:$BACK_PORT" VITE_DJANGO_URL="http://$SERVER_HOST:$DJANGO_PORT" \
  npm run build -w @aop/client

# ---------- 7. Subir/atualizar processos via pm2 ----------
log "Subindo backend Django (aop-backend) na porta $DJANGO_PORT..."
pm2 delete aop-backend >/dev/null 2>&1 || true
DJANGO_SETTINGS_MODULE=config.settings.prod pm2 start "$BACKEND_DIR/.venv/bin/gunicorn" \
  --name aop-backend --cwd "$BACKEND_DIR" --interpreter none \
  -- config.wsgi:application --bind "0.0.0.0:$DJANGO_PORT" --workers 3

log "Subindo game server (aop-server) na porta $BACK_PORT (integrado ao backend)..."
pm2 delete aop-server >/dev/null 2>&1 || true
PORT="$BACK_PORT" PLATFORM_ENABLED=1 PLATFORM_URL="http://localhost:$DJANGO_PORT" SERVICE_TOKEN="$SERVICE_TOKEN" \
  pm2 start npm --name aop-server --cwd "$REPO_DIR" -- run start -w @aop/server

log "Servindo client estático (aop-client) na porta $FRONT_PORT..."
pm2 delete aop-client >/dev/null 2>&1 || true
pm2 serve "$REPO_DIR/packages/client/dist" "$FRONT_PORT" --name aop-client --spa

# Bots headless (-b): conectam em localhost, direto na mesma VPS — não precisa de
# SERVER_URL (default do bot.ts já é ws://localhost:$SERVER_PORT).
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
log "pm2 configurado. Pra sobreviver a reboot da VPS (rodar 1x, comando muda por SO):"
pm2 startup || true

# ---------- 8. Firewall ----------
if command -v ufw >/dev/null 2>&1; then
  log "Abrindo portas no ufw..."
  $SUDO ufw allow OpenSSH >/dev/null 2>&1 || true
  $SUDO ufw allow "$BACK_PORT"/tcp
  $SUDO ufw allow "$FRONT_PORT"/tcp
  $SUDO ufw allow "$DJANGO_PORT"/tcp
  $SUDO ufw --force enable
else
  warn "ufw não encontrado — confirme manualmente que as portas $BACK_PORT, $FRONT_PORT e $DJANGO_PORT estão liberadas"
fi
warn "Se a VPS for de nuvem (DigitalOcean/AWS/Vultr/etc.), confira também o firewall do PAINEL do provedor — o ufw sozinho não basta se o provedor bloquear antes."
warn "Postgres (5432) fica só em 127.0.0.1 (backend/docker-compose.yml) — não precisa/deve abrir no firewall."

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
echo "          admin/ sem TLS não mantém login por sessão (cookie secure) — use"
echo "          '(cd backend && .venv/bin/python manage.py createsuperuser)' + shell na VPS"
if [[ "$BOTS_ON" -eq 1 ]]; then
  echo " Bots:    ${BOT_COUNT} bot(s), duração ${BOT_DURATION}s (0 = para sempre) — pm2 logs aop-bots"
else
  echo " Bots:    desativados (rodar de novo com -b pra ativar)"
fi
echo " Logs:    pm2 logs aop-server | pm2 logs aop-client | pm2 logs aop-backend | pm2 logs aop-bots"
echo " Status:  pm2 status"
echo " Atualizar depois: rodar este script de novo"
echo "========================================================"
