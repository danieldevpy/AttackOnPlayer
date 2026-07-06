"""Settings de desenvolvimento — DEBUG ligado, defaults amigáveis."""
from .base import *  # noqa: F401,F403
from .base import env

DEBUG = env("DJANGO_DEBUG", default=True)

# CORS liberado no dev para o client Vite (a UI de login chega na T-028).
CORS_ALLOW_ALL_ORIGINS = True
