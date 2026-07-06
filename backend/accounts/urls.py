"""Rotas de conta/auth (T-027c/T-028a)."""
from django.urls import path

from . import views

app_name = "accounts"

urlpatterns = [
    path("guest", views.guest_login, name="guest"),
    path("jwks.json", views.jwks_view, name="jwks"),
    path("register", views.register, name="register"),
    path("login", views.login, name="login"),
    path("me", views.me, name="me"),
    path("link", views.link, name="link"),
]
