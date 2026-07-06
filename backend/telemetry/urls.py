"""Rotas de telemetria (T-027f)."""
from django.urls import path

from . import views

app_name = "telemetry"

urlpatterns = [
    path("batch/", views.ingest_batch, name="batch"),
]
