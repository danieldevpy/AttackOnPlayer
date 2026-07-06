"""
Identidade da plataforma (SPEC-0008 / ADR-016).

Guardrail da Constituição: conta = identidade/estatística/mapas — NUNCA poder in-round. Guest é o
default (1 clique, sem senha); ao vincular (T-027c) herda estatísticas. Google/registro email-senha
completos são a T-028; o campo `google_sub` já existe para não migrar o schema depois.

PK UUID e AUTH_USER_MODEL são fixados aqui, na primeira migration, de propósito: trocar depois é
caro. `PlayerStats`/`GuestLink` chegam na T-027b; a migração real do acumulador ADR-012 é a T-029.
"""
import uuid

from django.contrib.auth.models import (
    AbstractBaseUser,
    BaseUserManager,
    PermissionsMixin,
)
from django.db import models
from django.utils import timezone


class AccountManager(BaseUserManager):
    def create_guest(self, display_name="guest"):
        account = self.model(is_guest=True, display_name=display_name[:32])
        account.set_unusable_password()
        account.save(using=self._db)
        return account

    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError("conta registrada exige email")
        extra.setdefault("is_guest", False)
        account = self.model(email=self.normalize_email(email), **extra)
        account.set_password(password)
        account.save(using=self._db)
        return account

    def create_superuser(self, email, password, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("is_guest", False)
        if not extra["is_staff"] or not extra["is_superuser"]:
            raise ValueError("superuser precisa de is_staff e is_superuser")
        return self.create_user(email, password, **extra)


class Account(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, null=True, blank=True)
    display_name = models.CharField(max_length=32, default="guest")
    is_guest = models.BooleanField(default=True)
    # T-028 (Google OAuth); presente desde já para evitar migração de schema depois.
    google_sub = models.CharField(max_length=255, unique=True, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = AccountManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        db_table = "accounts_account"

    def __str__(self):
        return f"{self.display_name} ({'guest' if self.is_guest else self.email})"


class PlayerStats(models.Model):
    """Scaffold do acumulador de estatística. Migração real do ADR-012 é a T-029."""

    account = models.OneToOneField(
        Account, on_delete=models.CASCADE, primary_key=True, related_name="stats"
    )
    kills = models.PositiveIntegerField(default=0)
    deaths = models.PositiveIntegerField(default=0)
    matches_played = models.PositiveIntegerField(default=0)
    xp_total = models.PositiveBigIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "accounts_player_stats"

    def __str__(self):
        return f"stats({self.account.display_name})"


class GuestLink(models.Model):
    """Mapeia `player_token` (identidade local do client, pré-conta) -> Account guest.

    Consumido pelo fluxo guest->conta (T-027c): ao logar/registrar, o `player_token` do client
    é usado para achar a conta guest e transferir `PlayerStats` para a conta definitiva.
    """

    player_token = models.CharField(max_length=64, unique=True)
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="guest_links")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "accounts_guest_link"

    def __str__(self):
        return f"{self.player_token} -> {self.account_id}"
