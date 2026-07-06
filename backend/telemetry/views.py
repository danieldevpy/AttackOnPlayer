"""Endpoint de ingestão de telemetria (SPEC-0008). Auth via service token — herda os defaults
do REST_FRAMEWORK (fronteira ADR-016, ver settings/base.py)."""
from django.db import transaction
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import TelemetryEvent
from .validators import validate_batch


@api_view(["POST"])
def ingest_batch(request):
    events = request.data.get("events")
    errors = validate_batch(events)
    if errors:
        return Response({"detail": "batch inválido", "errors": errors}, status=400)

    with transaction.atomic():
        TelemetryEvent.objects.bulk_create(
            TelemetryEvent(
                match_id=event["matchId"],
                type=event["type"],
                player_token=event.get("playerToken"),
                map_id=event.get("mapId"),
                ts=event["ts"],
                tick=event["tick"],
                payload=event,
            )
            for event in events
        )

    return Response({"ingested": len(events)}, status=201)
