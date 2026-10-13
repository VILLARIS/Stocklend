//! Apertura de conexiones SQLite.
//!
//! Las lecturas (Dashboard, Inventario) usan [`open_read_only`]: nunca crean el
//! archivo ni modifican la base. La Fase F1 añade [`open_read_write`] para
//! operaciones de escritura, que también exige una base **existente** y activa
//! `PRAGMA foreign_keys`.

use std::path::Path;
use std::time::Duration;

use rusqlite::{Connection, OpenFlags, Transaction, TransactionBehavior};

/// Tiempo de espera ante bloqueos (`stocklend.core.constants.BUSY_TIMEOUT_MS`).
const BUSY_TIMEOUT_MS: u64 = 5_000;

/// Abre la base en modo **solo lectura**.
///
/// Nunca crea el archivo: `SQLITE_OPEN_READ_ONLY` falla si no existe. Añade
/// `query_only` como refuerzo frente a escrituras accidentales.
pub fn open_read_only(path: &Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    conn.busy_timeout(Duration::from_millis(BUSY_TIMEOUT_MS))?;
    conn.execute_batch("PRAGMA query_only = ON;")?;
    Ok(conn)
}

/// Abre una conexión de **escritura** sobre una base existente.
///
/// Solo concede `SQLITE_OPEN_READ_WRITE` (sin `CREATE`): si el archivo no
/// existe, falla y no se crea ningún SQLite. Activa `PRAGMA foreign_keys = ON`
/// (necesario en cada conexión, ver `DATABASE_DESIGN.md` §1.3) y un
/// `busy_timeout` para tolerar bloqueos breves.
///
/// No altera la configuración de las conexiones de lectura.
pub fn open_read_write(path: &Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_WRITE)?;
    conn.busy_timeout(Duration::from_millis(BUSY_TIMEOUT_MS))?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    Ok(conn)
}

/// Abre una transacción `IMMEDIATE`.
///
/// `IMMEDIATE` toma el bloqueo de escritura al inicio, serializando las
/// operaciones concurrentes y evitando carreras entre la lectura de contadores
/// y su actualización (`DATABASE_DESIGN.md` §9.1). Si la transacción se descarta
/// sin `commit`, rusqlite hace rollback automático.
pub fn transaccion_immediate(conn: &mut Connection) -> rusqlite::Result<Transaction<'_>> {
    conn.transaction_with_behavior(TransactionBehavior::Immediate)
}
