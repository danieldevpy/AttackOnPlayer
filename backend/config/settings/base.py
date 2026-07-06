"""
Settings base do backend de plataforma (T-027 / SPEC-0008 / ADR-016).

Node/Colyseus NUNCA acessa o Postgres direto — só via REST com service token. Este projeto é a
PLATAFORMA (contas, mapas, gameops, telemetria). Configuração por env (django-environ); nada de
segredo commitado — ver `.env.example`.
"""
from pathlib import Path

import environ

# backend/config/settings/base.py -> backend/
BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(
    DJANGO_DEBUG=(bool, False),
    DJANGO_ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    CORS_ALLOWED_ORIGINS=(list, []),
    JWT_TTL_SECONDS=(int, 86400),
)

# .env local (dev). Em prod, as envs vêm do ambiente (gunicorn/compose) e este arquivo não existe.
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("DJANGO_SECRET_KEY", default="dev-insecure-secret-change-me")
DEBUG = env("DJANGO_DEBUG")
ALLOWED_HOSTS = env("DJANGO_ALLOWED_HOSTS")

# Fronteira Node <-> Django (ADR-016): segredo compartilhado do service token.
SERVICE_TOKEN = env("SERVICE_TOKEN", default="")

# JWT RS256 (T-027c). Caminhos das chaves PEM; geradas via openssl, nunca commitadas.
_SECRETS = BASE_DIR / "secrets"
JWT_PRIVATE_KEY_PATH = env("JWT_PRIVATE_KEY_PATH", default=str(_SECRETS / "jwt_private.pem"))
JWT_PUBLIC_KEY_PATH = env("JWT_PUBLIC_KEY_PATH", default=str(_SECRETS / "jwt_public.pem"))
JWT_ISSUER = env("JWT_ISSUER", default="aop-platform")
JWT_TTL_SECONDS = env("JWT_TTL_SECONDS")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # 3rd party
    "rest_framework",
    "corsheaders",
    # apps da plataforma (adicionados conforme as sub-tasks T-027b..f)
    "common",
    "accounts",
    "maps",
    "gameops",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# Postgres em dev/test/prod (ADR-016 / decisão CD). Ver backend/docker-compose.yml para o db local.
DATABASES = {
    "default": env.db(
        "DATABASE_URL",
        default="postgres://aop:aop@localhost:5432/aop_platform",
    ),
}

AUTH_USER_MODEL = "accounts.Account"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Secure-default: endpoints da plataforma exigem service token; endpoints de conta (accounts)
# sobrescrevem para AllowAny/JWT explicitamente.
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "common.authentication.ServiceTokenAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "common.permissions.IsServiceAccount",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "TEST_REQUEST_DEFAULT_FORMAT": "json",
    "UNAUTHENTICATED_USER": None,
}

CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")
