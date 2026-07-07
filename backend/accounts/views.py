"""Endpoints de conta (SPEC-0008). `guest`/`jwks`/`register`/`login` são públicos; `me`/`link`
exigem JWT de conta — isso sobrescreve os defaults de service-token do REST_FRAMEWORK (ver
settings/base.py). Google OAuth fica fora de escopo por ora (T-028)."""
from django.db import transaction
from django.db.models import F
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from . import jwt as jwt_lib
from .authentication import JWTAuthentication
from .models import Account, GuestLink, PlayerSettings, PlayerStats
from .serializers import (
    AccountSerializer,
    GuestRequestSerializer,
    LinkRequestSerializer,
    LoginSerializer,
    PlayerSettingsSerializer,
    PlayerStatsSerializer,
    ProgressReportSerializer,
    RankingEntrySerializer,
    RegisterSerializer,
)
from .services import sanitize_display_name


class RankingPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def guest_login(request):
    """Cria ou reusa a conta guest associada ao `player_token` do client e emite o JWT."""
    body = GuestRequestSerializer(data=request.data)
    body.is_valid(raise_exception=True)
    player_token = body.validated_data["player_token"]

    link = GuestLink.objects.select_related("account").filter(player_token=player_token).first()
    if link is not None:
        account = link.account
    else:
        with transaction.atomic():
            account = Account.objects.create_guest()
            PlayerStats.objects.create(account=account)
            GuestLink.objects.create(player_token=player_token, account=account)

    token = jwt_lib.sign_account(account)
    return Response({"token": token, "account": AccountSerializer(account).data})


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def jwks_view(_request):
    return Response(jwt_lib.jwks())


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def register(request):
    """Cria conta registrada por email/senha. Google OAuth: fora de escopo (deferred, T-028)."""
    body = RegisterSerializer(data=request.data)
    body.is_valid(raise_exception=True)
    email = body.validated_data["email"]
    password = body.validated_data["password"]
    email_prefix = email.split("@")[0][:32]
    raw_name = body.validated_data.get("display_name") or email_prefix
    # T-061: nick malicioso (fora do charset/tamanho) cai pro prefixo do email, nunca rejeita.
    display_name = sanitize_display_name(raw_name, fallback=email_prefix)

    with transaction.atomic():
        account = Account.objects.create_user(
            email=email, password=password, display_name=display_name
        )
        PlayerStats.objects.create(account=account)

    token = jwt_lib.sign_account(account)
    return Response({"token": token, "account": AccountSerializer(account).data}, status=201)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def login(request):
    body = LoginSerializer(data=request.data)
    body.is_valid(raise_exception=True)
    email = Account.objects.normalize_email(body.validated_data["email"])
    password = body.validated_data["password"]

    account = Account.objects.filter(email__iexact=email, is_guest=False).first()
    if account is None or not account.check_password(password):
        return Response({"detail": "email ou senha inválidos"}, status=401)

    token = jwt_lib.sign_account(account)
    return Response({"token": token, "account": AccountSerializer(account).data})


@api_view(["GET"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(AccountSerializer(request.user).data)


@api_view(["POST"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def link(request):
    """Vincula o `player_token` de um guest à conta autenticada, somando `PlayerStats` e
    encerrando a conta guest (aceite #5 da SPEC-0008)."""
    account = request.user
    if account.is_guest:
        return Response(
            {"detail": "somente contas registradas podem vincular um guest"}, status=400
        )

    body = LinkRequestSerializer(data=request.data)
    body.is_valid(raise_exception=True)
    player_token = body.validated_data["player_token"]

    try:
        guest_link = GuestLink.objects.select_related("account").get(player_token=player_token)
    except GuestLink.DoesNotExist:
        return Response({"detail": "player_token não encontrado"}, status=404)

    guest_account = guest_link.account
    if guest_account.pk == account.pk:
        return Response({"detail": "player_token já pertence a esta conta"}, status=400)

    with transaction.atomic():
        guest_stats = PlayerStats.objects.filter(account=guest_account).first()
        if guest_stats is not None:
            target_stats, _ = PlayerStats.objects.get_or_create(account=account)
            target_stats.kills += guest_stats.kills
            target_stats.deaths += guest_stats.deaths
            target_stats.matches_played += guest_stats.matches_played
            target_stats.xp_total += guest_stats.xp_total
            target_stats.forca += guest_stats.forca
            target_stats.agilidade += guest_stats.agilidade
            target_stats.vitalidade += guest_stats.vitalidade
            target_stats.save()
        guest_account.delete()

    account.refresh_from_db()
    return Response(AccountSerializer(account).data)


@api_view(["GET"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def stats_me(request):
    """`GET /stats/me` (T-060) — estatística da própria conta autenticada."""
    stats, _ = PlayerStats.objects.get_or_create(account=request.user)
    return Response(PlayerStatsSerializer(stats).data)


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def ranking(request):
    """`GET /ranking` (T-060) — paginado, ordenado por kills (desempate: partidas jogadas)."""
    qs = PlayerStats.objects.select_related("account").order_by("-kills", "-matches_played")
    paginator = RankingPagination()
    page = paginator.paginate_queryset(qs, request)
    data = RankingEntrySerializer(page, many=True).data
    return paginator.get_paginated_response(data)


@api_view(["GET", "PUT"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def player_settings(request):
    """`GET/PUT /api/v1/accounts/settings` (T-061) — perfil de controle/volumes/fullscreen +
    nick, usado pela persistência do lobby (T-058) quando logado. `PUT` é parcial (só os campos
    enviados mudam); nick malicioso cai pro nick atual (nunca rejeita a request toda)."""
    settings_obj, _ = PlayerSettings.objects.get_or_create(account=request.user)

    if request.method == "PUT":
        body = PlayerSettingsSerializer(settings_obj, data=request.data, partial=True)
        body.is_valid(raise_exception=True)
        body.save()

        if "display_name" in request.data:
            request.user.display_name = sanitize_display_name(
                request.data["display_name"], fallback=request.user.display_name
            )
            request.user.save(update_fields=["display_name"])

    data = PlayerSettingsSerializer(settings_obj).data
    data["display_name"] = request.user.display_name
    return Response(data)


@api_view(["POST"])
def report_progress(request):
    """`POST /api/v1/accounts/progress` (T-029/ADR-012) — deltas do acumulador persistente da
    box, enviados pelo Colyseus (service token, mesma fronteira de `gameops`/`telemetry`).
    Conta inexistente é ignorada (204) — nunca derruba a sala por causa de uma conta apagada
    entre o join e o pickup."""
    body = ProgressReportSerializer(data=request.data)
    body.is_valid(raise_exception=True)
    data = body.validated_data

    updated = PlayerStats.objects.filter(account_id=data["account_id"]).update(
        forca=F("forca") + data["forca"],
        agilidade=F("agilidade") + data["agilidade"],
        vitalidade=F("vitalidade") + data["vitalidade"],
    )
    if not updated:
        return Response(status=204)
    return Response(status=200)
