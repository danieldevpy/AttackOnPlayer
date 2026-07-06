from rest_framework import serializers

from .models import MapEntry


class MapEntrySummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = MapEntry
        fields = ["id", "name", "author", "w", "h", "in_rotation"]
