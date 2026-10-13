//! Servicio de artículos: alta, edición y ajuste de existencias (Fase F3).
//!
//! Aplica las reglas del inventario sobre una transacción ya abierta por el
//! llamador (normalmente `IMMEDIATE`), de modo que validar y escribir sean
//! atómicos. Nunca escribe contadores a mano: cualquier cambio de cantidad se
//! delega en [`crate::services::inventory`], que registra el movimiento
//! correspondiente (RN-05, RN-46, RN-47).
//!
//! Límites de esta fase:
//! - No hay unidades ni control individual: `control_individual` se rechaza en
//!   el alta y es inmutable al editar. Un artículo con control individual no
//!   admite ajuste masivo de existencias.
//! - La edición no toca contadores, `cantidad_prestada`, el código ni crea
//!   movimientos.
//! - El ajuste corrige solo el total descontando o sumando a lo disponible
//!   (RN-06). El daño y la pérdida pertenecen al módulo de Incidentes.

use std::fmt;

use rusqlite::{Connection, Transaction};

use crate::repositories::inventory as repo;
use crate::services::inventory::{self, ErrorInventario, TipoMovimiento};
use crate::services::texto::normalizar_nombre;
use crate::services::units::{self, ErrorUnidad, NuevaUnidad};

/// Límite documentado de la nota de un artículo (UI_FLOWS §5.1).
pub const MAX_NOTAS: usize = 200;
/// Límite documentado del motivo de un movimiento (UI_FLOWS §6.1).
pub const MAX_MOTIVO: usize = 200;
/// Motivo con el que se registra la entrada inicial de existencias.
const MOTIVO_ALTA: &str = "Alta inicial";

/// Datos de un artículo nuevo, ya desacoplados del contrato IPC.
pub struct NuevoArticulo<'a> {
    pub nombre: &'a str,
    pub categoria_id: i64,
    pub cantidad_inicial: i64,
    pub control_individual: bool,
    pub prestable: bool,
    pub notas: Option<&'a str>,
}

/// Crea un artículo con o sin control individual.
///
/// Sin control individual se comporta como en F3. Con `control_individual`, la
/// cantidad inicial debe ser exactamente el número de unidades suministradas (0
/// unidades es válido) y las unidades se insertan como `disponible`. Artículo,
/// unidades y movimiento de alta ocurren en la misma transacción.
pub fn crear(
    tx: &Transaction<'_>,
    nuevo: NuevoArticulo<'_>,
    unidades: &[NuevaUnidad<'_>],
) -> Result<i64, ErrorArticulo> {
    let nombre = validar_nombre(nuevo.nombre)?;
    validar_categoria(tx, nuevo.categoria_id)?;
    if nuevo.cantidad_inicial < 0 {
        return Err(ErrorArticulo::CantidadNegativa(nuevo.cantidad_inicial));
    }
    if !nuevo.control_individual && !unidades.is_empty() {
        return Err(ErrorArticulo::UnidadesSinControlIndividual);
    }
    if nuevo.control_individual && nuevo.cantidad_inicial != unidades.len() as i64 {
        return Err(ErrorArticulo::CantidadNoCoincideConUnidades {
            declarada: nuevo.cantidad_inicial,
            unidades: unidades.len(),
        });
    }
    let notas = validar_notas(nuevo.notas)?;
    if existe_duplicado(tx, &nombre, nuevo.categoria_id, None)? {
        return Err(ErrorArticulo::NombreDuplicado(nombre));
    }

    let id = repo::insertar_articulo(
        tx,
        &nombre,
        nuevo.categoria_id,
        nuevo.control_individual,
        nuevo.prestable,
        notas,
    )?;

    if nuevo.control_individual {
        units::crear_lote(tx, id, unidades).map_err(ErrorArticulo::Unidad)?;
    }

    if nuevo.cantidad_inicial > 0 {
        inventory::aplicar_movimiento(
            tx,
            id,
            None,
            TipoMovimiento::Alta,
            nuevo.cantidad_inicial,
            MOTIVO_ALTA,
            None,
            None,
        )
        .map_err(ErrorArticulo::Movimiento)?;
    }

    if nuevo.control_individual {
        units::conciliar(tx, id).map_err(ErrorArticulo::Unidad)?;
    }

    Ok(id)
}

/// Edita nombre, categoría, `prestable` y notas. No altera contadores ni crea
/// movimientos.
pub fn actualizar(
    tx: &Transaction<'_>,
    id: i64,
    nombre: &str,
    categoria_id: i64,
    prestable: bool,
    notas: Option<&str>,
) -> Result<(), ErrorArticulo> {
    if repo::leer_articulo(tx, id)?.is_none() {
        return Err(ErrorArticulo::NoExiste(id));
    }

    let nombre = validar_nombre(nombre)?;
    validar_categoria(tx, categoria_id)?;
    let notas = validar_notas(notas)?;
    if existe_duplicado(tx, &nombre, categoria_id, Some(id))? {
        return Err(ErrorArticulo::NombreDuplicado(nombre));
    }

    let filas = repo::actualizar_articulo(tx, id, &nombre, categoria_id, prestable, notas)?;
    if filas == 0 {
        return Err(ErrorArticulo::NoExiste(id));
    }
    Ok(())
}

/// Ajusta la cantidad total de un artículo a `nueva_cantidad`.
///
/// El efecto se calcula como diferencia con el total actual: si sube, un
/// `ajuste_positivo`; si baja, un `ajuste_negativo` que solo puede descontar de
/// lo disponible (RN-06). Si la cantidad no cambia no se registra movimiento.
pub fn ajustar(
    tx: &Transaction<'_>,
    id: i64,
    nueva_cantidad: i64,
    motivo: &str,
) -> Result<(), ErrorArticulo> {
    let actual = repo::leer_articulo(tx, id)?.ok_or(ErrorArticulo::NoExiste(id))?;

    if nueva_cantidad < 0 {
        return Err(ErrorArticulo::CantidadNegativa(nueva_cantidad));
    }
    if actual.control_individual {
        return Err(ErrorArticulo::AjusteMasivoControlIndividual);
    }
    let motivo = validar_motivo(motivo)?;

    let delta = nueva_cantidad - actual.cantidad_total;
    if delta == 0 {
        return Ok(());
    }

    let (tipo, cantidad) = if delta > 0 {
        (TipoMovimiento::AjustePositivo, delta)
    } else {
        let solicitado = -delta;
        if solicitado > actual.cantidad_disponible {
            return Err(ErrorArticulo::DisponibleInsuficiente {
                disponible: actual.cantidad_disponible,
                prestada: actual.cantidad_prestada,
                solicitado,
            });
        }
        (TipoMovimiento::AjusteNegativo, solicitado)
    };

    inventory::aplicar_movimiento(
        tx,
        id,
        None,
        tipo,
        cantidad,
        motivo,
        Some("ajuste"),
        None,
    )
    .map_err(ErrorArticulo::Movimiento)?;

    Ok(())
}

/// Nombre obligatorio y recortado; los espacios internos se conservan tal como
/// los escribió la persona.
fn validar_nombre(nombre: &str) -> Result<String, ErrorArticulo> {
    let recortado = nombre.trim();
    if recortado.is_empty() {
        return Err(ErrorArticulo::NombreVacio);
    }
    Ok(recortado.to_string())
}

/// La categoría debe existir y estar activa.
fn validar_categoria(conn: &Connection, categoria_id: i64) -> Result<(), ErrorArticulo> {
    match repo::categoria_activa(conn, categoria_id)? {
        None => Err(ErrorArticulo::CategoriaNoExiste(categoria_id)),
        Some(false) => Err(ErrorArticulo::CategoriaInactiva(categoria_id)),
        Some(true) => Ok(()),
    }
}

/// Una nota vacía o de solo espacios se guarda como `NULL`; nunca supera el
/// límite documentado.
fn validar_notas(notas: Option<&str>) -> Result<Option<&str>, ErrorArticulo> {
    let limpia = notas.map(str::trim).filter(|texto| !texto.is_empty());
    if let Some(texto) = limpia {
        if texto.chars().count() > MAX_NOTAS {
            return Err(ErrorArticulo::NotasMuyLargas(texto.chars().count()));
        }
    }
    Ok(limpia)
}

/// El motivo es obligatorio y no supera el límite documentado.
fn validar_motivo(motivo: &str) -> Result<&str, ErrorArticulo> {
    let recortado = motivo.trim();
    if recortado.is_empty() {
        return Err(ErrorArticulo::MotivoVacio);
    }
    if recortado.chars().count() > MAX_MOTIVO {
        return Err(ErrorArticulo::MotivoMuyLargo(recortado.chars().count()));
    }
    Ok(recortado)
}

/// Indica si ya existe otro artículo con el mismo nombre normalizado dentro de
/// la misma categoría (RN-09).
fn existe_duplicado(
    conn: &Connection,
    nombre: &str,
    categoria_id: i64,
    excluir: Option<i64>,
) -> Result<bool, ErrorArticulo> {
    let normalizado = normalizar_nombre(nombre);
    for (id, existente) in repo::nombres_articulo(conn, categoria_id)? {
        if Some(id) == excluir {
            continue;
        }
        if normalizar_nombre(&existente) == normalizado {
            return Ok(true);
        }
    }
    Ok(false)
}

/// Errores tipados del servicio de artículos.
#[derive(Debug)]
pub enum ErrorArticulo {
    /// El nombre es obligatorio (RF-INV-01).
    NombreVacio,
    /// Ya existe un artículo con ese nombre en la misma categoría (RN-09).
    NombreDuplicado(String),
    /// La categoría indicada no existe.
    CategoriaNoExiste(i64),
    /// La categoría existe pero está desactivada.
    CategoriaInactiva(i64),
    /// La cantidad no puede ser negativa (RN-01).
    CantidadNegativa(i64),
    /// Se enviaron unidades sin activar el control individual.
    UnidadesSinControlIndividual,
    /// La cantidad inicial no coincide con el número de unidades (RF-INV-10).
    CantidadNoCoincideConUnidades {
        declarada: i64,
        unidades: usize,
    },
    /// Un artículo con control individual no admite ajuste masivo de cantidad.
    AjusteMasivoControlIndividual,
    /// La nota supera el límite documentado.
    NotasMuyLargas(usize),
    /// El motivo del ajuste es obligatorio (RN-05).
    MotivoVacio,
    /// El motivo supera el límite documentado.
    MotivoMuyLargo(usize),
    /// No existe el artículo indicado.
    NoExiste(i64),
    /// El ajuste a la baja excede lo disponible (RN-06).
    DisponibleInsuficiente {
        disponible: i64,
        prestada: i64,
        solicitado: i64,
    },
    /// Fallo en la gestión de unidades individuales.
    Unidad(ErrorUnidad),
    /// Fallo al registrar el movimiento de inventario.
    Movimiento(ErrorInventario),
    /// Error de SQLite.
    Sqlite(rusqlite::Error),
}

impl fmt::Display for ErrorArticulo {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ErrorArticulo::NombreVacio => {
                write!(f, "El nombre del artículo es obligatorio.")
            }
            ErrorArticulo::NombreDuplicado(nombre) => {
                write!(f, "Ya existe un artículo llamado «{nombre}» en esta categoría.")
            }
            ErrorArticulo::CategoriaNoExiste(id) => {
                write!(f, "No se encontró la categoría con id {id}.")
            }
            ErrorArticulo::CategoriaInactiva(id) => {
                write!(f, "La categoría con id {id} está desactivada.")
            }
            ErrorArticulo::CantidadNegativa(cantidad) => write!(
                f,
                "La cantidad no puede ser menor que cero (se recibió {cantidad})."
            ),
            ErrorArticulo::UnidadesSinControlIndividual => write!(
                f,
                "Para registrar unidades hay que activar el control individual del artículo."
            ),
            ErrorArticulo::CantidadNoCoincideConUnidades {
                declarada,
                unidades,
            } => write!(
                f,
                "La cantidad inicial ({declarada}) debe coincidir con el número de unidades ({unidades})."
            ),
            ErrorArticulo::AjusteMasivoControlIndividual => write!(
                f,
                "No puedes ajustar la cantidad total de un artículo con control individual: \
                 gestiona sus unidades una a una."
            ),
            ErrorArticulo::NotasMuyLargas(longitud) => write!(
                f,
                "La nota no puede pasar de {MAX_NOTAS} caracteres (se recibieron {longitud})."
            ),
            ErrorArticulo::MotivoVacio => write!(f, "Escribe el motivo del movimiento."),
            ErrorArticulo::MotivoMuyLargo(longitud) => write!(
                f,
                "El motivo no puede pasar de {MAX_MOTIVO} caracteres (se recibieron {longitud})."
            ),
            ErrorArticulo::NoExiste(id) => {
                write!(f, "No se encontró el artículo con id {id}.")
            }
            ErrorArticulo::DisponibleInsuficiente {
                disponible,
                prestada,
                solicitado,
            } => write!(
                f,
                "No puedes bajar la cantidad total por debajo de lo disponible: se pidió descontar \
                 {solicitado}, con {disponible} disponibles y {prestada} prestadas."
            ),
            ErrorArticulo::Movimiento(e) => write!(f, "{e}"),
            ErrorArticulo::Unidad(e) => write!(f, "{e}"),
            ErrorArticulo::Sqlite(e) => write!(f, "Error de base de datos: {e}"),
        }
    }
}

impl std::error::Error for ErrorArticulo {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            ErrorArticulo::Movimiento(e) => Some(e),
            ErrorArticulo::Unidad(e) => Some(e),
            ErrorArticulo::Sqlite(e) => Some(e),
            _ => None,
        }
    }
}

impl From<rusqlite::Error> for ErrorArticulo {
    fn from(error: rusqlite::Error) -> Self {
        ErrorArticulo::Sqlite(error)
    }
}
