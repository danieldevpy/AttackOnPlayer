#!/usr/bin/env bash
#
# snapshot-test.sh — cria uma cópia congelada do AttackOnPlayer para testar
# isoladamente, sem .git/node_modules, com portas dedicadas (front 5555 / back 7777).
#
# Uso (rodar de dentro da raiz do projeto, o script só olha $(pwd)):
#   ./script/snapshot-test.sh [-n nome] [-d diretorio_destino] [-f porta_front] [-b porta_back]
#
# Exemplos:
#   ./script/snapshot-test.sh
#   ./script/snapshot-test.sh -n flag-do-rei
#   ./script/snapshot-test.sh -d ~/Desenvolvimento/aop-snapshots -n teste-t021
#
set -euo pipefail

# ---------- defaults ----------
FRONT_PORT=5555
BACK_PORT=7777
SNAPSHOT_NAME=""
DEST_PARENT=""

SOURCE_DIR="$(pwd)"

usage() {
  grep '^#' "$0" | sed -e 's/^#!\/usr\/bin\/env bash//' -e 's/^# \{0,1\}//'
  exit 1
}

while getopts "n:d:f:b:h" opt; do
  case "$opt" in
    n) SNAPSHOT_NAME="$OPTARG" ;;
    d) DEST_PARENT="$OPTARG" ;;
    f) FRONT_PORT="$OPTARG" ;;
    b) BACK_PORT="$OPTARG" ;;
    h) usage ;;
    *) usage ;;
  esac
done

# ---------- validação: precisa estar na raiz do monorepo ----------
if [[ ! -f "$SOURCE_DIR/package.json" ]] || [[ ! -d "$SOURCE_DIR/packages/client" ]] || [[ ! -d "$SOURCE_DIR/packages/server" ]]; then
  echo "Erro: rode este script a partir da raiz do projeto AttackOnPlayer (onde está o package.json com workspaces)." >&2
  exit 1
fi

VITE_CONFIG="$SOURCE_DIR/packages/client/vite.config.ts"
CONSTANTS_TS="$SOURCE_DIR/packages/shared/src/constants.ts"

if [[ ! -f "$VITE_CONFIG" ]] || [[ ! -f "$CONSTANTS_TS" ]]; then
  echo "Erro: não encontrei packages/client/vite.config.ts ou packages/shared/src/constants.ts. Estrutura do projeto mudou?" >&2
  exit 1
fi

# ---------- nome/destino da cópia ----------
if [[ -z "$SNAPSHOT_NAME" ]]; then
  TS="$(date +%Y%m%d-%H%M%S)"
  HASH="$(git -C "$SOURCE_DIR" rev-parse --short HEAD 2>/dev/null || echo "nogit")"
  SNAPSHOT_NAME="attackonplayer-snapshot-${TS}-${HASH}"
fi

if [[ -z "$DEST_PARENT" ]]; then
  DEST_PARENT="$(dirname "$SOURCE_DIR")"
fi

DEST_DIR="$DEST_PARENT/$SNAPSHOT_NAME"

if [[ -e "$DEST_DIR" ]]; then
  echo "Erro: já existe algo em $DEST_DIR" >&2
  exit 1
fi

echo "== Origem:  $SOURCE_DIR"
echo "== Destino: $DEST_DIR"
echo "== Portas:  front=$FRONT_PORT  back=$BACK_PORT"
echo

# ---------- 1. copiar projeto (sem .git, node_modules, dist, logs) ----------
mkdir -p "$DEST_DIR"

tar \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='**/node_modules' \
  --exclude='dist' \
  --exclude='**/dist' \
  --exclude='.claude/worktrees' \
  --exclude='packages/server/logs' \
  --exclude='*.log' \
  -cf - -C "$SOURCE_DIR" . | tar -xf - -C "$DEST_DIR"

echo "[1/4] Cópia criada (sem .git/node_modules/dist)."

# ---------- 2. garantir que não sobrou nada indesejado ----------
rm -rf "$DEST_DIR/.git" "$DEST_DIR/node_modules"
find "$DEST_DIR/packages" -maxdepth 2 -type d -name node_modules -exec rm -rf {} + 2>/dev/null || true
find "$DEST_DIR/packages" -maxdepth 2 -type d -name dist -exec rm -rf {} + 2>/dev/null || true

# ---------- 3. trocar portas (front 5173->FRONT_PORT, back 2567->BACK_PORT) ----------
sed -i -E "s/(port:[[:space:]]*)[0-9]+/\1${FRONT_PORT}/" "$DEST_DIR/packages/client/vite.config.ts"
sed -i -E "s/(export const SERVER_PORT = )[0-9]+/\1${BACK_PORT}/" "$DEST_DIR/packages/shared/src/constants.ts"

echo "[2/4] Portas ajustadas: client vite.config.ts -> ${FRONT_PORT}, shared SERVER_PORT -> ${BACK_PORT}."

# ---------- 4. gerar run.sh (server + client + bots opcionais) ----------
RUN_SH="$DEST_DIR/run.sh"

cat > "$RUN_SH" <<'RUNEOF'
#!/usr/bin/env bash
#
# run.sh — sobe server + client desta cópia de teste, com bots opcionais.
#
# Uso:
#   ./run.sh [-b] [-c qtd_bots] [-t duracao_s]
#
# Flags:
#   -b            ativa os bots (padrão: desativado)
#   -c qtd_bots   quantidade de bots quando -b está ativo (padrão: 2)
#   -t duracao_s  duração dos bots em segundos, 0 = para sempre (padrão: 0)
#
# Ctrl+C encerra server, client e bots juntos.
#
set -uo pipefail

FRONT_PORT="__FRONT_PORT__"
BACK_PORT="__BACK_PORT__"

BOTS_ON=0
BOT_COUNT=2
BOT_DURATION=0

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

cd "$(dirname "$0")"

PIDS=()
CLEANED_UP=0
cleanup() {
  [[ "$CLEANED_UP" -eq 1 ]] && return
  CLEANED_UP=1
  echo
  echo "Encerrando server/client/bots..."
  # mata cada npm + seus filhos diretos (tsx/vite não sempre repassam o sinal a tempo)
  for pid in "${PIDS[@]:-}"; do
    pkill -TERM -P "$pid" 2>/dev/null || true
    kill -TERM "$pid" 2>/dev/null || true
  done
  sleep 1
  for pid in "${PIDS[@]:-}"; do
    pkill -KILL -P "$pid" 2>/dev/null || true
    kill -KILL "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "== Server:  ws://localhost:${BACK_PORT}"
npm run dev:server &
PIDS+=("$!")

echo "== Client:  http://localhost:${FRONT_PORT}"
npm run dev:client &
PIDS+=("$!")

sleep 2

if [[ "$BOTS_ON" -eq 1 ]]; then
  echo "== Bots:    ${BOT_COUNT} bot(s), duração ${BOT_DURATION}s (0 = para sempre)"
  npm run bots -- "$BOT_COUNT" "$BOT_DURATION" &
  PIDS+=("$!")
else
  echo "== Bots:    desativados (use -b para ativar, -c para quantidade)"
fi

echo
echo "Pressione Ctrl+C para encerrar tudo."
wait
RUNEOF

sed -i \
  -e "s/__FRONT_PORT__/${FRONT_PORT}/" \
  -e "s/__BACK_PORT__/${BACK_PORT}/" \
  "$RUN_SH"
chmod +x "$RUN_SH"

echo "[3/4] run.sh gerado em $RUN_SH (server + client + bots opcionais)."

# ---------- 5. instalar dependências ----------
echo "[4/4] Instalando dependências (npm install)..."
(cd "$DEST_DIR" && npm install)

echo
echo "Pronto."
echo
echo "Cópia de teste em: $DEST_DIR"
echo
echo "Para rodar tudo de uma vez:"
echo "  cd \"$DEST_DIR\""
echo "  ./run.sh              # server + client, sem bots"
echo "  ./run.sh -b           # server + client + 2 bots"
echo "  ./run.sh -b -c 6      # server + client + 6 bots"
echo "  ./run.sh -b -c 6 -t 60  # bots param sozinhos após 60s"
echo
echo "Ou manualmente:"
echo "  npm run dev:server   # backend em ws://localhost:${BACK_PORT}"
echo "  npm run dev:client   # frontend em http://localhost:${FRONT_PORT}"
echo "  npm run bots -- 2 0  # bots (qtd=2, duração=0 => para sempre)"
