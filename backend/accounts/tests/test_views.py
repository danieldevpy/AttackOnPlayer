import pytest
from rest_framework.test import APIClient

from accounts import jwt as jwt_lib
from accounts.models import Account, GuestLink, PlayerStats

pytestmark = pytest.mark.django_db


def auth_header(account):
    return {"HTTP_AUTHORIZATION": f"Bearer {jwt_lib.sign_account(account)}"}


def test_guest_login_creates_account_and_stats():
    response = APIClient().post("/api/v1/auth/guest", {"player_token": "tok-1"}, format="json")
    assert response.status_code == 200
    body = response.json()
    assert body["account"]["is_guest"] is True
    assert body["account"]["stats"] == {
        "kills": 0,
        "deaths": 0,
        "matches_played": 0,
        "xp_total": 0,
    }
    assert "token" in body
    assert GuestLink.objects.filter(player_token="tok-1").exists()


def test_guest_login_reuses_account_for_same_token():
    first = APIClient().post("/api/v1/auth/guest", {"player_token": "tok-2"}, format="json")
    second = APIClient().post("/api/v1/auth/guest", {"player_token": "tok-2"}, format="json")
    assert first.json()["account"]["id"] == second.json()["account"]["id"]
    assert Account.objects.filter(is_guest=True).count() == 1


def test_jwks_endpoint_is_public():
    response = APIClient().get("/api/v1/auth/jwks.json")
    assert response.status_code == 200
    assert response.json()["keys"][0]["kty"] == "RSA"


def test_me_requires_authentication():
    response = APIClient().get("/api/v1/auth/me")
    assert response.status_code == 401


def test_me_returns_authenticated_profile():
    account = Account.objects.create_user(email="p@aop.dev", password="secret123")
    response = APIClient().get("/api/v1/auth/me", **auth_header(account))
    assert response.status_code == 200
    assert response.json()["email"] == "p@aop.dev"


def test_link_transfers_stats_and_removes_guest_account():
    guest = Account.objects.create_guest()
    PlayerStats.objects.create(account=guest, kills=5, deaths=2, matches_played=1, xp_total=100)
    GuestLink.objects.create(player_token="tok-link", account=guest)

    real = Account.objects.create_user(email="real@aop.dev", password="secret123")
    PlayerStats.objects.create(account=real, kills=1, deaths=1, matches_played=1, xp_total=10)

    response = APIClient().post(
        "/api/v1/auth/link", {"player_token": "tok-link"}, format="json", **auth_header(real)
    )
    assert response.status_code == 200
    body = response.json()["stats"]
    assert body == {"kills": 6, "deaths": 3, "matches_played": 2, "xp_total": 110}
    assert not Account.objects.filter(pk=guest.pk).exists()


def test_link_requires_authenticated_account_not_guest():
    guest_caller = Account.objects.create_guest()
    other_guest = Account.objects.create_guest()
    GuestLink.objects.create(player_token="tok-x", account=other_guest)

    response = APIClient().post(
        "/api/v1/auth/link", {"player_token": "tok-x"}, format="json", **auth_header(guest_caller)
    )
    assert response.status_code == 400


def test_link_rejects_unknown_player_token():
    real = Account.objects.create_user(email="a@aop.dev", password="secret123")
    response = APIClient().post(
        "/api/v1/auth/link", {"player_token": "no-such-token"}, format="json", **auth_header(real)
    )
    assert response.status_code == 404


def test_link_rejects_self_token():
    real = Account.objects.create_user(email="b@aop.dev", password="secret123")
    GuestLink.objects.create(player_token="tok-self", account=real)

    response = APIClient().post(
        "/api/v1/auth/link", {"player_token": "tok-self"}, format="json", **auth_header(real)
    )
    assert response.status_code == 400
