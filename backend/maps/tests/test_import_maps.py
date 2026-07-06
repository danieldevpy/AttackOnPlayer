import json

import pytest
from django.core.management import call_command

from maps.models import MapEntry

pytestmark = pytest.mark.django_db

VALID_MAP = {
    "version": 1,
    "id": "cmd-test",
    "name": "Cmd Test",
    "author": "CD",
    "w": 15,
    "h": 13,
    "seed": 42,
    "instances": [{"objectId": "pedra", "x": 1, "z": 1}],
    "zones": [],
    "spawns": [{"x": 1.5, "z": 1.5}],
    "flag": {"x": 7.5, "z": 6.5},
}

INVALID_MAP = {**VALID_MAP, "id": "cmd-test-bad", "spawns": []}


def _write(tmp_path, filename, payload):
    (tmp_path / filename).write_text(json.dumps(payload))


def test_import_maps_creates_entries(tmp_path):
    _write(tmp_path, "cmd-test.map.json", VALID_MAP)
    call_command("import_maps", dir=str(tmp_path))

    entry = MapEntry.objects.get(pk="cmd-test")
    assert entry.name == "Cmd Test"
    assert entry.w == 15
    assert entry.h == 13
    assert entry.seed == 42
    assert entry.data == VALID_MAP


def test_import_maps_is_idempotent_via_update_or_create(tmp_path):
    _write(tmp_path, "cmd-test.map.json", VALID_MAP)
    call_command("import_maps", dir=str(tmp_path))
    call_command("import_maps", dir=str(tmp_path))
    assert MapEntry.objects.filter(pk="cmd-test").count() == 1


def test_import_maps_skips_invalid_map(tmp_path):
    _write(tmp_path, "cmd-test-bad.map.json", INVALID_MAP)
    call_command("import_maps", dir=str(tmp_path))
    assert not MapEntry.objects.filter(pk="cmd-test-bad").exists()


def test_import_maps_real_fixtures_load_the_two_curated_maps():
    """Gate da T-027d: `import_maps` sem --dir carrega os mapas reais de `maps/`."""
    call_command("import_maps")
    ids = set(MapEntry.objects.values_list("id", flat=True))
    assert {"arena-teste", "arena-live-capture"}.issubset(ids)
