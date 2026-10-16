//! Consultas de Préstamos (Etapa B). Solo lectura.
//!
//! No se inventan relaciones: cada `JOIN` corresponde a una llave foránea real
//! del esquema (`DATABASE_DESIGN.md` §6). La lista y el detalle se apoyan en las
//! vistas `v_prestamo_resumen` y `v_prestamo_detalle`; el nombre del estudiante
//! (`estudiante`) y del artículo (`articulo`) se leen por su llave, no se
//! deducen. El vencimiento se calcula comparando `date(fecha_limite)` con la
//! fecha de referencia `hoy`, que el comando obtiene del reloj de SQLite.

use std::collections::HashMap;

use rusqlite::{Connection, OptionalExtension};

use crate::models::prestamos::{
    EstadisticasPrestamos, PrestamoDetalle, PrestamoLinea, PrestamoResumen,
};

/// Cabecera común de la lista: préstamo, estudiante y totales.
///
/// `?1` es la fecha de referencia (`YYYY-MM-DD`) usada para derivar `vencido`.
const SQL_RESUMEN: &str = "SELECT v.id, \
        v.folio, \
        v.estudiante_id, \
        TRIM(COALESCE(v.nombres, '') || ' ' || COALESCE(v.apellidos, '')), \
        v.codigo_universitario, \
        date(v.fecha_prestamo), \
        date(v.fecha_limite), \
        v.estado, \
        CASE WHEN v.estado = 'activo' \
                   AND v.fecha_limite IS NOT NULL \
                   AND date(v.fecha_limite) < ?1 \
             THEN 1 ELSE 0 END, \
        v.comentario, \
        date(p.cerrado_en), \
        v.total_renglones, \
        v.total_prestado, \
        v.total_pendiente \
   FROM v_prestamo_resumen v \
   JOIN prestamo p ON p.id = v.id";

/// Fecha de referencia local (`YYYY-MM-DD`) tomada del reloj de SQLite.
///
/// Se usa como "hoy" para derivar el vencimiento, de forma coherente con el
/// resto del proyecto (que también usa `date('now', 'localtime')`).
pub fn fecha_hoy(conn: &Connection) -> rusqlite::Result<String> {
    conn.query_row("SELECT date('now', 'localtime')", [], |row| row.get(0))
}

/// Marca de tiempo local (`YYYY-MM-DDTHH:MM:SS`) tomada del reloj de SQLite.
///
/// Es la fecha de préstamo que fija el backend; nunca llega desde el frontend.
/// Coincide en forma con la que usa la aplicación original (`datetime.now()`).
pub fn fecha_hora_local(conn: &Connection) -> rusqlite::Result<String> {
    conn.query_row(
        "SELECT strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime')",
        [],
        |row| row.get(0),
    )
}

/// Mapea una fila de [`SQL_RESUMEN`] a un préstamo de la lista.
fn fila_resumen(row: &rusqlite::Row<'_>) -> rusqlite::Result<PrestamoResumen> {
    Ok(PrestamoResumen {
        id: row.get(0)?,
        folio: row.get(1)?,
        estudiante_id: row.get(2)?,
        nombre_completo: row.get(3)?,
        codigo_universitario: row.get(4)?,
        fecha_prestamo: row.get(5)?,
        fecha_limite: row.get(6)?,
        estado: row.get(7)?,
        vencido: row.get::<_, i64>(8)? != 0,
        comentario: row.get(9)?,
        cerrado_en: row.get(10)?,
        renglones: row.get(11)?,
        unidades_prestadas: row.get(12)?,
        unidades_pendientes: row.get(13)?,
    })
}

/// Todos los préstamos con sus totales, del más reciente al más antiguo.
///
/// Incluye préstamos `activo`, `cerrado` y `anulado`. `hoy` (`YYYY-MM-DD`) fija
/// la referencia para el vencimiento calculado.
pub fn listar_prestamos(
    conn: &Connection,
    hoy: &str,
) -> rusqlite::Result<Vec<PrestamoResumen>> {
    let sql = format!("{SQL_RESUMEN} ORDER BY p.fecha_prestamo DESC, p.id DESC");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([hoy], fila_resumen)?;
    rows.collect()
}

/// Lee un préstamo con sus renglones, o `None` si no existe.
///
/// `hoy` (`YYYY-MM-DD`) fija la referencia para el vencimiento calculado.
pub fn obtener_detalle(
    conn: &Connection,
    id: i64,
    hoy: &str,
) -> rusqlite::Result<Option<PrestamoDetalle>> {
    let sql = format!(
        "SELECT v.id, v.folio, v.estudiante_id, \
                TRIM(COALESCE(v.nombres, '') || ' ' || COALESCE(v.apellidos, '')), \
                v.codigo_universitario, date(v.fecha_prestamo), date(v.fecha_limite), \
                v.estado, \
                CASE WHEN v.estado = 'activo' \
                           AND v.fecha_limite IS NOT NULL \
                           AND date(v.fecha_limite) < ?2 \
                     THEN 1 ELSE 0 END, \
                v.comentario, date(p.cerrado_en), date(p.creado_en), \
                v.total_renglones, v.total_prestado, v.total_pendiente \
           FROM v_prestamo_resumen v \
           JOIN prestamo p ON p.id = v.id \
          WHERE v.id = ?1"
    );

    let cabecera = conn
        .query_row(&sql, rusqlite::params![id, hoy], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, Option<String>>(6)?,
                row.get::<_, String>(7)?,
                row.get::<_, i64>(8)? != 0,
                row.get::<_, Option<String>>(9)?,
                row.get::<_, Option<String>>(10)?,
                row.get::<_, String>(11)?,
                row.get::<_, i64>(12)?,
                row.get::<_, i64>(13)?,
                row.get::<_, i64>(14)?,
            ))
        })
        .optional()?;

    let Some((
        id,
        folio,
        estudiante_id,
        nombre_completo,
        codigo_universitario,
        fecha_prestamo,
        fecha_limite,
        estado,
        vencido,
        comentario,
        cerrado_en,
        creado_en,
        renglones,
        unidades_prestadas,
        unidades_pendientes,
    )) = cabecera
    else {
        return Ok(None);
    };

    let unidades = unidades_por_renglon(conn, id)?;

    let mut stmt = conn.prepare(
        "SELECT pd.id, pd.articulo_id, a.nombre, pd.cantidad_prestada, \
                pd.cantidad_devuelta, pd.cantidad_daniada, pd.cantidad_perdida, \
                pd.cantidad_pendiente, pd.estado \
           FROM v_prestamo_detalle pd \
           JOIN articulo a ON a.id = pd.articulo_id \
          WHERE pd.prestamo_id = ?1 \
          ORDER BY pd.id",
    )?;
    let mut unidades_restantes = unidades;
    let filas = stmt.query_map([id], |row| {
        let renglon_id: i64 = row.get(0)?;
        Ok(PrestamoLinea {
            id: renglon_id,
            articulo_id: row.get(1)?,
            articulo: row.get(2)?,
            cantidad_prestada: row.get(3)?,
            cantidad_devuelta: row.get(4)?,
            cantidad_daniada: row.get(5)?,
            cantidad_perdida: row.get(6)?,
            cantidad_pendiente: row.get(7)?,
            estado: row.get(8)?,
            unidades: unidades_restantes.remove(&renglon_id).unwrap_or_default(),
        })
    })?;
    let lineas = filas.collect::<rusqlite::Result<Vec<_>>>()?;

    Ok(Some(PrestamoDetalle {
        id,
        folio,
        estudiante_id,
        nombre_completo,
        codigo_universitario,
        fecha_prestamo,
        fecha_limite,
        estado,
        vencido,
        comentario,
        cerrado_en,
        creado_en,
        renglones,
        unidades_prestadas,
        unidades_pendientes,
        lineas,
    }))
}

/// Códigos de unidad individual agrupados por `prestamo_detalle_id`.
///
/// Solo hay filas para artículos con `articulo.control_individual = 1`; el resto
/// devuelve un mapa sin entradas y cada renglón queda con `unidades` vacío.
fn unidades_por_renglon(
    conn: &Connection,
    prestamo_id: i64,
) -> rusqlite::Result<HashMap<i64, Vec<String>>> {
    let mut stmt = conn.prepare(
        "SELECT au.prestamo_detalle_id, au.codigo \
           FROM articulo_unidad au \
           JOIN prestamo_detalle pd ON pd.id = au.prestamo_detalle_id \
          WHERE pd.prestamo_id = ?1 \
          ORDER BY au.codigo",
    )?;
    let filas = stmt.query_map([prestamo_id], |row| {
        Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
    })?;
    let mut mapa: HashMap<i64, Vec<String>> = HashMap::new();
    for fila in filas {
        let (renglon_id, codigo) = fila?;
        mapa.entry(renglon_id).or_default().push(codigo);
    }
    Ok(mapa)
}

// ---------------------------------------------------------------------------
// Escrituras de préstamo (Etapa E1). Todas operan sobre la transacción que abre
// el comando; ninguna hace `commit`.
// ---------------------------------------------------------------------------

/// Reserva y devuelve el siguiente folio del año (`PRE-AAAA-NNNNNN`, RN-20).
///
/// El correlativo vive en `configuracion` bajo la clave `folio_prestamo_<año>`
/// (igual que la aplicación original). Incrementa y persiste el contador con un
/// *upsert* en la misma transacción, de modo que el folio es único y no se
/// reutiliza: si la transacción revierte, el contador vuelve atrás (no consume).
pub fn siguiente_folio(conn: &Connection, anio: &str) -> rusqlite::Result<String> {
    let clave = format!("folio_prestamo_{anio}");
    let actual: Option<String> = conn
        .query_row(
            "SELECT valor FROM configuracion WHERE clave = ?1",
            [&clave],
            |row| row.get(0),
        )
        .optional()?;
    let siguiente = actual.and_then(|v| v.trim().parse::<i64>().ok()).unwrap_or(0) + 1;

    conn.execute(
        "INSERT INTO configuracion (clave, valor, actualizado_en) \
         VALUES (?1, ?2, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) \
         ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, \
             actualizado_en = excluded.actualizado_en",
        rusqlite::params![clave, siguiente.to_string()],
    )?;

    Ok(format!("PRE-{anio}-{siguiente:06}"))
}

/// Inserta la cabecera de un préstamo `activo` y devuelve su identificador.
///
/// `creado_en` coincide con `fecha_prestamo` (el préstamo nace en el momento de
/// la entrega). `cerrado_en` queda en `NULL` porque acaba de abrirse.
pub fn insertar_prestamo(
    conn: &Connection,
    folio: &str,
    estudiante_id: i64,
    fecha_prestamo: &str,
    fecha_limite: Option<&str>,
    comentario: Option<&str>,
) -> rusqlite::Result<i64> {
    conn.execute(
        "INSERT INTO prestamo \
         (folio, estudiante_id, fecha_prestamo, fecha_limite, estado, comentario, \
          creado_en, cerrado_en) \
         VALUES (?1, ?2, ?3, ?4, 'activo', ?5, ?3, NULL)",
        rusqlite::params![folio, estudiante_id, fecha_prestamo, fecha_limite, comentario],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Inserta un renglón `pendiente` de un préstamo y devuelve su identificador.
///
/// Todo renglón nace sin devolución ni incidente; el estado derivado coherente
/// con esas cantidades es `pendiente` (CHECK de `prestamo_detalle`).
pub fn insertar_detalle(
    conn: &Connection,
    prestamo_id: i64,
    articulo_id: i64,
    cantidad_prestada: i64,
) -> rusqlite::Result<i64> {
    conn.execute(
        "INSERT INTO prestamo_detalle \
         (prestamo_id, articulo_id, cantidad_prestada, cantidad_devuelta, \
          cantidad_daniada, cantidad_perdida, estado, notas) \
         VALUES (?1, ?2, ?3, 0, 0, 0, 'pendiente', NULL)",
        rusqlite::params![prestamo_id, articulo_id, cantidad_prestada],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Indicadores de las tarjetas resumen, en una sola consulta.
///
/// Cada conteo es una subconsulta independiente sobre `prestamo`, así que un
/// préstamo con varios renglones no se cuenta dos veces. `hoy` (`YYYY-MM-DD`)
/// fija la referencia del vencimiento.
pub fn obtener_estadisticas(
    conn: &Connection,
    hoy: &str,
) -> rusqlite::Result<EstadisticasPrestamos> {
    conn.query_row(
        "SELECT \
             (SELECT COUNT(*) FROM prestamo), \
             (SELECT COUNT(*) FROM prestamo WHERE estado = 'activo'), \
             (SELECT COUNT(*) FROM prestamo WHERE estado = 'cerrado'), \
             (SELECT COUNT(*) FROM prestamo \
               WHERE estado = 'activo' AND fecha_limite IS NOT NULL \
                 AND date(fecha_limite) < ?1), \
             (SELECT COUNT(*) FROM prestamo WHERE estado = 'anulado'), \
             (SELECT COALESCE(SUM(v.cantidad_pendiente), 0) \
                FROM v_prestamo_detalle v \
                JOIN prestamo p ON p.id = v.prestamo_id \
               WHERE p.estado = 'activo')",
        [hoy],
        |row| {
            Ok(EstadisticasPrestamos {
                total: row.get(0)?,
                activos: row.get(1)?,
                finalizados: row.get(2)?,
                vencidos: row.get(3)?,
                anulados: row.get(4)?,
                unidades_pendientes: row.get(5)?,
            })
        },
    )
}

// ---------------------------------------------------------------------------
// Renglones para el registro de devoluciones (Etapa E1). Solo lectura salvo
// [`actualizar_cantidades_detalle`] y [`cerrar_prestamo`], que operan sobre la
// transacción que abre el comando y nunca hacen `commit`.
// ---------------------------------------------------------------------------

/// Renglón de préstamo con los datos reales que una devolución necesita.
///
/// Reúne las cantidades persistidas del renglón más el `control_individual` y el
/// nombre del artículo, tomados por sus llaves reales; `cantidad_pendiente` es la
/// derivada de la vista `v_prestamo_detalle`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RenglonPrestamo {
    pub id: i64,
    pub prestamo_id: i64,
    pub articulo_id: i64,
    pub articulo: String,
    pub control_individual: bool,
    pub cantidad_prestada: i64,
    pub cantidad_devuelta: i64,
    pub cantidad_daniada: i64,
    pub cantidad_perdida: i64,
    pub cantidad_pendiente: i64,
}

/// Lee un renglón de préstamo con su artículo, o `None` si no existe.
pub fn leer_renglon(
    conn: &Connection,
    id: i64,
) -> rusqlite::Result<Option<RenglonPrestamo>> {
    conn.query_row(
        "SELECT pd.id, pd.prestamo_id, pd.articulo_id, a.nombre, a.control_individual, \
                pd.cantidad_prestada, pd.cantidad_devuelta, pd.cantidad_daniada, \
                pd.cantidad_perdida, pd.cantidad_pendiente \
           FROM v_prestamo_detalle pd \
           JOIN articulo a ON a.id = pd.articulo_id \
          WHERE pd.id = ?1",
        [id],
        |row| {
            Ok(RenglonPrestamo {
                id: row.get(0)?,
                prestamo_id: row.get(1)?,
                articulo_id: row.get(2)?,
                articulo: row.get(3)?,
                control_individual: row.get::<_, i64>(4)? != 0,
                cantidad_prestada: row.get(5)?,
                cantidad_devuelta: row.get(6)?,
                cantidad_daniada: row.get(7)?,
                cantidad_perdida: row.get(8)?,
                cantidad_pendiente: row.get(9)?,
            })
        },
    )
    .optional()
}

/// Fija las cantidades acumuladas y el estado derivado de un renglón.
///
/// Las cantidades ya incluyen lo que devuelve el evento en curso. El estado lo
/// calcula el servicio de forma coherente con el `CHECK` de `prestamo_detalle`.
/// Devuelve las filas afectadas (0 si el renglón no existe).
pub fn actualizar_cantidades_detalle(
    conn: &Connection,
    id: i64,
    cantidad_devuelta: i64,
    cantidad_daniada: i64,
    cantidad_perdida: i64,
    estado: &str,
) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE prestamo_detalle \
         SET cantidad_devuelta = ?1, cantidad_daniada = ?2, cantidad_perdida = ?3, \
             estado = ?4 \
         WHERE id = ?5",
        rusqlite::params![
            cantidad_devuelta,
            cantidad_daniada,
            cantidad_perdida,
            estado,
            id
        ],
    )
}

/// Estado real de un préstamo (`activo`, `cerrado`, `anulado`), o `None` si no
/// existe.
pub fn leer_estado_prestamo(conn: &Connection, id: i64) -> rusqlite::Result<Option<String>> {
    conn.query_row("SELECT estado FROM prestamo WHERE id = ?1", [id], |row| {
        row.get(0)
    })
    .optional()
}

/// Identificador del estudiante de un préstamo, o `None` si no existe.
pub fn estudiante_id_prestamo(conn: &Connection, id: i64) -> rusqlite::Result<Option<i64>> {
    conn.query_row(
        "SELECT estudiante_id FROM prestamo WHERE id = ?1",
        [id],
        |row| row.get(0),
    )
    .optional()
}

/// Cierra un préstamo `activo` registrando el momento del cierre (RN-35).
///
/// Solo actúa si el préstamo sigue `activo`: un préstamo ya cerrado o anulado no
/// se toca. Devuelve las filas afectadas.
pub fn cerrar_prestamo(
    conn: &Connection,
    id: i64,
    momento: &str,
) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE prestamo SET estado = 'cerrado', cerrado_en = ?1 \
         WHERE id = ?2 AND estado = 'activo'",
        rusqlite::params![momento, id],
    )
}

/// Suma de las cantidades pendientes de todos los renglones de un préstamo.
///
/// Recorre la vista `v_prestamo_detalle`, así que un renglón devuelto, dañado o
/// perdido por completo no aporta y un préstamo sin renglones pendientes da 0.
pub fn pendiente_total(conn: &Connection, prestamo_id: i64) -> rusqlite::Result<i64> {
    conn.query_row(
        "SELECT COALESCE(SUM(cantidad_pendiente), 0) FROM v_prestamo_detalle \
         WHERE prestamo_id = ?1",
        [prestamo_id],
        |row| row.get(0),
    )
}
