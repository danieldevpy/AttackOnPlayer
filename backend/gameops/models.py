"""Config de rooms/eventos sem deploy (SPEC-0008/T-027e). `RoomConfig` é a base; um `GameEvent`
ativo (por `starts_at`/`ends_at`) sobrescreve os multiplicadores/flag — ver `effective_config`."""
from django.db import models
from django.utils import timezone

from maps.models import MapEntry


class RoomConfig(models.Model):
    name = models.CharField(max_length=80, default="default")
    flag_enabled = models.BooleanField(default=True)
    xp_multiplier = models.FloatField(default=1.0)
    coin_multiplier = models.FloatField(default=1.0)
    expected_players = models.PositiveIntegerField(default=8)
    map_rotation = models.ManyToManyField(
        MapEntry, through="RoomConfigMapRotation", related_name="room_configs"
    )
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "gameops_room_config"

    def __str__(self):
        return self.name

    def ordered_map_ids(self):
        return list(
            self.rotation_entries.order_by("order").values_list("map_entry_id", flat=True)
        )


class RoomConfigMapRotation(models.Model):
    """Through explícito — a rotação de mapas é ordenada (`order`), diferente de um M2M solto."""

    room_config = models.ForeignKey(
        RoomConfig, on_delete=models.CASCADE, related_name="rotation_entries"
    )
    map_entry = models.ForeignKey(MapEntry, on_delete=models.CASCADE)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "gameops_room_config_map_rotation"
        ordering = ["order"]
        unique_together = [("room_config", "order")]

    def __str__(self):
        return f"{self.room_config_id}[{self.order}] = {self.map_entry_id}"


class GameEvent(models.Model):
    """Override temporário de `RoomConfig` — `null` num campo de override = não mexe naquele
    valor da config base (ex.: evento só de XP não precisa tocar `flag_enabled`)."""

    name = models.CharField(max_length=120)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    xp_multiplier = models.FloatField(null=True, blank=True)
    coin_multiplier = models.FloatField(null=True, blank=True)
    flag_enabled = models.BooleanField(null=True, blank=True)
    enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "gameops_game_event"
        ordering = ["-starts_at"]

    def is_active_at(self, at):
        return self.enabled and self.starts_at <= at <= self.ends_at

    def __str__(self):
        return self.name


def effective_config(at=None):
    """Config efetiva da próxima room = `RoomConfig` padrão + `GameEvent` ativo em `at`
    (aceite #2 da SPEC-0008 — evento sem deploy). Contrato de saída casa com
    `ArenaRoom.onCreate({ expectedPlayers, flagEnabled, mapId })`."""
    at = at or timezone.now()
    base = RoomConfig.objects.filter(is_default=True).first() or RoomConfig.objects.first()

    result = {
        "flagEnabled": base.flag_enabled if base else True,
        "xpMultiplier": base.xp_multiplier if base else 1.0,
        "coinMultiplier": base.coin_multiplier if base else 1.0,
        "expectedPlayers": base.expected_players if base else 8,
        "mapRotation": base.ordered_map_ids() if base else [],
    }

    active_event = (
        GameEvent.objects.filter(enabled=True, starts_at__lte=at, ends_at__gte=at)
        .order_by("-starts_at")
        .first()
    )
    if active_event:
        if active_event.xp_multiplier is not None:
            result["xpMultiplier"] = active_event.xp_multiplier
        if active_event.coin_multiplier is not None:
            result["coinMultiplier"] = active_event.coin_multiplier
        if active_event.flag_enabled is not None:
            result["flagEnabled"] = active_event.flag_enabled

    return result
