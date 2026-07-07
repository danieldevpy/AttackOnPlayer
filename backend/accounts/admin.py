from django.contrib import admin

from .models import Account, GuestLink, PlayerStats


class PlayerStatsInline(admin.StackedInline):
    model = PlayerStats
    can_delete = False
    extra = 0


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ("display_name", "email", "is_guest", "is_staff", "date_joined")
    list_filter = ("is_guest", "is_staff", "is_active")
    search_fields = ("display_name", "email", "id")
    readonly_fields = ("id", "date_joined", "last_login", "password")
    ordering = ("-date_joined",)
    inlines = [PlayerStatsInline]


@admin.register(GuestLink)
class GuestLinkAdmin(admin.ModelAdmin):
    list_display = ("player_token", "account", "created_at")
    search_fields = ("player_token", "account__display_name", "account__email")
    readonly_fields = ("created_at",)
    autocomplete_fields = ["account"]
    ordering = ("-created_at",)


@admin.register(PlayerStats)
class PlayerStatsAdmin(admin.ModelAdmin):
    """T-060: view de ranking/busca dedicada (a inline em `AccountAdmin` continua existindo
    pra edição no contexto da conta; esta é pra operar/consultar direto, com busca por nick)."""

    list_display = ("account", "kills", "deaths", "matches_played", "xp_total", "updated_at")
    search_fields = ("account__display_name", "account__email")
    ordering = ("-kills",)
    autocomplete_fields = ["account"]
