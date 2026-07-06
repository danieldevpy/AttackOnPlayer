"""Roteamento raiz. Endpoints da API são versionados sob /api/v1/ e adicionados por sub-task."""
from django.contrib import admin
from django.urls import include, path

from common.health import healthz
from common.views import ping

urlpatterns = [
    path("healthz", healthz, name="healthz"),
    path("api/v1/ping/", ping, name="service-ping"),
    path("admin/", admin.site.urls),
    path("api/v1/auth/", include("accounts.urls")),
    path("api/v1/maps/", include("maps.urls")),
    path("api/v1/gameops/", include("gameops.urls")),
    path("api/v1/telemetry/", include("telemetry.urls")),
]
