"""Endpoint mínimo protegido por service token — serve de liveness autenticado e de fixture para
os testes da fronteira (ADR-016). Herda os defaults de auth/permission do REST_FRAMEWORK."""
from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(["GET"])
def ping(_request):
    return Response({"pong": True})
