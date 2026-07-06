"""Registry de mapas curados (SPEC-0007/T-024 + SPEC-0008/T-027d). `data` guarda o `MapFileV1`
completo tal como salvo em `maps/*.map.json`; os campos soltos (w/h/seed/version) existem para
listar/filtrar sem decodificar o JSON inteiro."""
from django.core.exceptions import ValidationError
from django.db import models

from .validators import validate_map_file


class MapEntry(models.Model):
    id = models.SlugField(primary_key=True, max_length=64)
    name = models.CharField(max_length=120)
    author = models.CharField(max_length=80, blank=True, default="")
    w = models.PositiveIntegerField()
    h = models.PositiveIntegerField()
    seed = models.BigIntegerField(null=True, blank=True)
    version = models.PositiveSmallIntegerField(default=1)
    data = models.JSONField(help_text="MapFileV1 completo — idêntico ao maps/<id>.map.json")
    is_active = models.BooleanField(default=True)
    in_rotation = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "maps_map_entry"
        ordering = ["id"]

    def clean(self):
        errors = validate_map_file(self.data)
        if errors:
            raise ValidationError({"data": errors})

    def __str__(self):
        return f"{self.id} ({self.w}x{self.h})"
