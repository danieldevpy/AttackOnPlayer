import pytest
from django.test import override_settings
from rest_framework.test import APIClient

from maps.models import MapEntry

pytestmark = pytest.mark.django_db

MAP_DATA = {
    "version": 1,
    "id": "view-test",
    "name": "View Test",
    "w": 15,
    "h": 13,
    "instances": [],
    "zones": [],
    "spawns": [{"x": 1.5, "z": 1.5}],
    "flag": {"x": 7.5, "z": 6.5},
}


def _make_entry(**overrides):
    defaults = {"id": "view-test", "name": "View Test", "w": 15, "h": 13, "data": MAP_DATA}
    defaults.update(overrides)
    return MapEntry.objects.create(**defaults)


def service_client():
    """Chame só de dentro de um teste com @override_settings(SERVICE_TOKEN="svc-token")."""
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION="ServiceToken svc-token")
    return client


@override_settings(SERVICE_TOKEN="svc-token")
def test_list_requires_service_token():
    _make_entry()
    response = APIClient().get("/api/v1/maps/")
    assert response.status_code == 401


@override_settings(SERVICE_TOKEN="svc-token")
def test_list_returns_only_active_maps():
    _make_entry()
    _make_entry(id="inactive-map", is_active=False)
    response = service_client().get("/api/v1/maps/")
    assert response.status_code == 200
    ids = {m["id"] for m in response.json()}
    assert ids == {"view-test"}


@override_settings(SERVICE_TOKEN="svc-token")
def test_detail_returns_data_identical_to_source():
    _make_entry()
    response = service_client().get("/api/v1/maps/view-test/")
    assert response.status_code == 200
    assert response.json() == MAP_DATA


@override_settings(SERVICE_TOKEN="svc-token")
def test_detail_404_for_unknown_id():
    response = service_client().get("/api/v1/maps/does-not-exist/")
    assert response.status_code == 404


@override_settings(SERVICE_TOKEN="svc-token")
def test_detail_404_for_inactive_map():
    _make_entry(is_active=False)
    response = service_client().get("/api/v1/maps/view-test/")
    assert response.status_code == 404
