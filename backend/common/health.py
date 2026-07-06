"""/healthz — liveness + conectividade com o Postgres. Usado pelos scripts (T-030) e pelo
critério de aceite #3 da SPEC-0008 (derrubar o Django não pode derrubar o jogo)."""
from django.db import connection
from django.http import JsonResponse


def healthz(_request):
    db_ok = True
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception:  # noqa: BLE001 — health check reporta, não propaga
        db_ok = False
    return JsonResponse(
        {"ok": db_ok, "db": db_ok, "service": "aop-platform"},
        status=200 if db_ok else 503,
    )
