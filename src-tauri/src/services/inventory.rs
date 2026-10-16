//! Servicio de movimientos de inventario (Fase F1).
//!
//! Centraliza las reglas que modifican los contadores de un artículo. No expone
//! SQL al frontend, no permite transiciones arbitrarias y nunca edita ni borra
//! el historial: cada cambio es un registro nuevo en `movimiento_inventario`.
//!
//! Toda escritura debe ejecutarse dentro de una transacción ya abierta por el
//! llamador (ver [`crate::db::connection::transaccion_immediate`]). Este módulo
//! no abre conexiones ni hace `commit`: solo opera sobre la transacción que
//! recibe, de forma que el llamador controle el límite atómico.

use std::fmt;

use rusqlite::{Connection, Transaction};

/// Los doce valores admitidos por el `CHECK` de `movimiento_inventario.tipo`
/// (`DATABASE_DESIGN.md` §4.9).
pub const TIPOS_MOVIMIENTO: [&str; 12] = [
    "alta",
    "ajuste_positivo",
    "ajuste_negativo",
    "prestamo",
    "devolucion",
    "danio_prestado",
    "perdida_prestado",
    "danio_disponible",
    "perdida_disponible",
    "reingreso_reparacion",
    "baja_daniada",
    "baja_faltante",
];

/// Valores admitidos por el `CHECK` de `movimiento_inventario.referencia_tipo`.
pub const TIPOS_REFERENCIA: [&str; 5] =
    ["prestamo", "devolucion", "incidente", "ajuste", "anulacion"];

/// Transiciones que esta infraestructura sabe aplicar.
///
/// Cubre las entradas (`alta`), las correcciones (`ajuste_*`), el préstamo y las
/// tres vueltas que produce una devolución: en buen estado (`devolucion`), dañada
/// (`danio_prestado`) o perdida (`perdida_prestado`), todas con origen en
/// `prestada` (RN-30, RN-31, RN-32). Las transiciones sobre `disponible`
/// (`danio_disponible`, `perdida_disponible`) pertenecen a la Incidencia de
/// depósito. Al ser un `enum`, no es posible solicitar una transición no prevista.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TipoMovimiento {
    /// Entrada inicial de existencias al crear un artículo.
    Alta,
    /// Corrección que aumenta el total y lo disponible.
    AjustePositivo,
    /// Corrección que reduce el total y lo disponible (RN-06).
    AjusteNegativo,
    /// Presta cantidad o una unidad: disponible → prestada (RN-21, RN-53).
    Prestamo,
    /// Devuelve en buen estado: prestada → disponible (RN-30).
    Devolucion,
    /// Devuelve dañado: prestada → dañada, nunca disponible (RN-31).
    DanioPrestado,
    /// Devuelve perdido: prestada → faltante, nunca disponible (RN-32).
    PerdidaPrestado,
    /// Una unidad dañada vuelve a estar disponible tras repararse.
    ReingresoReparacion,
    /// Se da de baja una unidad dañada (sale del inventario).
    BajaDaniada,
    /// Se da de baja una unidad faltante (sale del inventario).
    BajaFaltante,
}

impl TipoMovimiento {
    /// Valor persistido en `movimiento_inventario.tipo`.
    pub fn as_str(self) -> &'static str {
        match self {
            TipoMovimiento::Alta => "alta",
            TipoMovimiento::AjustePositivo => "ajuste_positivo",
            TipoMovimiento::AjusteNegativo => "ajuste_negativo",
            TipoMovimiento::Prestamo => "prestamo",
            TipoMovimiento::Devolucion => "devolucion",
            TipoMovimiento::DanioPrestado => "danio_prestado",
            TipoMovimiento::PerdidaPrestado => "perdida_prestado",
            TipoMovimiento::ReingresoReparacion => "reingreso_reparacion",
            TipoMovimiento::BajaDaniada => "baja_daniada",
            TipoMovimiento::BajaFaltante => "baja_faltante",
        }
    }

    /// Interpreta un tipo persistido. Devuelve `None` para cualquier valor que
    /// no sea uno de los tipos que esta infraestructura aplica, evitando
    /// transiciones arbitrarias.
    pub fn desde_str(valor: &str) -> Option<Self> {
        match valor {
            "alta" => Some(TipoMovimiento::Alta),
            "ajuste_positivo" => Some(TipoMovimiento::AjustePositivo),
            "ajuste_negativo" => Some(TipoMovimiento::AjusteNegativo),
            "prestamo" => Some(TipoMovimiento::Prestamo),
            "devolucion" => Some(TipoMovimiento::Devolucion),
            "danio_prestado" => Some(TipoMovimiento::DanioPrestado),
            "perdida_prestado" => Some(TipoMovimiento::PerdidaPrestado),
            "reingreso_reparacion" => Some(TipoMovimiento::ReingresoReparacion),
            "baja_daniada" => Some(TipoMovimiento::BajaDaniada),
            "baja_faltante" => Some(TipoMovimiento::BajaFaltante),
            _ => None,
        }
    }
}

/// Los cinco contadores persistidos en `articulo` (RN-01/RN-02).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Contadores {
    pub total: i64,
    pub disponible: i64,
    pub prestada: i64,
    pub danada: i64,
    pub faltante: i64,
}

impl Contadores {
    /// Suma de los cuatro cubos que deben coincidir con el total (RN-02).
    pub fn suma_cubos(&self) -> i64 {
        self.disponible + self.prestada + self.danada + self.faltante
    }

    /// Comprueba la invariante de RN-02.
    pub fn coherente(&self) -> bool {
        self.total == self.suma_cubos()
    }

    /// Verifica que ninguna cantidad sea negativa y que el total cuadre.
    fn validar(&self) -> Result<(), ErrorInventario> {
        for (campo, valor) in [
            ("cantidad_total", self.total),
            ("cantidad_disponible", self.disponible),
            ("cantidad_prestada", self.prestada),
            ("cantidad_daniada", self.danada),
            ("cantidad_faltante", self.faltante),
        ] {
            if valor < 0 {
                return Err(ErrorInventario::ResultadoNegativo(campo));
            }
        }
        if !self.coherente() {
            return Err(ErrorInventario::TotalIncoherente {
                total: self.total,
                suma: self.suma_cubos(),
            });
        }
        Ok(())
    }
}

/// Resultado de aplicar un movimiento: identificador del registro creado y
/// estado final de los contadores.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MovimientoAplicado {
    pub movimiento_id: i64,
    pub contadores: Contadores,
    /// Instante UTC ISO-8601 (`YYYY-MM-DDTHH:MM:SSZ`) grabado en el historial.
    pub fecha: String,
}

/// Efecto puro de un movimiento sobre los contadores, sin tocar la base.
///
/// Se separa para poder probar la aritmética de cada tipo sin SQL y para
/// validar el resultado antes de escribir. Devuelve error si `cantidad <= 0`,
/// si algún cubo quedaría negativo o si el total dejaría de cuadrar.
pub fn calcular(
    actual: Contadores,
    tipo: TipoMovimiento,
    cantidad: i64,
) -> Result<Contadores, ErrorInventario> {
    if cantidad <= 0 {
        return Err(ErrorInventario::CantidadNoPositiva);
    }

    let mut nuevo = actual;
    match tipo {
        TipoMovimiento::Alta | TipoMovimiento::AjustePositivo => {
            nuevo.total += cantidad;
            nuevo.disponible += cantidad;
        }
        TipoMovimiento::AjusteNegativo => {
            nuevo.total -= cantidad;
            nuevo.disponible -= cantidad;
        }
        TipoMovimiento::Prestamo => {
            nuevo.disponible -= cantidad;
            nuevo.prestada += cantidad;
        }
        TipoMovimiento::Devolucion => {
            nuevo.prestada -= cantidad;
            nuevo.disponible += cantidad;
        }
        TipoMovimiento::DanioPrestado => {
            nuevo.prestada -= cantidad;
            nuevo.danada += cantidad;
        }
        TipoMovimiento::PerdidaPrestado => {
            nuevo.prestada -= cantidad;
            nuevo.faltante += cantidad;
        }
        TipoMovimiento::ReingresoReparacion => {
            nuevo.danada -= cantidad;
            nuevo.disponible += cantidad;
        }
        TipoMovimiento::BajaDaniada => {
            nuevo.danada -= cantidad;
            nuevo.total -= cantidad;
        }
        TipoMovimiento::BajaFaltante => {
            nuevo.faltante -= cantidad;
            nuevo.total -= cantidad;
        }
    }

    nuevo.validar()?;
    Ok(nuevo)
}

/// Lee los cinco contadores de un artículo. Falla si el artículo no existe.
pub fn leer_contadores(conn: &Connection, articulo_id: i64) -> Result<Contadores, ErrorInventario> {
    conn.query_row(
        "SELECT cantidad_total, cantidad_disponible, cantidad_prestada, \
                cantidad_daniada, cantidad_faltante \
         FROM articulo WHERE id = ?1",
        [articulo_id],
        |row| {
            Ok(Contadores {
                total: row.get(0)?,
                disponible: row.get(1)?,
                prestada: row.get(2)?,
                danada: row.get(3)?,
                faltante: row.get(4)?,
            })
        },
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => ErrorInventario::ArticuloNoEncontrado(articulo_id),
        otro => ErrorInventario::Sqlite(otro),
    })
}

/// Aplica un movimiento válido dentro de una transacción existente.
///
/// Pasos: lee los contadores, calcula el efecto, valida (sin negativos y con el
/// total igual a la suma de estados), actualiza los cinco contadores en **una
/// sola sentencia** e inserta el movimiento en el historial dentro de la misma
/// transacción. Devuelve el resultado tipado.
///
/// Nunca actualiza ni elimina movimientos históricos. No hace `commit`: el
/// llamador decide el desenlace de la transacción (un fallo produce rollback
/// completo).
pub fn aplicar_movimiento(
    tx: &Transaction<'_>,
    articulo_id: i64,
    articulo_unidad_id: Option<i64>,
    tipo: TipoMovimiento,
    cantidad: i64,
    motivo: &str,
    referencia_tipo: Option<&str>,
    referencia_id: Option<i64>,
) -> Result<MovimientoAplicado, ErrorInventario> {
    let motivo = motivo.trim();
    if motivo.is_empty() {
        return Err(ErrorInventario::MotivoVacio);
    }
    if let Some(rt) = referencia_tipo {
        if !TIPOS_REFERENCIA.contains(&rt) {
            return Err(ErrorInventario::ReferenciaTipoInvalida(rt.to_string()));
        }
    }

    let actual = leer_contadores(tx, articulo_id)?;
    let nuevo = calcular(actual, tipo, cantidad)?;

    tx.execute(
        "UPDATE articulo \
         SET cantidad_total = ?1, cantidad_disponible = ?2, cantidad_prestada = ?3, \
             cantidad_daniada = ?4, cantidad_faltante = ?5, \
             actualizado_en = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') \
         WHERE id = ?6",
        rusqlite::params![
            nuevo.total,
            nuevo.disponible,
            nuevo.prestada,
            nuevo.danada,
            nuevo.faltante,
            articulo_id
        ],
    )?;

    tx.execute(
        "INSERT INTO movimiento_inventario \
         (articulo_id, articulo_unidad_id, tipo, cantidad, \
          cantidad_resultante_total, cantidad_resultante_disponible, \
          motivo, referencia_tipo, referencia_id, fecha) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, \
                 strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))",
        rusqlite::params![
            articulo_id,
            articulo_unidad_id,
            tipo.as_str(),
            cantidad,
            nuevo.total,
            nuevo.disponible,
            motivo,
            referencia_tipo,
            referencia_id
        ],
    )?;

    let movimiento_id = tx.last_insert_rowid();
    let fecha: String = tx.query_row(
        "SELECT fecha FROM movimiento_inventario WHERE id = ?1",
        [movimiento_id],
        |row| row.get(0),
    )?;

    Ok(MovimientoAplicado {
        movimiento_id,
        contadores: nuevo,
        fecha,
    })
}

/// Errores tipados del servicio de movimientos.
#[derive(Debug)]
pub enum ErrorInventario {
    /// La cantidad de un movimiento debe ser estrictamente positiva.
    CantidadNoPositiva,
    /// El motivo es obligatorio (RN-05).
    MotivoVacio,
    /// `referencia_tipo` no pertenece a los valores admitidos.
    ReferenciaTipoInvalida(String),
    /// El movimiento dejaría un contador por debajo de cero.
    ResultadoNegativo(&'static str),
    /// El total no coincide con la suma de los estados (RN-02).
    TotalIncoherente { total: i64, suma: i64 },
    /// No existe el artículo indicado.
    ArticuloNoEncontrado(i64),
    /// Error de SQLite.
    Sqlite(rusqlite::Error),
}

impl fmt::Display for ErrorInventario {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ErrorInventario::CantidadNoPositiva => {
                write!(f, "La cantidad del movimiento debe ser mayor que cero.")
            }
            ErrorInventario::MotivoVacio => write!(f, "El motivo del movimiento es obligatorio."),
            ErrorInventario::ReferenciaTipoInvalida(valor) => {
                write!(f, "El tipo de referencia «{valor}» no es válido.")
            }
            ErrorInventario::ResultadoNegativo(campo) => {
                write!(f, "El movimiento dejaría «{campo}» por debajo de cero.")
            }
            ErrorInventario::TotalIncoherente { total, suma } => write!(
                f,
                "La cantidad total ({total}) no coincide con la suma de los estados ({suma})."
            ),
            ErrorInventario::ArticuloNoEncontrado(id) => {
                write!(f, "No se encontró el artículo con id {id}.")
            }
            ErrorInventario::Sqlite(e) => write!(f, "Error de base de datos: {e}"),
        }
    }
}

impl std::error::Error for ErrorInventario {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            ErrorInventario::Sqlite(e) => Some(e),
            _ => None,
        }
    }
}

impl From<rusqlite::Error> for ErrorInventario {
    fn from(error: rusqlite::Error) -> Self {
        ErrorInventario::Sqlite(error)
    }
}
