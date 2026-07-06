"""Ingestão da telemetria por evento (SPEC-0008/T-027f), schema T-026. Colunas indexadas cobrem
os filtros mais comuns (por partida, por tipo); `payload` guarda o evento cru completo — nada se
perde mesmo para campos específicos de um `type` (ex.: `killerToken`/`victimToken` do kill)."""
from django.db import models


class TelemetryEvent(models.Model):
    match_id = models.CharField(max_length=64, db_index=True)
    type = models.CharField(max_length=32, db_index=True)
    player_token = models.CharField(max_length=64, null=True, blank=True, db_index=True)
    map_id = models.CharField(max_length=64, null=True, blank=True)
    ts = models.BigIntegerField(help_text="epoch ms — Date.now() no instante do evento (Node)")
    tick = models.PositiveIntegerField()
    payload = models.JSONField(help_text="evento cru completo, schema TELEMETRY_SCHEMA_VERSION")
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "telemetry_event"
        indexes = [models.Index(fields=["match_id", "type"])]
        ordering = ["match_id", "tick"]

    def __str__(self):
        return f"{self.match_id}#{self.tick} {self.type}"
