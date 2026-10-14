//! Servicio de Préstamos: registro de un préstamo (Etapa E1).
//!
//! Aplica RN-16 a RN-25, RN-48 y RN-50 a RN-53 sobre una transacción ya abierta
//! por el llamador (el comando abre una `IMMEDIATE`), de modo que validar,
//! generar el folio y escribir préstamo, renglones, inventario y movimientos sea
//! un todo o nada. Nunca hace `commit`: si cualquier paso falla, el llamador
//! descarta la transacción y no queda rastro.
//!
//! - Un préstamo nace `activo` con un renglón por artículo; cada renglón empieza
//!   `pendiente` (RN-17, RN-18).
//! - Los artículos sin control individual se descuentan por cantidad; los que
//!   tienen control individual se prestan eligiendo unidades concretas, que
//!   quedan `prestada` y vinculadas al renglón (RN-50, RN-53).
//! - El folio `PRE-AAAA-NNNNNN` sale de `configuracion` dentro de la misma
//!   transacción (RN-20): es único y no se consume si algo revierte.
//! - Un estudiante puede tener varios préstamos activos a la vez (RN-16).

use std::collections::HashSet;
use std::fmt;

use rusqlite::{Connection, Transaction};

use crate::models::inventory::ArticuloInventario;
use crate::repositories::inventory as inventario_repo;
use crate::repositories::prestamos as repo;
use crate::repositories::students as estudiantes_repo;
use crate::services::inventory::{self, ErrorInventario, TipoMovimiento};
use crate::services::texto::limpiar_opcional;
use crate::services::units::{self, ErrorUnidad};

/// Motivo con el que se registra cada movimiento de préstamo (RN-05).
const MOTIVO_PRESTAMO: &str = "Préstamo registrado";

/// Una línea ya desacoplada del contrato IPC.
///
/// `cantidad` y `unidad_ids` son excluyentes para un mismo artículo: los
/// artículos sin control individual usan `cantidad`; los de control individual,
/// `unidad_ids`.
#[derive(Debug, Clone)]
pub struct LineaPrestamo {
    pub articulo_id: i64,
    pub cantidad: Option<i64>,
    pub unidad_ids: Vec<i64>,
}

/// Registra un préstamo completo y devuelve su identificador.
///
/// Todo ocurre dentro de `tx`. Orden: fijar la fecha, validar estudiante,
/// agrupar y validar líneas (RN-18, RN-21), validar la fecha límite, reservar el
/// folio (RN-20) e insertar cabecera, renglones, movimientos y unidades.
pub fn registrar(
    tx: &Transaction<'_>,
    estudiante_id: i64,
    lineas: &[LineaPrestamo],
    fecha_limite: Option<&str>,
    comentario: Option<&str>,
) -> Result<i64, ErrorPrestamo> {
    let momento = repo::fecha_hora_local(tx)?;

    verificar_estudiante_activo(tx, estudiante_id)?;

    let agrupadas = agrupar(lineas);
    if agrupadas.is_empty() {
        return Err(ErrorPrestamo::SinLineas);
    }

    let fecha_limite = validar_fecha_limite(tx, fecha_limite, &momento)?;
    let comentario = limpiar_opcional(comentario);

    // Se validan todas las líneas antes de escribir nada, para que un error en
    // la última no deje un folio consumido ni filas a medio insertar.
    let mut preparadas: Vec<(&LineaPrestamo, ArticuloInventario)> = Vec::new();
    for linea in &agrupadas {
        let articulo = obtener_articulo_prestable(tx, linea.articulo_id)?;
        validar_linea(tx, linea, &articulo)?;
        preparadas.push((linea, articulo));
    }

    let anio = momento.get(..4).unwrap_or_default();
    let folio = repo::siguiente_folio(tx, anio)?;
    let prestamo_id = repo::insertar_prestamo(
        tx,
        &folio,
        estudiante_id,
        &momento,
        fecha_limite.as_deref(),
        comentario,
    )?;

    for (linea, articulo) in preparadas {
        entregar(tx, prestamo_id, linea, &articulo)?;
    }

    Ok(prestamo_id)
}

/// Entrega un renglón: inserta el detalle y descuenta el inventario.
fn entregar(
    tx: &Transaction<'_>,
    prestamo_id: i64,
    linea: &LineaPrestamo,
    articulo: &ArticuloInventario,
) -> Result<(), ErrorPrestamo> {
    if articulo.control_individual {
        let cantidad = linea.unidad_ids.len() as i64;
        let detalle_id = repo::insertar_detalle(tx, prestamo_id, articulo.id, cantidad)?;

        for unidad_id in &linea.unidad_ids {
            let filas = inventario_repo::marcar_unidad_prestada(tx, *unidad_id, detalle_id)?;
            if filas == 0 {
                return Err(ErrorPrestamo::UnidadNoExiste(*unidad_id));
            }
            inventory::aplicar_movimiento(
                tx,
                articulo.id,
                Some(*unidad_id),
                TipoMovimiento::Prestamo,
                1,
                MOTIVO_PRESTAMO,
                Some("prestamo"),
                Some(prestamo_id),
            )
            .map_err(ErrorPrestamo::Movimiento)?;
        }

        // Los contadores del artículo tienen que seguir cuadrando con sus
        // unidades tras mover cada una (RN-61).
        units::conciliar(tx, articulo.id).map_err(ErrorPrestamo::Conciliar)?;
    } else {
        let cantidad = linea.cantidad.unwrap_or(0);
        repo::insertar_detalle(tx, prestamo_id, articulo.id, cantidad)?;
        inventory::aplicar_movimiento(
            tx,
            articulo.id,
            None,
            TipoMovimiento::Prestamo,
            cantidad,
            MOTIVO_PRESTAMO,
            Some("prestamo"),
            Some(prestamo_id),
        )
        .map_err(ErrorPrestamo::Movimiento)?;
    }
    Ok(())
}

/// Valida una línea ya agrupada contra su artículo.
fn validar_linea(
    conn: &Connection,
    linea: &LineaPrestamo,
    articulo: &ArticuloInventario,
) -> Result<(), ErrorPrestamo> {
    if articulo.control_individual {
        if linea.cantidad.is_some() {
            return Err(ErrorPrestamo::ControlIndividualNoAdmiteCantidad(
                articulo.nombre.clone(),
            ));
        }
        if linea.unidad_ids.is_empty() {
            return Err(ErrorPrestamo::ControlIndividualRequiereUnidades(
                articulo.nombre.clone(),
            ));
        }

        let mut vistas: HashSet<i64> = HashSet::new();
        for unidad_id in &linea.unidad_ids {
            if !vistas.insert(*unidad_id) {
                return Err(ErrorPrestamo::UnidadDuplicada(*unidad_id));
            }
        }

        for unidad_id in &linea.unidad_ids {
            let unidad = inventario_repo::leer_unidad(conn, *unidad_id)?
                .ok_or(ErrorPrestamo::UnidadNoExiste(*unidad_id))?;
            if unidad.articulo_id != articulo.id {
                return Err(ErrorPrestamo::UnidadNoPertenece {
                    codigo: unidad.codigo,
                    articulo: articulo.nombre.clone(),
                });
            }
            if unidad.estado != "disponible" {
                return Err(ErrorPrestamo::UnidadNoDisponible {
                    codigo: unidad.codigo,
                    estado: unidad.estado,
                });
            }
        }

        let solicitado = linea.unidad_ids.len() as i64;
        if solicitado > articulo.cantidad_disponible {
            return Err(ErrorPrestamo::DisponibleInsuficiente {
                articulo: articulo.nombre.clone(),
                disponible: articulo.cantidad_disponible,
                solicitado,
            });
        }
    } else {
        if !linea.unidad_ids.is_empty() {
            return Err(ErrorPrestamo::SinControlIndividualNoAdmiteUnidades(
                articulo.nombre.clone(),
            ));
        }
        let cantidad = linea.cantidad.unwrap_or(0);
        if cantidad <= 0 {
            return Err(ErrorPrestamo::CantidadInvalida);
        }
        if cantidad > articulo.cantidad_disponible {
            return Err(ErrorPrestamo::DisponibleInsuficiente {
                articulo: articulo.nombre.clone(),
                disponible: articulo.cantidad_disponible,
                solicitado: cantidad,
            });
        }
    }
    Ok(())
}

/// Comprueba que el estudiante exista y esté activo (RN-16, RF-EST-06).
fn verificar_estudiante_activo(
    conn: &Connection,
    estudiante_id: i64,
) -> Result<(), ErrorPrestamo> {
    let estudiante = estudiantes_repo::leer_estudiante(conn, estudiante_id)?
        .ok_or(ErrorPrestamo::EstudianteNoExiste(estudiante_id))?;
    if !estudiante.activo {
        return Err(ErrorPrestamo::EstudianteInactivo(estudiante_id));
    }
    Ok(())
}

/// Lee un artículo exigiendo que exista, esté activo y sea prestable.
fn obtener_articulo_prestable(
    conn: &Connection,
    articulo_id: i64,
) -> Result<ArticuloInventario, ErrorPrestamo> {
    let articulo = inventario_repo::leer_articulo(conn, articulo_id)?
        .ok_or(ErrorPrestamo::ArticuloNoExiste(articulo_id))?;
    if !articulo.activo {
        return Err(ErrorPrestamo::ArticuloInactivo(articulo.nombre));
    }
    if !articulo.prestable {
        return Err(ErrorPrestamo::ArticuloNoPrestable(articulo.nombre));
    }
    Ok(articulo)
}

/// Agrupa por artículo (RN-18): suma cantidades o concatena unidades.
///
/// Mezclar `cantidad` y `unidad_ids` para un mismo artículo es inconsistente y
/// se marca como línea mixta; el error lo producirá [`validar_linea`] contra el
/// artículo real.
fn agrupar(lineas: &[LineaPrestamo]) -> Vec<LineaPrestamo> {
    let mut agrupadas: Vec<LineaPrestamo> = Vec::new();
    for linea in lineas {
        match agrupadas
            .iter_mut()
            .find(|previa| previa.articulo_id == linea.articulo_id)
        {
            Some(previa) => {
                if let Some(cantidad) = linea.cantidad {
                    previa.cantidad = Some(previa.cantidad.unwrap_or(0) + cantidad);
                }
                previa.unidad_ids.extend(&linea.unidad_ids);
            }
            None => agrupadas.push(linea.clone()),
        }
    }
    agrupadas
}

/// Normaliza y valida la fecha límite opcional (RN-25).
///
/// Vacía o ausente significa "sin vencimiento" (`None`). Una fecha mal formada es
/// un error, y no puede ser anterior a la fecha de entrega.
fn validar_fecha_limite(
    conn: &Connection,
    fecha_limite: Option<&str>,
    momento: &str,
) -> Result<Option<String>, ErrorPrestamo> {
    let Some(texto) = limpiar_opcional(fecha_limite) else {
        return Ok(None);
    };
    let fecha: Option<String> = conn.query_row("SELECT date(?1)", [texto], |row| row.get(0))?;
    let Some(fecha) = fecha else {
        return Err(ErrorPrestamo::FechaLimiteInvalida(texto.to_string()));
    };
    let entrega: String = conn.query_row("SELECT date(?1)", [momento], |row| row.get(0))?;
    if fecha < entrega {
        return Err(ErrorPrestamo::FechaLimiteAnterior(fecha));
    }
    Ok(Some(fecha))
}

/// Errores tipados del servicio de préstamos.
#[derive(Debug)]
pub enum ErrorPrestamo {
    /// El préstamo no incluye ningún artículo (RN-17).
    SinLineas,
    /// No existe el estudiante indicado.
    EstudianteNoExiste(i64),
    /// El estudiante existe pero está inactivo (RF-EST-06).
    EstudianteInactivo(i64),
    /// No existe el artículo indicado.
    ArticuloNoExiste(i64),
    /// El artículo existe pero está desactivado.
    ArticuloInactivo(String),
    /// El artículo no admite préstamos (RF-INV-09).
    ArticuloNoPrestable(String),
    /// La cantidad de un artículo debe ser al menos 1 (RN-17).
    CantidadInvalida,
    /// No hay disponibilidad suficiente (RN-19, RN-21).
    DisponibleInsuficiente {
        articulo: String,
        disponible: i64,
        solicitado: i64,
    },
    /// Un artículo con control individual no se presta por cantidad (RN-50).
    ControlIndividualNoAdmiteCantidad(String),
    /// Un artículo con control individual se presta eligiendo unidades (RN-50).
    ControlIndividualRequiereUnidades(String),
    /// Un artículo sin control individual no admite unidades (RN-50).
    SinControlIndividualNoAdmiteUnidades(String),
    /// No existe la unidad individual indicada.
    UnidadNoExiste(i64),
    /// La unidad pertenece a otro artículo.
    UnidadNoPertenece { codigo: String, articulo: String },
    /// La unidad no está disponible (RN-52).
    UnidadNoDisponible { codigo: String, estado: String },
    /// La misma unidad aparece dos veces en la solicitud.
    UnidadDuplicada(i64),
    /// La fecha límite no es una fecha válida (RN-25).
    FechaLimiteInvalida(String),
    /// La fecha límite es anterior a la entrega.
    FechaLimiteAnterior(String),
    /// Fallo al registrar un movimiento de inventario.
    Movimiento(ErrorInventario),
    /// Los contadores no coinciden con las unidades tras prestar (RN-61).
    Conciliar(ErrorUnidad),
    /// Error de SQLite.
    Sqlite(rusqlite::Error),
}

impl fmt::Display for ErrorPrestamo {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ErrorPrestamo::SinLineas => write!(
                f,
                "El préstamo debe incluir al menos un artículo con cantidad mayor que cero."
            ),
            ErrorPrestamo::EstudianteNoExiste(id) => {
                write!(f, "No existe el estudiante con id {id}.")
            }
            ErrorPrestamo::EstudianteInactivo(_) => write!(
                f,
                "El estudiante está inactivo y no puede recibir préstamos nuevos."
            ),
            ErrorPrestamo::ArticuloNoExiste(id) => {
                write!(f, "No existe el artículo con id {id}.")
            }
            ErrorPrestamo::ArticuloInactivo(articulo) => {
                write!(f, "El artículo «{articulo}» está desactivado.")
            }
            ErrorPrestamo::ArticuloNoPrestable(articulo) => {
                write!(f, "El artículo «{articulo}» no puede prestarse.")
            }
            ErrorPrestamo::CantidadInvalida => write!(
                f,
                "La cantidad de cada artículo debe ser un número entero mayor que cero."
            ),
            ErrorPrestamo::DisponibleInsuficiente {
                articulo,
                disponible,
                solicitado,
            } => write!(
                f,
                "Solo hay {disponible} unidades disponibles de «{articulo}» y se pidieron {solicitado}."
            ),
            ErrorPrestamo::ControlIndividualNoAdmiteCantidad(articulo) => write!(
                f,
                "El artículo «{articulo}» tiene control individual: elige sus unidades en lugar de una cantidad."
            ),
            ErrorPrestamo::ControlIndividualRequiereUnidades(articulo) => write!(
                f,
                "El artículo «{articulo}» tiene control individual: indica las unidades que se prestan."
            ),
            ErrorPrestamo::SinControlIndividualNoAdmiteUnidades(articulo) => write!(
                f,
                "El artículo «{articulo}» no tiene control individual: préstalo por cantidad."
            ),
            ErrorPrestamo::UnidadNoExiste(id) => {
                write!(f, "No existe la unidad con id {id}.")
            }
            ErrorPrestamo::UnidadNoPertenece { codigo, articulo } => write!(
                f,
                "La unidad «{codigo}» no pertenece al artículo «{articulo}»."
            ),
            ErrorPrestamo::UnidadNoDisponible { codigo, estado } => write!(
                f,
                "La unidad «{codigo}» no está disponible (estado «{estado}»)."
            ),
            ErrorPrestamo::UnidadDuplicada(id) => {
                write!(f, "La unidad con id {id} aparece más de una vez.")
            }
            ErrorPrestamo::FechaLimiteInvalida(valor) => {
                write!(f, "La fecha límite «{valor}» no es una fecha válida.")
            }
            ErrorPrestamo::FechaLimiteAnterior(fecha) => write!(
                f,
                "La fecha límite ({fecha}) no puede ser anterior a la fecha del préstamo."
            ),
            ErrorPrestamo::Movimiento(e) => write!(f, "{e}"),
            ErrorPrestamo::Conciliar(e) => write!(f, "{e}"),
            ErrorPrestamo::Sqlite(e) => write!(f, "Error de base de datos: {e}"),
        }
    }
}

impl std::error::Error for ErrorPrestamo {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            ErrorPrestamo::Movimiento(e) => Some(e),
            ErrorPrestamo::Conciliar(e) => Some(e),
            ErrorPrestamo::Sqlite(e) => Some(e),
            _ => None,
        }
    }
}

impl From<rusqlite::Error> for ErrorPrestamo {
    fn from(error: rusqlite::Error) -> Self {
        ErrorPrestamo::Sqlite(error)
    }
}
