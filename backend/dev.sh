#!/usr/bin/env bash
# Sobe o backend Django em modo desenvolvimento (T-027 / SPEC-0008 / ADR-016).
# Idempotente: só cria venv/.env/chaves JWT/instala deps na primeira vez; nas próximas
# execuções só reaplica migrations e sobe o runserver. Uso: ./dev.sh (a partir de backend/).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

if [ ! -d .venv ]; then
  echo "==> criando venv"
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate

echo "==> instalando dependências (requirements-dev.txt)"
pip install -q -r requirements-dev.txt

if [ ! -f .env ]; then
  echo "==> criando .env a partir de .env.example"
  cp .env.example .env
fi

if [ ! -f secrets/jwt_private.pem ]; then
  echo "==> gerando par de chaves JWT (RS256, dev only — nunca commitado)"
  mkdir -p secrets
  openssl genpkey -algorithm RSA -out secrets/jwt_private.pem -pkeyopt rsa_keygen_bits:2048
  openssl rsa -in secrets/jwt_private.pem -pubout -out secrets/jwt_public.pem
fi

echo "==> subindo Postgres (docker compose)"
docker compose up -d db

echo "==> aguardando Postgres ficar healthy"
until [ "$(docker compose ps db --format '{{.Health}}' 2>/dev/null)" = "healthy" ]; do
  sleep 1
done

echo "==> aplicando migrations"
python manage.py migrate

PORT="${DJANGO_PORT:-8000}"
echo "==> runserver em 0.0.0.0:${PORT} (Ctrl+C para parar; o Postgres continua no ar)"
exec python manage.py runserver "0.0.0.0:${PORT}"
