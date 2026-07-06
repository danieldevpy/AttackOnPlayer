"""Rotas de mapas (T-027d)."""
from django.urls import path

from . import views

app_name = "maps"

urlpatterns = [
    path("", views.list_maps, name="list"),
    path("<slug:map_id>/", views.map_detail, name="detail"),
]
