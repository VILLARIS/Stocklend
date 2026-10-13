//! Servicio de categorías (Fase F2).
//!
//! Centraliza las reglas de negocio de RF-INV-02 y RN-10:
//!
//! - El nombre es obligatorio.
//! - El nombre es único ignorando mayúsculas **y** espacios (el `UNIQUE COLLATE
//!   NOCASE` de la base solo pliega mayúsculas ASCII, no espacios; aquí se
//!   normaliza para cubrir ambos casos).
//! - La descripción es opcional.
//! - Nunca se borra una categoría: solo se activa o desactiva.
//!
//! Opera sobre una transacción ya abierta por el llamador (normalmente
//! `IMMEDIATE`), de modo que la comprobación de duplicados y la escritura son
//! atómicas.

use std::fmt;

use rusqlite::Connection;

use crate::repositories::inventory as repo;

pub use crate::services::texto::normalizar_nombre;

/// Crea una categoría y devuelve su identificador.
pub fn crear(
    conn: &Connection,
    nombre: &str,
    descripcion: Option<&str>,
) -> Result<i64, ErrorCategoria> {
    let nombre = validar_nombre(nombre)?;
    let normalizado = normalizar_nombre(&nombre);
    if existe_duplicado(conn, &normalizado, None)? {
        return Err(ErrorCategoria::Duplicada(nombre));
    }

    let descripcion = limpiar_descripcion(descripcion);
    repo::insertar_categoria(conn, &nombre, descripcion).map_err(ErrorCategoria::from)
}

/// Edita nombre y descripción de una categoría existente.
pub fn actualizar(
    conn: &Connection,
    id: i64,
    nombre: &str,
    descripcion: Option<&str>,
) -> Result<(), ErrorCategoria> {
    let nombre = validar_nombre(nombre)?;
    let normalizado = normalizar_nombre(&nombre);
    if existe_duplicado(conn, &normalizado, Some(id))? {
        return Err(ErrorCategoria::Duplicada(nombre));
    }

    let descripcion = limpiar_descripcion(descripcion);
    let filas = repo::actualizar_categoria(conn, id, &nombre, descripcion)?;
    if filas == 0 {
        return Err(ErrorCategoria::NoEncontrada(id));
    }
    Ok(())
}

/// Activa o desactiva una categoría. No borra ni altera sus artículos.
pub fn cambiar_estado(conn: &Connection, id: i64, activo: bool) -> Result<(), ErrorCategoria> {
    let filas = repo::cambiar_activo_categoria(conn, id, activo)?;
    if filas == 0 {
        return Err(ErrorCategoria::NoEncontrada(id));
    }
    Ok(())
}

/// Nombre obligatorio y recortado (no se almacenan espacios sobrantes en los
/// extremos; los internos se conservan tal como los escribió la persona).
fn validar_nombre(nombre: &str) -> Result<String, ErrorCategoria> {
    let recortado = nombre.trim();
    if recortado.is_empty() {
        return Err(ErrorCategoria::NombreVacio);
    }
    Ok(recortado.to_string())
}

/// Una descripción vacía o de solo espacios se guarda como `NULL`.
fn limpiar_descripcion(descripcion: Option<&str>) -> Option<&str> {
    descripcion.map(str::trim).filter(|texto| !texto.is_empty())
}

/// Indica si existe otra categoría con el mismo nombre normalizado.
fn existe_duplicado(
    conn: &Connection,
    normalizado: &str,
    excluir: Option<i64>,
) -> Result<bool, ErrorCategoria> {
    for (id, nombre) in repo::nombres_categoria(conn)? {
        if Some(id) == excluir {
            continue;
        }
        if normalizar_nombre(&nombre) == normalizado {
            return Ok(true);
        }
    }
    Ok(false)
}

/// Errores tipados del servicio de categorías.
#[derive(Debug)]
pub enum ErrorCategoria {
    /// El nombre es obligatorio (RN-10).
    NombreVacio,
    /// Ya existe otra categoría con el mismo nombre normalizado (RN-10).
    Duplicada(String),
    /// No existe la categoría indicada.
    NoEncontrada(i64),
    /// Error de SQLite.
    Sqlite(rusqlite::Error),
}

impl fmt::Display for ErrorCategoria {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ErrorCategoria::NombreVacio => {
                write!(f, "El nombre de la categoría es obligatorio.")
            }
            ErrorCategoria::Duplicada(nombre) => {
                write!(f, "Ya existe una categoría llamada «{nombre}».")
            }
            ErrorCategoria::NoEncontrada(id) => {
                write!(f, "No se encontró la categoría con id {id}.")
            }
            ErrorCategoria::Sqlite(e) => write!(f, "No se pudo guardar la categoría: {e}"),
        }
    }
}

impl std::error::Error for ErrorCategoria {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            ErrorCategoria::Sqlite(e) => Some(e),
            _ => None,
        }
    }
}

impl From<rusqlite::Error> for ErrorCategoria {
    fn from(error: rusqlite::Error) -> Self {
        ErrorCategoria::Sqlite(error)
    }
}
