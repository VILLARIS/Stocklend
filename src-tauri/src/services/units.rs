//! Servicio de unidades individuales (Fase F4).
//!
//! Gestiona el alta, la edición y los cambios de estado permitidos de las
//! unidades de un artículo con `control_individual = 1`. Aplica RN-50 a RN-53 y
//! RN-58 a RN-61:
//!
//! - Solo hay unidades para artículos con control individual.
//! - El código es obligatorio, no vacío y único globalmente (sin distinguir
//!   mayúsculas).
//! - Cada cambio de estado mueve la unidad de exactamente un cubo a otro y
//!   actualiza los contadores y el libro en la misma transacción.
//! - Los contadores del artículo deben coincidir con sus unidades (conciliación
//!   RN-61), contando el total sin las unidades en `baja`.
//!
//! Opera sobre una transacción ya abierta por el llamador; nunca hace `commit`.

use std::collections::HashSet;
use std::fmt;

use rusqlite::{Connection, Transaction};

use crate::repositories::inventory as repo;
use crate::services::inventory::{self, Contadores, ErrorInventario, TipoMovimiento};
use crate::services::texto::limpiar_opcional;

/// Límite documentado del motivo de un movimiento (UI_FLOWS §6.1).
pub const MAX_MOTIVO: usize = 200;
/// Motivo con el que se registra el alta de una unidad individual.
const MOTIVO_ALTA: &str = "Alta de unidad";

/// Datos de una unidad nueva, desacoplados del contrato IPC.
pub struct NuevaUnidad<'a> {
    pub codigo: &'a str,
    pub descripcion: Option<&'a str>,
}

/// Inserta las unidades de un artículo recién creado.
///
/// Valida que ningún código se repita dentro de la propia solicitud ni contra
/// la base. No registra movimientos: el alta del artículo se anota como un único
/// movimiento agregado en [`crate::services::articles::crear`].
pub fn crear_lote(
    tx: &Transaction<'_>,
    articulo_id: i64,
    unidades: &[NuevaUnidad<'_>],
) -> Result<(), ErrorUnidad> {
    let mut vistos: HashSet<String> = HashSet::new();
    for unidad in unidades {
        let codigo = validar_codigo(unidad.codigo)?;
        if !vistos.insert(normalizar_codigo(&codigo)) {
            return Err(ErrorUnidad::CodigoDuplicado(codigo));
        }
    }

    for unidad in unidades {
        let codigo = validar_codigo(unidad.codigo)?;
        verificar_codigo_unico(tx, &codigo, None)?;
        let descripcion = limpiar_opcional(unidad.descripcion);
        repo::insertar_unidad(tx, articulo_id, &codigo, descripcion)?;
    }

    Ok(())
}

/// Agrega una unidad `disponible` a un artículo con control individual.
///
/// Inserta la unidad, suma uno al total y a lo disponible vía `ajuste_positivo`
/// y concilia los contadores. Devuelve el identificador de la unidad.
pub fn agregar(
    tx: &Transaction<'_>,
    articulo_id: i64,
    codigo: &str,
    descripcion: Option<&str>,
) -> Result<i64, ErrorUnidad> {
    let articulo = repo::leer_articulo(tx, articulo_id)?
        .ok_or(ErrorUnidad::ArticuloNoExiste(articulo_id))?;
    if !articulo.activo {
        return Err(ErrorUnidad::ArticuloInactivo(articulo_id));
    }
    if !articulo.control_individual {
        return Err(ErrorUnidad::SinControlIndividual(articulo_id));
    }

    let codigo = validar_codigo(codigo)?;
    verificar_codigo_unico(tx, &codigo, None)?;
    let descripcion = limpiar_opcional(descripcion);

    let id = repo::insertar_unidad(tx, articulo_id, &codigo, descripcion)?;

    inventory::aplicar_movimiento(
        tx,
        articulo_id,
        Some(id),
        TipoMovimiento::AjustePositivo,
        1,
        MOTIVO_ALTA,
        Some("ajuste"),
        None,
    )
    .map_err(ErrorUnidad::Movimiento)?;

    conciliar(tx, articulo_id)?;
    Ok(id)
}

/// Edita código, descripción y notas de una unidad.
///
/// No cambia el estado, los contadores ni el préstamo asociado, y no registra
/// movimientos.
pub fn actualizar(
    tx: &Transaction<'_>,
    id: i64,
    codigo: &str,
    descripcion: Option<&str>,
    notas: Option<&str>,
) -> Result<(), ErrorUnidad> {
    if repo::leer_unidad(tx, id)?.is_none() {
        return Err(ErrorUnidad::NoExiste(id));
    }

    let codigo = validar_codigo(codigo)?;
    verificar_codigo_unico(tx, &codigo, Some(id))?;
    let descripcion = limpiar_opcional(descripcion);
    let notas = limpiar_opcional(notas);

    let filas = repo::actualizar_unidad(tx, id, &codigo, descripcion, notas)?;
    if filas == 0 {
        return Err(ErrorUnidad::NoExiste(id));
    }
    Ok(())
}

/// Cambia el estado de una unidad dentro de las transiciones permitidas.
///
/// Cada transición mueve la unidad de un cubo a otro con el movimiento que
/// declara su origen (RN-59) y actualiza los contadores en la misma transacción.
pub fn cambiar_estado(
    tx: &Transaction<'_>,
    id: i64,
    estado: &str,
    motivo: &str,
) -> Result<(), ErrorUnidad> {
    let unidad = repo::leer_unidad(tx, id)?.ok_or(ErrorUnidad::NoExiste(id))?;
    let desde = unidad.estado;
    let hacia = estado.trim().to_ascii_lowercase();

    let tipo = transicion(&desde, &hacia).ok_or_else(|| ErrorUnidad::TransicionNoPermitida {
        desde: desde.clone(),
        hacia: hacia.clone(),
    })?;
    let motivo = validar_motivo(motivo)?;

    let filas = repo::cambiar_estado_unidad(tx, id, &hacia)?;
    if filas == 0 {
        return Err(ErrorUnidad::NoExiste(id));
    }

    inventory::aplicar_movimiento(tx, unidad.articulo_id, Some(id), tipo, 1, motivo, None, None)
        .map_err(ErrorUnidad::Movimiento)?;

    conciliar(tx, unidad.articulo_id)?;
    Ok(())
}

/// Comprueba que los contadores del artículo coincidan con sus unidades
/// (RN-61). Falla si el artículo no existe.
pub fn conciliar(conn: &Connection, articulo_id: i64) -> Result<(), ErrorUnidad> {
    let (total, disponible, prestada, danada, faltante) =
        repo::contar_unidades_por_estado(conn, articulo_id)?;
    let esperado = Contadores {
        total,
        disponible,
        prestada,
        danada,
        faltante,
    };
    let actual = inventory::leer_contadores(conn, articulo_id)
        .map_err(ErrorUnidad::Movimiento)?;
    if actual != esperado {
        return Err(ErrorUnidad::Incoherente(articulo_id));
    }
    Ok(())
}

/// Transiciones de estado permitidas en esta fase y su movimiento asociado.
///
/// `prestada` queda fuera a propósito: la gestionan Préstamos y Devoluciones.
/// `disponible → danada/faltante` requiere una incidencia y se añadirá después.
fn transicion(desde: &str, hacia: &str) -> Option<TipoMovimiento> {
    match (desde, hacia) {
        ("danada", "disponible") => Some(TipoMovimiento::ReingresoReparacion),
        ("danada", "baja") => Some(TipoMovimiento::BajaDaniada),
        ("faltante", "baja") => Some(TipoMovimiento::BajaFaltante),
        _ => None,
    }
}

/// Código obligatorio y recortado.
fn validar_codigo(codigo: &str) -> Result<String, ErrorUnidad> {
    let recortado = codigo.trim();
    if recortado.is_empty() {
        return Err(ErrorUnidad::CodigoVacio);
    }
    Ok(recortado.to_string())
}

/// Clave de comparación de códigos: recortado y en minúsculas ASCII, que es
/// justo lo que pliega el `COLLATE NOCASE` de la columna.
fn normalizar_codigo(codigo: &str) -> String {
    codigo.trim().to_ascii_lowercase()
}

/// Falla si el código ya pertenece a otra unidad.
fn verificar_codigo_unico(
    conn: &Connection,
    codigo: &str,
    excluir: Option<i64>,
) -> Result<(), ErrorUnidad> {
    if repo::codigo_unidad_existe(conn, codigo, excluir)? {
        return Err(ErrorUnidad::CodigoDuplicado(codigo.to_string()));
    }
    Ok(())
}

/// Motivo obligatorio y no vacío.
fn validar_motivo(motivo: &str) -> Result<&str, ErrorUnidad> {
    let recortado = motivo.trim();
    if recortado.is_empty() {
        return Err(ErrorUnidad::MotivoVacio);
    }
    if recortado.chars().count() > MAX_MOTIVO {
        return Err(ErrorUnidad::MotivoMuyLargo(recortado.chars().count()));
    }
    Ok(recortado)
}

/// Errores tipados del servicio de unidades.
#[derive(Debug)]
pub enum ErrorUnidad {
    /// No existe la unidad indicada.
    NoExiste(i64),
    /// El código es obligatorio (RN-51).
    CodigoVacio,
    /// El código ya está en uso por otra unidad (RN-51).
    CodigoDuplicado(String),
    /// No existe el artículo indicado.
    ArticuloNoExiste(i64),
    /// El artículo existe pero está desactivado.
    ArticuloInactivo(i64),
    /// Solo los artículos con control individual admiten unidades (RN-50).
    SinControlIndividual(i64),
    /// La transición de estado solicitada no está permitida.
    TransicionNoPermitida { desde: String, hacia: String },
    /// El motivo del movimiento es obligatorio (RN-05).
    MotivoVacio,
    /// El motivo supera el límite documentado.
    MotivoMuyLargo(usize),
    /// Los contadores no coinciden con las unidades (RN-61).
    Incoherente(i64),
    /// Fallo al registrar el movimiento de inventario.
    Movimiento(ErrorInventario),
    /// Error de SQLite.
    Sqlite(rusqlite::Error),
}

impl fmt::Display for ErrorUnidad {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ErrorUnidad::CodigoVacio => {
                write!(f, "El código de la unidad es obligatorio.")
            }
            ErrorUnidad::CodigoDuplicado(codigo) => {
                write!(f, "Ya existe una unidad con el código «{codigo}».")
            }
            ErrorUnidad::ArticuloNoExiste(id) => {
                write!(f, "No se encontró el artículo con id {id}.")
            }
            ErrorUnidad::ArticuloInactivo(id) => {
                write!(f, "El artículo con id {id} está desactivado.")
            }
            ErrorUnidad::SinControlIndividual(id) => write!(
                f,
                "El artículo con id {id} no tiene control individual; no admite unidades."
            ),
            ErrorUnidad::TransicionNoPermitida { desde, hacia } => write!(
                f,
                "No se puede pasar una unidad de «{desde}» a «{hacia}»."
            ),
            ErrorUnidad::MotivoVacio => write!(f, "Escribe el motivo del movimiento."),
            ErrorUnidad::MotivoMuyLargo(longitud) => write!(
                f,
                "El motivo no puede pasar de {MAX_MOTIVO} caracteres (se recibieron {longitud})."
            ),
            ErrorUnidad::Incoherente(id) => write!(
                f,
                "Los contadores del artículo {id} no coinciden con sus unidades."
            ),
            ErrorUnidad::NoExiste(id) => {
                write!(f, "No se encontró la unidad con id {id}.")
            }
            ErrorUnidad::Movimiento(e) => write!(f, "{e}"),
            ErrorUnidad::Sqlite(e) => write!(f, "Error de base de datos: {e}"),
        }
    }
}

impl std::error::Error for ErrorUnidad {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            ErrorUnidad::Movimiento(e) => Some(e),
            ErrorUnidad::Sqlite(e) => Some(e),
            _ => None,
        }
    }
}

impl From<rusqlite::Error> for ErrorUnidad {
    fn from(error: rusqlite::Error) -> Self {
        ErrorUnidad::Sqlite(error)
    }
}
