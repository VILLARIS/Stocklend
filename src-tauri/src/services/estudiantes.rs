//! Servicio de Estudiantes (escritura).
//!
//! Aplica las reglas de dominio de los estudiantes sobre una conexión ya
//! abierta, dentro de la transacción que abre el comando:
//!
//! - RN-11: el código universitario es obligatorio y único en toda la
//!   aplicación (la columna es `COLLATE NOCASE`; aquí se recorta antes de
//!   comparar, de modo que un código con espacios sobrantes no crea un
//!   duplicado).
//! - RN-12: nombres y apellidos son obligatorios y no pueden quedar en blanco.
//! - RN-14/RN-46: nada se elimina; los estudiantes solo se marcan inactivos.
//!   Además, en este proyecto no se inactiva a un estudiante que tenga préstamos
//!   activos, para no perder de vista material sin devolver.
//! - RN-15: editar los datos no toca el historial, que vive en los préstamos.
//!
//! La comprobación de duplicados y la escritura ocurren en la misma transacción,
//! de modo que son atómicas.

use std::fmt;

use rusqlite::Connection;

use crate::repositories::students as repo;

/// Registra un estudiante y devuelve su identificador.
pub fn crear(
    conn: &Connection,
    codigo_universitario: &str,
    nombres: &str,
    apellidos: &str,
) -> Result<i64, ErrorEstudiante> {
    let codigo = validar_texto(codigo_universitario, ErrorEstudiante::CodigoVacio)?;
    let nombres = validar_texto(nombres, ErrorEstudiante::NombresVacios)?;
    let apellidos = validar_texto(apellidos, ErrorEstudiante::ApellidosVacios)?;

    if repo::codigo_existe(conn, &codigo, None)? {
        return Err(ErrorEstudiante::CodigoDuplicado(codigo));
    }

    Ok(repo::insertar_estudiante(
        conn, &codigo, &nombres, &apellidos,
    )?)
}

/// Corrige los datos de un estudiante existente sin tocar su historial (RN-15).
pub fn actualizar(
    conn: &Connection,
    id: i64,
    codigo_universitario: &str,
    nombres: &str,
    apellidos: &str,
) -> Result<(), ErrorEstudiante> {
    let codigo = validar_texto(codigo_universitario, ErrorEstudiante::CodigoVacio)?;
    let nombres = validar_texto(nombres, ErrorEstudiante::NombresVacios)?;
    let apellidos = validar_texto(apellidos, ErrorEstudiante::ApellidosVacios)?;

    if repo::codigo_existe(conn, &codigo, Some(id))? {
        return Err(ErrorEstudiante::CodigoDuplicado(codigo));
    }

    let filas = repo::actualizar_estudiante(conn, id, &codigo, &nombres, &apellidos)?;
    if filas == 0 {
        return Err(ErrorEstudiante::NoEncontrado);
    }
    Ok(())
}

/// Activa o desactiva un estudiante. Nunca lo borra (RN-14).
///
/// Desactivar a alguien con préstamos activos se rechaza: RN-14 prohíbe el
/// borrado, y este proyecto extiende la protección para no dejar material
/// prestado sin un responsable activo.
pub fn cambiar_estado(conn: &Connection, id: i64, activo: bool) -> Result<(), ErrorEstudiante> {
    if !activo && repo::tiene_prestamos_activos(conn, id)? {
        return Err(ErrorEstudiante::ConPrestamosActivos);
    }

    let filas = repo::cambiar_activo_estudiante(conn, id, activo)?;
    if filas == 0 {
        return Err(ErrorEstudiante::NoEncontrado);
    }
    Ok(())
}

/// Recorta un texto obligatorio y rechaza el vacío (RN-11, RN-12).
fn validar_texto(texto: &str, vacio: ErrorEstudiante) -> Result<String, ErrorEstudiante> {
    let recortado = texto.trim();
    if recortado.is_empty() {
        return Err(vacio);
    }
    Ok(recortado.to_string())
}

/// Errores tipados del servicio de estudiantes.
#[derive(Debug)]
pub enum ErrorEstudiante {
    /// El código universitario es obligatorio (RN-11).
    CodigoVacio,
    /// Los nombres son obligatorios (RN-12).
    NombresVacios,
    /// Los apellidos son obligatorios (RN-12).
    ApellidosVacios,
    /// Ya existe otro estudiante con el mismo código (RN-11).
    CodigoDuplicado(String),
    /// No se puede inactivar mientras haya préstamos activos.
    ConPrestamosActivos,
    /// No existe el estudiante indicado.
    NoEncontrado,
    /// Error de SQLite.
    Sqlite(rusqlite::Error),
}

impl fmt::Display for ErrorEstudiante {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ErrorEstudiante::CodigoVacio => {
                write!(f, "El código universitario es obligatorio.")
            }
            ErrorEstudiante::NombresVacios => write!(f, "Los nombres son obligatorios."),
            ErrorEstudiante::ApellidosVacios => write!(f, "Los apellidos son obligatorios."),
            ErrorEstudiante::CodigoDuplicado(codigo) => {
                write!(f, "Ya existe un estudiante con el código «{codigo}».")
            }
            ErrorEstudiante::ConPrestamosActivos => write!(
                f,
                "No se puede marcar como inactivo: el estudiante tiene préstamos activos."
            ),
            ErrorEstudiante::NoEncontrado => {
                write!(f, "No se encontró el estudiante indicado.")
            }
            ErrorEstudiante::Sqlite(e) => write!(f, "No se pudo guardar el estudiante: {e}"),
        }
    }
}

impl std::error::Error for ErrorEstudiante {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            ErrorEstudiante::Sqlite(e) => Some(e),
            _ => None,
        }
    }
}

impl From<rusqlite::Error> for ErrorEstudiante {
    fn from(error: rusqlite::Error) -> Self {
        ErrorEstudiante::Sqlite(error)
    }
}
