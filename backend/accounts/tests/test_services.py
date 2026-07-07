import pytest

from accounts.models import Account, GuestLink, PlayerStats
from accounts.services import apply_telemetry_stats

pytestmark = pytest.mark.django_db


def _linked_account(token, display_name="p"):
    account = Account.objects.create_guest(display_name=display_name)
    PlayerStats.objects.create(account=account)
    GuestLink.objects.create(player_token=token, account=account)
    return account


def test_kill_event_increments_killer_kills_and_victim_deaths():
    killer = _linked_account("tok-killer")
    victim = _linked_account("tok-victim")

    apply_telemetry_stats(
        [{"type": "kill", "killerToken": "tok-killer", "victimToken": "tok-victim"}]
    )

    assert PlayerStats.objects.get(account=killer).kills == 1
    assert PlayerStats.objects.get(account=victim).deaths == 1


def test_multiple_kills_accumulate():
    killer = _linked_account("tok-killer")
    _linked_account("tok-victim")

    apply_telemetry_stats(
        [
            {"type": "kill", "killerToken": "tok-killer", "victimToken": "tok-victim"},
            {"type": "kill", "killerToken": "tok-killer", "victimToken": "tok-victim"},
            {"type": "kill", "killerToken": "tok-killer", "victimToken": "tok-victim"},
        ]
    )

    assert PlayerStats.objects.get(account=killer).kills == 3


def test_quit_event_increments_matches_played():
    account = _linked_account("tok-quit")

    apply_telemetry_stats([{"type": "quit", "playerToken": "tok-quit", "reason": "disconnect"}])

    assert PlayerStats.objects.get(account=account).matches_played == 1


def test_unknown_token_is_ignored_without_raising():
    # bot sem conta (token default `bot_<sessionId>`) ou guest nunca registrado no Django.
    apply_telemetry_stats(
        [
            {"type": "kill", "killerToken": "bot_xyz", "victimToken": "bot_abc"},
            {"type": "quit", "playerToken": "bot_xyz"},
        ]
    )
    assert PlayerStats.objects.count() == 0


def test_other_event_types_are_ignored():
    account = _linked_account("tok-a")
    apply_telemetry_stats([{"type": "upgrade_choice", "playerToken": "tok-a"}])
    stats = PlayerStats.objects.get(account=account)
    assert stats.kills == 0 and stats.deaths == 0 and stats.matches_played == 0
