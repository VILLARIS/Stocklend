//! Consultas de Devoluciones (Etapa B). Solo lectura.
//!
//! No se inventan relaciones: cada `JOIN` corresponde a una llave foránea real
//! del esquema (`DATABASE_DESIGN.md` §6). La lista y el detalle se apoyan en las
//! vistas `v_prestamo_resumen` y `v_prestamo_detalle`; el nombre del estudiante y
//! del artículo se leen por su llave. El vencimiento se calcula comparando
//! `date(fecha_limite)` con la fecha de referencia `hoy`, que el comando obtiene
//! del reloj de SQLite (misma convención que Préstamos).
//!
//! El historial recorre `devolucion` y `devolucion_detalle` (RN-38: cada
//! devolución es un registro inmutable e independiente del cierre del préstamo).
//! Las cantidades dañadas y perdidas ya registradas se leen tal cual; esta etapa
//! no crea incidentes, no cambia estados ni escribe contadores.

use std::collections::HashMap;

use rusqlite::{Connection, OptionalExtension};

use crate::models::devoluciones::{
    DetalleDevolucion, DevolucionHistorial, DevolucionRegistrada, EstadisticasDevoluciones,
    LineaDevolucion, LineaDevolucionHistorial, PrestamoDevolucionResumen, UnidadDevolucion,
};

/// Cabecera de un préstamo por identificador (para el detalle).
const SQL_DETALLE: &str = "SELECT v.id, v.folio, v.estudiante_id, \
        TRIM(COALESCE(v.nombres, '') || ' ' || COALESCE(v.apellidos, '')), \
        v.codigo_universitario, date(v.fecha_prestamo), date(v.fecha_limite), \
        v.estado, \
        CASE WHEN v.estado = 'activo' \
                   AND v.fecha_limite IS NOT NULL \
                   AND date(v.fecha_limite) < ?2 \
             THEN 1 ELSE 0 END, \
        v.comentario, date(p.cerrado_en), date(p.creado_en) \
   FROM v_prestamo_resumen v \
   JOIN prestamo p ON p.id = v.id \
  WHERE v.id = ?1";

/// Cabecera de un evento de devolución, con el préstamo y su estudiante.
const SQL_HISTORIAL: &str = "SELECT d.id, d.prestamo_id, p.folio, \
        TRIM(COALESCE(e.nombres, '') || ' ' || COALESCE(e.apellidos, '')), \
        e.codigo_universitario, d.fecha_devolucion, d.observaciones \
   FROM devolucion d \
   JOIN prestamo p ON p.id = d.prestamo_id \
   JOIN estudiante e ON e.id = p.estudiante_id \
  WHERE (?1 IS NULL OR d.prestamo_id = ?1) \
  ORDER BY d.fecha_devolucion DESC, d.id DESC";

/// Renglones de un préstamo con sus cantidades reales.
fn filas_lineas(conn: &Connection, prestamo_id: i64) -> rusqlite::Result<Vec<LineaDevolucion>> {
    let mut unidades = unidades_por_renglon(conn, prestamo_id)?;

    let mut stmt = conn.prepare(
        "SELECT pd.id, pd.articulo_id, a.nombre, pd.cantidad_prestada, \
                pd.cantidad_devuelta, pd.cantidad_daniada, pd.cantidad_perdida, \
                pd.cantidad_pendiente, pd.estado \
           FROM v_prestamo_detalle pd \
           JOIN articulo a ON a.id = pd.articulo_id \
          WHERE pd.prestamo_id = ?1 \
          ORDER BY pd.id",
    )?;
    let filas = stmt.query_map([prestamo_id], |row| {
        let renglon_id: i64 = row.get(0)?;
        Ok(LineaDevolucion {
            id: renglon_id,
            articulo_id: row.get(1)?,
            articulo: row.get(2)?,
            cantidad_prestada: row.get(3)?,
            cantidad_devuelta: row.get(4)?,
            cantidad_daniada: row.get(5)?,
            cantidad_perdida: row.get(6)?,
            cantidad_pendiente: row.get(7)?,
            estado: row.get(8)?,
            unidades: unidades.remove(&renglon_id).unwrap_or_default(),
        })
    })?;
    filas.collect()
}

/// Unidades individuales aún prestadas, agrupadas por `prestamo_detalle_id`.
///
/// Solo se incluyen unidades con `estado = 'prestada'` cuyo renglón pertenece al
/// préstamo indicado: quedan fuera las disponibles, las dadas de baja y las de
/// otros préstamos. Los artículos sin control individual no tienen filas.
fn unidades_por_renglon(
    conn: &Connection,
    prestamo_id: i64,
) -> rusqlite::Result<HashMap<i64, Vec<UnidadDevolucion>>> {
    let mut stmt = conn.prepare(
        "SELECT au.prestamo_detalle_id, au.id, au.codigo \
           FROM articulo_unidad au \
           JOIN prestamo_detalle pd ON pd.id = au.prestamo_detalle_id \
          WHERE pd.prestamo_id = ?1 AND au.estado = 'prestada' \
          ORDER BY au.codigo",
    )?;
    let filas = stmt.query_map([prestamo_id], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            UnidadDevolucion {
                id: row.get(1)?,
                codigo: row.get(2)?,
            },
        ))
    })?;
    let mut mapa: HashMap<i64, Vec<UnidadDevolucion>> = HashMap::new();
    for fila in filas {
        let (renglon_id, unidad) = fila?;
        mapa.entry(renglon_id).or_default().push(unidad);
    }
    Ok(mapa)
}

/// Suma los cinco totales de un conjunto de renglones.
fn totales(lineas: &[LineaDevolucion]) -> (i64, i64, i64, i64, i64) {
    let mut prestadas = 0;
    let mut devueltas = 0;
    let mut daniadas = 0;
    let mut perdidas = 0;
    let mut pendientes = 0;
    for linea in lineas {
        prestadas += linea.cantidad_prestada;
        devueltas += linea.cantidad_devuelta;
        daniadas += linea.cantidad_daniada;
        perdidas += linea.cantidad_perdida;
        pendientes += linea.cantidad_pendiente;
    }
    (prestadas, devueltas, daniadas, perdidas, pendientes)
}

/// Préstamos `activo` con cantidades pendientes, del más reciente al más antiguo.
///
/// `hoy` (`YYYY-MM-DD`) fija la referencia para el vencimiento. Los préstamos
/// `cerrado` y `anulado` quedan fuera: no pueden recibir devoluciones nuevas.
pub fn listar_pendientes(
    conn: &Connection,
    hoy: &str,
) -> rusqlite::Result<Vec<PrestamoDevolucionResumen>> {
    let mut stmt = conn.prepare(SQL_RESUMEN_PENDIENTES)?;
    let cabeceras = stmt.query_map([hoy], |row| {
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
        ))
    })?;

    let mut resultado = Vec::new();
    for cabecera in cabeceras {
        let (
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
        ) = cabecera?;

        let lineas = filas_lineas(conn, id)?;
        let (prestadas, devueltas, daniadas, perdidas, pendientes) = totales(&lineas);
        resultado.push(PrestamoDevolucionResumen {
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
            renglones: lineas.len() as i64,
            unidades_prestadas: prestadas,
            unidades_devueltas: devueltas,
            unidades_daniadas: daniadas,
            unidades_perdidas: perdidas,
            unidades_pendientes: pendientes,
            lineas,
        });
    }
    Ok(resultado)
}

/// Detalle de un préstamo, o `None` si no existe.
///
/// `hoy` (`YYYY-MM-DD`) fija la referencia para el vencimiento. Se devuelve
/// también si el préstamo no está activo (para consultar su historial); en ese
/// caso `elegible` es `false`.
pub fn obtener_detalle(
    conn: &Connection,
    id: i64,
    hoy: &str,
) -> rusqlite::Result<Option<DetalleDevolucion>> {
    let cabecera = conn
        .query_row(SQL_DETALLE, rusqlite::params![id, hoy], |row| {
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
    )) = cabecera
    else {
        return Ok(None);
    };

    let lineas = filas_lineas(conn, id)?;
    let (prestadas, devueltas, daniadas, perdidas, pendientes) = totales(&lineas);
    let elegible = estado == "activo" && pendientes > 0;

    Ok(Some(DetalleDevolucion {
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
        renglones: lineas.len() as i64,
        unidades_prestadas: prestadas,
        unidades_devueltas: devueltas,
        unidades_daniadas: daniadas,
        unidades_perdidas: perdidas,
        unidades_pendientes: pendientes,
        elegible,
        lineas,
    }))
}

/// Devoluciones registradas, de la más reciente a la más antigua.
///
/// `prestamo_id` opcional filtra por préstamo; un préstamo puede tener varias
/// devoluciones (RN-36). Cada evento se lee completo e independiente del estado
/// actual del préstamo: una devolución parcial no es el cierre del préstamo.
pub fn listar_historial(
    conn: &Connection,
    prestamo_id: Option<i64>,
) -> rusqlite::Result<Vec<DevolucionHistorial>> {
    let mut stmt = conn.prepare(SQL_HISTORIAL)?;
    let cabeceras = stmt.query_map(rusqlite::params![prestamo_id], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, i64>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, String>(5)?,
            row.get::<_, Option<String>>(6)?,
        ))
    })?;

    let mut resultado = Vec::new();
    for cabecera in cabeceras {
        let (id, prestamo_id, folio, nombre_completo, codigo_universitario, fecha, observaciones) =
            cabecera?;
        let lineas = lineas_historial(conn, id)?;
        let mut devueltas = 0;
        let mut daniadas = 0;
        let mut perdidas = 0;
        for linea in &lineas {
            devueltas += linea.cantidad_devuelta;
            daniadas += linea.cantidad_daniada;
            perdidas += linea.cantidad_perdida;
        }
        resultado.push(DevolucionHistorial {
            id,
            prestamo_id,
            folio,
            nombre_completo,
            codigo_universitario,
            fecha_devolucion: fecha,
            observaciones,
            cantidad_devuelta: devueltas,
            cantidad_daniada: daniadas,
            cantidad_perdida: perdidas,
            lineas,
        });
    }
    Ok(resultado)
}

/// Renglones de una devolución, con el artículo afectado.
pub fn lineas_historial(
    conn: &Connection,
    devolucion_id: i64,
) -> rusqlite::Result<Vec<LineaDevolucionHistorial>> {
    let mut stmt = conn.prepare(
        "SELECT dd.prestamo_detalle_id, pd.articulo_id, a.nombre, \
                dd.cantidad_devuelta, dd.cantidad_daniada, dd.cantidad_perdida, dd.notas \
           FROM devolucion_detalle dd \
           JOIN prestamo_detalle pd ON pd.id = dd.prestamo_detalle_id \
           JOIN articulo a ON a.id = pd.articulo_id \
          WHERE dd.devolucion_id = ?1 \
          ORDER BY dd.id",
    )?;
    let filas = stmt.query_map([devolucion_id], |row| {
        Ok(LineaDevolucionHistorial {
            prestamo_detalle_id: row.get(0)?,
            articulo_id: row.get(1)?,
            articulo: row.get(2)?,
            cantidad_devuelta: row.get(3)?,
            cantidad_daniada: row.get(4)?,
            cantidad_perdida: row.get(5)?,
            notas: row.get(6)?,
        })
    })?;
    filas.collect()
}

/// Indicadores de las tarjetas resumen, en una sola consulta.
///
/// Cada conteo es una subconsulta independiente sobre `prestamo`, así que un
/// préstamo con varios renglones o varias devoluciones no se cuenta dos veces.
/// `hoy` (`YYYY-MM-DD`) fija la referencia del vencimiento.
pub fn obtener_estadisticas(
    conn: &Connection,
    hoy: &str,
) -> rusqlite::Result<EstadisticasDevoluciones> {
    conn.query_row(
        "SELECT \
             (SELECT COUNT(*) FROM prestamo p \
                WHERE p.estado = 'activo' \
                  AND EXISTS (SELECT 1 FROM v_prestamo_detalle d \
                               WHERE d.prestamo_id = p.id \
                                 AND d.cantidad_pendiente > 0)), \
             (SELECT COUNT(*) FROM prestamo p \
                WHERE p.estado = 'activo' \
                  AND EXISTS (SELECT 1 FROM v_prestamo_detalle d \
                               WHERE d.prestamo_id = p.id \
                                 AND d.cantidad_pendiente > 0) \
                  AND EXISTS (SELECT 1 FROM devolucion dv \
                               WHERE dv.prestamo_id = p.id)), \
             (SELECT COUNT(*) FROM prestamo WHERE estado = 'cerrado'), \
             (SELECT COUNT(*) FROM prestamo p \
                WHERE p.estado = 'activo' AND p.fecha_limite IS NOT NULL \
                  AND date(p.fecha_limite) < ?1 \
                  AND EXISTS (SELECT 1 FROM v_prestamo_detalle d \
                               WHERE d.prestamo_id = p.id \
                                 AND d.cantidad_pendiente > 0)), \
             (SELECT COALESCE(SUM(d.cantidad_pendiente), 0) \
                FROM v_prestamo_detalle d \
                JOIN prestamo p ON p.id = d.prestamo_id \
               WHERE p.estado = 'activo')",
        [hoy],
        |row| {
            Ok(EstadisticasDevoluciones {
                pendientes: row.get(0)?,
                parciales: row.get(1)?,
                completadas: row.get(2)?,
                vencidas: row.get(3)?,
                unidades_pendientes: row.get(4)?,
            })
        },
    )
}

/// Cabecera de la lista de préstamos con pendientes (para el listado).
const SQL_RESUMEN_PENDIENTES: &str = "SELECT v.id, v.folio, v.estudiante_id, \
        TRIM(COALESCE(v.nombres, '') || ' ' || COALESCE(v.apellidos, '')), \
        v.codigo_universitario, date(v.fecha_prestamo), date(v.fecha_limite), \
        v.estado, \
        CASE WHEN v.estado = 'activo' \
                   AND v.fecha_limite IS NOT NULL \
                   AND date(v.fecha_limite) < ?1 \
             THEN 1 ELSE 0 END, \
        v.comentario \
   FROM v_prestamo_resumen v \
  WHERE v.estado = 'activo' AND v.total_pendiente > 0 \
  ORDER BY v.fecha_prestamo DESC, v.id DESC";

// ---------------------------------------------------------------------------
// Escrituras de devolución (Etapa E1). Todas operan sobre la transacción que
// abre el comando; ninguna hace `commit`. Tampoco inventan folios ni códigos:
// `incidente` no tiene columna de folio en el esquema, así que no se genera uno.
// ---------------------------------------------------------------------------

/// Datos de un incidente nuevo ligado a una devolución (`origen = 'devolucion'`).
///
/// El estado nace `abierto`; la responsabilidad solo se atribuye a un estudiante
/// cuando el servicio la recibe explícitamente (RN-55, RN-56).
pub struct NuevoIncidente<'a> {
    /// `danio` o `perdida`.
    pub tipo: &'a str,
    pub prestamo_id: i64,
    pub prestamo_detalle_id: i64,
    pub devolucion_id: i64,
    pub articulo_id: i64,
    pub articulo_unidad_id: Option<i64>,
    pub estudiante_id: Option<i64>,
    /// `estudiante` o `sin_determinar`.
    pub responsabilidad: &'a str,
    pub cantidad: i64,
    pub descripcion: &'a str,
    pub momento: &'a str,
}

/// Inserta la cabecera de una devolución y devuelve su identificador.
///
/// `creado_en` coincide con `fecha_devolucion`: la devolución nace en el momento
/// del registro (RN-37) y no se modifica después (RN-38).
pub fn insertar_devolucion(
    conn: &Connection,
    prestamo_id: i64,
    momento: &str,
    observaciones: Option<&str>,
) -> rusqlite::Result<i64> {
    conn.execute(
        "INSERT INTO devolucion \
         (prestamo_id, fecha_devolucion, observaciones, creado_en) \
         VALUES (?1, ?2, ?3, ?2)",
        rusqlite::params![prestamo_id, momento, observaciones],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Inserta un renglón de devolución con las cantidades reales que vuelven.
pub fn insertar_detalle(
    conn: &Connection,
    devolucion_id: i64,
    prestamo_detalle_id: i64,
    cantidad_devuelta: i64,
    cantidad_daniada: i64,
    cantidad_perdida: i64,
    notas: Option<&str>,
) -> rusqlite::Result<i64> {
    conn.execute(
        "INSERT INTO devolucion_detalle \
         (devolucion_id, prestamo_detalle_id, cantidad_devuelta, cantidad_daniada, \
          cantidad_perdida, notas) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            devolucion_id,
            prestamo_detalle_id,
            cantidad_devuelta,
            cantidad_daniada,
            cantidad_perdida,
            notas
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Inserta un incidente `abierto` con `origen = 'devolucion'` y devuelve su id.
///
/// Cumple los `CHECK` del esquema: un incidente de devolución siempre lleva
/// `prestamo_id` y `devolucion_id`, y `responsabilidad = 'estudiante'` exige
/// `estudiante_id`.
pub fn insertar_incidente(
    conn: &Connection,
    incidente: &NuevoIncidente<'_>,
) -> rusqlite::Result<i64> {
    conn.execute(
        "INSERT INTO incidente \
         (tipo, estado, origen, prestamo_id, prestamo_detalle_id, devolucion_id, \
          articulo_id, articulo_unidad_id, estudiante_id, responsabilidad, \
          cantidad, descripcion, resolucion, resuelto_en, creado_en) \
         VALUES (?1, 'abierto', 'devolucion', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, \
                 NULL, NULL, ?11)",
        rusqlite::params![
            incidente.tipo,
            incidente.prestamo_id,
            incidente.prestamo_detalle_id,
            incidente.devolucion_id,
            incidente.articulo_id,
            incidente.articulo_unidad_id,
            incidente.estudiante_id,
            incidente.responsabilidad,
            incidente.cantidad,
            incidente.descripcion,
            incidente.momento
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Lee una devolución registrada con sus renglones y el estado actualizado del
/// préstamo, o `None` si no existe.
///
/// `prestamo_unidades_pendientes` se recalcula de la vista tras la operación, de
/// modo que el comando devuelve el estado real y no el que creía conocer.
pub fn obtener_registrada(
    conn: &Connection,
    devolucion_id: i64,
) -> rusqlite::Result<Option<DevolucionRegistrada>> {
    let cabecera = conn
        .query_row(
            "SELECT d.id, d.prestamo_id, p.folio, d.fecha_devolucion, d.observaciones, \
                    p.estado, \
                    (SELECT COALESCE(SUM(v.cantidad_pendiente), 0) \
                       FROM v_prestamo_detalle v \
                      WHERE v.prestamo_id = p.id) \
               FROM devolucion d \
               JOIN prestamo p ON p.id = d.prestamo_id \
              WHERE d.id = ?1",
            [devolucion_id],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, i64>(6)?,
                ))
            },
        )
        .optional()?;

    let Some((id, prestamo_id, folio, fecha_devolucion, observaciones, estado, pendientes)) =
        cabecera
    else {
        return Ok(None);
    };

    let lineas = lineas_historial(conn, id)?;
    let mut cantidad_devuelta = 0;
    let mut cantidad_daniada = 0;
    let mut cantidad_perdida = 0;
    for linea in &lineas {
        cantidad_devuelta += linea.cantidad_devuelta;
        cantidad_daniada += linea.cantidad_daniada;
        cantidad_perdida += linea.cantidad_perdida;
    }

    Ok(Some(DevolucionRegistrada {
        id,
        prestamo_id,
        folio,
        fecha_devolucion,
        observaciones,
        cantidad_devuelta,
        cantidad_daniada,
        cantidad_perdida,
        lineas,
        prestamo_estado: estado,
        prestamo_unidades_pendientes: pendientes,
    }))
}
