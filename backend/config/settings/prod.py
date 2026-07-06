"""Settings de produção — hardening básico. Endurecimento completo é T-031."""
from .base import *  # noqa: F401,F403
from .base import env

DEBUG = False

# Em prod, faltar SERVICE_TOKEN ou SECRET_KEY é erro de deploy — não silenciar.
if not SERVICE_TOKEN:  # noqa: F405
    raise RuntimeError("SERVICE_TOKEN não configurado em produção (ADR-016).")

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_CONTENT_TYPE_NOSNIFF = True

CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")
