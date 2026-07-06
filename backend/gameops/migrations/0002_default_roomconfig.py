"""Fixture: garante 1 RoomConfig default (`is_default=True`) para `effective_config` nunca cair
nos hardcoded de fallback num banco recém-criado (T-027e)."""
from django.db import migrations


def create_default_room_config(apps, schema_editor):
    RoomConfig = apps.get_model("gameops", "RoomConfig")
    if not RoomConfig.objects.filter(is_default=True).exists():
        RoomConfig.objects.create(name="default", is_default=True)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("gameops", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(create_default_room_config, noop_reverse),
    ]
