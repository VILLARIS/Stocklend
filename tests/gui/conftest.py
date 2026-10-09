"""Pruebas de interfaz: usan la plataforma offscreen para no abrir ventanas reales."""

import os

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
