//! Consultas de Inventario. Solo lectura.
//!
//! No se inventan relaciones: cada `JOIN` corresponde a una llave foránea real
//! del esquema (`DATABASE_DESIGN.md` §6). Los contadores de artículos y las
//! estadísticas se leen de las columnas persistidas en `articulo`.

use rusqlite::{Connection, OptionalExtension};

use crate::models::inventory::{ArticuloInventario, CategoriaInventario, UnidadInventario};

/// Todos los artículos con su categoría, ordenados por nombre.
pub fn listar_articulos(conn: &Connection) -> rusqlite::Result<Vec<ArticuloInventario>> {
    let mut stmt = conn.prepare(
        "SELECT a.id, a.codigo, a.nombre, c.nombre, \
                a.cantidad_total, a.cantidad_disponible, a.cantidad_prestada, \
                a.cantidad_daniada, a.cantidad_faltante, \
                a.prestable, a.control_individual, a.activo, \
                a.categoria_id, a.notas \
         FROM articulo a \
         JOIN categoria c ON c.id = a.categoria_id \
         ORDER BY a.nombre COLLATE NOCASE, a.id",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(ArticuloInventario {
            id: row.get(0)?,
            codigo: row.get(1)?,
            nombre: row.get(2)?,
            categoria: row.get(3)?,
            cantidad_total: row.get(4)?,
            cantidad_disponible: row.get(5)?,
            cantidad_prestada: row.get(6)?,
            cantidad_daniada: row.get(7)?,
            cantidad_faltante: row.get(8)?,
            prestable: row.get::<_, i64>(9)? != 0,
            control_individual: row.get::<_, i64>(10)? != 0,
            activo: row.get::<_, i64>(11)? != 0,
            categoria_id: row.get(12)?,
            notas: row.get(13)?,
        })
    })?;
    rows.collect()
}

/// Todas las unidades con su artículo, categoría y, si corresponde, su préstamo,
/// estudiante e incidente asociado.
///
/// Se devuelven todas las unidades (incluidas las `baja`). El incidente es el
/// más reciente de la unidad; si hay uno abierto, ese tiene prioridad.
pub fn listar_unidades(conn: &Connection) -> rusqlite::Result<Vec<UnidadInventario>> {
    let mut stmt = conn.prepare(
        "SELECT u.id, u.codigo, u.articulo_id, ar.nombre, c.nombre, u.estado, \
                u.prestamo_detalle_id, \
                p.id, p.folio, p.estado, date(p.fecha_prestamo), \
                e.id, NULLIF(TRIM(COALESCE(e.nombres, '') || ' ' || COALESCE(e.apellidos, '')), ''), \
                inc.id, inc.tipo, inc.estado \
         FROM articulo_unidad u \
         JOIN articulo ar ON ar.id = u.articulo_id \
         JOIN categoria c ON c.id = ar.categoria_id \
         LEFT JOIN prestamo_detalle pd ON pd.id = u.prestamo_detalle_id \
         LEFT JOIN prestamo p ON p.id = pd.prestamo_id \
         LEFT JOIN estudiante e ON e.id = p.estudiante_id \
         LEFT JOIN incidente inc ON inc.id = ( \
             SELECT i.id FROM incidente i \
             WHERE i.articulo_unidad_id = u.id \
             ORDER BY (i.estado = 'abierto') DESC, i.creado_en DESC, i.id DESC \
             LIMIT 1 \
         ) \
         ORDER BY u.codigo COLLATE NOCASE, u.id",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(UnidadInventario {
            id: row.get(0)?,
            codigo: row.get(1)?,
            articulo_id: row.get(2)?,
            articulo: row.get(3)?,
            categoria: row.get(4)?,
            estado: row.get(5)?,
            prestamo_detalle_id: row.get(6)?,
            prestamo_id: row.get(7)?,
            prestamo_folio: row.get(8)?,
            prestamo_estado: row.get(9)?,
            prestamo_fecha: row.get(10)?,
            estudiante_id: row.get(11)?,
            estudiante: row.get(12)?,
            incidente_id: row.get(13)?,
            incidente_tipo: row.get(14)?,
            incidente_estado: row.get(15)?,
        })
    })?;
    rows.collect()
}

/// Todas las categorías con la cantidad de artículos asociados, por nombre.
pub fn listar_categorias(conn: &Connection) -> rusqlite::Result<Vec<CategoriaInventario>> {
    let mut stmt = conn.prepare(
        "SELECT c.id, c.nombre, c.descripcion, c.activo, \
                (SELECT COUNT(*) FROM articulo a WHERE a.categoria_id = c.id) \
         FROM categoria c \
         ORDER BY c.nombre COLLATE NOCASE, c.id",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(CategoriaInventario {
            id: row.get(0)?,
            nombre: row.get(1)?,
            descripcion: row.get(2)?,
            activo: row.get::<_, i64>(3)? != 0,
            articulos: row.get(4)?,
        })
    })?;
    rows.collect()
}

/// Cantidad total de artículos registrados (activos e inactivos).
pub fn contar_articulos(conn: &Connection) -> rusqlite::Result<i64> {
    conn.query_row("SELECT COUNT(*) FROM articulo", [], |row| row.get(0))
}

// ---------------------------------------------------------------------------
// Escrituras de categoría (Fase F2)
// ---------------------------------------------------------------------------

/// Inserta una categoría activa y devuelve su identificador.
pub fn insertar_categoria(
    conn: &Connection,
    nombre: &str,
    descripcion: Option<&str>,
) -> rusqlite::Result<i64> {
    conn.execute(
        "INSERT INTO categoria (nombre, descripcion, activo, creado_en) \
         VALUES (?1, ?2, 1, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))",
        rusqlite::params![nombre, descripcion],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Actualiza nombre y descripción. Devuelve las filas afectadas (0 si no existe).
pub fn actualizar_categoria(
    conn: &Connection,
    id: i64,
    nombre: &str,
    descripcion: Option<&str>,
) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE categoria SET nombre = ?1, descripcion = ?2 WHERE id = ?3",
        rusqlite::params![nombre, descripcion, id],
    )
}

/// Activa (`true`) o desactiva (`false`) una categoría. No la borra.
/// Devuelve las filas afectadas (0 si no existe).
pub fn cambiar_activo_categoria(
    conn: &Connection,
    id: i64,
    activo: bool,
) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE categoria SET activo = ?1 WHERE id = ?2",
        rusqlite::params![activo as i64, id],
    )
}

/// Lee una categoría con su cantidad de artículos, o `None` si no existe.
pub fn leer_categoria(
    conn: &Connection,
    id: i64,
) -> rusqlite::Result<Option<CategoriaInventario>> {
    conn.query_row(
        "SELECT c.id, c.nombre, c.descripcion, c.activo, \
                (SELECT COUNT(*) FROM articulo a WHERE a.categoria_id = c.id) \
         FROM categoria c WHERE c.id = ?1",
        [id],
        |row| {
            Ok(CategoriaInventario {
                id: row.get(0)?,
                nombre: row.get(1)?,
                descripcion: row.get(2)?,
                activo: row.get::<_, i64>(3)? != 0,
                articulos: row.get(4)?,
            })
        },
    )
    .optional()
}

/// Pares `(id, nombre)` de todas las categorías, para comprobar duplicados.
pub fn nombres_categoria(conn: &Connection) -> rusqlite::Result<Vec<(i64, String)>> {
    let mut stmt = conn.prepare("SELECT id, nombre FROM categoria")?;
    let rows = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?;
    rows.collect()
}

/// Lee un artículo con su categoría y contadores, o `None` si no existe.
pub fn leer_articulo(
    conn: &Connection,
    id: i64,
) -> rusqlite::Result<Option<ArticuloInventario>> {
    conn.query_row(
        "SELECT a.id, a.codigo, a.nombre, c.nombre, \
                a.cantidad_total, a.cantidad_disponible, a.cantidad_prestada, \
                a.cantidad_daniada, a.cantidad_faltante, \
                a.control_individual, a.prestable, a.activo, \
                a.categoria_id, a.notas \
         FROM articulo a \
         JOIN categoria c ON c.id = a.categoria_id \
         WHERE a.id = ?1",
        [id],
        |row| {
            Ok(ArticuloInventario {
                id: row.get(0)?,
                codigo: row.get(1)?,
                nombre: row.get(2)?,
                categoria: row.get(3)?,
                cantidad_total: row.get(4)?,
                cantidad_disponible: row.get(5)?,
                cantidad_prestada: row.get(6)?,
                cantidad_daniada: row.get(7)?,
                cantidad_faltante: row.get(8)?,
                control_individual: row.get::<_, i64>(9)? != 0,
                prestable: row.get::<_, i64>(10)? != 0,
                activo: row.get::<_, i64>(11)? != 0,
                categoria_id: row.get(12)?,
                notas: row.get(13)?,
            })
        },
    )
    .optional()
}

/// Inserta un artículo nuevo con los contadores a cero. Devuelve su
/// identificador.
pub fn insertar_articulo(
    conn: &Connection,
    nombre: &str,
    categoria_id: i64,
    control_individual: bool,
    prestable: bool,
    notas: Option<&str>,
) -> rusqlite::Result<i64> {
    conn.execute(
        "INSERT INTO articulo \
         (nombre, categoria_id, notas, control_individual, prestable, activo, \
          cantidad_total, cantidad_disponible, cantidad_prestada, \
          cantidad_daniada, cantidad_faltante, creado_en, actualizado_en) \
         VALUES (?1, ?2, ?3, ?4, ?5, 1, 0, 0, 0, 0, 0, \
                 strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), \
                 strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))",
        rusqlite::params![
            nombre,
            categoria_id,
            notas,
            control_individual as i64,
            prestable as i64
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Actualiza nombre, categoría, `prestable` y notas. No toca contadores,
/// `control_individual` ni el código. Devuelve las filas afectadas (0 si no
/// existe).
pub fn actualizar_articulo(
    conn: &Connection,
    id: i64,
    nombre: &str,
    categoria_id: i64,
    prestable: bool,
    notas: Option<&str>,
) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE articulo \
         SET nombre = ?1, categoria_id = ?2, prestable = ?3, notas = ?4, \
             actualizado_en = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') \
         WHERE id = ?5",
        rusqlite::params![nombre, categoria_id, prestable as i64, notas, id],
    )
}

/// Indica si una categoría existe y, en tal caso, si está activa.
pub fn categoria_activa(conn: &Connection, id: i64) -> rusqlite::Result<Option<bool>> {
    conn.query_row("SELECT activo FROM categoria WHERE id = ?1", [id], |row| {
        Ok(row.get::<_, i64>(0)? != 0)
    })
    .optional()
}

/// Pares `(id, nombre)` de los artículos de una categoría, para comprobar
/// duplicados de nombre (RN-09).
pub fn nombres_articulo(
    conn: &Connection,
    categoria_id: i64,
) -> rusqlite::Result<Vec<(i64, String)>> {
    let mut stmt = conn.prepare("SELECT id, nombre FROM articulo WHERE categoria_id = ?1")?;
    let rows = stmt.query_map([categoria_id], |row| Ok((row.get(0)?, row.get(1)?)))?;
    rows.collect()
}

// ---------------------------------------------------------------------------
// Unidades individuales (Fase F4)
// ---------------------------------------------------------------------------

/// Columnas comunes de `listar_unidades` y `leer_unidad`.
const SQL_UNIDAD: &str = "SELECT u.id, u.codigo, u.articulo_id, ar.nombre, c.nombre, u.estado, \
          u.prestamo_detalle_id, \
          p.id, p.folio, p.estado, date(p.fecha_prestamo), \
          e.id, NULLIF(TRIM(COALESCE(e.nombres, '') || ' ' || COALESCE(e.apellidos, '')), ''), \
          inc.id, inc.tipo, inc.estado \
   FROM articulo_unidad u \
   JOIN articulo ar ON ar.id = u.articulo_id \
   JOIN categoria c ON c.id = ar.categoria_id \
   LEFT JOIN prestamo_detalle pd ON pd.id = u.prestamo_detalle_id \
   LEFT JOIN prestamo p ON p.id = pd.prestamo_id \
   LEFT JOIN estudiante e ON e.id = p.estudiante_id \
   LEFT JOIN incidente inc ON inc.id = ( \
       SELECT i.id FROM incidente i \
       WHERE i.articulo_unidad_id = u.id \
       ORDER BY (i.estado = 'abierto') DESC, i.creado_en DESC, i.id DESC \
       LIMIT 1 \
   )";

fn fila_unidad(row: &rusqlite::Row<'_>) -> rusqlite::Result<UnidadInventario> {
    Ok(UnidadInventario {
        id: row.get(0)?,
        codigo: row.get(1)?,
        articulo_id: row.get(2)?,
        articulo: row.get(3)?,
        categoria: row.get(4)?,
        estado: row.get(5)?,
        prestamo_detalle_id: row.get(6)?,
        prestamo_id: row.get(7)?,
        prestamo_folio: row.get(8)?,
        prestamo_estado: row.get(9)?,
        prestamo_fecha: row.get(10)?,
        estudiante_id: row.get(11)?,
        estudiante: row.get(12)?,
        incidente_id: row.get(13)?,
        incidente_tipo: row.get(14)?,
        incidente_estado: row.get(15)?,
    })
}

/// Lee una unidad con su artículo, categoría y referencias, o `None` si no
/// existe.
pub fn leer_unidad(conn: &Connection, id: i64) -> rusqlite::Result<Option<UnidadInventario>> {
    let sql = format!("{SQL_UNIDAD} WHERE u.id = ?1");
    conn.query_row(&sql, [id], fila_unidad).optional()
}

/// Inserta una unidad en estado `disponible` y devuelve su identificador.
pub fn insertar_unidad(
    conn: &Connection,
    articulo_id: i64,
    codigo: &str,
    descripcion: Option<&str>,
) -> rusqlite::Result<i64> {
    conn.execute(
        "INSERT INTO articulo_unidad \
         (articulo_id, codigo, descripcion, estado, creado_en, actualizado_en) \
         VALUES (?1, ?2, ?3, 'disponible', \
                 strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), \
                 strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))",
        rusqlite::params![articulo_id, codigo, descripcion],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Cambia el estado de una unidad. Devuelve las filas afectadas (0 si no
/// existe).
pub fn cambiar_estado_unidad(
    conn: &Connection,
    id: i64,
    estado: &str,
) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE articulo_unidad \
         SET estado = ?1, actualizado_en = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') \
         WHERE id = ?2",
        rusqlite::params![estado, id],
    )
}

/// Actualiza código, descripción y notas de una unidad. No toca el estado ni el
/// préstamo asociado. Devuelve las filas afectadas (0 si no existe).
pub fn actualizar_unidad(
    conn: &Connection,
    id: i64,
    codigo: &str,
    descripcion: Option<&str>,
    notas: Option<&str>,
) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE articulo_unidad \
         SET codigo = ?1, descripcion = ?2, notas = ?3, \
             actualizado_en = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') \
         WHERE id = ?4",
        rusqlite::params![codigo, descripcion, notas, id],
    )
}

/// Indica si un código de unidad ya existe (comparación sin distinguir
/// mayúsculas, por el `COLLATE NOCASE` de la columna), excluyendo una unidad.
pub fn codigo_unidad_existe(
    conn: &Connection,
    codigo: &str,
    excluir: Option<i64>,
) -> rusqlite::Result<bool> {
    let existe: i64 = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM articulo_unidad \
         WHERE codigo = ?1 AND (?2 IS NULL OR id <> ?2))",
        rusqlite::params![codigo, excluir],
        |row| row.get(0),
    )?;
    Ok(existe != 0)
}

/// Cuenta las unidades de un artículo por estado.
///
/// Devuelve `(total, disponible, prestada, danada, faltante)`; el total excluye
/// las unidades en `baja` (RN-61).
pub fn contar_unidades_por_estado(
    conn: &Connection,
    articulo_id: i64,
) -> rusqlite::Result<(i64, i64, i64, i64, i64)> {
    conn.query_row(
        "SELECT \
            COALESCE(SUM(CASE WHEN estado <> 'baja' THEN 1 ELSE 0 END), 0), \
            COALESCE(SUM(CASE WHEN estado = 'disponible' THEN 1 ELSE 0 END), 0), \
            COALESCE(SUM(CASE WHEN estado = 'prestada' THEN 1 ELSE 0 END), 0), \
            COALESCE(SUM(CASE WHEN estado = 'danada' THEN 1 ELSE 0 END), 0), \
            COALESCE(SUM(CASE WHEN estado = 'faltante' THEN 1 ELSE 0 END), 0) \
         FROM articulo_unidad WHERE articulo_id = ?1",
        [articulo_id],
        |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
            ))
        },
    )
}
