"""Settings de teste — hasher rápido e service token fixo para os testes de auth."""
from .base import *  # noqa: F401,F403

DEBUG = False

# Hasher rápido acelera testes que criam contas com senha.
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

# Valor determinístico; testes que exercitam o service token usam este ou override_settings.
SERVICE_TOKEN = "test-service-token"
