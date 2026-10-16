//! Servicio de Devoluciones: registro de devoluciones completas y parciales
//! (Etapa E1).
//!
//! Aplica RN-26 a RN-38 y RN-54 a RN-57 sobre una transacción ya abierta por el
//! llamador (el comando abre una `IMMEDIATE`), de modo que validar, registrar la
//! devolución, mover el inventario, crear los incidentes y cerrar el préstamo sea
//! un todo o nada. Nunca hace `commit`: si cualquier paso falla, el llamador
//! descarta la transacción y no queda rastro.
//!
//! - Solo se devuelve a un préstamo `activo` con cantidades pendientes (RN-26).
//! - En cada renglón, lo que vuelve se reparte en tres cubos: bueno (`disponible`),
//!   dañado (`danada`) y perdido (`faltante`); la suma no puede superar el
//!   pendiente (RN-27, RN-28, RN-29).
//! - Una devolución dañada o perdida crea su incidente en la misma transacción
//!   (RN-33), con origen `devolucion` (RN-54) y responsabilidad `sin_determinar`
//!   salvo que se indique el estudiante (RN-55, RN-56).
//! - El préstamo sigue `activo` si queda pendiente (RN-36) y se cierra solo cuando
//!   nada queda (RN-35).
//! - Con control individual se devuelven unidades concretas, verificando que estén
//!   prestadas en el renglón indicado (RN-50, RN-53).

use std::collections::HashSet;
use std::fmt;

use rusqlite::Transaction;

use crate::repositories::devoluciones as repo;
use crate::repositories::inventory as inventario_repo;
use crate::repositories::prestamos as prestamos_repo;
use crate::services::inventory::{self, ErrorInventario, TipoMovimiento};
use crate::services::texto::limpiar_opcional;
use crate::services::units::{self, ErrorUnidad};

/// Motivo con el que se registra cada movimiento de devolución (RN-05).
const MOTIVO_DEVOLUCION: &str = "Devolución registrada";

/// Una unidad individual que vuelve, con la condición con la que se recibe.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UnidadDevolucion {
    pub unidad_id: i64,
    /// `bueno`, `danado` o `perdido`.
    pub condicion: String,
}

/// Un renglón de la solicitud ya desacoplado del contrato IPC.
#[derive(Debug, Clone)]
pub struct LineaDevolucion {
    pub prestamo_detalle_id: i64,
    pub cantidad_devuelta: i64,
    pub cantidad_daniada: i64,
    pub cantidad_perdida: i64,
    pub unidades: Vec<UnidadDevolucion>,
    pub descripcion: Option<String>,
    pub notas: Option<String>,
    pub estudiante_id: Option<i64>,
}

/// Condición final de una unidad individual.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Condicion {
    Bueno,
    Danado,
    Perdido,
}

impl Condicion {
    /// Interpreta la condición recibida; rechaza cualquier otro valor.
    fn desde_str(valor: &str) -> Result<Self, ErrorDevolucion> {
        match valor.trim().to_ascii_lowercase().as_str() {
            "bueno" | "buena" => Ok(Condicion::Bueno),
            "danado" | "danada" => Ok(Condicion::Danado),
            "perdido" | "perdida" => Ok(Condicion::Perdido),
            _ => Err(ErrorDevolucion::CondicionInvalida(valor.to_string())),
        }
    }
}

/// Línea ya validada contra el renglón real, lista para aplicarse.
struct LineaNormalizada {
    detalle: prestamos_repo::RenglonPrestamo,
    cantidad_devuelta: i64,
    cantidad_daniada: i64,
    cantidad_perdida: i64,
    /// Unidades concretas; vacío para artículos sin control individual.
    unidades: Vec<(i64, Condicion)>,
    descripcion: Option<String>,
    notas: Option<String>,
    estudiante_id: Option<i64>,
}

/// Registra una devolución real y devuelve el identificador del evento.
///
/// Valida el préstamo, agrupa y valida los renglones, escribe la devolución, mueve
/// el inventario, crea los incidentes y cierra el préstamo si corresponde, todo
/// dentro de la transacción del llamador.
pub fn registrar(
    tx: &Transaction<'_>,
    prestamo_id: i64,
    lineas: &[LineaDevolucion],
    observaciones: Option<&str>,
) -> Result<i64, ErrorDevolucion> {
    let momento = prestamos_repo::fecha_hora_local(tx)?;

    let estado = prestamos_repo::leer_estado_prestamo(tx, prestamo_id)?
        .ok_or(ErrorDevolucion::PrestamoNoExiste(prestamo_id))?;
    if estado != "activo" {
        return Err(ErrorDevolucion::PrestamoNoActivo(estado));
    }
    let estudiante_prestamo = prestamos_repo::estudiante_id_prestamo(tx, prestamo_id)?
        .ok_or(ErrorDevolucion::PrestamoNoExiste(prestamo_id))?;
    if prestamos_repo::pendiente_total(tx, prestamo_id)? == 0 {
        return Err(ErrorDevolucion::SinPendientes);
    }

    let agrupadas = agrupar(lineas);
    if agrupadas.is_empty() {
        return Err(ErrorDevolucion::SinLineas);
    }

    // Se resuelven y validan todas las líneas antes de escribir nada: un error en
    // la última no debe dejar una devolución a medio registrar.
    let mut unidades_vistas: HashSet<i64> = HashSet::new();
    let mut preparadas: Vec<LineaNormalizada> = Vec::new();
    for linea in &agrupadas {
        let detalle = prestamos_repo::leer_renglon(tx, linea.prestamo_detalle_id)?
            .ok_or(ErrorDevolucion::RenglonNoExiste(linea.prestamo_detalle_id))?;
        if detalle.prestamo_id != prestamo_id {
            return Err(ErrorDevolucion::RenglonAjeno {
                renglon: detalle.id,
                prestamo: prestamo_id,
            });
        }
        if let Some(normalizada) =
            normalizar(tx, &detalle, linea, &mut unidades_vistas, estudiante_prestamo)?
        {
            preparadas.push(normalizada);
        }
    }

    if preparadas.is_empty() {
        return Err(ErrorDevolucion::SinLineas);
    }

    let observaciones = limpiar_opcional(observaciones);
    let devolucion_id = repo::insertar_devolucion(tx, prestamo_id, &momento, observaciones)?;

    for linea in &preparadas {
        procesar(tx, prestamo_id, devolucion_id, linea, &momento)?;
    }

    cerrar_si_corresponde(tx, prestamo_id, &momento)?;
    Ok(devolucion_id)
}

/// Agrupa las líneas por renglón: suma cantidades y concatena unidades.
///
/// Igual que la solicitud de préstamo (RN-18), un renglón repetido no se procesa
/// dos veces; las unidades repetidas se detectan al validar.
fn agrupar(lineas: &[LineaDevolucion]) -> Vec<LineaDevolucion> {
    let mut agrupadas: Vec<LineaDevolucion> = Vec::new();
    for linea in lineas {
        match agrupadas
            .iter_mut()
            .find(|previa| previa.prestamo_detalle_id == linea.prestamo_detalle_id)
        {
            Some(previa) => {
                previa.cantidad_devuelta += linea.cantidad_devuelta;
                previa.cantidad_daniada += linea.cantidad_daniada;
                previa.cantidad_perdida += linea.cantidad_perdida;
                previa.unidades.extend(linea.unidades.iter().cloned());
                if previa.descripcion.is_none() {
                    previa.descripcion = linea.descripcion.clone();
                }
                if previa.notas.is_none() {
                    previa.notas = linea.notas.clone();
                }
                if previa.estudiante_id.is_none() {
                    previa.estudiante_id = linea.estudiante_id;
                }
            }
            None => agrupadas.push(linea.clone()),
        }
    }
    agrupadas
}

/// Valida una línea contra el renglón real y la normaliza.
///
/// Devuelve `Ok(None)` si la línea no aporta nada (todo en cero). Para artículos
/// con control individual resuelve y verifica cada unidad concreta.
fn normalizar(
    tx: &Transaction<'_>,
    detalle: &prestamos_repo::RenglonPrestamo,
    linea: &LineaDevolucion,
    unidades_vistas: &mut HashSet<i64>,
    estudiante_prestamo: i64,
) -> Result<Option<LineaNormalizada>, ErrorDevolucion> {
    if let Some(estudiante_id) = linea.estudiante_id {
        if estudiante_id != estudiante_prestamo {
            return Err(ErrorDevolucion::EstudianteAjeno);
        }
    }
    let descripcion = limpiar_opcional(linea.descripcion.as_deref()).map(str::to_string);
    let notas = limpiar_opcional(linea.notas.as_deref()).map(str::to_string);

    if detalle.control_individual {
        if linea.cantidad_devuelta != 0
            || linea.cantidad_daniada != 0
            || linea.cantidad_perdida != 0
        {
            return Err(ErrorDevolucion::ControlIndividualNoAdmiteCantidad(
                detalle.articulo.clone(),
            ));
        }
        if linea.unidades.is_empty() {
            return Ok(None);
        }

        let mut cantidad_devuelta = 0;
        let mut cantidad_daniada = 0;
        let mut cantidad_perdida = 0;
        let mut unidades = Vec::with_capacity(linea.unidades.len());
        for unidad in &linea.unidades {
            if !unidades_vistas.insert(unidad.unidad_id) {
                return Err(ErrorDevolucion::UnidadDuplicada(unidad.unidad_id));
            }
            let real = inventario_repo::leer_unidad(tx, unidad.unidad_id)?
                .ok_or(ErrorDevolucion::UnidadNoExiste(unidad.unidad_id))?;
            if real.estado != "prestada" {
                return Err(ErrorDevolucion::UnidadNoPrestada {
                    codigo: real.codigo,
                    estado: real.estado,
                });
            }
            if real.articulo_id != detalle.articulo_id
                || real.prestamo_detalle_id != Some(detalle.id)
            {
                return Err(ErrorDevolucion::UnidadNoPertenece(real.codigo));
            }
            let condicion = Condicion::desde_str(&unidad.condicion)?;
            match condicion {
                Condicion::Bueno => cantidad_devuelta += 1,
                Condicion::Danado => cantidad_daniada += 1,
                Condicion::Perdido => cantidad_perdida += 1,
            }
            unidades.push((unidad.unidad_id, condicion));
        }

        let total = cantidad_devuelta + cantidad_daniada + cantidad_perdida;
        if total > detalle.cantidad_pendiente {
            return Err(ErrorDevolucion::CantidadExcedida {
                articulo: detalle.articulo.clone(),
                pendiente: detalle.cantidad_pendiente,
            });
        }
        if (cantidad_daniada > 0 || cantidad_perdida > 0) && descripcion.is_none() {
            return Err(ErrorDevolucion::DescripcionRequerida(detalle.articulo.clone()));
        }
        return Ok(Some(LineaNormalizada {
            detalle: detalle.clone(),
            cantidad_devuelta,
            cantidad_daniada,
            cantidad_perdida,
            unidades,
            descripcion,
            notas,
            estudiante_id: linea.estudiante_id,
        }));
    }

    if !linea.unidades.is_empty() {
        return Err(ErrorDevolucion::SinControlIndividualNoAdmiteUnidades(
            detalle.articulo.clone(),
        ));
    }
    if linea.cantidad_devuelta < 0 || linea.cantidad_daniada < 0 || linea.cantidad_perdida < 0 {
        return Err(ErrorDevolucion::CantidadNegativa);
    }
    let total = linea.cantidad_devuelta + linea.cantidad_daniada + linea.cantidad_perdida;
    if total == 0 {
        return Ok(None);
    }
    if total > detalle.cantidad_pendiente {
        return Err(ErrorDevolucion::CantidadExcedida {
            articulo: detalle.articulo.clone(),
            pendiente: detalle.cantidad_pendiente,
        });
    }
    if (linea.cantidad_daniada > 0 || linea.cantidad_perdida > 0) && descripcion.is_none() {
        return Err(ErrorDevolucion::DescripcionRequerida(detalle.articulo.clone()));
    }
    Ok(Some(LineaNormalizada {
        detalle: detalle.clone(),
        cantidad_devuelta: linea.cantidad_devuelta,
        cantidad_daniada: linea.cantidad_daniada,
        cantidad_perdida: linea.cantidad_perdida,
        unidades: Vec::new(),
        descripcion,
        notas,
        estudiante_id: linea.estudiante_id,
    }))
}

/// Aplica una línea ya validada: escribe el renglón, mueve el inventario, crea
/// los incidentes y actualiza el renglón del préstamo.
fn procesar(
    tx: &Transaction<'_>,
    prestamo_id: i64,
    devolucion_id: i64,
    linea: &LineaNormalizada,
    momento: &str,
) -> Result<(), ErrorDevolucion> {
    let detalle = &linea.detalle;

    repo::insertar_detalle(
        tx,
        devolucion_id,
        detalle.id,
        linea.cantidad_devuelta,
        linea.cantidad_daniada,
        linea.cantidad_perdida,
        linea.notas.as_deref(),
    )?;

    if detalle.control_individual {
        for (unidad_id, condicion) in &linea.unidades {
            let (tipo_movimiento, estado, incidente) = match condicion {
                Condicion::Bueno => (TipoMovimiento::Devolucion, "disponible", None),
                Condicion::Danado => (TipoMovimiento::DanioPrestado, "danada", Some("danio")),
                Condicion::Perdido => {
                    (TipoMovimiento::PerdidaPrestado, "faltante", Some("perdida"))
                }
            };
            inventario_repo::devolver_unidad(tx, *unidad_id, estado)?;
            inventory::aplicar_movimiento(
                tx,
                detalle.articulo_id,
                Some(*unidad_id),
                tipo_movimiento,
                1,
                MOTIVO_DEVOLUCION,
                Some("devolucion"),
                Some(devolucion_id),
            )
            .map_err(ErrorDevolucion::Movimiento)?;
            if let Some(tipo_incidente) = incidente {
                crear_incidente(
                    tx,
                    prestamo_id,
                    devolucion_id,
                    detalle,
                    linea,
                    tipo_incidente,
                    1,
                    Some(*unidad_id),
                    momento,
                )?;
            }
        }
        units::conciliar(tx, detalle.articulo_id).map_err(ErrorDevolucion::Conciliar)?;
    } else {
        if linea.cantidad_devuelta > 0 {
            inventory::aplicar_movimiento(
                tx,
                detalle.articulo_id,
                None,
                TipoMovimiento::Devolucion,
                linea.cantidad_devuelta,
                MOTIVO_DEVOLUCION,
                Some("devolucion"),
                Some(devolucion_id),
            )
            .map_err(ErrorDevolucion::Movimiento)?;
        }
        if linea.cantidad_daniada > 0 {
            inventory::aplicar_movimiento(
                tx,
                detalle.articulo_id,
                None,
                TipoMovimiento::DanioPrestado,
                linea.cantidad_daniada,
                MOTIVO_DEVOLUCION,
                Some("devolucion"),
                Some(devolucion_id),
            )
            .map_err(ErrorDevolucion::Movimiento)?;
            crear_incidente(
                tx,
                prestamo_id,
                devolucion_id,
                detalle,
                linea,
                "danio",
                linea.cantidad_daniada,
                None,
                momento,
            )?;
        }
        if linea.cantidad_perdida > 0 {
            inventory::aplicar_movimiento(
                tx,
                detalle.articulo_id,
                None,
                TipoMovimiento::PerdidaPrestado,
                linea.cantidad_perdida,
                MOTIVO_DEVOLUCION,
                Some("devolucion"),
                Some(devolucion_id),
            )
            .map_err(ErrorDevolucion::Movimiento)?;
            crear_incidente(
                tx,
                prestamo_id,
                devolucion_id,
                detalle,
                linea,
                "perdida",
                linea.cantidad_perdida,
                None,
                momento,
            )?;
        }
    }

    let cantidad_devuelta = detalle.cantidad_devuelta + linea.cantidad_devuelta;
    let cantidad_daniada = detalle.cantidad_daniada + linea.cantidad_daniada;
    let cantidad_perdida = detalle.cantidad_perdida + linea.cantidad_perdida;
    let estado = estado_detalle(
        detalle.cantidad_prestada,
        cantidad_devuelta,
        cantidad_daniada,
        cantidad_perdida,
    );
    prestamos_repo::actualizar_cantidades_detalle(
        tx,
        detalle.id,
        cantidad_devuelta,
        cantidad_daniada,
        cantidad_perdida,
        &estado,
    )?;
    Ok(())
}

/// Crea el incidente obligatorio de un daño o una pérdida (RN-33, RN-54).
fn crear_incidente(
    tx: &Transaction<'_>,
    prestamo_id: i64,
    devolucion_id: i64,
    detalle: &prestamos_repo::RenglonPrestamo,
    linea: &LineaNormalizada,
    tipo: &str,
    cantidad: i64,
    articulo_unidad_id: Option<i64>,
    momento: &str,
) -> Result<(), ErrorDevolucion> {
    let descripcion = linea
        .descripcion
        .as_deref()
        .ok_or_else(|| ErrorDevolucion::DescripcionRequerida(detalle.articulo.clone()))?;
    let (estudiante_id, responsabilidad) = match linea.estudiante_id {
        Some(id) => (Some(id), "estudiante"),
        None => (None, "sin_determinar"),
    };
    repo::insertar_incidente(
        tx,
        &repo::NuevoIncidente {
            tipo,
            prestamo_id,
            prestamo_detalle_id: detalle.id,
            devolucion_id,
            articulo_id: detalle.articulo_id,
            articulo_unidad_id,
            estudiante_id,
            responsabilidad,
            cantidad,
            descripcion,
            momento,
        },
    )?;
    Ok(())
}

/// Estado derivado de un renglón, coherente con el `CHECK` de `prestamo_detalle`.
///
/// Un renglón con daño o pérdida es `con_incidente`; si solo hay devoluciones en
/// buen estado, es `devuelto` cuando nada queda pendiente y `parcial` si aún queda.
fn estado_detalle(
    cantidad_prestada: i64,
    cantidad_devuelta: i64,
    cantidad_daniada: i64,
    cantidad_perdida: i64,
) -> String {
    let pendiente = cantidad_prestada - cantidad_devuelta - cantidad_daniada - cantidad_perdida;
    if cantidad_daniada > 0 || cantidad_perdida > 0 {
        "con_incidente".to_string()
    } else if cantidad_devuelta > 0 && pendiente == 0 {
        "devuelto".to_string()
    } else if cantidad_devuelta > 0 {
        "parcial".to_string()
    } else {
        "pendiente".to_string()
    }
}

/// Cierra el préstamo cuando ningún renglón tiene pendiente (RN-35).
fn cerrar_si_corresponde(
    tx: &Transaction<'_>,
    prestamo_id: i64,
    momento: &str,
) -> Result<(), ErrorDevolucion> {
    if prestamos_repo::pendiente_total(tx, prestamo_id)? == 0 {
        prestamos_repo::cerrar_prestamo(tx, prestamo_id, momento)?;
    }
    Ok(())
}

/// Errores tipados del servicio de devoluciones.
#[derive(Debug)]
pub enum ErrorDevolucion {
    /// No existe el préstamo indicado.
    PrestamoNoExiste(i64),
    /// El préstamo no está `activo` (RN-26).
    PrestamoNoActivo(String),
    /// El préstamo está `activo` pero ya no tiene nada pendiente.
    SinPendientes,
    /// La devolución no incluye ningún renglón con cantidades mayores que cero.
    SinLineas,
    /// No existe el renglón de préstamo indicado.
    RenglonNoExiste(i64),
    /// El renglón pertenece a otro préstamo.
    RenglonAjeno { renglon: i64, prestamo: i64 },
    /// Alguna cantidad es negativa (RN-29).
    CantidadNegativa,
    /// Lo que vuelve supera el pendiente del renglón (RN-28).
    CantidadExcedida { articulo: String, pendiente: i64 },
    /// Un artículo con control individual no se devuelve por cantidad (RN-50).
    ControlIndividualNoAdmiteCantidad(String),
    /// Un artículo sin control individual no admite unidades (RN-50).
    SinControlIndividualNoAdmiteUnidades(String),
    /// La condición de una unidad no es válida.
    CondicionInvalida(String),
    /// No existe la unidad individual indicada.
    UnidadNoExiste(i64),
    /// La unidad no está prestada en este renglón (RN-53).
    UnidadNoPertenece(String),
    /// La unidad ya no está prestada.
    UnidadNoPrestada { codigo: String, estado: String },
    /// La misma unidad aparece más de una vez.
    UnidadDuplicada(i64),
    /// Un daño o una pérdida exige descripción (RN-33).
    DescripcionRequerida(String),
    /// El responsable indicado no es el estudiante del préstamo (RN-56).
    EstudianteAjeno,
    /// Fallo al registrar un movimiento de inventario.
    Movimiento(ErrorInventario),
    /// Los contadores no coinciden con las unidades tras devolver (RN-61).
    Conciliar(ErrorUnidad),
    /// Error de SQLite.
    Sqlite(rusqlite::Error),
}

impl fmt::Display for ErrorDevolucion {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ErrorDevolucion::PrestamoNoExiste(_) => {
                write!(f, "No se encontró el préstamo indicado.")
            }
            ErrorDevolucion::PrestamoNoActivo(estado) => write!(
                f,
                "Solo se puede registrar una devolución en un préstamo activo (estado «{estado}»)."
            ),
            ErrorDevolucion::SinPendientes => write!(
                f,
                "El préstamo no tiene unidades pendientes de devolución."
            ),
            ErrorDevolucion::SinLineas => write!(
                f,
                "La devolución debe incluir al menos un renglón con cantidades mayores que cero."
            ),
            ErrorDevolucion::RenglonNoExiste(id) => {
                write!(f, "No existe el renglón de préstamo con id {id}.")
            }
            ErrorDevolucion::RenglonAjeno { renglon, prestamo } => write!(
                f,
                "El renglón {renglon} no pertenece al préstamo {prestamo}."
            ),
            ErrorDevolucion::CantidadNegativa => {
                write!(f, "Las cantidades de la devolución no pueden ser negativas.")
            }
            ErrorDevolucion::CantidadExcedida { articulo, pendiente } => write!(
                f,
                "Solo quedan {pendiente} unidades pendientes de «{articulo}»."
            ),
            ErrorDevolucion::ControlIndividualNoAdmiteCantidad(articulo) => write!(
                f,
                "El artículo «{articulo}» tiene control individual: indica las unidades en lugar de cantidades."
            ),
            ErrorDevolucion::SinControlIndividualNoAdmiteUnidades(articulo) => write!(
                f,
                "El artículo «{articulo}» no tiene control individual: usa cantidades en lugar de unidades."
            ),
            ErrorDevolucion::CondicionInvalida(valor) => write!(
                f,
                "La condición «{valor}» no es válida; usa «bueno», «danado» o «perdido»."
            ),
            ErrorDevolucion::UnidadNoExiste(id) => {
                write!(f, "No existe la unidad con id {id}.")
            }
            ErrorDevolucion::UnidadNoPertenece(codigo) => {
                write!(f, "La unidad «{codigo}» no pertenece a este préstamo.")
            }
            ErrorDevolucion::UnidadNoPrestada { codigo, estado } => {
                write!(f, "La unidad «{codigo}» no está prestada (estado «{estado}»).")
            }
            ErrorDevolucion::UnidadDuplicada(id) => {
                write!(f, "La unidad con id {id} aparece más de una vez.")
            }
            ErrorDevolucion::DescripcionRequerida(articulo) => write!(
                f,
                "Registrar un daño o una pérdida de «{articulo}» exige una descripción (RN-33)."
            ),
            ErrorDevolucion::EstudianteAjeno => write!(
                f,
                "El responsable indicado no corresponde al estudiante del préstamo."
            ),
            ErrorDevolucion::Movimiento(e) => write!(f, "{e}"),
            ErrorDevolucion::Conciliar(e) => write!(f, "{e}"),
            ErrorDevolucion::Sqlite(e) => write!(f, "Error de base de datos: {e}"),
        }
    }
}

impl std::error::Error for ErrorDevolucion {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            ErrorDevolucion::Movimiento(e) => Some(e),
            ErrorDevolucion::Conciliar(e) => Some(e),
            ErrorDevolucion::Sqlite(e) => Some(e),
            _ => None,
        }
    }
}

impl From<rusqlite::Error> for ErrorDevolucion {
    fn from(error: rusqlite::Error) -> Self {
        ErrorDevolucion::Sqlite(error)
    }
}
