import pytest
from django.test import override_settings
from rest_framework.test import APIClient

from accounts.models import Account, GuestLink, PlayerStats
from telemetry.models import TelemetryEvent

pytestmark = pytest.mark.django_db

KILL_EVENT = {
    "v": 1,
    "ts": 1000,
    "tick": 42,
    "matchId": "room-1",
    "mapId": "arena-teste",
    "type": "kill",
    "killerToken": "tok-a",
    "victimToken": "tok-b",
}

UPGRADE_EVENT = {
    "v": 1,
    "ts": 1001,
    "tick": 43,
    "matchId": "room-1",
    "type": "upgrade_choice",
    "playerToken": "tok-a",
    "level": 2,
    "chosenCardId": "card-x",
    "declinedCardIds": ["card-y"],
    "autoPick": False,
}


def _service_client():
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION="ServiceToken svc-token")
    return client


def test_batch_requires_service_token():
    response = APIClient().post("/api/v1/telemetry/batch/", {"events": [KILL_EVENT]}, format="json")
    assert response.status_code == 401


@override_settings(SERVICE_TOKEN="svc-token")
def test_batch_ingests_events_and_indexes_fields():
    response = _service_client().post(
        "/api/v1/telemetry/batch/", {"events": [KILL_EVENT, UPGRADE_EVENT]}, format="json"
    )
    assert response.status_code == 201
    assert response.json() == {"ingested": 2}
    assert TelemetryEvent.objects.count() == 2

    kill_row = TelemetryEvent.objects.get(type="kill")
    assert kill_row.match_id == "room-1"
    assert kill_row.map_id == "arena-teste"
    assert kill_row.player_token is None  # kill não tem playerToken único — fica só no payload
    assert kill_row.payload == KILL_EVENT

    upgrade_row = TelemetryEvent.objects.get(type="upgrade_choice")
    assert upgrade_row.player_token == "tok-a"


@override_settings(SERVICE_TOKEN="svc-token")
def test_batch_rejects_wrong_schema_version_and_ingests_nothing():
    bad = {**KILL_EVENT, "v": 2}
    response = _service_client().post("/api/v1/telemetry/batch/", {"events": [bad]}, format="json")
    assert response.status_code == 400
    assert TelemetryEvent.objects.count() == 0


@override_settings(SERVICE_TOKEN="svc-token")
def test_batch_rejects_missing_events_key():
    response = _service_client().post("/api/v1/telemetry/batch/", {}, format="json")
    assert response.status_code == 400
    assert TelemetryEvent.objects.count() == 0


@override_settings(SERVICE_TOKEN="svc-token")
def test_batch_of_kill_updates_playerstats_and_ranking(client=None):
    """T-060 fim a fim: exatamente o payload que o ArenaRoom real envia (killerToken/
    victimToken) — batch ingerido reflete em PlayerStats e no /api/v1/ranking."""
    killer = Account.objects.create_guest(display_name="killer")
    victim = Account.objects.create_guest(display_name="victim")
    PlayerStats.objects.create(account=killer)
    PlayerStats.objects.create(account=victim)
    GuestLink.objects.create(player_token="tok-a", account=killer)
    GuestLink.objects.create(player_token="tok-b", account=victim)

    response = _service_client().post(
        "/api/v1/telemetry/batch/", {"events": [KILL_EVENT]}, format="json"
    )
    assert response.status_code == 201

    assert PlayerStats.objects.get(account=killer).kills == 1
    assert PlayerStats.objects.get(account=victim).deaths == 1

    ranking = APIClient().get("/api/v1/ranking").json()
    assert ranking["results"][0]["display_name"] == "killer"
    assert ranking["results"][0]["kills"] == 1
