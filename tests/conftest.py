"""Fixtures compartidas: entorno aislado, conexiones temporales y datos mínimos."""

from __future__ import annotations

import os
from types import SimpleNamespace

import pytest

from stocklend.data import database, migrator
from stocklend.data.repositories import (
    ArticuloRepo,
    ArticuloUnidadRepo,
    CategoriaRepo,
    ConfiguracionRepo,
    DevolucionRepo,
    EstudianteRepo,
    IncidenteRepo,
    MovimientoRepo,
    PrestamoRepo,
)
from stocklend.domain import (
    Articulo,
    ArticuloUnidad,
    Categoria,
    Configuracion,
    Devolucion,
    DevolucionDetalle,
    EstadoDetalle,
    EstadoIncidente,
    EstadoPrestamo,
    EstadoUnidad,
    Estudiante,
    Incidente,
    MovimientoInventario,
    OrigenIncidente,
    Prestamo,
    PrestamoDetalle,
    ResponsabilidadIncidente,
    TipoIncidente,
    TipoMovimiento,
)


@pytest.fixture(scope="session", autouse=True)
def _entorno_aislado(tmp_path_factory: pytest.TempPathFactory):
    """Ninguna prueba toca datos reales: STOCKLEND_DATA_DIR apunta a un temporal."""
    raiz = tmp_path_factory.mktemp("stocklend_datos")
    anterior = os.environ.get("STOCKLEND_DATA_DIR")
    os.environ["STOCKLEND_DATA_DIR"] = str(raiz)
    yield
    if anterior is None:
        os.environ.pop("STOCKLEND_DATA_DIR", None)
    else:
        os.environ["STOCKLEND_DATA_DIR"] = anterior


@pytest.fixture
def conn(tmp_path):
    conexion = database.connect(tmp_path / "prueba.sqlite")
    yield conexion
    conexion.close()


@pytest.fixture
def conn_migrada(conn):
    migrator.migrate(conn)
    return conn


@pytest.fixture
def datos_previos(conn_migrada):
    """Categoría, estudiante y préstamo mínimos para las pruebas de integridad."""
    categoria = conn_migrada.execute(
        "INSERT INTO categoria (nombre, creado_en) VALUES (?, ?)",
        ("Utensilios", "2026-01-01"),
    ).lastrowid
    estudiante = conn_migrada.execute(
        "INSERT INTO estudiante (codigo_universitario, nombres, apellidos,"
        " creado_en, actualizado_en) VALUES (?, ?, ?, ?, ?)",
        ("U100", "Ana", "Pérez", "2026-01-01", "2026-01-01"),
    ).lastrowid
    prestamo = conn_migrada.execute(
        "INSERT INTO prestamo (folio, estudiante_id, fecha_prestamo, estado, creado_en)"
        " VALUES (?, ?, ?, ?, ?)",
        ("PRE-2026-000001", estudiante, "2026-01-02", "activo", "2026-01-02"),
    ).lastrowid
    return {"categoria": categoria, "estudiante": estudiante, "prestamo": prestamo}


def insertar_articulo(conn, categoria_id, nombre="Olla", control_individual=0, **contadores):
    valores = {
        "total": 0,
        "disponible": None,
        "prestada": 0,
        "daniada": 0,
        "faltante": 0,
    }
    valores.update(contadores)
    if valores["disponible"] is None:
        valores["disponible"] = (
            valores["total"] - valores["prestada"] - valores["daniada"] - valores["faltante"]
        )
    return conn.execute(
        "INSERT INTO articulo (nombre, categoria_id, control_individual, creado_en,"
        " actualizado_en, cantidad_total, cantidad_disponible, cantidad_prestada,"
        " cantidad_daniada, cantidad_faltante) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            nombre,
            categoria_id,
            control_individual,
            "2026-01-01",
            "2026-01-01",
            valores["total"],
            valores["disponible"],
            valores["prestada"],
            valores["daniada"],
            valores["faltante"],
        ),
    ).lastrowid


@pytest.fixture
def crear_articulo(conn_migrada):
    def _crear(categoria_id, **kwargs):
        return insertar_articulo(conn_migrada, categoria_id, **kwargs)

    return _crear


@pytest.fixture
def repos(conn_migrada):
    """Instancias de todos los repositorios sobre una base migrada."""
    return SimpleNamespace(
        categorias=CategoriaRepo(conn_migrada),
        articulos=ArticuloRepo(conn_migrada),
        unidades=ArticuloUnidadRepo(conn_migrada),
        estudiantes=EstudianteRepo(conn_migrada),
        prestamos=PrestamoRepo(conn_migrada),
        devoluciones=DevolucionRepo(conn_migrada),
        incidentes=IncidenteRepo(conn_migrada),
        movimientos=MovimientoRepo(conn_migrada),
        configuracion=ConfiguracionRepo(conn_migrada),
    )


@pytest.fixture
def fabrica():
    """Fábricas de entidades de dominio con valores por defecto razonables."""

    def categoria(**kw):
        datos = {
            "id": None,
            "nombre": "Utensilios",
            "descripcion": None,
            "activo": True,
            "creado_en": "2026-01-01",
        }
        datos.update(kw)
        return Categoria(**datos)

    def articulo(categoria_id=1, **kw):
        datos = {
            "id": None,
            "codigo": None,
            "nombre": "Olla",
            "categoria_id": categoria_id,
            "unidad_medida": "unidad",
            "notas": None,
            "control_individual": False,
            "prestable": True,
            "activo": True,
            "cantidad_total": 0,
            "cantidad_disponible": 0,
            "cantidad_prestada": 0,
            "cantidad_daniada": 0,
            "cantidad_faltante": 0,
            "creado_en": "2026-01-01",
            "actualizado_en": "2026-01-01",
        }
        datos.update(kw)
        return Articulo(**datos)

    def unidad(articulo_id=1, **kw):
        datos = {
            "id": None,
            "articulo_id": articulo_id,
            "codigo": "U-0001",
            "descripcion": None,
            "estado": EstadoUnidad.DISPONIBLE,
            "prestamo_detalle_id": None,
            "verificado_en": None,
            "notas": None,
            "creado_en": "2026-01-01",
            "actualizado_en": "2026-01-01",
        }
        datos.update(kw)
        return ArticuloUnidad(**datos)

    def estudiante(**kw):
        datos = {
            "id": None,
            "codigo_universitario": "U100",
            "nombres": "Ana",
            "apellidos": "Pérez",
            "activo": True,
            "creado_en": "2026-01-01",
            "actualizado_en": "2026-01-01",
        }
        datos.update(kw)
        return Estudiante(**datos)

    def prestamo(estudiante_id=1, **kw):
        datos = {
            "id": None,
            "folio": "PRE-2026-000001",
            "estudiante_id": estudiante_id,
            "fecha_prestamo": "2026-01-02",
            "fecha_limite": None,
            "estado": EstadoPrestamo.ACTIVO,
            "comentario": None,
            "creado_en": "2026-01-02",
            "cerrado_en": None,
        }
        datos.update(kw)
        return Prestamo(**datos)

    def prestamo_detalle(prestamo_id=1, articulo_id=1, **kw):
        datos = {
            "id": None,
            "prestamo_id": prestamo_id,
            "articulo_id": articulo_id,
            "cantidad_prestada": 1,
            "cantidad_devuelta": 0,
            "cantidad_daniada": 0,
            "cantidad_perdida": 0,
            "estado": EstadoDetalle.PENDIENTE,
            "notas": None,
        }
        datos.update(kw)
        return PrestamoDetalle(**datos)

    def devolucion(prestamo_id=1, **kw):
        datos = {
            "id": None,
            "prestamo_id": prestamo_id,
            "fecha_devolucion": "2026-01-05",
            "observaciones": None,
            "creado_en": "2026-01-05",
        }
        datos.update(kw)
        return Devolucion(**datos)

    def devolucion_detalle(devolucion_id=1, prestamo_detalle_id=1, **kw):
        datos = {
            "id": None,
            "devolucion_id": devolucion_id,
            "prestamo_detalle_id": prestamo_detalle_id,
            "cantidad_devuelta": 1,
            "cantidad_daniada": 0,
            "cantidad_perdida": 0,
            "notas": None,
        }
        datos.update(kw)
        return DevolucionDetalle(**datos)

    def incidente(articulo_id=1, **kw):
        datos = {
            "id": None,
            "tipo": TipoIncidente.PERDIDA,
            "estado": EstadoIncidente.ABIERTO,
            "origen": OrigenIncidente.STOCK,
            "prestamo_id": None,
            "prestamo_detalle_id": None,
            "devolucion_id": None,
            "articulo_id": articulo_id,
            "articulo_unidad_id": None,
            "estudiante_id": None,
            "responsabilidad": ResponsabilidadIncidente.SIN_DETERMINAR,
            "cantidad": 1,
            "descripcion": "Se perdió una unidad",
            "resolucion": None,
            "resuelto_en": None,
            "creado_en": "2026-01-06",
        }
        datos.update(kw)
        return Incidente(**datos)

    def movimiento(articulo_id=1, **kw):
        datos = {
            "id": None,
            "articulo_id": articulo_id,
            "articulo_unidad_id": None,
            "tipo": TipoMovimiento.ALTA,
            "cantidad": 1,
            "cantidad_resultante_total": 1,
            "cantidad_resultante_disponible": 1,
            "motivo": "Alta inicial",
            "referencia_tipo": None,
            "referencia_id": None,
            "fecha": "2026-01-01",
        }
        datos.update(kw)
        return MovimientoInventario(**datos)

    def configuracion(**kw):
        datos = {
            "clave": "tema",
            "valor": "claro",
            "actualizado_en": "2026-01-01",
        }
        datos.update(kw)
        return Configuracion(**datos)

    return SimpleNamespace(
        categoria=categoria,
        articulo=articulo,
        unidad=unidad,
        estudiante=estudiante,
        prestamo=prestamo,
        prestamo_detalle=prestamo_detalle,
        devolucion=devolucion,
        devolucion_detalle=devolucion_detalle,
        incidente=incidente,
        movimiento=movimiento,
        configuracion=configuracion,
    )
