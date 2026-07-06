import pytest
from django.core.exceptions import ValidationError

from maps.models import MapEntry

pytestmark = pytest.mark.django_db

VALID_DATA = {
    "version": 1,
    "id": "test-map",
    "name": "Test Map",
    "w": 15,
    "h": 13,
    "instances": [],
    "zones": [],
    "spawns": [{"x": 1.5, "z": 1.5}],
    "flag": {"x": 7.5, "z": 6.5},
}


def test_full_clean_accepts_valid_map_data():
    entry = MapEntry(id="test-map", name="Test Map", w=15, h=13, data=VALID_DATA)
    entry.full_clean()


def test_full_clean_rejects_invalid_map_data():
    bad = {**VALID_DATA, "spawns": []}
    entry = MapEntry(id="test-map", name="Test Map", w=15, h=13, data=bad)
    with pytest.raises(ValidationError):
        entry.full_clean()


def test_str_includes_dimensions():
    entry = MapEntry.objects.create(id="test-map", name="Test Map", w=15, h=13, data=VALID_DATA)
    assert "15x13" in str(entry)
