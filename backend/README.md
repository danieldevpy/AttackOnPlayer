# backend/ — Plataforma Django (SPEC-0008 / ADR-016)

Serviço de **plataforma** do AttackOnPlayer: contas/auth, registry de mapas, gameops (config de
rooms/eventos sem deploy) e ingestão de telemetria. **Não** roda gameplay em tempo real — isso é
100% do game server Node/Colyseus (`packages/server`), que consome esta plataforma via REST com
service token e **degrada graciosamente** se ela cair (ADR-016).

## Stack
Django 5.1 · DRF · Postgres 16 · PyJWT (RS256) · pip + venv.

## Subir do zero (dev)

```bash
cd backend
./dev.sh
```

Idempotente: na primeira vez cria a venv, instala `requirements-dev.txt`, copia `.env.example`
para `.env` e gera o par de chaves JWT (`secrets/`); nas próximas só sobe o Postgres, aplica
migrations e o `runserver` em `0.0.0.0:${DJANGO_PORT:-8000}`. Superuser ainda é manual
(`python manage.py createsuperuser`, com a venv ativa) — sanidade: `curl -s localhost:8000/healthz`
→ `{"ok": true, ...}`.

Passo a passo equivalente, caso prefira rodar na mão:

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env            # ajuste segredos locais
docker compose up -d db         # Postgres em localhost:5432
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 0.0.0.0:8000
```

## Chaves JWT (RS256) — T-027c

As chaves **não são commitadas** (`secrets/` e `*.pem` estão no `.gitignore`). `./dev.sh` gera o
par automaticamente se `secrets/jwt_private.pem` não existir. Para gerar na mão:

```bash
mkdir -p backend/secrets
openssl genpkey -algorithm RSA -out backend/secrets/jwt_private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -in backend/secrets/jwt_private.pem -pubout -out backend/secrets/jwt_public.pem
```

Os caminhos vêm de `JWT_PRIVATE_KEY_PATH` / `JWT_PUBLIC_KEY_PATH` no `.env`. A chave pública é
exposta em `/api/v1/auth/jwks.json` para o Colyseus verificar o JWT sem chamar o Django por join.

## Testes / gates

```bash
docker compose up -d db                              # banco de teste no ar
python -m pytest                                     # todos os apps (Postgres)
python manage.py makemigrations --check --dry-run    # sem migration faltando
ruff check .                                          # lint
```

## Fronteira (ADR-016)
- Node **nunca** toca o Postgres — só REST.
- Django **nunca** decide gameplay em tempo real.
- Conta **nunca** concede poder in-round (só identidade/estatística/mapas).
- Nenhum segredo no repo; tudo em `.env` (ver `.env.example`).

## Rotas
Ver `config/urls.py`. Endpoints da API sob `/api/v1/`; ativados por sub-task (T-027c..f).
