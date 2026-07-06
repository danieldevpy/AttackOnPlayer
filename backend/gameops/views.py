"""Endpoint de gameops (SPEC-0008). Auth via service token — herda os defaults do
REST_FRAMEWORK (fronteira ADR-016, ver settings/base.py)."""
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import effective_config


@api_view(["GET"])
def config_view(_request):
    return Response(effective_config())
