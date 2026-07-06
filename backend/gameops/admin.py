from django.contrib import admin

from .models import GameEvent, RoomConfig, RoomConfigMapRotation


class RoomConfigMapRotationInline(admin.TabularInline):
    model = RoomConfigMapRotation
    extra = 1
    ordering = ("order",)


@admin.register(RoomConfig)
class RoomConfigAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "is_default",
        "flag_enabled",
        "xp_multiplier",
        "coin_multiplier",
        "expected_players",
    )
    list_filter = ("is_default", "flag_enabled")
    search_fields = ("name",)
    inlines = [RoomConfigMapRotationInline]


@admin.register(GameEvent)
class GameEventAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "starts_at",
        "ends_at",
        "enabled",
        "xp_multiplier",
        "coin_multiplier",
        "flag_enabled",
    )
    list_filter = ("enabled",)
    search_fields = ("name",)
    ordering = ("-starts_at",)
