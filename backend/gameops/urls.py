"""Rotas de gameops (T-027e)."""
from django.urls import path

from . import views

app_name = "gameops"

urlpatterns = [
    path("config/", views.config_view, name="config"),
]
