"""Roteamento raiz. Endpoints da API são versionados sob /api/v1/ e adicionados por sub-task."""
from django.contrib import admin
from django.urls import include, path

from accounts.views import player_settings, ranking, stats_me
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
    # T-060 (SPEC-0008, Frente B): KDA/ranking — fora do prefixo /auth/ de propósito (não são
    # rotas de identidade, são leitura de estatística/ranking público+próprio).
    path("api/v1/stats/me", stats_me, name="stats-me"),
    path("api/v1/ranking", ranking, name="ranking"),
    # T-061 (SPEC-0008, Frente B): settings do player (consumido pela T-058 quando o lobby existir).
    path("api/v1/accounts/settings", player_settings, name="player-settings"),
]
