from django.contrib import admin

from .models import MapEntry


@admin.register(MapEntry)
class MapEntryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "w", "h", "is_active", "in_rotation", "updated_at")
    list_filter = ("is_active", "in_rotation")
    search_fields = ("id", "name", "author")
    readonly_fields = ("created_at", "updated_at")
    ordering = ("id",)
