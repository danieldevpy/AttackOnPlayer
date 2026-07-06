#!/usr/bin/env bash
#
# deploy-vps-sem-dominio.sh — sobe o AttackOnPlayer numa VPS usando só o IP público,
# sem domínio e sem TLS. Uso pra jogar com amigos, não é o fluxo oficial de lançamento
# (esse é SPEC-0009 / M5, com domínio + Caddy/TLS). Idempotente: rodar de novo atualiza
# tudo (git pull + rebuild + restart dos processos pm2).
#
# Uso na VPS (Ubuntu/Debian, como root ou com sudo, a partir da raiz do repo clonado):
#   ./script/deploy-vps-sem-dominio.sh [-b] [-c qtd_bots] [-t duracao_s] [IP_PUBLICO]
#
# Flags (espelham o script/run.sh de dev):
#   -b            sobe bots headless via pm2 (padrão: desativado)
#   -c qtd_bots   quantidade de bots quando -b está ativo (padrão: 2)
#   -t duracao_s  duração dos bots em segundos, 0 = para sempre (padrão: 0)
#
# Se IP_PUBLICO não for passado, o script tenta detectar automaticamente.
# Portas (sobrescrevíveis por env): BACK_PORT=2567 FRONT_PORT=5173
#
set -euo pipefail

BACK_PORT="${BACK_PORT:-2567}"
FRONT_PORT="${FRONT_PORT:-5173}"
NODE_VERSION="20"

BOTS_ON=0
BOT_COUNT=2
BOT_DURATION=0

log()  { echo -e "\n\033[1;36m==> $*\033[0m"; }
warn() { echo -e "\033[1;33m[aviso] $*\033[0m"; }
die()  { echo -e "\033[1;31m[erro] $*\033[0m"; exit 1; }

usage() {
  grep '^#' "$0" | sed -e 's/^#!\/usr\/bin\/env bash//' -e 's/^# \{0,1\}//'
  exit 1
}

while getopts "bc:t:h" opt; do
  case "$opt" in
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

# ---------- 1. IP público ----------
PUBLIC_IP="${1:-}"
if [[ -z "$PUBLIC_IP" ]]; then
  log "Detectando IP público..."
  PUBLIC_IP="$(curl -fsS4 ifconfig.me || curl -fsS4 ipinfo.io/ip || true)"
  [[ -n "$PUBLIC_IP" ]] || die "não consegui detectar o IP público — rode com ./deploy-vps-sem-dominio.sh SEU_IP"
fi
log "IP público: $PUBLIC_IP (server em ws://$PUBLIC_IP:$BACK_PORT, jogo em http://$PUBLIC_IP:$FRONT_PORT)"

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

# ---------- 6. Build do client com o IP fixo no bundle ----------
log "Build do client (VITE_SERVER_URL=ws://$PUBLIC_IP:$BACK_PORT)..."
VITE_SERVER_URL="ws://$PUBLIC_IP:$BACK_PORT" npm run build -w @aop/client

# ---------- 7. Subir/atualizar processos via pm2 ----------
log "Subindo game server (aop-server) na porta $BACK_PORT..."
pm2 delete aop-server >/dev/null 2>&1 || true
PORT="$BACK_PORT" pm2 start npm --name aop-server --cwd "$REPO_DIR" -- run start -w @aop/server

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
  $SUDO ufw --force enable
else
  warn "ufw não encontrado — confirme manualmente que as portas $BACK_PORT e $FRONT_PORT estão liberadas"
fi
warn "Se a VPS for de nuvem (DigitalOcean/AWS/Vultr/etc.), confira também o firewall do PAINEL do provedor — o ufw sozinho não basta se o provedor bloquear antes."

# ---------- 9. Health check ----------
log "Checando /health do server..."
ok=0
for _ in $(seq 1 15); do
  if curl -fsS "http://127.0.0.1:$BACK_PORT/health" >/dev/null 2>&1; then ok=1; break; fi
  sleep 1
done
[[ "$ok" -eq 1 ]] && log "Server respondendo." || warn "Server não respondeu em 15s — rode 'pm2 logs aop-server'."

echo
echo "========================================================"
echo " Jogo:    http://$PUBLIC_IP:$FRONT_PORT"
echo " Server:  ws://$PUBLIC_IP:$BACK_PORT  (HTTP: /health, /metrics/summary)"
if [[ "$BOTS_ON" -eq 1 ]]; then
  echo " Bots:    ${BOT_COUNT} bot(s), duração ${BOT_DURATION}s (0 = para sempre) — pm2 logs aop-bots"
else
  echo " Bots:    desativados (rodar de novo com -b pra ativar)"
fi
echo " Logs:    pm2 logs aop-server | pm2 logs aop-client | pm2 logs aop-bots"
echo " Status:  pm2 status"
echo " Atualizar depois: rodar este script de novo"
echo "========================================================"
