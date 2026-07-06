"""Endpoints de maps (SPEC-0008). Auth via service token — herda os defaults do
REST_FRAMEWORK (fronteira ADR-016, ver settings/base.py)."""
from rest_framework.decorators import api_view
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

from .models import MapEntry
from .serializers import MapEntrySummarySerializer


@api_view(["GET"])
def list_maps(_request):
    entries = MapEntry.objects.filter(is_active=True)
    return Response(MapEntrySummarySerializer(entries, many=True).data)


@api_view(["GET"])
def map_detail(_request, map_id):
    """Retorna o `MapFileV1` idêntico ao arquivo original — o Colyseus carrega direto."""
    try:
        entry = MapEntry.objects.get(pk=map_id, is_active=True)
    except MapEntry.DoesNotExist as exc:
        raise NotFound("mapa não encontrado") from exc
    return Response(entry.data)
