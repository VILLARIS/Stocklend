"""config.ini: lectura, escritura y guardado atómico."""

from __future__ import annotations

import pytest

from stocklend.core.config import Config


def test_valores_por_defecto_si_no_existe_el_archivo(tmp_path):
    config = Config(tmp_path / "no_existe.ini")
    config.load()
    assert config.get("interfaz", "tema") is None
    assert config.get_int("interfaz", "tamanio", fallback=800) == 800
    assert config.get_bool("interfaz", "maximizado", fallback=False) is False


def test_ciclo_completo_de_escritura_y_lectura(tmp_path):
    ruta = tmp_path / "config.ini"
    config = Config(ruta)
    config.load()
    config.set("interfaz", "tema", "claro")
    config.set("interfaz", "tamanio", 1024)
    config.set("interfaz", "maximizado", True)
    config.save()

    assert ruta.exists()
    relistado = Config(ruta)
    relistado.load()
    assert relistado.get("interfaz", "tema") == "claro"
    assert relistado.get_int("interfaz", "tamanio") == 1024
    assert relistado.get_bool("interfaz", "maximizado") is True


def test_save_sin_cambios_no_escribe(tmp_path):
    ruta = tmp_path / "config.ini"
    config = Config(ruta)
    config.load()
    config.save()
    assert not ruta.exists()


def test_booleano_invalido_lanza_error(tmp_path):
    config = Config(tmp_path / "config.ini")
    config.load()
    config.set("interfaz", "maximizado", "quizas")
    with pytest.raises(ValueError, match="inválido"):
        config.get_bool("interfaz", "maximizado")
