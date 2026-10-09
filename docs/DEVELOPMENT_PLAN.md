# StockLend — Plan de Desarrollo

> **Estado del documento:** plan propuesto para la etapa de planificación.
> **Nada de lo descrito aquí está implementado.** No hay pantallas, no hay base de
> datos funcional, no hay módulos de inventario ni de préstamos, no hay pruebas
> ejecutadas y no hay ejecutable generado.

---

## 1. Principio de trabajo

El plan se organiza en etapas cortas. Cada una termina con algo verificable y
con una revisión de Sonia, no solo con código escrito. Ninguna etapa avanza si la
anterior no se puede demostrar funcionando.

| Regla | Detalle |
|-------|---------|
| Una etapa, una verificación | Cada etapa define cómo se comprueba que funciona |
| Primero la regla, luego la pantalla | La lógica de negocio se implementa y se prueba antes de existir en la interfaz |
| Nada de pantallas sin lógica | Ninguna vista se escribe antes que su servicio y sus pruebas |
| Nada de lógica sin prueba | Toda regla `RN-xx` tiene al menos un test antes de la interfaz que la usa |
| Progreso visible | Al final de cada etapa Sonia ve funcionando algo que puede usar |
| Nada se borra | No se elimina historial; las correcciones son ajustes (RN-46) |

**Ninguna etapa se considera terminada por «no dar error»**. Se termina cuando
su criterio de verificación se cumple de forma explícita.

---

## 2. Resumen de etapas

| # | Etapa | Resultado verificable | Depende de |
|---|-------|----------------------|------------|
| 0 | Planificación | Documentación técnica aprobada | — |
| 1 | Cimientos del proyecto | Estructura, configuración, base de datos creada y migrada | 0 |
| 2 | Dominio y acceso a datos | Repositorios operativos con pruebas de integración | 1 |
| 3 | Inventario y estudiantes | RN-01 a RN-15, RN-50 a RN-53 y RN-58 a RN-61 probadas | 2 |
| 4 | Préstamos, devoluciones e incidentes | RN-16 a RN-49 y RN-54 a RN-57 probadas | 3 |
| 5 | Armazón de la interfaz | Navegación y tema funcionando con datos reales | 4 |
| 6 | Pantallas de operación | Sonia registra un préstamo y una devolución completos | 5 |
| 7 | Panel y reportes | Cifras reales y exportaciones | 6 |
| 8 | Respaldo y recuperación | Copia y restauración probadas | 6 |
| 9 | Empaquetado y entrega | Ejecutable en el equipo de Sonia | 7, 8 |
| 10 | Estabilización | Uso real durante un ciclo de prácticas | 9 |

Estimación de esfuerzo: **no se incluye en este documento.** El ritmo depende de
cuánto trabajo puede hacerse por semana y conviene acordarlo explícitamente,
porque las etapas 6 y 10 requieren tiempo de Sonia, no solo de desarrollo.

---

## 3. Detalle de cada etapa

### Etapa 0 — Planificación (esta etapa)

**Trabajo:** analizar requisitos, definir arquitectura, modelo de datos,
reglas de negocio, riesgos y estructura de carpetas. Y, en la segunda parte,
diseñar la interfaz y la experiencia de usuario.

**Entregables:** los cuatro documentos de `docs/` y el `README.md`. Después, los
cuatro documentos de diseño de interfaz: `UI_DESIGN.md`, `UI_SCREENS.md`,
`UI_COMPONENTS.md` y `UI_FLOWS.md`.

**Verificación:** Sonia revisa la documentación y responde las preguntas abiertas de
la sección 8 de `REQUIREMENTS.md`. **Ninguna bloquea el modelo de datos:** el diseño
admite a la vez el artículo con control individual y el que no lo tiene, y el
incidente con préstamo y el que ocurre solo en el depósito. Lo que falta es decidir
con qué datos se llenará la base.

Las preguntas abiertas del diseño de interfaz están en la sección 12 de
`UI_FLOWS.md` y las contradicciones detectadas en la sección 10 de `UI_DESIGN.md`.
Ninguna bloquea la implementación: los cuatro documentos de interfaz se han escrito
de forma que se puedan maquetar tal cual, y las decisiones pendientes solo afectan a
casos concretos señalados uno por uno.

**Estado:** completada como propuesta, pendiente de aprobación. El repositorio git
está inicializado con su primer commit ya publicado en `origin/main`. El modelo de
datos está verificado ejecutando su DDL **y sus consultas de referencia** sobre una
base en memoria: 11 tablas, 2 vistas, 13 índices, `PRAGMA foreign_key_check` sin
violaciones y los `CHECK` de integridad rechazan lo que deben. La documentación
consolidada corresponde a la revisión 4 de `DATABASE_DESIGN.md` (incluye los dos
`CHECK` de coherencia aprobados para la Etapa 1). El diseño de
interfaz está escrito como propuesta, **sin ninguna pantalla implementada ni
maquetada**.

---

### Etapa 1 — Cimientos del proyecto

**Trabajo:**
- `pyproject.toml` con dependencias fijadas y configuración de pytest y ruff.
- Entorno virtual de desarrollo (`.venv`).
- `stocklend/core/paths.py` con la resolución de rutas de datos.
- `stocklend/core/logging_setup.py` y `config.py`.
- `stocklend/data/database.py`: conexión, PRAGMA y `transaction()`.
- `stocklend/data/migrations/0001_inicial.sql` con el DDL de la sección 6 de
  `DATABASE_DESIGN.md`, que ya está escrito y probado.
- Ejecutor de migraciones basado en `PRAGMA user_version`.
- `stocklend/data/__init__.py` y el resto de `__init__.py`.
- `tests/conftest.py` con la fixture de base de datos temporal.

**Verificación:**
- `pytest` ejecuta la prueba de creación de la base y todas pasan.
- `PRAGMA user_version` vale 1 tras la primera ejecución y 1 al reabrir.
- `PRAGMA foreign_keys` vale 1 en la conexión de la aplicación.
- Al abrir y cerrar la aplicación dos veces, la base no se recrea ni se borra.
- Existen las 11 tablas, las 2 vistas y los 13 índices de las secciones 5, 6 y 7 de
  `DATABASE_DESIGN.md`.

**Lo que NO se hace en esta etapa:** pantallas, servicios, préstamos, inventario.

---

### Etapa 2 — Dominio y acceso a datos

**Trabajo:**
- `stocklend/domain/`: entidades, enums, value objects, jerarquía de excepciones.
- `stocklend/data/repositories/`: un repositorio por entidad.
- Mapeo de fila a entidad, con tipos correctos (nunca `str` donde va un `int`).
- Paginación en las consultas de listado.
- Pruebas de integración sobre base temporal real.

**Verificación:**
- Un CRUD completo de `articulo`, `estudiante` y `categoria` funciona desde el repositorio.
- Un `INSERT` con clave foránea inválida falla, lo que demuestra que
  `foreign_keys` está activo.
- Un `CHECK` de cantidad negativa falla.
- Un `LIKE` con comilla simple no rompe la consulta (protección de inyección).
- Un listado de 10 000 registros devuelve una página, no todo.
- Los servicios (aún no escritos) pueden construirse con un repositorio falso.

**Estado:** implementada, pendiente de aprobación. `stocklend/domain/` contiene las
entidades, los enums, los value objects y las excepciones; `stocklend/data/repositories/`
contiene un repositorio por entidad (más `CategoriaRepo`, que la verificación exige)
con SQL parametrizado, paginación e historial. Las seis verificaciones de la etapa se
comprueban en pruebas de integración; `DashboardRepo` y `RespaldoRepo` quedan
diferidos a la etapa 7 y la 8. La suite `pytest` pasa completa y `ruff` no reporta
hallazgos.

**Lo que NO se hace en esta etapa:** servicios de negocio, pantallas, cambios de
esquema.

---

### Etapa 3 — Inventario y estudiantes

**Trabajo:**
- `InventarioService`: alta de artículos y categorías, ajuste con motivo,
  historial de movimientos, búsqueda.
- `EstudianteService`: alta, edición, búsqueda, historial, inactivación.
- `UnidadService`: alta de artículos con control individual, alta de unidades con
  su código y su estado, y paso de unidades por los 12 tipos de movimiento.
- Pruebas de las reglas RN-01 a RN-15, RN-50 a RN-53 y RN-58 a RN-61.

**Verificación:**
- Cada una de RN-01 a RN-15, RN-50 a RN-53 y RN-58 a RN-61 tiene su prueba
  identificada por código.
- Intentar un ajuste sin motivo se rechaza.
- Un ajuste que dejaría la disponible negativa se rechaza **y no modifica nada**.
- Registrar un artículo con cantidad 5 genera un movimiento `alta` de 5.
- Un artículo con `control_individual = 0` no tiene filas en `articulo_unidad` y se
  maneja solo con cantidades (RN-50).
- Un artículo con `control_individual = 1` y 5 unidades muestra 5 en total, y cada
  cambio de estado de una unidad actualiza los contadores en la misma transacción
  (RN-53, RN-61).
- Un estudiante con préstamos no se puede eliminar, solo desactivar.
- El contador de `articulo` coincide con la suma de movimientos tras una
  secuencia aleatoria de 50 operaciones (prueba de reconciliación, RN-49).
- Un daño en el depósito descuenta de `disponible` y uno en un préstamo descuenta de
  `prestada`; nunca al revés (RN-58, RN-59).
- Registrar una pérdida no reduce la cantidad total (RN-60).
- Prueba de rollback: una operación que falla a mitad no deja cambios parciales.

**Nota:** ya no hace falta ninguna decisión previa de Sonia para empezar esta etapa.
El control individual está modelado como opción por artículo (D-02); si al final
resulta que ningún equipo lo necesita, la tabla simplemente queda vacía.

**Estado:** implementada. `stocklend/services/` contiene `_comun.py` (cálculo puro
de contadores, validación de motivo y registro del movimiento en el orden de
`DATABASE_DESIGN` §9.3), `inventario_service.py`, `unidad_service.py` y
`estudiante_service.py`. Cada método público abre una sola transacción
`BEGIN IMMEDIATE`. Para RN-13 se registra la función SQL determinista
`sin_acentos` en `data/database.py`, de modo que la búsqueda de estudiantes ignora
acentos y mayúsculas sin cambiar el esquema. Las transiciones de unidad de esta
etapa cubren los estados de stock (`disponible`, `danada`, `faltante`, `baja`); las
que pasan por `prestada` corresponden a la Etapa 4. Las doce verificaciones de la
etapa se comprueban en pruebas unitarias y de integración, incluida la
reconciliación de contadores (§8.6) y de unidades (§8.7). La suite pasa completa y
`ruff` no reporta hallazgos.

---

### Etapa 4 — Préstamos, devoluciones e incidentes

**Trabajo:**
- `PrestamoService`: alta multi-artículo con validación de disponibilidad,
  generación de folio, anulación.
- `DevolucionService`: devoluciones totales y parciales, validación de cantidades,
  cierre automático del préstamo.
- `IncidenteService`: registro de pérdidas y daños con su origen (`stock`,
  `prestamo`, `devolucion`), resolución, y elección explícita de responsable.
- Pruebas de las reglas RN-16 a RN-49 y RN-54 a RN-57.

**Verificación:**
- Cada regla RN-16 a RN-49 y RN-54 a RN-57 tiene su prueba por código.
- Prestar más de lo disponible se rechaza con un mensaje que indique el
  máximo disponible (RF-INV-07, RN-03).
- Un estudiante puede tener dos préstamos activos simultáneos (RN-16).
- Un préstamo con tres renglones descuenta correctamente los tres del inventario.
- Una devolución parcial deja el préstamo activo (RN-36).
- Una devolución total cierra el préstamo (RN-35).
- Devolver más de lo pendiente se rechaza (RN-28, RF-DEV-08).
- Un artículo dañado no aumenta la disponible (RN-31, RN-34).
- Una pérdida sin incidente se rechaza (RN-33).
- Un artículo pendiente no aparece como faltante (RN-39).
- Se puede registrar un daño o una pérdida en el depósito **sin** préstamo y **sin**
  estudiante, y el sistema no atribuye la responsabilidad a nadie (RN-54, RN-55).
- Un incidente de devolución queda ligado a su devolución; uno de stock no puede
  llevar `devolucion_id` (RN-54).
- Pruebas de reversión: si falla el segundo renglón de un préstamo de tres,
  el primero tampoco queda registrado.
- La reconciliación de contadores sigue dando cero filas al terminar cada prueba.

---

### Etapa 5 — Armazón de la interfaz

**Trabajo:**
- `main_window.py` con menú lateral y `QStackedWidget`.
- `theme.py` con la paleta azul y la hoja de estilos QSS.
- `container.py` que conecta base de datos, repositorios y servicios.
- Páginas vacías pero navegables, con la tabla ya conectada a datos reales.
- Traducción de excepciones a mensajes en español (`ui/errors.py`).
- Pruebas de humo con pytest-qt.

**Verificación:**
- La aplicación arranca y las secciones son navegables.
- Cada página muestra un estado vacío correcto («No hay artículos registrados»),
  nunca datos de ejemplo (RF-DAS-06).
- El menú lateral no deja la aplicación en un estado inconsistente al navegar rápido.
- Un error de negocio lanzado desde un servicio aparece como mensaje en español
  comprensible, sin nombres de tablas ni de clases SQL.
- `tests/test_architecture.py` confirma que `ui/` no importa `sqlite3` y que
  `services/` no importa `PySide6` (RNF-15, RNF-16).

---

### Etapa 6 — Pantallas de operación

**Trabajo:**
- Pantalla de inventario con buscador y formulario de alta/edición.
- Pantalla de ajuste de existencias con motivo obligatorio.
- Pantalla de estudiantes con buscador y ficha de historial.
- Pantalla de préstamo: selección de estudiante, selección múltiple de artículos,
  cantidades, confirmación previa con el resumen.
- Pantalla de devolución: estudiante → préstamos activos → formulario por artículo
  con devuelta, dañada y perdida.
- Pantalla de incidentes con resolución, separando los del depósito de los que
  viene de un préstamo o una devolución, y con la responsabilidad «sin determinar»
  como valor por defecto.
- Confirmaciones en todas las acciones que afectan cantidades o historial (RNF-02).

**Verificación (la más importante del proyecto):**
- Sonia registra un préstamo completo desde la interfaz, sin ayuda externa.
- Sonia registra una devolución parcial y ve las cantidades actualizarse.
- Sonia registra una devolución con daño y ve el incidente creado.
- Sonia registra un daño en el depósito desde la pantalla de incidentes, sin
  tener que elegir un estudiante (RN-54, RN-55).
- Para un artículo con control individual, Sonia elige la unidad por su código al
  prestar y al devolver, y ve el estado de cada unidad (RF-INV-08, RN-53).
- Un estudiante sin préstamos activos no muestra la opción de devolver.
- Una cantidad mayor que la pendiente se rechaza en la propia interfaz, con el
  máximo permitido visible (RN-28).
- Un mensaje de «cantidad insuficiente» indica el número exacto disponible.
- La búsqueda responde mientras se escribe (RF-INV-04).

---

### Etapa 7 — Panel y reportes

**Trabajo:**
- `DashboardService` con las cinco estadísticas reales (RF-DAS-01 a RF-DAS-05).
- Pantalla de panel con tarjetas y alertas separadas (RF-ALA-02).
- `ReporteService`: historial con filtros combinables por estudiante, fecha,
  estado y categoría (RF-REP-01 a RF-REP-03).
- Exportación a CSV (RF-REP-05).
- Arquitectura de reportes preparada para PDF (RF-REP-04), sin generar PDF todavía
  si no se confirma la librería.

**Verificación:**
- Los números del panel coinciden con un conteo manual sobre la misma base.
- Con la base vacía, el panel muestra ceros (RF-DAS-06).
- Los préstamos pendientes y los incidentes abiertos aparecen en secciones
  separadas, nunca mezclados (RF-ALA-02).
- No aparece la etiqueta «vencido» en ningún préstamo sin `fecha_limite` (RF-ALA-03).
- Los filtros de fecha incluyen el día final completo.
- El CSV se abre correctamente en Excel con acentos correctos.

---

### Etapa 8 — Respaldo y recuperación

**Trabajo:**
- `RespaldoService`: copia en caliente con `sqlite3.Connection.backup`.
- Respaldo manual y automático, con las últimas N copias (N configurable, 10).
- Respaldo automático antes de cada migración.
- Restauración desde un archivo validado.
- Pantalla de respaldo con listado, verificación y apertura de la carpeta de datos.

**Verificación:**
- Se genera una copia y se abre correctamente con una herramienta externa.
- `PRAGMA integrity_check` devuelve `ok` en la copia.
- Se restaura la copia y todos los datos vuelven correctamente.
- Se restaura un archivo corrupto: la aplicación lo rechaza con un mensaje claro
  y **no** sobrescribe la base original.
- Desinstalar y reinstalar el programa deja la base intacta (RNF-12).
- El registro de la copia indica si es utilizable.

---

### Etapa 9 — Empaquetado y entrega

**Trabajo:**
- `tools/build_windows.py` y `tools/stocklend.spec` con PyInstaller.
- `pyproject.toml` actualizado con la versión de la aplicación y el icono.
- Prueba del ejecutable en un equipo limpio.
- Manual de uso breve en español.

**Verificación:**
- El ejecutable arranca en un equipo sin Python instalado (RNF-10).
- Arranca en menos de 3 segundos (RNF-04).
- La base de datos se crea en `%LOCALAPPDATA%\StockLend`, no junto al
  ejecutable (RNF-11).
- Funciona con el equipo sin conexión a internet (RNF-09).
- No hay errores en el archivo de registro durante una sesión completa.
- Sustituir el ejecutable por una versión nueva conserva los datos.

---

### Etapa 10 — Estabilización

**Trabajo:** uso real durante al menos un ciclo de prácticas completas.

**Verificación:**
- Ninguna incidencia de inventario incorrecto reportada.
- Los tiempos de respuesta cumplen RNF-04 a RNF-06 en el equipo real.
- Las peticiones de cambio se priorizan y se implementan.
- Copia de seguridad restaurada con éxito desde la semana anterior.

---

## 4. Riesgos técnicos

| # | Riesgo | Impacto | Probabilidad | Mitigación |
|---|--------|---------|--------------|------------|
| R-01 | Pérdida total de datos por un fallo del disco o un borrado accidental | Muy alto | Baja | Respaldo automático, copia previa a migraciones, datos fuera del ejecutable, verificación de integridad |
| R-02 | Los contadores de `articulo` divergen del libro de movimientos | Alto | Media | Pruebas de reconciliación en cada integración; el libro es la fuente de verdad; comando de verificación manual disponible |
| R-03 | Un fallo a mitad de una devolución deja inventario inconsistente | Alto | Media | Transacciones con `BEGIN IMMEDIATE`, orden de escritura fijo, prueba de reversión |
| R-04 | PyInstaller no empaqueta bien PySide6 en la versión de Python elegida | Medio | Media | Validar la combinación en la etapa 1, no en la 9; si falla, probar 3.13 |
| R-05 | Interfaz lenta con el historial acumulado | Medio | Baja | Índices definidos, paginación, `QAbstractTableModel`; revisar si supera 10 000 préstamos |
| R-06 | Abrir dos instancias corrompe la base | Alto | Baja | Detección de instancia única; `busy_timeout`; WAL |
| R-07 | La búsqueda se ralentiza con muchos artículos | Bajo | Baja | Revisar a 2 000 artículos; FTS5 está disponible como salida |
| R-08 | Un cambio de esquema futuro deja la base de Sonia inutilizable | Alto | Media | Migraciones solo hacia adelante, probadas, precedidas de copia; nunca editar el esquema a mano |
| R-09 | Cambios de zona horaria o de horario de verano desordenan las fechas | Medio | Media | Almacenar UTC, presentar en hora local (ADR-08) |
| R-10 | Un cambio de hardware obliga a reinstalar y se pierden los datos | Alto | Baja | Los datos están en el perfil de usuario, no en el programa; el ejecutable es desechable |
| R-11 | La interfaz se complica y Sonia la evita | Alto | Media | Probar con Sonia en cada etapa 5 a 7; simplicidad por encima de funcionalidad |
| R-12 | Requisitos que cambian a mitad del desarrollo | Medio | Media | Reglas y requisitos con código estable; cada cambio se incorpora en la etapa correspondiente |
| R-13 | Un daño o una pérdida en la facultad no tiene forma de registrarse porque no hay préstamo | Bajo | Baja | **Cubierto en el diseño:** `incidente` acepta `origen = 'stock'` sin `prestamo_id` ni estudiante (RN-54) |
| R-14 | Una migración defectuosa daña la base de producción | Muy alto | Baja | Copia previa obligatoria, migración probada desde la versión anterior, verificación posterior |
| R-15 | El proyecto queda sin control de versiones | Medio | Baja | **Ya mitigado:** repositorio inicializado en la etapa 0 con `.gitignore` y primer commit publicado en `origin/main` |

---

## 5. Decisiones pendientes

Ninguna de estas decisiones está tomada. Las dos que bloqueaban el modelo de datos
ya están resueltas por diseño (ver tabla siguiente); el resto no impide empezar a
programar.

| # | Decisión | Opciones | Recomendación | Bloqueante |
|---|----------|----------|---------------|-----------|
| D-01 | Versión de Python para el ejecutable | 3.13.x o 3.14.x | 3.13.x para compilar; 3.14.x para desarrollo | No |
| D-02 | ¿Se controlan equipos por número de serie? | Sí, con tabla `articulo_unidad` / No, solo cantidades | **Resuelta:** ambos casos caben. `articulo.control_individual` decide por artículo; si ningún equipo lo necesita, la tabla queda vacía | No |
| D-03 | ¿Puede haber faltante sin préstamo previo? | Sí, con `prestamo_id` nulo / No, solo ajuste con motivo | **Resuelta:** `incidente.origen = 'stock'` lo permite, con la responsabilidad en `sin_determinar` hasta que se demuestre lo contrario | No |
| D-04 | ¿Existe `fecha_limite` real? | Sí, con vencimiento / No, la columna queda siempre nula | No marcar vencidos hasta que Sonia lo pida (ADR-04) | No |
| D-05 | Librería de PDF | ReportLab / motor de impresión de Qt / ninguno en la v1 | Ninguna en la v1; preparar la arquitectura | No |
| D-06 | ¿Hacer una vista de conteo físico? | Sí, pantalla de conteo / No, con el ajuste manual actual | Sí, si la facultad hace inventario periódico | No |
| D-07 | ¿Vale de entrega impreso con firma? | Sí, con vista de impresión / No | Preguntar a Sonia | No |
| D-08 | ¿Se subcategorizan los artículos? | Sí, categoría padre / No, una sola categoría | No en la v1 | No |
| D-09 | ¿Nombre de la persona usuaria en los registros? | Fijo «Sonia» / Configurable / Ausente | **Resuelta:** ausente. En un solo usuario `recibido_por` y `registrado_por` serían constantes; se pueden recuperar si algún día hay más de una usuaria | No |
| D-10 | Exportación a más formatos | CSV, PDF, Excel | CSV y PDF | No |
| D-11 | ¿Más de un equipo con los mismos datos? | Instancia única / carpeta compartida | Instancia única (ADR-07) | No |
| D-12 | ¿Retención indefinida del historial? | Sí / No, con depuración | Sí; sin límite en la v1 | No |
| D-13 | Cantidad de copias de seguridad conservadas | 5, 10, 20 | 10, configurable | No |
| D-14 | ¿Reparaciones registradas como movimientos propios? | Sí, con `reingreso_reparacion` / No | Sí, ya está en el modelo | No |
| D-15 | ¿La librería de PDF exige dependencia externa? | Sí / No | Decisión ligada a D-05 | No |

---

## 6. Riesgos de proyecto

| Riesgo | Mitigación |
|--------|------------|
| Los requisitos reales difieren de lo documentado | Preguntas abiertas resueltas en la etapa 0; revisión con Sonia antes de cada etapa |
| El alcance crece sin control | Lo que no está en `REQUIREMENTS.md` no entra; se añade con código y documento |
| La documentación se desactualiza al cambiar el código | Cada cambio de esquema implica cambiar `DATABASE_DESIGN.md` en la misma revisión |
| La etapa 10 se salta por falta de tiempo | Es la etapa que detecta errores de inventario reales; no se puede eliminar, solo acortar |
| Sonia no tiene tiempo para probar | Prueba en bloques cortos de 15 minutos al final de cada etapa, no una revisión larga |

---

## 7. Cómo se verifica cada etapa

| Tipo | Herramienta | Cuándo |
|------|-------------|--------|
| Pruebas automáticas | `pytest` | Antes de cada etapa y en integración continua |
| Lint y formato | `ruff check` y `ruff format` | Antes de cada etapa |
| Reglas de arquitectura | `tests/test_architecture.py` | En cada ejecución de la suite |
| Reconciliación de inventario | `tests/integration/test_reconciliacion.py` | Al terminar cada prueba de inventario, préstamo o devolución |
| Revisión con Sonia | Demo de 15 minutos | Al terminar las etapas 5, 6, 7 y 8 |
| Prueba en el equipo real | Ejecutable con datos de Sonia | Al terminar las etapas 9 y 10 |

---

## 8. Qué hay que revisar antes de empezar a programar

### 8.1 Decisiones que bloquean el inicio

**Ninguna.** El modelo de datos está completo y verificado, y admite los dos casos
que quedaban planteados:

1. **Equipos con número de serie (D-02).** Resuelto con control individual
   opcional por artículo (`articulo.control_individual` + `articulo_unidad`,
   RN-50 a RN-53). No hay que elegir entre «sí» y «no»: cada artículo decide.
2. **Faltante sin préstamo previo (D-03).** Resuelto con incidentes independientes
   (`incidente.origen = 'stock'`, RN-54 a RN-57), que además impiden atribuir la
   responsabilidad a un estudiante por omisión.
3. **Revisión de las 61 reglas de negocio.** En especial RN-02, RN-25, RN-34, RN-39,
   RN-45, RN-55 y RN-61, que reflejan decisiones de criterio.
4. **Revisión del invariante del inventario** (RN-02): la suma de los cuatro
   estados siempre debe igualar el total. Es el compromiso central del sistema.
5. **Confirmación de que no hay fecha límite real** (D-04). Si la hay, hay que
   definarla antes de implementar las alertas.

### 8.2 Decisiones que conviene cerrar pronto, pero no bloquean

- D-01: versión de Python para el ejecutable.
- Qué equipos de la facultad usarán el control individual: afecta a la carga
  inicial, no al esquema.
- D-05: si se quiere PDF en la primera entrega.
- D-06: si habrá inventario físico periódico.
- D-11: si más de un equipo necesitará los datos.

### 8.3 Verificaciones de la documentación

| Documento | Qué hay que comprobar |
|-----------|-----------------------|
| `ARCHITECTURE.md` | ¿La separación en tres capas encaja con la forma de trabajar de Sonia? |
| `DATABASE_DESIGN.md` | ¿Los nombres de las tablas y columnas reflejan el vocabulario real de la facultad? |
| `REQUIREMENTS.md` | ¿Falta algún requisito? ¿Hay alguno que no se vaya a cumplir? |
| `DEVELOPMENT_PLAN.md` | ¿El orden de las etapas es el adecuado? ¿Cuánto tiempo hay por etapa? |
| `UI_DESIGN.md` | ¿El agrupamiento de las secciones del menú es el que espera Sonia? ¿Acepta el tono de advertencia más oscuro que hace falta para cumplir el contraste? |
| `UI_SCREENS.md` | ¿La separación entre el Panel y Reportes es la esperada? ¿Las cinco tarjetas del Panel son las que necesita? |
| `UI_COMPONENTS.md` | ¿Falta algún componente? ¿Alguno sobra? |
| `UI_FLOWS.md` | Las 11 preguntas de la sección 12, sobre todo la 1: ¿una devolución sin daños necesita confirmación? |

### 8.4 Antes de la primera línea de código

- [ ] Aprobar la documentación de `docs/`.
- [x] Resolver las dos decisiones que bloqueaban el modelo (D-02, D-03): hechas
      por diseño, no por respuesta.
- [ ] Confirmar la ubicación de los datos en el equipo de Sonia.
- [x] Inicializar el repositorio git con `.gitignore`.
- [ ] Crear el entorno virtual con las versiones fijadas.
- [ ] Confirmar que Sonia dispone de un hueco semanal para las pruebas.

---

## 9. Lo que este plan NO cubre

- Estimación de fechas o de horas.
- Plan de despliegue en red.
- Estrategia de formación de Sonia más allá de un manual breve.
- Auditoría legal o certificación de la base de datos.
- Migración de los cuadernos y archivos Excel existentes a StockLend.

**Sobre la migración de los datos actuales:** no está planificada. Cargar el
historial en cuadernos y Excel requiere decidir qué se migra, cómo se depuran los
duplicados y cómo se concilian las diferencias con el conteo real. Es un proyecto
adicional, con su propio alcance. Lo razonable es empezar con StockLend vacío y
que el inventario real se registre mediante altas y ajustes documentados, de modo
que el primer conteo quede registrado como el movimiento inicial.
