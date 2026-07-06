import copy
import json
from pathlib import Path

from django.conf import settings

from maps.validators import validate_map_file

REPO_MAPS_DIR = Path(settings.BASE_DIR).parent / "maps"

VALID = {
    "version": 1,
    "id": "arena-teste",
    "name": "Arena de teste",
    "w": 15,
    "h": 13,
    "instances": [{"objectId": "pedra", "x": 1, "z": 1}],
    "zones": [{"kind": "war", "cx": 7.5, "cz": 6.5, "radius": 4}],
    "spawns": [{"x": 1.5, "z": 1.5}, {"x": 13.5, "z": 1.5}],
    "flag": {"x": 7.5, "z": 6.5},
}


def test_valid_map_has_no_errors():
    assert validate_map_file(copy.deepcopy(VALID)) == []


def test_rejects_wrong_version():
    m = copy.deepcopy(VALID)
    m["version"] = 2
    errors = validate_map_file(m)
    assert any("versão" in e for e in errors)


def test_rejects_tiny_dimensions():
    m = copy.deepcopy(VALID)
    m["w"] = 2
    errors = validate_map_file(m)
    assert any("dimensões" in e for e in errors)


def test_rejects_missing_spawns():
    m = copy.deepcopy(VALID)
    m["spawns"] = []
    errors = validate_map_file(m)
    assert any("spawn" in e for e in errors)


def test_rejects_unknown_object_id():
    m = copy.deepcopy(VALID)
    m["instances"] = [{"objectId": "trono-do-rei", "x": 1, "z": 1}]
    errors = validate_map_file(m)
    assert any("objectId desconhecido" in e for e in errors)


def test_rejects_instance_out_of_bounds():
    m = copy.deepcopy(VALID)
    m["instances"] = [{"objectId": "pedra", "x": 999, "z": 1}]
    errors = validate_map_file(m)
    assert any("instância 0: fora dos limites" in e for e in errors)


def test_rejects_spawn_out_of_bounds():
    m = copy.deepcopy(VALID)
    m["spawns"] = [{"x": -1, "z": 1}]
    errors = validate_map_file(m)
    assert any("spawn 0: fora dos limites" in e for e in errors)


def test_rejects_missing_flag():
    m = copy.deepcopy(VALID)
    del m["flag"]
    errors = validate_map_file(m)
    assert any("bandeira" in e for e in errors)


def test_rejects_flag_out_of_bounds():
    m = copy.deepcopy(VALID)
    m["flag"] = {"x": 999, "z": 999}
    errors = validate_map_file(m)
    assert any("bandeira fora dos limites" in e for e in errors)


def test_accumulates_multiple_errors():
    m = copy.deepcopy(VALID)
    m["version"] = 9
    m["spawns"] = []
    errors = validate_map_file(m)
    assert len(errors) == 2


def test_real_curated_maps_are_valid():
    """Mesma fixture usada pelo lado TS (`packages/shared/src/mapFile.ts`) — mitiga a
    duplicação de validação (risco anotado no plano da T-027)."""
    files = sorted(REPO_MAPS_DIR.glob("*.map.json"))
    assert len(files) >= 2, f"esperava os mapas curados em {REPO_MAPS_DIR}"
    for path in files:
        data = json.loads(path.read_text())
        assert validate_map_file(data) == [], f"{path.name} deveria ser válido"
