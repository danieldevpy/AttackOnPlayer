#!/usr/bin/env bash
#
# run.sh — sobe server + client (dev), com bots opcionais.
#
# Uso (a partir da raiz do repo):
#   ./script/run.sh [-b] [-c qtd_bots] [-t duracao_s]
#
# Flags:
#   -b            ativa os bots (padrão: desativado)
#   -c qtd_bots   quantidade de bots quando -b está ativo (padrão: 2)
#   -t duracao_s  duração dos bots em segundos, 0 = para sempre (padrão: 0)
#
# Ctrl+C encerra server, client e bots juntos.
#
set -uo pipefail

FRONT_PORT="5173"
BACK_PORT="2567"

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

# raiz do repo = um nível acima de script/
cd "$(dirname "$0")/.."

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
