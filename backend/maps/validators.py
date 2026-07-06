"""
Espelho Python de `packages/shared/src/mapFile.ts::validateMapFile` (SPEC-0007/T-024). Cobre as
regras estruturais: versão, dimensões, spawns, bounds de instância/spawn/bandeira e objectId
conhecido. NÃO reimplementa o flood-fill de alcançabilidade — mapas curados já passaram por ele
no lado TS (CLI da T-025) antes de virar `maps/*.map.json`; a duplicação é mitigada testando os
dois lados com os mesmos arquivos (ver risco anotado no plano da T-027).
"""

MAP_FILE_VERSION = 1

# Espelha `OBJECT_DEFS` de packages/shared/src/objects.ts — só os ids importam aqui (footprint/
# colisão não são recalculados no Python).
KNOWN_OBJECT_IDS = {"pedra", "arvore", "caixa", "muro", "bandeira"}


def validate_map_file(data: dict) -> list[str]:
    """Lista de erros — vazia = mapa válido. Nunca lança."""
    errors = []

    version = data.get("version")
    if version != MAP_FILE_VERSION:
        errors.append(f"versão desconhecida: {version}")

    w = data.get("w")
    h = data.get("h")
    w_ok = isinstance(w, int | float) and not isinstance(w, bool) and w > 2
    h_ok = isinstance(h, int | float) and not isinstance(h, bool) and h > 2
    if not w_ok or not h_ok:
        errors.append(f"dimensões inválidas: {w}x{h}")

    spawns = data.get("spawns") or []
    if not spawns:
        errors.append("mapa sem nenhum spawn")

    def in_bounds(x, z):
        if not w_ok or not h_ok or x is None or z is None:
            return False
        if not isinstance(x, int | float) or isinstance(x, bool):
            return False
        if not isinstance(z, int | float) or isinstance(z, bool):
            return False
        return 0 <= x <= w and 0 <= z <= h

    for i, inst in enumerate(data.get("instances") or []):
        object_id = inst.get("objectId")
        if object_id not in KNOWN_OBJECT_IDS:
            errors.append(f'instância {i}: objectId desconhecido "{object_id}"')
        if not in_bounds(inst.get("x"), inst.get("z")):
            errors.append(f"instância {i}: fora dos limites ({inst.get('x')},{inst.get('z')})")

    for i, s in enumerate(spawns):
        if not in_bounds(s.get("x"), s.get("z")):
            errors.append(f"spawn {i}: fora dos limites ({s.get('x')},{s.get('z')})")

    flag = data.get("flag")
    if not flag or not in_bounds(flag.get("x"), flag.get("z")):
        fx = flag.get("x") if flag else None
        fz = flag.get("z") if flag else None
        errors.append(f"bandeira fora dos limites ({fx},{fz})")

    return errors
