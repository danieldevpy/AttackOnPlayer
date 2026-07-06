"""
JWT RS256 (T-027c). Emite/verifica tokens de conta. A chave pública é exposta via
`/api/v1/auth/jwks.json` para o Colyseus validar o token localmente, sem round-trip por join
(SPEC-0008) — a verificação em si no Node fica para a T-028.
"""
import time

import jwt
from cryptography.hazmat.primitives import serialization
from django.conf import settings
from jwt.algorithms import RSAAlgorithm

ALGORITHM = "RS256"
KEY_ID = "aop-platform-1"


class InvalidToken(Exception):
    pass


def _read_private_key():
    with open(settings.JWT_PRIVATE_KEY_PATH, "rb") as fh:
        return serialization.load_pem_private_key(fh.read(), password=None)


def _read_public_key():
    with open(settings.JWT_PUBLIC_KEY_PATH, "rb") as fh:
        return serialization.load_pem_public_key(fh.read())


def sign_account(account):
    """Claims: sub, is_guest, display_name, iat, exp (contrato da SPEC-0008)."""
    now = int(time.time())
    payload = {
        "sub": str(account.id),
        "is_guest": account.is_guest,
        "display_name": account.display_name,
        "iss": settings.JWT_ISSUER,
        "iat": now,
        "exp": now + settings.JWT_TTL_SECONDS,
    }
    return jwt.encode(
        payload, _read_private_key(), algorithm=ALGORITHM, headers={"kid": KEY_ID}
    )


def decode_token(token):
    try:
        return jwt.decode(
            token,
            _read_public_key(),
            algorithms=[ALGORITHM],
            issuer=settings.JWT_ISSUER,
        )
    except jwt.PyJWTError as exc:
        raise InvalidToken(str(exc)) from exc


def jwks():
    jwk = RSAAlgorithm.to_jwk(_read_public_key(), as_dict=True)
    jwk.update({"kid": KEY_ID, "use": "sig", "alg": ALGORITHM})
    return {"keys": [jwk]}
