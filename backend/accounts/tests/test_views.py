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


def test_stats_me_requires_authentication():
    response = APIClient().get("/api/v1/stats/me")
    assert response.status_code == 401


def test_stats_me_returns_own_stats():
    account = Account.objects.create_user(email="stats@aop.dev", password="secret123")
    PlayerStats.objects.create(account=account, kills=4, deaths=1, matches_played=2, xp_total=50)

    response = APIClient().get("/api/v1/stats/me", **auth_header(account))
    assert response.status_code == 200
    assert response.json() == {"kills": 4, "deaths": 1, "matches_played": 2, "xp_total": 50}


def test_player_settings_requires_authentication():
    response = APIClient().get("/api/v1/accounts/settings")
    assert response.status_code == 401


def test_player_settings_get_creates_defaults_lazily():
    account = Account.objects.create_user(
        email="settings@aop.dev", password="secret123", display_name="settings"
    )
    response = APIClient().get("/api/v1/accounts/settings", **auth_header(account))
    assert response.status_code == 200
    assert response.json() == {
        "control_profile": "",
        "volume_master": 1.0,
        "volume_sfx": 1.0,
        "fullscreen_pref": True,
        "display_name": "settings",
    }


def test_player_settings_put_updates_prefs_and_nick():
    account = Account.objects.create_user(email="prefs@aop.dev", password="secret123")
    response = APIClient().put(
        "/api/v1/accounts/settings",
        {"control_profile": "touch", "volume_master": 0.4, "display_name": "NovoNick"},
        format="json",
        **auth_header(account),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["control_profile"] == "touch"
    assert body["volume_master"] == 0.4
    assert body["volume_sfx"] == 1.0  # não enviado, mantém default
    assert body["display_name"] == "NovoNick"


def test_player_settings_put_rejects_out_of_range_volume():
    account = Account.objects.create_user(email="vol@aop.dev", password="secret123")
    response = APIClient().put(
        "/api/v1/accounts/settings", {"volume_master": 2.0}, format="json", **auth_header(account)
    )
    assert response.status_code == 400


def test_player_settings_put_malicious_nick_keeps_current_name():
    account = Account.objects.create_user(
        email="malnick@aop.dev", password="secret123", display_name="Original"
    )
    response = APIClient().put(
        "/api/v1/accounts/settings",
        {"display_name": "<script>x</script>"},
        format="json",
        **auth_header(account),
    )
    assert response.status_code == 200
    assert response.json()["display_name"] == "Original"


def test_ranking_is_public_ordered_by_kills_and_paginated():
    for i, kills in enumerate([10, 30, 20]):
        account = Account.objects.create_guest(display_name=f"player{i}")
        PlayerStats.objects.create(account=account, kills=kills)

    response = APIClient().get("/api/v1/ranking?page_size=2")
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 3
    assert [row["kills"] for row in body["results"]] == [30, 20]
    assert body["results"][0]["display_name"] == "player1"
