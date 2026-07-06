import pytest
from django.test import override_settings
from rest_framework.test import APIClient

from gameops.models import RoomConfig

pytestmark = pytest.mark.django_db


def test_config_requires_service_token():
    response = APIClient().get("/api/v1/gameops/config/")
    assert response.status_code == 401


@override_settings(SERVICE_TOKEN="svc-token")
def test_config_returns_effective_shape():
    RoomConfig.objects.all().delete()
    RoomConfig.objects.create(name="base", is_default=True)

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION="ServiceToken svc-token")
    response = client.get("/api/v1/gameops/config/")

    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {
        "flagEnabled",
        "xpMultiplier",
        "coinMultiplier",
        "mapRotation",
        "expectedPlayers",
    }
