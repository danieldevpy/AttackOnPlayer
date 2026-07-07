import pytest
from rest_framework.test import APIClient

from accounts.models import Account

pytestmark = pytest.mark.django_db

STRONG_PASSWORD = "Xk9m Pq2v L7zR".replace(" ", "")


def test_register_creates_account_with_stats_and_token():
    response = APIClient().post(
        "/api/v1/auth/register",
        {"email": "nova@aop.dev", "password": STRONG_PASSWORD, "display_name": "Nova"},
        format="json",
    )
    assert response.status_code == 201
    body = response.json()
    assert body["account"]["is_guest"] is False
    assert body["account"]["email"] == "nova@aop.dev"
    assert body["account"]["display_name"] == "Nova"
    assert body["account"]["stats"] == {
        "kills": 0,
        "deaths": 0,
        "matches_played": 0,
        "xp_total": 0,
        "forca": 0,
        "agilidade": 0,
        "vitalidade": 0,
    }
    assert "token" in body
    account = Account.objects.get(email="nova@aop.dev")
    assert account.check_password(STRONG_PASSWORD)


def test_register_defaults_display_name_from_email():
    response = APIClient().post(
        "/api/v1/auth/register",
        {"email": "semnome@aop.dev", "password": STRONG_PASSWORD},
        format="json",
    )
    assert response.status_code == 201
    assert response.json()["account"]["display_name"] == "semnome"


def test_register_sanitizes_malicious_display_name_to_email_prefix():
    response = APIClient().post(
        "/api/v1/auth/register",
        {
            "email": "malicioso@aop.dev",
            "password": STRONG_PASSWORD,
            "display_name": "<script>alert(1)</script>",
        },
        format="json",
    )
    assert response.status_code == 201
    assert response.json()["account"]["display_name"] == "malicioso"


def test_register_rejects_duplicate_email():
    Account.objects.create_user(email="dup@aop.dev", password=STRONG_PASSWORD)
    response = APIClient().post(
        "/api/v1/auth/register",
        {"email": "dup@aop.dev", "password": STRONG_PASSWORD},
        format="json",
    )
    assert response.status_code == 400


def test_register_rejects_weak_password():
    response = APIClient().post(
        "/api/v1/auth/register",
        {"email": "fraca@aop.dev", "password": "12345678"},
        format="json",
    )
    assert response.status_code == 400


def test_login_returns_token_for_valid_credentials():
    Account.objects.create_user(email="login@aop.dev", password=STRONG_PASSWORD)
    response = APIClient().post(
        "/api/v1/auth/login",
        {"email": "login@aop.dev", "password": STRONG_PASSWORD},
        format="json",
    )
    assert response.status_code == 200
    body = response.json()
    assert body["account"]["email"] == "login@aop.dev"
    assert "token" in body


def test_login_rejects_wrong_password():
    Account.objects.create_user(email="errada@aop.dev", password=STRONG_PASSWORD)
    response = APIClient().post(
        "/api/v1/auth/login",
        {"email": "errada@aop.dev", "password": "outra-senha-123"},
        format="json",
    )
    assert response.status_code == 401


def test_login_rejects_unknown_email():
    response = APIClient().post(
        "/api/v1/auth/login",
        {"email": "ninguem@aop.dev", "password": STRONG_PASSWORD},
        format="json",
    )
    assert response.status_code == 401


def test_login_rejects_guest_accounts():
    guest = Account.objects.create_guest()
    guest.email = "guest-email@aop.dev"
    guest.set_password(STRONG_PASSWORD)
    guest.save()
    response = APIClient().post(
        "/api/v1/auth/login",
        {"email": "guest-email@aop.dev", "password": STRONG_PASSWORD},
        format="json",
    )
    assert response.status_code == 401
