# StockLend — Arquitectura Técnica

> **Estado del documento:** propuesta técnica para revisión.
> **Etapa:** planificación (pre-implementación).
> El sistema **no está desarrollado**. Ninguna funcionalidad descrita aquí ha sido implementada ni probada.

---

## 1. Objetivo de la arquitectura

StockLend es una aplicación de escritorio de un solo usuario, en español, que funciona
sin conexión a internet, sobre Windows, y que reemplaza los registros en cuadernos,
fichas físicas y archivos de Excel usados actualmente para el control de utensilios
de cocina, equipos y máquinas de prácticas de industria alimentaria.

La arquitectura debe priorizar, en este orden:

1. **Corrección del inventario.** Un número de existencia incorrecto causa un problema
   operativo real en la práctica siguiente.
2. **Trazabilidad.** Nada se borra ni se sobrescribe en silencio; los cambios quedan
   registrados como movimientos o ajustes con motivo.
3. **Velocidad de uso.** Sonia opera sola y con pocos minutos entre clases:
   menos clics, búsqueda instantánea y confirmaciones solo en acciones destructivas.
4. **Portabilidad de los datos.** La base es un archivo SQLite legible, sin cifrado
   propietario, sin dependencia del ejecutable y sin mecanismos que la retengan.

### 1.1 Criterios de aceptación de la arquitectura

| # | Criterio | Cómo se verifica |
|---|----------|------------------|
| CA-1 | Ningún módulo de `ui/` importa `sqlite3` ni ejecuta SQL | Test automatizado de imports prohibidos |
| CA-2 | Ningún módulo de `services/` importa `PySide6` | Test automatizado de imports prohibidos |
| CA-3 | Toda regla de negocio es comprobable sin interfaz gráfica | Suite de tests de `services/` |
| CA-4 | La base de datos sobrevive a la actualización y reinstalación del ejecutable | Copia del archivo `.sqlite` a otra carpeta |
| CA-5 | La aplicación arranca y opera sin conexión a internet | Prueba en equipo sin red |

---

## 2. Vista general de la arquitectura

Arquitectura **modular monolítica en tres capas**, sobre una aplicación local.
No hay servidores, no hay APIs, no hay procesos de fondo, no hay cola de mensajes.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  CAPA 1 — PRESENTACIÓN            stocklend/ui/                           │
│                                                                          │
│  Ventana principal · Menú lateral · Vistas · Diálogos · Widgets         │
│  Tema (QSS) · Formateadores de presentación · Manejo de errores visual  │
│                                                                          │
│  Responsabilidad: mostrar datos y capturar la intención del usuario.     │
│  NO conoce SQL. NO decide reglas de negocio. NO guarda estado global.    │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │  llama a objetos de servicio
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  CAPA 2 — LÓGICA DE NEGOCIO        stocklend/services/                   │
│                                                                          │
│  InventarioService   EstudianteService   PrestamoService                 │
│  DevolucionService   IncidenteService    DashboardService                │
│  ReporteService      RespaldoService     ConfiguracionService            │
│  UnidadService                                                        │
│                                                                          │
│  Responsabilidad: reglas de negocio, validación, orquestación,          │
│  transacciones, mensajes de error en lenguaje natural.                  │
│  NO importa PySide6. NO escribe SQL: usa repositorios.                   │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │  recibe y devuelve entidades (dataclasses)
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  CAPA 3 — ACCESO A DATOS          stocklend/data/ + stocklend/domain/    │
│                                                                          │
│  database.py (conexión, PRAGMA, transacciones)                          │
│  repositories/*.py  (SQL parametrizado, mapeo fila → entidad)           │
│  migrations/*.sql   (migraciones versionadas)                            │
│                                                                          │
│  domain/  entidades, enums, value objects. Sin dependencias.             │
│                                                                          │
│  Responsabilidad: persistencia, mapeo, integridad referencial.           │
│  NO conoce reglas de negocio. NO importa PySide6 ni services.            │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Dirección de dependencias

Las dependencias apuntan **hacia adentro**, en un solo sentido:

```
ui/  →  services/  →  data/repositories/  →  sqlite3
 │         │                  │
 └─────────┴──────────────────┴──→  domain/   (hoja sin dependencias)
```

**Prohibido:** `data/` → `services/`, `data/` → `ui/`, `services/` → `ui/`,
`domain/` → cualquier otra capa.

### 2.2 Por qué una arquitectura en capas y no hexagonal completa

La regla de negocio más importante de StockLend es la **transaccionalidad entre
préstamos e inventario**: una devolución parcial correcta cambia simultáneamente
`prestamo_detalle`, `devolucion`, `devolucion_detalle`, los contadores de
`articulo`, `movimiento_inventario`, las unidades individuales afectadas y
posiblemente `incidente`. Eso exige una frontera transaccional clara alrededor de la
lógica de negocio.

El coste de un diseño hexagonal completo (puertos y adaptadores con inyección de dependencias) no se paga
en un monolito de un solo usuario: se paga en ceremonia y en indirección. La
separación en tres capas con repositorios explícitos ofrece la misma garantía
técnica (SQL aislado de la vista, lógica testeable sin GUI) con menos código.

**Cuando se reevalúa esta decisión:** si apareciera un segundo consumidor de las
mismas reglas (por ejemplo, un script de importación masiva o un servicio de
consulta), los puertos de `services/` ya están definidos por las firmas de los
repositorios y la migración sería incremental.

---

## 3. Componentes

### 3.1 `stocklend/domain/` — Dominio (hoja)

Entidades y tipos sin dependencias externas. Contenido previsto:

| Elemento | Descripción |
|----------|-------------|
| `entidades.py` | Dataclasses: `Articulo`, `ArticuloUnidad`, `Categoria`, `Estudiante`, `Prestamo`, `PrestamoDetalle`, `Devolucion`, `DevolucionDetalle`, `Incidente`, `MovimientoInventario` |
| `enums.py` | `EstadoPrestamo`, `EstadoDetalle`, `EstadoUnidad`, `EstadoIncidente`, `TipoIncidente`, `OrigenIncidente`, `ResponsabilidadIncidente`, `TipoMovimiento` (12 valores) |
| `value_objects.py` | `Folio`, `CodigoUniversitario`, `CodigoUnidad`, `Cantidad`, `RangoFechas` con sus validaciones |
| `excepciones.py` | Jerarquía: `StockLendError` → `ValidacionError`, `CantidadInsuficienteError`, `ReglaNegocioError`, `NoEncontradoError`, `PersistenciaError` |

`TipoMovimiento` merece una nota: cada valor lleva consigo el **cubo de origen** y el
**cubo de destino** del que sale y al que entra la unidad. El efecto de un
movimiento sobre los contadores no se decide en el servicio, se deduce del tipo.
Así la reconciliación del libro de movimientos es una igualdad exacta y no una
comprobación caso por caso. Ver `DATABASE_DESIGN.md`, sección 4.9.1.

Reglas de este paquete:
- Solo biblioteca estándar.
- Sin `datetime.now()` dentro de las entidades: el tiempo lo inyecta el servicio.
- Sin SQL, sin PySide6, sin acceso a archivos.

**Estado (Etapa 2):** implementado. Además de los tipos de la tabla, el dominio
incluye dos tipos de apoyo que el modelo implica y no estaban listados: `Cubo` (los
cinco contadores de `articulo`) y `Configuracion` (la fila clave/valor que usa
`ConfiguracionRepo`). Se verifica con `tests/unit/test_domain_*`.

### 3.2 `stocklend/data/` — Acceso a datos

| Módulo | Responsabilidad |
|--------|------------------|
| `database.py` | Fábrica de conexiones `sqlite3`, PRAGMA, `Database.transaction()` |
| `migrations/` | Scripts SQL numerados, aplicados en orden, versionados con `PRAGMA user_version` |
| `repositories/` | Un repositorio por agregado: `ArticuloRepo`, `ArticuloUnidadRepo`, `EstudianteRepo`, `PrestamoRepo`, `DevolucionRepo`, `IncidenteRepo`, `MovimientoRepo`, `DashboardRepo`, `RespaldoRepo`, `ConfiguracionRepo` |

**Estado (Etapa 2):** implementados los repositorios de entidades. Se añade
`CategoriaRepo`, que la lista anterior no incluía: la categoría es un agregado con
CRUD propio y la verificación de la etapa lo exige. `DashboardRepo` y `RespaldoRepo`
quedan diferidos a sus etapas (panel y respaldo).

**Contrato de los repositorios:**
- Todo SQL va en el repositorio, con parámetros vinculados (`?`). Nunca `f"SELECT ... {var}"`.
- Las consultas de lectura que alimentan tablas usan paginación por clave (`LIMIT/OFFSET`
  o paginación por `id` cuando el volumen lo justifique).
- Devuelven entidades de `domain/`, nunca tuplas crudas a la capa de servicios.
- No abren ni cierran la transacción: se limitan a la conexión que reciben.

**Configuración de la conexión SQLite** (fija, en `database.py`):

```python
PRAGMA foreign_keys = ON          # integridad referencial activa
PRAGMA journal_mode = WAL         # lectores concurrentes y mejor resistencia a cortes
PRAGMA synchronous = NORMAL       # equilibrio adecuado con WAL
PRAGMA busy_timeout = 5000        # 5 s de espera ante bloqueo
PRAGMA temp_store = MEMORY
```

`foreign_keys = ON` es obligatorio: en SQLite está desactivado por defecto y, sin él,
las reglas de integridad del modelo de datos no se aplican.

### 3.3 `stocklend/services/` — Lógica de negocio

Es la única capa que conoce las reglas. Cada servicio es un objeto sin estado
persistente, instanciado una vez en el contenedor de la aplicación.

| Servicio | Responsabilidad principal |
|----------|--------------------------|
| `InventarioService` | Altas, ajuste de existencias con motivo, estados por artículo, búsqueda |
| `UnidadService` | Artículos con control individual: alta de unidades con código, cambio de estado, pase por los 12 tipos de movimiento |
| `EstudianteService` | Alta/consulta de estudiantes, búsqueda por nombre, historial |
| `PrestamoService` | Crear préstamo multi-artículo, validar disponibilidad, anular, cerrar |
| `DevolucionService` | Devoluciones totales y parciales, validación de cantidades y condiciones |
| `IncidenteService` | Registrar pérdidas y daños con su origen, resolver incidentes, elegir responsable solo cuando hay evidencia |
| `DashboardService` | Estadísticas reales agregadas desde la base |
| `ReporteService` | Consultas de historial, filtros, preparación de datos para PDF |
| `RespaldoService` | Copia de seguridad, restauración, verificación de integridad |
| `ConfiguracionService` | Preferencias locales, ruta de datos, contadores y valores de `configuracion` |

**Reglas de esta capa:**
- Una operación de negocio = **una** transacción. Si algo falla a mitad, no queda nada a medias.
- Las excepciones propias se traducen aquí a mensajes en español comprensibles.
  La capa `ui/` muestra el mensaje, nunca una traza técnica.
- No se ejecutan `SELECT` de KPI en la vista: el panel se calcula en
  `DashboardService` para que las cifras sean siempre consistentes y testeables.

**Estado (Etapa 4).** A los servicios de la Etapa 3 (`InventarioService`,
`UnidadService`, `EstudianteService`) y al módulo privado `_comun.py` —que
concentra el cálculo puro de contadores (RN-01, RN-02, RN-58, RN-59) y el registro
del movimiento en el orden de `DATABASE_DESIGN` §9.3— se suman `PrestamoService`,
`DevolucionService` e `IncidenteService`. `_comun` añade la primitiva
`aplicar_movimiento_unidad` (mueve una unidad y ajusta contadores y libro), la
derivación `estado_detalle` y el cierre `cerrar_prestamo_si_corresponde` (RN-35,
RN-36), de modo que el control individual (RN-50 a RN-53) se comparte entre alta,
préstamo, devolución y anulación. Las devoluciones registran el daño o la pérdida
con su incidente `devolucion` en la misma transacción (RN-33, RN-54), y los
incidentes de `stock` o `prestamo` se registran por separado con
`IncidenteService`. Cada método público construye sus repositorios sobre la
conexión recibida y abre una sola transacción `BEGIN IMMEDIATE`
(`data.database.transaction`); los servicios no se llaman entre sí dentro de una
transacción, comparten lógica por `_comun`. `DashboardService`, `ReporteService`,
`RespaldoService` y `ConfiguracionService` quedan para las etapas 6 a 8.

### 3.4 `stocklend/ui/` — Presentación

| Módulo | Responsabilidad |
|--------|------------------|
| `main_window.py` | Ventana principal, layout general |
| `sidebar.py` | Menú lateral de navegación |
| `pages/` | Una clase por sección: `dashboard.py`, `inventario.py`, `estudiantes.py`, `prestamos.py`, `devoluciones.py`, `incidentes.py`, `reportes.py`, `respaldo.py`, `configuracion.py` |
| `widgets/` | Componentes reutilizables: `DataTable`, `SearchBar`, `StatCard`, `ConfirmDialog`, `FormField`. El catálogo completo, con su anatomía y sus estados, está en `UI_COMPONENTS.md` |
| `dialogs/` | Diálogos modales: confirmación, alta de artículo, alta de estudiante, devolución |
| `theme.py` | Paleta de colores y hoja de estilos Qt (QSS), **generada a partir de los tokens de `UI_DESIGN.md` sección 3**, no escrita a mano |
| `formatters.py` | Fechas, cantidades, folios en formato legible para la vista |
| `errors.py` | Traducción de excepciones de dominio a mensajes en español para los componentes de `UI_COMPONENTS.md` |

**Reglas de esta capa:**
- Los widgets no abren la base de datos. Reciben un servicio por constructor.
- La navegación es por *páginas* con `QStackedWidget`, sin abrir ventanas nuevas
  para la navegación principal: reduce la carga cognitiva y la memoria.
- Los textos visibles están en español y fuera de la lógica.

**Estado (Etapa 5):** implementado el armazón. `main_window.py` monta la ventana
única (1360×840, mínimo 1024×640) con `sidebar.py` y un `QStackedWidget`
(`objectName` `contenido`). `theme.py` genera el QSS desde los tokens de
`UI_DESIGN.md` §3 y expone `aplicar_tema`. Los componentes base viven en
`widgets/` (`primitives.py`, `feedback.py`, `inputs.py`, `table.py`) y en
`dialogs/` (`confirm.py`). `pages/` contiene `base.py`, los listados conectados a
datos reales (Inventario, Estudiantes, Préstamos, Incidentes) y las páginas
provisionales (Panel, Devoluciones, Reportes, Respaldo, Configuración), que
muestran un aviso de etapa pendiente y **no** inventan datos. La carga es síncrona
en el hilo de la interfaz; el traslado a `QThreadPool` queda para una etapa
posterior. `formatters.py` y `errors.py` completan la capa. Las contradicciones
C-1…C-10 de `UI_DESIGN.md` §10 se resolvieron según las propuestas documentadas y
quedan registradas para revisión del usuario.

### 3.5 `stocklend/core/` — Soporte transversal

| Módulo | Responsabilidad |
|--------|------------------|
| `paths.py` | Resolución de rutas de datos y de configuración |
| `config.py` | Carga y guardado de preferencias locales |
| `logging_setup.py` | Registro en archivo, rotación y nivel |
| `container.py` | Composición: crea y conecta servicios y repositorios |
| `constants.py` | Versión de la aplicación, versión del esquema |

### 3.6 `stocklend/services/reporting/` — Preparación de PDF

Subpaquete de `services/`, separado para mantener `ReporteService` legible:

- `consultas.py` — Consultas de historial con filtros.
- `plantillas.py` — Estructuras de datos de cada reporte, sin dependencia de librería PDF.
- `render/` — Adaptadores de renderizado (se implementarán en la etapa de reportes).

La generación de PDF **no está implementada**. El diseño mantiene la capa de
consulta y la de renderizado separadas, de modo que la librería PDF (ReportLab,
o el motor de impresión de Qt) sea un detalle intercambiable y no contamine
la lógica de negocio.

---

## 4. Arquitectura de la interfaz gráfica

Decisiones de diseño, **aún sin implementar**. El marco visual y de navegación está
fijo aquí; el diseño detallado de las pantallas, de los componentes y de los flujos
está en `UI_DESIGN.md`, `UI_SCREENS.md`, `UI_COMPONENTS.md` y `UI_FLOWS.md`, que
materializan estas decisiones sin cambiar ninguna.

| Elemento | Decisión |
|----------|----------|
| Estilo | Widgets nativos de Qt (`QtWidgets`), no QML. Menor complejidad, suficiente para formularios y tablas |
| Navegación | Menú lateral fijo + `QStackedWidget`. Sin ventanas emergentes para secciones |
| Color principal | Azul. Fondo claro, texto de alto contraste |
| Tipografía | Familia del sistema (Segoe UI en Windows), 10–11 pt en tablas, títulos 16–20 pt |
| Tablas | `QTableView` + `QAbstractTableModel` propio, no `QTableWidget`, para no cargar widgets por celda |
| Formularios | `QFormLayout` con etiquetas AboveField, validación en línea y mensaje bajo el campo |
| Acciones destructivas | Confirmación obligatoria con el nombre del registro afectado |
| Mensajes | Componentes de `UI_COMPONENTS.md` (`InlineNotice`, aviso flotante, `ConfirmDialog`), en español, sin nombres de tablas ni clases SQL. No se usa `QMessageBox`: no admite el nombre del registro, ni botón con verbo propio, ni doble confirmación. Ver C-8 en `UI_DESIGN.md` |
| Accesibilidad | Contraste mínimo 4.5:1, foco visible, navegación por teclado en formularios |

Paleta de referencia (a confirmar con Sonia antes de maquetar):

| Rol | Color |
|-----|-------|
| Primario | `#1E5AA8` |
| Primario oscuro (barra lateral) | `#153E75` |
| Fondo | `#F5F7FA` |
| Superficie | `#FFFFFF` |
| Texto principal | `#1B2430` |
| Texto secundario | `#5A6672` |
| Éxito | `#1E7B45` |
| Advertencia | `#B26A00` |
| Error | `#B3261E` |

### 4.1 Corrección pendiente: el color de advertencia no cumple el contraste declarado

La tabla anterior declara «Contraste mínimo 4.5:1». Al medir los valores con la
fórmula de luminancia relativa de WCAG 2.1, **`#B26A00` da 4.24:1 sobre `#FFFFFF`**,
por debajo del mínimo que este mismo documento exige. Sobre el fondo ámbar de una
pastilla, da 3.80:1, todavía peor.

**Este documento no se modifica todavía.** La corrección propuesta, pendiente de
aprobar, es conservar `#B26A00` para rellenos y añadir un tono de texto más oscuro,
`#9C5800`, que da 5.51:1 sobre blanco y 4.94:1 sobre el fondo ámbar. También hace
falta un tono de borde de campo, `#828D9E` (3.36:1), porque `#D8DEE7` no alcanza el
3:1 que WCAG 1.4.11 exige en un control no textual.

El diseño de interfaz ya cuenta con esos dos tonos y con veinticuatro combinaciones
verificadas, todas conformes. Está en `UI_DESIGN.md` secciones 3.1 y 3.2, y la
contradicción está registrada como C-2 en su sección 10. Cuando se apruebe, la
paleta de este apartado se actualiza con los valores aprobados.

**Rendimiento en tablas:** el volumen esperado es bajo (decenas de artículos,
miles de préstamos a largo plazo). Aun así, las vistas implementarán carga bajo
demanda y filtrado en SQL, nunca la carga completa de la tabla en memoria para
listas grandes.

---

## 5. Estructura de carpetas

```
StockLend/
│
├── README.md                     Descripción general del proyecto
├── pyproject.toml                Metadatos, dependencias y configuración de herramientas
├── .gitignore                    Exclusiones (build, dist, .venv, *.sqlite)
│
├── docs/                         Documentación técnica
│   ├── ARCHITECTURE.md           Este documento
│   ├── REQUIREMENTS.md           Requisitos funcionales y no funcionales
│   ├── DATABASE_DESIGN.md        Modelo de datos, DDL e invariantes
│   ├── DEVELOPMENT_PLAN.md       Etapas, riesgos y decisiones pendientes
│   ├── UI_DESIGN.md              Identidad visual, ventana, navegación, accesibilidad
│   ├── UI_SCREENS.md             Diseño de cada pantalla
│   ├── UI_COMPONENTS.md          Catálogo de componentes reutilizables
│   └── UI_FLOWS.md               Flujos, validaciones, mensajes y preguntas abiertas
│
├── stocklend/                    Paquete de la aplicación
│   ├── __main__.py               Punto de entrada: python -m stocklend
│   ├── app.py                    Arranque de la aplicación Qt
│   │
│   ├── core/                     Soporte transversal
│   │   ├── paths.py              Rutas de datos y configuración (Windows)
│   │   ├── config.py             Preferencias locales
│   │   ├── logging_setup.py      Registro en archivo con rotación
│   │   ├── constants.py          Versiones de app y esquema
│   │   └── container.py          Composición de dependencias
│   │
│   ├── domain/                   Dominio: sin dependencias (hoja)
│   │   ├── entidades.py
│   │   ├── enums.py
│   │   ├── value_objects.py
│   │   └── excepciones.py
│   │
│   ├── data/                     Acceso a datos
│   │   ├── database.py           Conexión, PRAGMA, transacciones
│   │   ├── migrations/           Migraciones SQL versionadas
│   │   └── repositories/         Repositorios (SQL parametrizado)
│   │
│   ├── services/                 Lógica de negocio
│   │   ├── inventario_service.py
│   │   ├── unidad_service.py
│   │   ├── estudiante_service.py
│   │   ├── prestamo_service.py
│   │   ├── devolucion_service.py
│   │   ├── incidente_service.py
│   │   ├── dashboard_service.py
│   │   ├── reporte_service.py
│   │   ├── respaldo_service.py
│   │   ├── configuracion_service.py
│   │   └── reporting/            Consultas y plantillas de reportes
│   │
│   ├── ui/                       Presentación (PySide6)
│   │   ├── main_window.py
│   │   ├── sidebar.py
│   │   ├── theme.py              Paleta y hoja de estilos QSS
│   │   ├── formatters.py         Fechas y cantidades legibles
│   │   ├── errors.py             Excepciones → mensajes en español
│   │   ├── pages/                Una vista por sección
│   │   ├── widgets/              Componentes reutilizables
│   │   └── dialogs/              Diálogos modales
│   │
│   └── resources/                Recursos estáticos
│       ├── icons/                Iconos (SVG)
│       ├── styles/                Hojas de estilo adicionales
│       └── fonts/                 Tipografías propias, si se requieren
│
├── tests/                        Pruebas automatizadas
│   ├── conftest.py               Fixtures: base temporal, servicios de prueba
│   ├── unit/                     Pruebas de dominio y servicios
│   ├── integration/              Pruebas de repositorios sobre SQLite real
│   ├── gui/                      Pruebas de interfaz (pytest-qt)
│   └── test_architecture.py      Verifica CA-1 y CA-2 (imports prohibidos)
│
├── tools/                        Utilidades de desarrollo
│   ├── build_windows.py          Empaquetado con PyInstaller
│   └── stocklend.spec            Configuración de PyInstaller
│
├── data/                         Datos locales en desarrollo (NO versionado)
│   ├── stocklend.sqlite          Base de datos de desarrollo
│   └── respaldos/                Copias de seguridad de desarrollo
│
├── logs/                         Registro de la aplicación (NO versionado)
│
└── build/, dist/                 Salida de PyInstaller (NO versionados)
```

**Reglas sobre la estructura:**
- `stocklend/` no debe contener archivos sueltos: todo va en su paquete correspondiente.
- Cada subpaquete tendrá su `__init__.py`.
- `data/`, `logs/`, `build/`, `dist/` en la raíz son **solo para desarrollo**. En la
  aplicación instalada la base de datos vive fuera, en la carpeta de datos del usuario.

---

## 6. Gestión de dependencias y versiones

### 6.1 Versiones elegidas

Comprobadas en PyPI el 25 de septiembre de 2026.

| Componente | Versión mínima | Versión fijada | Notas |
|------------|----------------|----------------|-------|
| Python | 3.10 | **3.13.x** | Ver 6.2 |
| PySide6 | 6.11.0 | **6.11.2** | Requiere Python ≥3.10, <3.15. Publicada el 18/08/2026 |
| SQLite (módulo `sqlite3`) | 3.35 | **incluido en Python** | Ver nota |
| PyInstaller | 6.22.0 | **6.22.3** | Soporta Python 3.8–3.15 y PySide6 |
| pytest | 9.0 | **9.1.1** | |
| pytest-qt | 4.5.0 | **4.5.0** | Solo para pruebas de interfaz |
| ruff | 0.16 | **0.16.9** | Lint y formateo |

**Sobre SQLite:** no se instala como paquete. Se usa el módulo `sqlite3` de la
biblioteca estándar, que se distribuye con Python. En la máquina de desarrollo
resuelve a la versión **3.50.4**. El ejecutable empaquetado con PyInstaller
incluye la biblioteca SQLite del propio Python, por lo que el formato de archivo
será compatible. El diseño no usará ninguna función de SQLite posterior a 3.35
para mantener compatibilidad con sistemas antiguos; si se necesitara una función
más reciente, se documentaría aquí.

### 6.2 Riesgo de versión de Python: decisión pendiente

En la máquina de desarrollo está instalado **Python 3.14.6**. Tanto PySide6 6.11.2
como PyInstaller 6.22.3 declaran soporte para 3.14, por lo que la combinación
es viable.

**Recomendación:** usar **Python 3.13.x** como versión canónica de compilación del
ejecutable, por ser la combinación con mayor historial de validación en Qt for
Python y PyInstaller, y **3.14.x** para desarrollo diario.

**Impacto si se decide usar 3.14 en todo el ciclo:** ninguno funcional conocido,
pero el ejecutable congelado sobre 3.13 tendrá menos riesgo de regresiones de
empaquetado. **Esta decisión debe cerrarse antes de la etapa de empaquetado.**

### 6.3 Dependencias deliberadamente excluidas

| No se usa | Motivo |
|-----------|--------|
| SQLAlchemy / ORM | A esta escala un ORM añade capas y abstracción sin beneficio. El SQL explícito con parámetros es más auditable para una base de datos institucional. Decisión reversible: los repositorios aíslan el SQL, así que introducir un ORM posterior afectaría solo a esa capa |
| FastAPI / Flask / Django | No hay servidor. La aplicación es de escritorio |
| pandas / numpy | No se requiere cálculo numérico |
| Requests / httpx | Sin red |
| Telemetry, OpenTelemetry, Sentry | Sin telemetría, por requisito |
| Dependencias de Windows (`pywin32`) | Python resuelve `%LOCALAPPDATA%` sin ellas |
| bcrypt / cryptography | Un solo usuario local. El cifrado impediría leer los datos con cualquier herramienta estándar, lo que iría en contra del criterio de portabilidad de datos |

**Consecuencia aceptada:** el archivo `.sqlite` no está protegido contra alguien
con acceso a la cuenta de Windows de Sonia. Para una usuaria única en un equipo
de la facultad esto es razonable. Si más adelante se requiere autenticación o
cifrado, es una decisión de producto que debe tomarse con Sonia.

---

## 7. Decisiones de arquitectura registradas (ADR)

Formato: decisión, motivo, alternativa descartada, revisión prevista.

| ID | Decisión | Motivo | Alternativa descartada | Revisar cuando |
|----|----------|--------|------------------------|----------------|
| ADR-01 | Monolito de escritorio en tres capas | Un solo usuario, sin red; la complejidad se paga sola | Hexagonal completo, microservicios | Aparezca un segundo consumidor de la lógica |
| ADR-02 | `sqlite3` de la biblioteca estándar | Sin dependencias externas, control total del SQL, formato de archivo estándar | SQLAlchemy | Se supere ~50 000 préstamos o se necesiten relaciones complejas |
| ADR-03 | Contadores desnormalizados en `articulo` + libro de movimientos | Consultas del panel instantáneas y simples de verificar | Calcular todo desde el libro en cada consulta | La reconciliación contador↔libro resulte costosa |
| ADR-04 | `fecha_limite` opcional; sin vencimiento automático | No existe fecha límite real en el proceso; no se puede inventar | Marcar «vencido» por días transcurridos | Sonia defina una política de plazos |
| ADR-05 | Registro de solo adición: nada se borra físicamente | Trazabilidad institucional; las correcciones son ajustes | `DELETE`/`UPDATE` sobre históricos | Requisito legal o de auditoría que exija lo contrario |
| ADR-06 | Folio legible con secuencia por año | Orden cronológico y referenciable en la comunicación oral | UUID | Necesidad de referencia por índice global |
| ADR-07 | Instancia única de la aplicación | SQLite admite un solo escritor; evita corrupción por apertura simultánea | Multiusuario | Sonia necesitara acceso desde dos equipos |
| ADR-08 | Tiempos en ISO-8601 UTC, presentación en hora local | Ordena y compara correctamente; evita errores de horario de verano | `datetime.now()` local en la base | Ninguna foreseeable |
| ADR-09 | Modo WAL | Lecturas no bloquean escrituras; mejor resistencia a corte de energía | `DELETE` journal | Incompatibilidad con un destino de datos en red |
| ADR-10 | Migraciones solo hacia adelante con `PRAGMA user_version` | Sencillo, auditable, sin dependencias | Herramienta de migraciones externa | Necesidad de migraciones reversibles o de usuarios en distintas versiones a la vez |
| ADR-11 | Control individual **opcional por artículo** (`articulo.control_individual` + `articulo_unidad`) | Los equipos con número de serie se controlan uno a uno y los artículos a granel por cantidad, en la misma base y sin campos inútiles para ninguno de los dos casos | Obligar a todas las unidades a tener código, o renunciar al control individual | La facultad confirme que ningún equipo lo necesita |
| ADR-12 | `incidente` con `origen` explícito y `prestamo_id` / `estudiante_id` nulos | Un daño o una pérdida en el depósito es un hecho real que ocurre sin ningún préstamo detrás; y la responsabilidad no se atribuye por la existencia de un préstamo, sino porque el registro lo evidencie | Obligar a `prestamo_id` y forzar un responsable, o registrar las pérdidas de stock como simples ajustes de cantidad | La facultad establezca un procedimiento de responsabilidad que exija más campos |
| ADR-13 | Doce tipos de movimiento, cada uno con su cubo de origen declarado | El efecto sobre los contadores es determinista: el servicio no «decide» de dónde resta, y la reconciliación del libro es una igualdad exacta | Dos o cuatro tipos genéricos (`danio`, `perdida`) con el cubo decidido en tiempo de ejecución | Alguna operación necesite un efecto que no encaje en ningún cubo existente |
| ADR-14 | Solo dos vistas de lectura (`v_prestamo_detalle`, `v_prestamo_resumen`) | Una vista por cada consulta duplica el esquema y añade un sitio más donde algo puede quedar desactualizado; a este volumen una consulta en el repositorio es igual de clara | Cinco vistas (`v_inventario`, `v_alertas_prestamos`, `v_alertas_incidentes`, …) | El número de consultas repetidas que justifique una vista |
| ADR-15 | Sin campos de contacto, sin `recibido_por` ni `registrado_por` | Sistema de un solo usuario y sin red: esos campos serían constantes y se pagarían en cada lectura y cada verificación | Mantener columnas que siempre valen lo mismo | Aparezca un segundo usuario, una segunda sede o un envío de correo |

---

## 8. Ubicación de los datos y persistencia

### 8.1 Resolución de rutas (`core/paths.py`)

La base de datos **nunca** se guarda junto al ejecutable. Se resuelve en este orden:

```
1. %STOCKLEND_DATA_DIR%        Variable de entorno (pruebas, portabilidad, uso compartido)
2. %LOCALAPPDATA%\StockLend\   Ubicación estándar de datos de usuario en Windows
```

Rutas resultantes:

| Elemento | Ruta |
|----------|------|
| Base de datos | `%LOCALAPPDATA%\StockLend\stocklend.sqlite` |
| Copias de seguridad | `%LOCALAPPDATA%\StockLend\respaldos\` |
| Registro | `%LOCALAPPDATA%\StockLend\registros\stocklend.log` |
| Preferencias | `%LOCALAPPDATA%\StockLend\config.ini` |
| Exportaciones | Carpeta que elija Sonia en el diálogo de guardado |

`%LOCALAPPDATA%` (y no `%APPDATA%`) porque se trata de datos de la aplicación,
no de configuración del usuario. Se expande a una ruta del perfil de Sonia y,
por tanto, sobrevive a actualizaciones, reinstalaciones y reemplazo del ejecutable.

### 8.2 Conservación de los datos

- **Actualización del programa:** la carpeta de datos no se toca. Solo se ejecuta
  la migración de esquema correspondiente, precedida de una copia de seguridad
  automática.
- **Desinstalación:** la desinstalación de PyInstaller **no** borra
  `%LOCALAPPDATA%\StockLend`. Los datos permanecen y se pueden recuperar.
- **Portabilidad:** la carpeta completa se puede copiar a un USB. El formato
  SQLite es estándar y se puede consultar desde cualquier herramienta.
- **Sin captura de datos:** no hay cifrado propietario, ni licencias, ni
  comprobaciones de conexión, ni límites de uso. El sistema no puede retener,
  bloquear ni destruir los datos institucionales.

### 8.3 Copias de seguridad y restauración (diseño, no implementado)

- **Respaldo manual:** a archivo, con fecha y hora en el nombre.
- **Respaldo automático:** al iniciar la aplicación y antes de cada migración,
  conservando las últimas N copias (N configurable, propuesta: 10).
- **Formato:** copia en caliente mediante la API de copia de SQLite
  (`sqlite3.Connection.backup`). Esto produce un archivo consistente incluso
  con el WAL activo, a diferencia de copiar el archivo con el explorador.
- **Restauración:** desde un `.sqlite` validado; se comprueba integridad con
  `PRAGMA integrity_check` y versión de esquema antes de aceptar el archivo.
- **Verificación:** el registro de la copia —etapa 8— guarda fecha, ruta, tamaño y
  resultado de la verificación, para que Sonia sepa si una copia es utilizable. La
  tabla `respaldo` se crea en esa etapa; hasta entonces, `configuracion` guarda
  `ultimo_respaldo` y `copias_conservadas`.

---

## 9. Registro, errores y trazabilidad

| Elemento | Decisión |
|----------|----------|
| Registro | Archivo en la carpeta de datos, rotación por tamaño (5 MB, 5 archivos) |
| Niveles | `INFO` para operaciones de negocio, `WARNING` para incidentes y ajustes, `ERROR` para fallos |
| Datos sensibles | No se registran datos personales completos de estudiantes más allá de lo necesario para diagnosticar |
| Errores en la interfaz | Mensaje en español + detalle técnico solo en el registro |
| Trazabilidad de inventario | `movimiento_inventario`: un movimiento por unidad que entra o sale de un cubo, inmutable (RN-46, RN-47) |
| Trazabilidad de incidentes | `incidente`: cada pérdida o daño con su origen, su descripción y su resolución, inmutable |
| Auditoría de datos maestros | **Diferida a la etapa 2.** El movimiento ya da la trazabilidad del inventario, que es donde importa. Si más adelante se necesita saber quién cambió el nombre de un artículo, se añade la tabla `auditoria` sin tocar el resto del diseño |

---

## 10. Pruebas

| Tipo | Alcance | Herramienta |
|------|---------|-------------|
| Unitarias | `domain/`: value objects, enums, validaciones | pytest |
| Unitarias | `services/`: las 61 reglas de negocio, una prueba por regla | pytest |
| Integración | `data/repositories/`: CRUD, filtros, joins, agregados del panel | pytest sobre SQLite temporal |
| Integración | Los `CHECK` y claves foráneas del esquema: cada restricción tiene una prueba que demuestra que rechaza lo que debe | pytest sobre SQLite temporal |
| Integración | Transacciones: rollback ante fallo intermedio | pytest |
| Arquitectura | Imports prohibidos (CA-1, CA-2) | pytest |
| Interfaz | Smoke tests de navegación y validación de formularios | pytest-qt |
| Consistencia | Reconciliación de los contadores de `articulo` contra `movimiento_inventario` | pytest |
| Consistencia | Reconciliación de los contadores contra el detalle de `articulo_unidad` | pytest |

Las pruebas de interfaz se limitan a la lógica de presentación. **Las reglas de
negocio no se prueban pulsando botones**, para que la suite siga siendo rápida
y estable. Las pruebas usan siempre una base de datos temporal; nunca la real.

Cada regla de negocio de `REQUIREMENTS.md` tendrá al menos una prueba que la
cubra, identificada por su código (por ejemplo, `test_rn_03_no_prestar_mas_que_disponible`).

**Las reconciliaciones no se prueban por separado: se ejecutan al final de cada
prueba.** Un test de inventario, de préstamo, de devolución o de incidente termina
con la comprobación de que las consultas de `DATABASE_DESIGN.md` 8.6 y 8.7 devuelven
cero filas. Es la defensa contra el error más caro del sistema: un contador que
deje de cuadrar sin que nadie lo note.

---

## 11. Rendimiento esperado

Volumen de referencia: ~200 artículos, ~200 estudiantes, ~2 000 préstamos al año,
~5 000 filas de `movimiento_inventario` al año. Órdenes de magnitud muy por debajo
de los límites de SQLite; los índices definidos en el modelo de datos son
suficientes. No se prevé necesidad de particionado, de una capa de caché en
memoria ni de consultas asíncronas.

Revisión de rendimiento prevista solo si el historial crece más de 10 veces lo
estimado, en cuyo caso se evaluaría un archivado anual de movimientos antiguos.

---

## 12. Contexto que se revisará más adelante

- Definición exacta de la ubicación de datos en el equipo de la facultad.
- Política de plazo (ADR-04) y si los préstamos vencen por curso.
- Necesidad de múltiples categorías jerárquicas (categoría → subcategoría).
- Exportación de inventario a formatos que la facultad ya consume.
- Firma digital o acuse de recibo del estudiante (impresión de un vale).
