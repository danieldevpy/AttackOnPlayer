from telemetry.validators import validate_batch

KILL_EVENT = {
    "v": 1,
    "ts": 1000,
    "tick": 42,
    "matchId": "room-1",
    "type": "kill",
    "killerToken": "tok-a",
    "victimToken": "tok-b",
}


def test_valid_batch_has_no_errors():
    assert validate_batch([KILL_EVENT]) == []


def test_rejects_empty_batch():
    assert validate_batch([]) != []
    assert validate_batch(None) != []


def test_rejects_non_list_batch():
    assert validate_batch({"not": "a list"}) != []


def test_rejects_non_dict_event():
    errors = validate_batch(["not-a-dict"])
    assert any("não é um objeto" in e for e in errors)


def test_rejects_missing_required_field():
    bad = {k: v for k, v in KILL_EVENT.items() if k != "matchId"}
    errors = validate_batch([bad])
    assert any("matchId" in e for e in errors)


def test_rejects_wrong_schema_version():
    bad = {**KILL_EVENT, "v": 2}
    errors = validate_batch([bad])
    assert any("schema version não suportada" in e for e in errors)


def test_reports_errors_for_every_bad_event_in_batch():
    bad1 = {**KILL_EVENT, "v": 2}
    bad2 = {k: v for k, v in KILL_EVENT.items() if k != "tick"}
    errors = validate_batch([bad1, bad2])
    assert any("evento 0" in e for e in errors)
    assert any("evento 1" in e for e in errors)
