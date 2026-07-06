"""Validação do batch de ingestão — espelha o schema de
`packages/server/src/telemetry/events.ts` (T-026): cada evento tem `v`/`ts`/`tick`/`matchId`/`type`
na base, mais campos específicos por `type` que aqui viajam intactos em `payload`."""

TELEMETRY_SCHEMA_VERSION = 1
REQUIRED_BASE_FIELDS = ("v", "ts", "tick", "matchId", "type")


def validate_event(event: dict) -> list[str]:
    errors = []
    for field in REQUIRED_BASE_FIELDS:
        if field not in event:
            errors.append(f"campo obrigatório ausente: {field}")
    if "v" in event and event["v"] != TELEMETRY_SCHEMA_VERSION:
        errors.append(f"schema version não suportada: {event['v']}")
    return errors


def validate_batch(events) -> list[str]:
    """Lista de erros (com índice do evento) — vazia = batch válido. Rejeita o batch inteiro se
    qualquer evento estiver malformado (ingestão é tudo-ou-nada, ver views.ingest_batch)."""
    if not isinstance(events, list) or not events:
        return ["batch vazio ou inválido — esperado uma lista de eventos em `events`"]

    errors = []
    for i, event in enumerate(events):
        if not isinstance(event, dict):
            errors.append(f"evento {i}: não é um objeto")
            continue
        errors.extend(f"evento {i}: {e}" for e in validate_event(event))
    return errors
