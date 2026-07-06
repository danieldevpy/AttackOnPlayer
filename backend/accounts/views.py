"""Endpoints de conta (SPEC-0008). `guest`/`jwks`/`register`/`login` são públicos; `me`/`link`
exigem JWT de conta — isso sobrescreve os defaults de service-token do REST_FRAMEWORK (ver
settings/base.py). Google OAuth fica fora de escopo por ora (T-028)."""
from django.db import transaction
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from . import jwt as jwt_lib
from .authentication import JWTAuthentication
from .models import Account, GuestLink, PlayerStats
from .serializers import (
    AccountSerializer,
    GuestRequestSerializer,
    LinkRequestSerializer,
    LoginSerializer,
    RegisterSerializer,
)


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
    display_name = body.validated_data.get("display_name") or email.split("@")[0]

    with transaction.atomic():
        account = Account.objects.create_user(
            email=email, password=password, display_name=display_name[:32]
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
            target_stats.save()
        guest_account.delete()

    account.refresh_from_db()
    return Response(AccountSerializer(account).data)
