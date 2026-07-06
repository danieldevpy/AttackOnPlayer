import jwt as pyjwt
import pytest
from django.test import override_settings
from jwt.algorithms import RSAAlgorithm

from accounts import jwt as jwt_lib
from accounts.models import Account

pytestmark = pytest.mark.django_db


def _make_account():
    return Account.objects.create_guest(display_name="Bea")


def test_sign_and_decode_roundtrip():
    account = _make_account()
    token = jwt_lib.sign_account(account)
    claims = jwt_lib.decode_token(token)
    assert claims["sub"] == str(account.id)
    assert claims["is_guest"] is True
    assert claims["display_name"] == "Bea"
    assert claims["iss"] == "aop-platform"


def test_decode_rejects_tampered_signature():
    account = _make_account()
    token = jwt_lib.sign_account(account)
    tampered = token[:-2] + ("aa" if not token.endswith("aa") else "bb")
    with pytest.raises(jwt_lib.InvalidToken):
        jwt_lib.decode_token(tampered)


@override_settings(JWT_TTL_SECONDS=-1)
def test_decode_rejects_expired_token():
    account = _make_account()
    token = jwt_lib.sign_account(account)
    with pytest.raises(jwt_lib.InvalidToken):
        jwt_lib.decode_token(token)


def test_jwks_format():
    keyset = jwt_lib.jwks()
    assert list(keyset.keys()) == ["keys"]
    assert len(keyset["keys"]) == 1
    key = keyset["keys"][0]
    assert key["kty"] == "RSA"
    assert key["alg"] == "RS256"
    assert key["use"] == "sig"
    assert key["kid"]
    assert "n" in key and "e" in key


def test_jwks_public_key_actually_verifies_signed_tokens():
    """A chave publicada no JWKS precisa ser a mesma que verifica os tokens emitidos —
    reconstrói a chave a partir do JWKS (como o Colyseus faria) em vez de reusar decode_token."""
    account = _make_account()
    token = jwt_lib.sign_account(account)

    key = jwt_lib.jwks()["keys"][0]
    public_key = RSAAlgorithm.from_jwk(key)
    claims = pyjwt.decode(token, public_key, algorithms=["RS256"], issuer="aop-platform")
    assert claims["sub"] == str(account.id)
