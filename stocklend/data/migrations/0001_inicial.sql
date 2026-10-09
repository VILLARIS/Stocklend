-- ============================================================================
-- StockLend — migración inicial.  user_version = 1   (revisión 4)
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------- categoria
CREATE TABLE categoria (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre      TEXT    NOT NULL COLLATE NOCASE UNIQUE,
    descripcion TEXT,
    activo      INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
    creado_en   TEXT    NOT NULL
);

-- ----------------------------------------------------------------- articulo
CREATE TABLE articulo (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo              TEXT    COLLATE NOCASE UNIQUE,
    nombre              TEXT    NOT NULL COLLATE NOCASE,
    categoria_id        INTEGER NOT NULL
                        REFERENCES categoria(id) ON DELETE RESTRICT,
    unidad_medida       TEXT    NOT NULL DEFAULT 'unidad',
    notas               TEXT,
    control_individual  INTEGER NOT NULL DEFAULT 0 CHECK (control_individual IN (0, 1)),
    prestable           INTEGER NOT NULL DEFAULT 1 CHECK (prestable IN (0, 1)),
    activo              INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),

    cantidad_total       INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_total      >= 0),
    cantidad_disponible  INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_disponible >= 0),
    cantidad_prestada    INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_prestada   >= 0),
    cantidad_daniada     INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_daniada    >= 0),
    cantidad_faltante    INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_faltante   >= 0),

    creado_en           TEXT    NOT NULL,
    actualizado_en      TEXT    NOT NULL,

    -- RN-02 (refuerzo revisión 4): los cuatro cubos suman exactamente el total
    CHECK (cantidad_total = cantidad_disponible + cantidad_prestada
                            + cantidad_daniada + cantidad_faltante)
);

-- -------------------------------------------------------------- estudiante
CREATE TABLE estudiante (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_universitario TEXT    NOT NULL COLLATE NOCASE UNIQUE,
    nombres              TEXT    NOT NULL,
    apellidos            TEXT    NOT NULL,
    activo               INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
    creado_en            TEXT    NOT NULL,
    actualizado_en       TEXT    NOT NULL
);

-- ---------------------------------------------------------------- prestamo
CREATE TABLE prestamo (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    folio          TEXT    NOT NULL UNIQUE,
    estudiante_id  INTEGER NOT NULL REFERENCES estudiante(id) ON DELETE RESTRICT,
    fecha_prestamo TEXT    NOT NULL,
    fecha_limite   TEXT,
    estado         TEXT    NOT NULL
                   CHECK (estado IN ('activo', 'cerrado', 'anulado')),
    comentario     TEXT,
    creado_en      TEXT    NOT NULL,
    cerrado_en     TEXT
);

-- -------------------------------------------------------- prestamo_detalle
CREATE TABLE prestamo_detalle (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    prestamo_id         INTEGER NOT NULL REFERENCES prestamo(id) ON DELETE RESTRICT,
    articulo_id         INTEGER NOT NULL REFERENCES articulo(id) ON DELETE RESTRICT,
    cantidad_prestada   INTEGER NOT NULL CHECK (cantidad_prestada > 0),
    cantidad_devuelta   INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_devuelta >= 0),
    cantidad_daniada    INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_daniada  >= 0),
    cantidad_perdida    INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_perdida  >= 0),
    estado              TEXT    NOT NULL
                        CHECK (estado IN ('pendiente', 'parcial', 'devuelto', 'con_incidente')),
    notas               TEXT,
    UNIQUE (prestamo_id, articulo_id),

    -- Estado derivado coherente con las cantidades (refuerzo revisión 4).
    -- Ver §4.6: pendiente / parcial / devuelto / con_incidente.
    CHECK (
        (estado = 'pendiente'
         AND cantidad_devuelta = 0
         AND cantidad_daniada = 0
         AND cantidad_perdida = 0)
        OR (estado = 'parcial'
            AND cantidad_devuelta > 0
            AND cantidad_prestada - cantidad_devuelta
                - cantidad_daniada - cantidad_perdida > 0
            AND cantidad_daniada = 0
            AND cantidad_perdida = 0)
        OR (estado = 'devuelto'
            AND cantidad_devuelta > 0
            AND cantidad_prestada - cantidad_devuelta
                - cantidad_daniada - cantidad_perdida = 0
            AND cantidad_daniada = 0
            AND cantidad_perdida = 0)
        OR (estado = 'con_incidente'
            AND (cantidad_daniada > 0 OR cantidad_perdida > 0))
    )
);

-- -------------------------------------------------------- articulo_unidad
-- Se crea DESPUÉS de prestamo_detalle porque lo referencia (FK).
-- Solo tiene filas para artículos con articulo.control_individual = 1.
CREATE TABLE articulo_unidad (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    articulo_id         INTEGER NOT NULL REFERENCES articulo(id) ON DELETE RESTRICT,
    codigo              TEXT    NOT NULL COLLATE NOCASE UNIQUE,
    descripcion         TEXT,
    estado              TEXT    NOT NULL
                        CHECK (estado IN ('disponible','prestada','danada','faltante','baja')),
    prestamo_detalle_id INTEGER REFERENCES prestamo_detalle(id) ON DELETE RESTRICT,
    verificado_en       TEXT,
    notas               TEXT,
    creado_en           TEXT    NOT NULL,
    actualizado_en      TEXT    NOT NULL,

    -- Una unidad prestada siempre tiene que decir en qué renglón está
    CHECK (estado <> 'prestada' OR prestamo_detalle_id IS NOT NULL)
);

-- --------------------------------------------------------------- devolucion
CREATE TABLE devolucion (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    prestamo_id      INTEGER NOT NULL REFERENCES prestamo(id) ON DELETE RESTRICT,
    fecha_devolucion TEXT    NOT NULL,
    observaciones    TEXT,
    creado_en        TEXT    NOT NULL
);

-- ------------------------------------------------------- devolucion_detalle
CREATE TABLE devolucion_detalle (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    devolucion_id       INTEGER NOT NULL REFERENCES devolucion(id) ON DELETE RESTRICT,
    prestamo_detalle_id INTEGER NOT NULL REFERENCES prestamo_detalle(id) ON DELETE RESTRICT,
    cantidad_devuelta   INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_devuelta >= 0),
    cantidad_daniada    INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_daniada  >= 0),
    cantidad_perdida    INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_perdida  >= 0),
    notas               TEXT,
    UNIQUE (devolucion_id, prestamo_detalle_id)
);

-- --------------------------------------------------------------- incidente
CREATE TABLE incidente (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo                TEXT    NOT NULL CHECK (tipo IN ('perdida', 'danio', 'otro')),
    estado              TEXT    NOT NULL DEFAULT 'abierto'
                        CHECK (estado IN ('abierto', 'resuelto')),
    origen              TEXT    NOT NULL
                        CHECK (origen IN ('stock', 'prestamo', 'devolucion')),
    prestamo_id         INTEGER REFERENCES prestamo(id) ON DELETE RESTRICT,
    prestamo_detalle_id INTEGER REFERENCES prestamo_detalle(id) ON DELETE RESTRICT,
    devolucion_id       INTEGER REFERENCES devolucion(id) ON DELETE RESTRICT,
    articulo_id         INTEGER NOT NULL REFERENCES articulo(id) ON DELETE RESTRICT,
    articulo_unidad_id  INTEGER REFERENCES articulo_unidad(id) ON DELETE RESTRICT,
    estudiante_id       INTEGER REFERENCES estudiante(id) ON DELETE RESTRICT,
    responsabilidad     TEXT    NOT NULL DEFAULT 'sin_determinar'
                        CHECK (responsabilidad IN ('estudiante', 'facultad', 'sin_determinar')),
    cantidad            INTEGER NOT NULL CHECK (cantidad > 0),
    descripcion         TEXT    NOT NULL CHECK (length(trim(descripcion)) > 0),
    resolucion          TEXT,
    resuelto_en         TEXT,
    creado_en           TEXT    NOT NULL,

    -- Coherencia entre el origen del incidente y sus relaciones
    CHECK (origen = 'stock'       OR prestamo_id   IS NOT NULL),
    CHECK (origen <> 'devolucion' OR devolucion_id IS NOT NULL),
    CHECK (devolucion_id IS NULL  OR origen = 'devolucion'),
    -- No se atribuye responsabilidad al estudiante sin registro que lo evidencie
    CHECK (responsabilidad <> 'estudiante' OR estudiante_id IS NOT NULL)
);

-- ---------------------------------------------------- movimiento_inventario
CREATE TABLE movimiento_inventario (
    id                             INTEGER PRIMARY KEY AUTOINCREMENT,
    articulo_id                    INTEGER NOT NULL REFERENCES articulo(id) ON DELETE RESTRICT,
    articulo_unidad_id             INTEGER REFERENCES articulo_unidad(id) ON DELETE RESTRICT,
    tipo                           TEXT    NOT NULL CHECK (tipo IN (
                                       'alta', 'ajuste_positivo', 'ajuste_negativo',
                                       'prestamo', 'devolucion',
                                       'danio_prestado', 'perdida_prestado',
                                       'danio_disponible', 'perdida_disponible',
                                       'reingreso_reparacion',
                                       'baja_daniada', 'baja_faltante')),
    cantidad                       INTEGER NOT NULL CHECK (cantidad > 0),
    cantidad_resultante_total      INTEGER NOT NULL CHECK (cantidad_resultante_total      >= 0),
    cantidad_resultante_disponible INTEGER NOT NULL CHECK (cantidad_resultante_disponible >= 0),
    motivo                         TEXT    NOT NULL CHECK (length(trim(motivo)) > 0),
    referencia_tipo                TEXT    CHECK (referencia_tipo IS NULL OR referencia_tipo IN (
                                       'prestamo', 'devolucion', 'incidente', 'ajuste', 'anulacion')),
    referencia_id                  INTEGER,
    fecha                          TEXT    NOT NULL
);

-- ----------------------------------------------------------- configuracion
CREATE TABLE configuracion (
    clave          TEXT PRIMARY KEY,
    valor          TEXT NOT NULL,
    actualizado_en TEXT NOT NULL
);

-- ============================================================ índices (13)
CREATE INDEX ix_articulo_nombre              ON articulo(nombre);
CREATE INDEX ix_articulo_categoria           ON articulo(categoria_id);
CREATE INDEX ix_articulo_unidad_articulo     ON articulo_unidad(articulo_id, estado);
CREATE INDEX ix_articulo_unidad_prestamo     ON articulo_unidad(prestamo_detalle_id);
CREATE INDEX ix_estudiante_apellidos         ON estudiante(apellidos, nombres);
CREATE INDEX ix_prestamo_estudiante          ON prestamo(estudiante_id, estado);
CREATE INDEX ix_prestamo_estado_fecha        ON prestamo(estado, fecha_prestamo DESC);
CREATE INDEX ix_prestamo_fecha               ON prestamo(fecha_prestamo);
CREATE INDEX ix_prestamo_detalle_articulo    ON prestamo_detalle(articulo_id);
CREATE INDEX ix_devolucion_prestamo          ON devolucion(prestamo_id, fecha_devolucion DESC);
CREATE INDEX ix_devolucion_fecha             ON devolucion(fecha_devolucion);
CREATE INDEX ix_incidente_estado             ON incidente(estado, creado_en DESC);
CREATE INDEX ix_incidente_articulo           ON incidente(articulo_id, creado_en DESC);

-- No se crean por estar ya cubiertos:
--   UNIQUE(prestamo_id, articulo_id)             cubre prestamo_detalle por préstamo
--   UNIQUE(devolucion_id, prestamo_detalle_id)   cubre devolucion_detalle por devolución
--   UNIQUE COLLATE NOCASE (codigo_universitario) cubre estudiante por código
--   UNIQUE COLLATE NOCASE (nombre) de categoria   cubre categoría por nombre

-- ============================================================ vistas (2)
-- Cantidad pendiente por renglón. Es una OBLIGACIÓN, no un cubo de inventario.
CREATE VIEW v_prestamo_detalle AS
SELECT
    pd.*,
    (pd.cantidad_prestada - pd.cantidad_devuelta
     - pd.cantidad_daniada  - pd.cantidad_perdida) AS cantidad_pendiente
FROM prestamo_detalle pd;

-- Préstamos con su estudiante y sus totales, para listados y panel
CREATE VIEW v_prestamo_resumen AS
SELECT
    p.id,
    p.folio,
    p.estado,
    p.fecha_prestamo,
    p.fecha_limite,
    p.comentario,
    e.id                   AS estudiante_id,
    e.codigo_universitario,
    e.nombres,
    e.apellidos,
    COUNT(pd.id)           AS total_renglones,
    COALESCE(SUM(pd.cantidad_prestada), 0)  AS total_prestado,
    COALESCE(SUM(pd.cantidad_pendiente), 0) AS total_pendiente
FROM prestamo p
JOIN estudiante e              ON e.id = p.estudiante_id
LEFT JOIN v_prestamo_detalle pd ON pd.prestamo_id = p.id
GROUP BY p.id;
