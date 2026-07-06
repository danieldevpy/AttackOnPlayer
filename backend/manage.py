#!/usr/bin/env python
"""Entrypoint de administração do backend de plataforma (T-027 / SPEC-0008)."""
import os
import sys


def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Django não encontrado. Ative a venv: `. .venv/bin/activate` "
            "e instale: `pip install -r requirements-dev.txt`."
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
