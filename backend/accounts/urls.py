"""Rotas de conta/auth (T-027c)."""
from django.urls import path

from . import views

app_name = "accounts"

urlpatterns = [
    path("guest", views.guest_login, name="guest"),
    path("jwks.json", views.jwks_view, name="jwks"),
    path("me", views.me, name="me"),
    path("link", views.link, name="link"),
]
