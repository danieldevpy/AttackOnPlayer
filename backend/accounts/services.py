"""Agregação de estatística a partir da telemetria (T-060) e moderação de nick (T-061)."""
import re

from django.db.models import F

from .models import GuestLink, PlayerStats

# T-061: nick malicioso vira fallback (nunca erro 400) — mesmo aceite previsto pro lobby T-058.
# Unicode \w cobre letras acentuadas/dígitos/underscore; espaço/hífen/ponto liberados à parte.
# Bloqueia: HTML/script, caracteres de controle, emoji, RTL override, etc.
_NICK_RE = re.compile(r"^[\w \-.]{1,32}$", re.UNICODE)


def sanitize_display_name(raw, fallback="guest"):
    """Sanitiza um nick vindo do cliente. Fora do charset/tamanho permitido (ou vazio) => cai
    pro `fallback` inteiro (nunca trunca/edita um nick malicioso — aceite explícito da T-058)."""
    if not isinstance(raw, str):
        return fallback
    candidate = raw.strip()
    if not candidate or not _NICK_RE.match(candidate):
        return fallback
    return candidate


def _stats_for_token(token):
    if not token:
        return None
    link = GuestLink.objects.filter(player_token=token).first()
    if link is None:
        return None
    stats, _ = PlayerStats.objects.get_or_create(account_id=link.account_id)
    return stats


def apply_telemetry_stats(events):
    """Atualiza `PlayerStats.kills`/`deaths`/`matches_played` a partir de um batch de eventos
    de telemetria (mesmo formato aceito por `telemetry.views.ingest_batch`). `kill` soma 1 kill
    pro `killerToken` e 1 death pro `victimToken`; `quit` soma 1 partida jogada (sinal mais
    confiável de "sessão encerrada" que existe no schema hoje — `match_end` é por room, não por
    jogador)."""
    for event in events:
        etype = event.get("type")
        if etype == "kill":
            killer = _stats_for_token(event.get("killerToken"))
            if killer is not None:
                PlayerStats.objects.filter(pk=killer.pk).update(kills=F("kills") + 1)
            victim = _stats_for_token(event.get("victimToken"))
            if victim is not None:
                PlayerStats.objects.filter(pk=victim.pk).update(deaths=F("deaths") + 1)
        elif etype == "quit":
            stats = _stats_for_token(event.get("playerToken"))
            if stats is not None:
                PlayerStats.objects.filter(pk=stats.pk).update(
                    matches_played=F("matches_played") + 1
                )
