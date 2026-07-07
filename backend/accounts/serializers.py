from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Account, PlayerSettings, PlayerStats


class PlayerStatsSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlayerStats
        fields = [
            "kills",
            "deaths",
            "matches_played",
            "xp_total",
            "forca",
            "agilidade",
            "vitalidade",
        ]


class ProgressReportSerializer(serializers.Serializer):
    """`POST /api/v1/accounts/progress` (T-029) — deltas do acumulador ADR-012, service token."""

    account_id = serializers.UUIDField()
    forca = serializers.IntegerField(required=False, default=0, min_value=0)
    agilidade = serializers.IntegerField(required=False, default=0, min_value=0)
    vitalidade = serializers.IntegerField(required=False, default=0, min_value=0)


class RankingEntrySerializer(serializers.ModelSerializer):
    """Linha do `GET /ranking` (T-060) — nome vem da conta, não do PlayerStats."""

    display_name = serializers.CharField(source="account.display_name")

    class Meta:
        model = PlayerStats
        fields = ["display_name", "kills", "deaths", "matches_played", "xp_total"]


class AccountSerializer(serializers.ModelSerializer):
    stats = PlayerStatsSerializer(read_only=True)

    class Meta:
        model = Account
        fields = ["id", "email", "display_name", "is_guest", "date_joined", "stats"]


class GuestRequestSerializer(serializers.Serializer):
    player_token = serializers.CharField(max_length=64)


class LinkRequestSerializer(serializers.Serializer):
    player_token = serializers.CharField(max_length=64)


class RegisterSerializer(serializers.Serializer):
    """Registro por email/senha (T-028a). Google OAuth fica fora de escopo por ora."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    display_name = serializers.CharField(max_length=32, required=False, allow_blank=True)

    def validate_email(self, value):
        email = Account.objects.normalize_email(value)
        if Account.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("já existe uma conta com este email")
        return email

    def validate_password(self, value):
        validate_password(value)
        return value


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class PlayerSettingsSerializer(serializers.ModelSerializer):
    """`GET/PUT /api/v1/accounts/settings` (T-061, consumido pela T-058). `display_name` não é
    campo do model (é da `Account`) — a view injeta no dict de saída depois de serializar."""

    class Meta:
        model = PlayerSettings
        fields = ["control_profile", "volume_master", "volume_sfx", "fullscreen_pref"]
