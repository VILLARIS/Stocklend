//! Apertura de conexiones SQLite.
//!
//! Toda la Etapa A es de lectura: las conexiones se abren en modo
//! **solo lectura** y nunca crean el archivo si no existe.

use std::path::Path;
use std::time::Duration;

use rusqlite::{Connection, OpenFlags};

/// Tiempo de espera ante bloqueos (`stocklend.core.constants.BUSY_TIMEOUT_MS`).
const BUSY_TIMEOUT_MS: u64 = 5000;

/// Abre una conexión SQLite en modo solo lectura.
///
/// Si el archivo no existe, `open_with_flags` falla y **no** lo crea. Además se
/// activa `PRAGMA query_only` como garantía adicional de que no se escriba.
pub fn open_read_only(path: &Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    conn.busy_timeout(Duration::from_millis(BUSY_TIMEOUT_MS))?;
    conn.execute_batch("PRAGMA query_only = ON;")?;
    Ok(conn)
}
