"""
Service token para a fronteira Node <-> Django (ADR-016).

O game server (Colyseus) autentica em gameops/maps/telemetry com um segredo compartilhado, e não
com uma conta. Aceita `Authorization: ServiceToken <token>` ou `X-Service-Token: <token>`.
"""
from django.conf import settings
from django.utils.crypto import constant_time_compare
from rest_framework import authentication, exceptions

KEYWORD = "ServiceToken"


class ServiceAccount:
    """Principal sintético das chamadas por service token (não é um usuário Django)."""

    is_authenticated = True
    is_service = True

    def __str__(self):
        return "service"


class ServiceTokenAuthentication(authentication.BaseAuthentication):
    def authenticate(self, request):
        token = self._extract_token(request)
        if not token:
            return None  # deixa outros authenticators/permissões decidirem
        expected = getattr(settings, "SERVICE_TOKEN", "")
        if not expected or not constant_time_compare(token, expected):
            raise exceptions.AuthenticationFailed("service token inválido")
        return (ServiceAccount(), token)

    @staticmethod
    def _extract_token(request):
        header = request.headers.get("Authorization", "")
        if header.startswith(KEYWORD + " "):
            return header[len(KEYWORD) + 1 :].strip()
        return (request.headers.get("X-Service-Token") or "").strip() or None

    def authenticate_header(self, request):
        # Presença deste header faz o DRF responder 401 (e não 403) quando a auth falta.
        return KEYWORD
