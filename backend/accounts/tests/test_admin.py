import pytest

from accounts.admin import reset_nick
from accounts.models import Account

pytestmark = pytest.mark.django_db


def test_reset_nick_action_falls_back_guest_to_guest():
    account = Account.objects.create_guest(display_name="NickAbusivo")
    reset_nick(None, None, Account.objects.filter(pk=account.pk))
    account.refresh_from_db()
    assert account.display_name == "guest"


def test_reset_nick_action_falls_back_registered_account_to_email_prefix():
    account = Account.objects.create_user(
        email="staff-alvo@aop.dev", password="secret123", display_name="NickAbusivo"
    )
    reset_nick(None, None, Account.objects.filter(pk=account.pk))
    account.refresh_from_db()
    assert account.display_name == "staff-alvo"
