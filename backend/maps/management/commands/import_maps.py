"""Ingere `maps/*.map.json` (fora do repo Django, na raiz do monorepo) para o registry
`MapEntry`. Uso: `python manage.py import_maps [--dir <path>]`."""
import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from maps.models import MapEntry
from maps.validators import validate_map_file


class Command(BaseCommand):
    help = "Importa maps/*.map.json para o registry MapEntry."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dir",
            default=None,
            help="Diretório com *.map.json (default: <repo>/maps/, irmão de backend/)",
        )

    def handle(self, *args, **options):
        maps_dir = (
            Path(options["dir"]) if options["dir"] else Path(settings.BASE_DIR).parent / "maps"
        )
        files = sorted(maps_dir.glob("*.map.json"))
        if not files:
            self.stdout.write(self.style.WARNING(f"nenhum *.map.json em {maps_dir}"))
            return

        imported = 0
        for path in files:
            data = json.loads(path.read_text())
            errors = validate_map_file(data)
            if errors:
                self.stderr.write(self.style.ERROR(f"{path.name}: inválido — {'; '.join(errors)}"))
                continue

            entry, _created = MapEntry.objects.update_or_create(
                id=data["id"],
                defaults={
                    "name": data.get("name", data["id"]),
                    "author": data.get("author") or "",
                    "w": data["w"],
                    "h": data["h"],
                    "seed": data.get("seed"),
                    "version": data.get("version", 1),
                    "data": data,
                },
            )
            imported += 1
            self.stdout.write(self.style.SUCCESS(f"{path.name} -> {entry.id}"))

        self.stdout.write(self.style.SUCCESS(f"{imported}/{len(files)} mapa(s) importado(s)"))
