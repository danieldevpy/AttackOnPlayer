"""Settings de teste — hasher rápido, service token fixo e par JWT efêmero."""
import tempfile

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from .base import *  # noqa: F401,F403

DEBUG = False

# Hasher rápido acelera testes que criam contas com senha.
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

# Valor determinístico; testes que exercitam o service token usam este ou override_settings.
SERVICE_TOKEN = "test-service-token"

# Par JWT efêmero: pytest não pode depender do par gerado à mão via openssl (README) —
# gerado uma vez por processo de teste e descartado com o diretório temporário.
_jwt_test_dir = tempfile.mkdtemp(prefix="aop-jwt-test-")
_jwt_test_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

JWT_PRIVATE_KEY_PATH = f"{_jwt_test_dir}/jwt_private.pem"
JWT_PUBLIC_KEY_PATH = f"{_jwt_test_dir}/jwt_public.pem"

with open(JWT_PRIVATE_KEY_PATH, "wb") as _fh:
    _fh.write(
        _jwt_test_private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )
with open(JWT_PUBLIC_KEY_PATH, "wb") as _fh:
    _fh.write(
        _jwt_test_private_key.public_key().public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
    )
