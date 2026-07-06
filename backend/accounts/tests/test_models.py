import pytest
from django.db import IntegrityError

from accounts.models import Account, GuestLink, PlayerStats

pytestmark = pytest.mark.django_db


def test_create_guest_has_unusable_password():
    account = Account.objects.create_guest(display_name="Ana")
    assert account.is_guest is True
    assert account.email is None
    assert account.has_usable_password() is False


def test_create_user_requires_email():
    with pytest.raises(ValueError):
        Account.objects.create_user(email=None, password="x")


def test_create_user_is_not_guest():
    account = Account.objects.create_user(email="a@b.com", password="secret123")
    assert account.is_guest is False
    assert account.check_password("secret123") is True


def test_create_superuser_sets_staff_and_superuser_flags():
    account = Account.objects.create_superuser(email="admin@aop.dev", password="secret123")
    assert account.is_staff is True
    assert account.is_superuser is True
    assert account.is_guest is False


def test_email_uniqueness_enforced():
    Account.objects.create_user(email="dup@aop.dev", password="secret123")
    with pytest.raises(IntegrityError):
        Account.objects.create_user(email="dup@aop.dev", password="secret123")


def test_player_stats_defaults_and_one_to_one():
    account = Account.objects.create_guest()
    stats = PlayerStats.objects.create(account=account)
    assert stats.kills == 0
    assert stats.deaths == 0
    assert stats.matches_played == 0
    assert stats.xp_total == 0
    assert account.stats == stats


def test_player_stats_one_per_account():
    account = Account.objects.create_guest()
    PlayerStats.objects.create(account=account)
    with pytest.raises(IntegrityError):
        PlayerStats.objects.create(account=account)


def test_guest_link_maps_token_to_account():
    account = Account.objects.create_guest()
    link = GuestLink.objects.create(player_token="tok-123", account=account)
    assert link.account_id == account.id
    assert GuestLink.objects.get(player_token="tok-123").account == account


def test_guest_link_token_is_unique():
    account = Account.objects.create_guest()
    GuestLink.objects.create(player_token="tok-dup", account=account)
    other = Account.objects.create_guest()
    with pytest.raises(IntegrityError):
        GuestLink.objects.create(player_token="tok-dup", account=other)
