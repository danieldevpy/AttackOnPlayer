from rest_framework.permissions import BasePermission


class IsServiceAccount(BasePermission):
    """Libera só chamadas autenticadas por service token (ver common.authentication)."""

    message = "requer service token (fronteira ADR-016)"

    def has_permission(self, request, view):
        return getattr(request.user, "is_service", False)
