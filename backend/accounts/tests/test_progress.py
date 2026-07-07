import pytest
from django.test import override_settings
from rest_framework.test import APIClient

from accounts.models import Account, PlayerStats

pytestmark = pytest.mark.django_db


def _service_client():
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION="ServiceToken svc-token")
    return client


def test_progress_requires_service_token():
    response = APIClient().post(
        "/api/v1/accounts/progress",
        {"account_id": "00000000-0000-0000-0000-000000000000"},
        format="json",
    )
    assert response.status_code == 401


@override_settings(SERVICE_TOKEN="svc-token")
def test_progress_increments_existing_stats():
    account = Account.objects.create_guest()
    PlayerStats.objects.create(account=account, forca=1, agilidade=1, vitalidade=1)

    response = _service_client().post(
        "/api/v1/accounts/progress",
        {"account_id": str(account.pk), "forca": 2, "agilidade": 2, "vitalidade": 2},
        format="json",
    )
    assert response.status_code == 200

    stats = PlayerStats.objects.get(account=account)
    assert (stats.forca, stats.agilidade, stats.vitalidade) == (3, 3, 3)


@override_settings(SERVICE_TOKEN="svc-token")
def test_progress_accumulates_across_multiple_calls():
    account = Account.objects.create_guest()
    PlayerStats.objects.create(account=account)

    for _ in range(3):
        _service_client().post(
            "/api/v1/accounts/progress",
            {"account_id": str(account.pk), "forca": 1, "agilidade": 1, "vitalidade": 1},
            format="json",
        )

    stats = PlayerStats.objects.get(account=account)
    assert (stats.forca, stats.agilidade, stats.vitalidade) == (3, 3, 3)


@override_settings(SERVICE_TOKEN="svc-token")
def test_progress_missing_stats_row_is_ignored_not_error():
    account = Account.objects.create_guest()
    # sem PlayerStats.objects.create — simula estado inconsistente, nunca deve derrubar a sala.
    response = _service_client().post(
        "/api/v1/accounts/progress",
        {"account_id": str(account.pk), "forca": 1},
        format="json",
    )
    assert response.status_code == 204


@override_settings(SERVICE_TOKEN="svc-token")
def test_progress_unknown_account_is_ignored_not_error():
    response = _service_client().post(
        "/api/v1/accounts/progress",
        {"account_id": "00000000-0000-0000-0000-000000000000", "forca": 1},
        format="json",
    )
    assert response.status_code == 204


@override_settings(SERVICE_TOKEN="svc-token")
def test_progress_rejects_negative_delta():
    account = Account.objects.create_guest()
    PlayerStats.objects.create(account=account)
    response = _service_client().post(
        "/api/v1/accounts/progress",
        {"account_id": str(account.pk), "forca": -1},
        format="json",
    )
    assert response.status_code == 400


@override_settings(SERVICE_TOKEN="svc-token")
def test_progress_defaults_missing_fields_to_zero():
    account = Account.objects.create_guest()
    PlayerStats.objects.create(account=account, forca=5)

    response = _service_client().post(
        "/api/v1/accounts/progress", {"account_id": str(account.pk)}, format="json"
    )
    assert response.status_code == 200

    stats = PlayerStats.objects.get(account=account)
    assert (stats.forca, stats.agilidade, stats.vitalidade) == (5, 0, 0)
