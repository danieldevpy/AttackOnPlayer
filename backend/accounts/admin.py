from django.contrib import admin

from .models import Account


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ("display_name", "email", "is_guest", "is_staff", "date_joined")
    list_filter = ("is_guest", "is_staff", "is_active")
    search_fields = ("display_name", "email", "id")
    readonly_fields = ("id", "date_joined", "last_login", "password")
    ordering = ("-date_joined",)
