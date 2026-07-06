from django.contrib import admin

from .models import TelemetryEvent


@admin.register(TelemetryEvent)
class TelemetryEventAdmin(admin.ModelAdmin):
    list_display = ("match_id", "type", "player_token", "tick", "ts", "received_at")
    list_filter = ("type", "match_id")
    search_fields = ("match_id", "player_token")
    readonly_fields = ("received_at",)
    ordering = ("-received_at",)
