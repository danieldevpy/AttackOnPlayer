from rest_framework import serializers

from .models import Account, PlayerStats


class PlayerStatsSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlayerStats
        fields = ["kills", "deaths", "matches_played", "xp_total"]


class AccountSerializer(serializers.ModelSerializer):
    stats = PlayerStatsSerializer(read_only=True)

    class Meta:
        model = Account
        fields = ["id", "email", "display_name", "is_guest", "date_joined", "stats"]


class GuestRequestSerializer(serializers.Serializer):
    player_token = serializers.CharField(max_length=64)


class LinkRequestSerializer(serializers.Serializer):
    player_token = serializers.CharField(max_length=64)
