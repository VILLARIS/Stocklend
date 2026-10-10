"""Formato legible de fechas, horas y cantidades para la vista.

No abre la base ni conoce el dominio: solo convierte cadenas ISO y enteros en el
texto que aparece en pantalla (ARCHITECTURE §3.4).
"""

from __future__ import annotations


def fecha(iso: str | None) -> str:
    """`2026-09-12T10:30` → `12/09/2026`. Cadena vacía si no hay dato."""
    if not iso:
        return "—"
    partes = iso[:10].split("-")
    if len(partes) != 3:
        return iso
    anio, mes, dia = partes
    return f"{dia}/{mes}/{anio}"


def fecha_hora(iso: str | None) -> str:
    """`2026-09-12T10:30:00` → `12/09/2026 10:30`."""
    if not iso:
        return "—"
    base = fecha(iso)
    if "T" in iso or " " in iso:
        separador = "T" if "T" in iso else " "
        return f"{base} {iso.split(separador, 1)[1][:5]}"
    return base


def cantidad(valor: int, singular: str = "unidad", plural: str | None = None) -> str:
    """`8` → `8 unidades`; `1` → `1 unidad`."""
    if valor == 1:
        return f"{valor} {singular}"
    return f"{valor} {plural or singular + 's'}"


def cantidad_de(
    parcial: int, total: int, singular: str = "unidad", plural: str | None = None
) -> str:
    """`8` de `12` → `8 de 12 unidades`."""
    etiqueta = singular if total == 1 else (plural or singular + "s")
    return f"{parcial} de {total} {etiqueta}"
