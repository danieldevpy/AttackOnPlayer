import datetime

import pytest
from django.utils import timezone

from gameops.models import GameEvent, RoomConfig, RoomConfigMapRotation, effective_config
from maps.models import MapEntry

pytestmark = pytest.mark.django_db

MAP_DATA_TEMPLATE = {
    "version": 1,
    "w": 15,
    "h": 13,
    "instances": [],
    "zones": [],
    "spawns": [{"x": 1.5, "z": 1.5}],
    "flag": {"x": 7.5, "z": 6.5},
}


def _make_map(map_id):
    data = {**MAP_DATA_TEMPLATE, "id": map_id, "name": map_id}
    return MapEntry.objects.create(id=map_id, name=map_id, w=15, h=13, data=data)


def test_migration_seeds_a_default_room_config():
    assert RoomConfig.objects.filter(is_default=True).exists()


def test_effective_config_uses_default_room_config_when_no_event_active():
    RoomConfig.objects.all().delete()
    RoomConfig.objects.create(
        name="base", is_default=True, flag_enabled=False, xp_multiplier=1.0,
        coin_multiplier=1.0, expected_players=6,
    )
    config = effective_config(at=timezone.now())
    assert config == {
        "flagEnabled": False,
        "xpMultiplier": 1.0,
        "coinMultiplier": 1.0,
        "expectedPlayers": 6,
        "mapRotation": [],
    }


def test_effective_config_orders_map_rotation():
    RoomConfig.objects.all().delete()
    base = RoomConfig.objects.create(name="base", is_default=True)
    m1, m2 = _make_map("m1"), _make_map("m2")
    RoomConfigMapRotation.objects.create(room_config=base, map_entry=m2, order=1)
    RoomConfigMapRotation.objects.create(room_config=base, map_entry=m1, order=0)

    config = effective_config()
    assert config["mapRotation"] == ["m1", "m2"]


def test_effective_config_applies_active_event_overrides():
    RoomConfig.objects.all().delete()
    RoomConfig.objects.create(
        name="base", is_default=True, xp_multiplier=1.0, coin_multiplier=1.0, flag_enabled=True
    )
    now = timezone.now()
    GameEvent.objects.create(
        name="XP x2 fim de semana",
        starts_at=now - datetime.timedelta(hours=1),
        ends_at=now + datetime.timedelta(hours=1),
        xp_multiplier=2.0,
        enabled=True,
    )

    config = effective_config(at=now)
    assert config["xpMultiplier"] == 2.0
    assert config["coinMultiplier"] == 1.0
    assert config["flagEnabled"] is True


def test_effective_config_ignores_event_outside_its_window():
    RoomConfig.objects.all().delete()
    RoomConfig.objects.create(name="base", is_default=True, xp_multiplier=1.0)
    now = timezone.now()
    GameEvent.objects.create(
        name="evento futuro",
        starts_at=now + datetime.timedelta(days=1),
        ends_at=now + datetime.timedelta(days=2),
        xp_multiplier=5.0,
        enabled=True,
    )

    config = effective_config(at=now)
    assert config["xpMultiplier"] == 1.0


def test_effective_config_ignores_disabled_event():
    RoomConfig.objects.all().delete()
    RoomConfig.objects.create(name="base", is_default=True, xp_multiplier=1.0)
    now = timezone.now()
    GameEvent.objects.create(
        name="desativado",
        starts_at=now - datetime.timedelta(hours=1),
        ends_at=now + datetime.timedelta(hours=1),
        xp_multiplier=5.0,
        enabled=False,
    )

    config = effective_config(at=now)
    assert config["xpMultiplier"] == 1.0


def test_effective_config_only_overrides_fields_the_event_sets():
    RoomConfig.objects.all().delete()
    RoomConfig.objects.create(
        name="base", is_default=True, xp_multiplier=1.0, coin_multiplier=1.0, flag_enabled=True
    )
    now = timezone.now()
    GameEvent.objects.create(
        name="só bandeira desligada",
        starts_at=now - datetime.timedelta(hours=1),
        ends_at=now + datetime.timedelta(hours=1),
        flag_enabled=False,
        enabled=True,
    )

    config = effective_config(at=now)
    assert config["flagEnabled"] is False
    assert config["xpMultiplier"] == 1.0
    assert config["coinMultiplier"] == 1.0
