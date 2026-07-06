"""Autenticação de conta via JWT (`Authorization: Bearer <token>`). Distinta do service token
(fronteira Node<->Django, ver `common.authentication`) — esta é para o dono da conta."""
from rest_framework import authentication, exceptions

from . import jwt as jwt_lib
from .models import Account

KEYWORD = "Bearer"


class JWTAuthentication(authentication.BaseAuthentication):
    def authenticate(self, request):
        token = self._extract_token(request)
        if not token:
            return None

        try:
            claims = jwt_lib.decode_token(token)
        except jwt_lib.InvalidToken as exc:
            raise exceptions.AuthenticationFailed(str(exc)) from exc

        try:
            account = Account.objects.get(pk=claims["sub"])
        except (Account.DoesNotExist, ValueError, KeyError) as exc:
            raise exceptions.AuthenticationFailed("conta do token não existe") from exc

        return (account, token)

    @staticmethod
    def _extract_token(request):
        header = request.headers.get("Authorization", "")
        if header.startswith(KEYWORD + " "):
            return header[len(KEYWORD) + 1 :].strip()
        return None

    def authenticate_header(self, request):
        return KEYWORD
