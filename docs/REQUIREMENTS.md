# StockLend — Requisitos

> **Estado del documento:** propuesta para validación con Sonia antes de programar.
> **Etapa:** planificación. Ningún requisito descrito aquí está implementado ni probado.

---

## 1. Objetivo del sistema

Sustituir los registros en cuadernos, fichas físicas y archivos de Excel que usa
actualmente Sonia para administrar los utensilios de cocina, equipos y máquinas
que los estudiantes emplean en las clases prácticas de industria alimentaria.

El sistema debe permitir registrar el inventario, entregar artículos, registrar
devoluciones parciales y totales y controlar faltantes, conservando un historial
completo y auditable de cada movimiento.

### 1.1 Usuario principal

| Aspecto | Descripción |
|---------|-------------|
| Perfil | Sonia, trabajadora de una facultad |
| Modelo de uso | Una persona, una computadora con Windows, uso local |
| Conocimientos técnicos | No es desarrolladora; usa ofimática y cuadernos |
| Objetivo | Rapidez y confiabilidad de las cifras entre clases |
| Datos sensibles | Datos personales de estudiantes (código, nombres) |

### 1.2 Fuera de alcance en esta versión

- Multiusuario, red, servidor web o acceso desde otros equipos.
- Aplicación móvil.
- Integración con sistemas institucionales externos.
- Cualquier envío de datos a servicios de internet.
- Cifrado o autenticación del usuario.

---

## 2. Requisitos funcionales

Cada requisito tiene un código estable. Los códigos se usan en las pruebas
(`test_rn_XX_...`) y no deben reasignarse una vez aceptada la documentación.

### 2.1 Inventario

| ID | Requisito | Criterio de aceptación |
|----|-----------|------------------------|
| RF-INV-01 | Registrar artículos con nombre, categoría y cantidad | Se puede dar de alta un artículo con nombre obligatorio, categoría obligatoria y cantidad inicial ≥ 0 |
| RF-INV-02 | Registrar y consultar categorías | Existen categorías con nombre único; no se pueden crear duplicados |
| RF-INV-03 | Consultar y modificar existencias | La cantidad disponible nunca es negativa y cada cambio queda registrado |
| RF-INV-04 | Buscar artículos rápidamente | La búsqueda por nombre o código filtra mientras se escribe, sin botón adicional |
| RF-INV-05 | Distinguir disponible, prestado, dañado y faltante | Cada artículo muestra sus cuatro cantidades y su suma coincide con el total |
| RF-INV-06 | Registrar movimientos y ajustes con motivo | Todo cambio de cantidad exige un motivo no vacío y queda en el historial |
| RF-INV-07 | Impedir préstamos superiores a lo disponible | El sistema rechaza la operación con un mensaje claro si no hay existencias suficientes |
| RF-INV-08 | Activar el control individual de un artículo | Es opcional y por artículo: si está activo, el sistema pide un código por unidad; si no, solo se registra la cantidad |
| RF-INV-09 | Marcar un artículo como no disponible para préstamo | Un artículo de reparación o deprecado no puede prestarse, pero sí devolverse |
| RF-INV-10 | Identificar unidades individuales con su propio código | Cada unidad tiene un código único; el artículo con control individual muestra sus unidades con su estado y sus contadores coinciden con el número de unidades en cada estado |
| RF-INV-11 | Registrar una pérdida o un daño en la facultad sin préstamo | Un artículo que se rompe o desaparece en el depósito se puede registrar sin haber salido nunca en préstamo, sin Señalar a ningún estudiante |

> **RF-INV-08, RF-INV-10 y RF-INV-11 no bloquean el desarrollo.** El modelo ya
> admite ambas formas de control en la misma base (revisión 2 de
> `DATABASE_DESIGN.md`): `articulo_unidad` solo se usa con `control_individual = 1`,
> y `incidente` admite `origen = 'stock'` sin préstamo. Lo único pendiente de Sonia es
> **qué equipos concretos** de la facultad usarán el control individual, y eso solo
> afecta a la carga inicial de datos, no al esquema.

### 2.2 Estudiantes

| ID | Requisito | Criterio de aceptación |
|----|-----------|------------------------|
| RF-EST-01 | Registrar código, nombres y apellidos | El código universitario es obligatorio y único |
| RF-EST-02 | Identificación única por código | No se pueden crear dos estudiantes con el mismo código |
| RF-EST-03 | Buscar por nombres y apellidos | La búsqueda es parcial e insensible a mayúsculas |
| RF-EST-04 | Consultar el historial de préstamos | Se ven los préstamos del estudiante con estado y fechas |
| RF-EST-05 | Editar datos del estudiante | Se puede corregir un nombre mal registrado sin perder el historial |
| RF-EST-06 | No eliminar estudiantes con historial | Un estudiante con préstamos solo se puede marcar como inactivo, nunca borrar |

### 2.3 Préstamos

| ID | Requisito | Criterio de aceptación |
|----|-----------|------------------------|
| RF-PRE-01 | Registrar al estudiante responsable | El préstamo siempre tiene un estudiante asociado |
| RF-PRE-02 | Registrar fecha y hora de entrega | Se guarda con hora y minuto; por defecto el momento del registro |
| RF-PRE-03 | Asociar varios artículos y cantidades a un mismo préstamo | Un préstamo puede contener N artículos con cantidades distintas |
| RF-PRE-04 | Varios préstamos activos por estudiante | No hay límite de cantidad; solo la disponibilidad limita la operación |
| RF-PRE-05 | Actualizar la disponibilidad del inventario | Al registrar el préstamo, la cantidad disponible disminuye en la misma transacción |
| RF-PRE-06 | Identificador único por préstamo | Folio visible y no reutilizable, por ejemplo `PRE-2026-000001` |
| RF-PRE-07 | Anular un préstamo erróneo | Solo si no tiene devoluciones; deja rastro del movimiento revertido |
| RF-PRE-08 | Consultar préstamos activos | Filtro por estado y por estudiante |
| RF-PRE-09 | Registrar un comentario en el préstamo | Texto libre opcional para contexto (clase, práctica, etc.) |

### 2.4 Devoluciones

| ID | Requisito | Criterio de aceptación |
|----|-----------|------------------------|
| RF-DEV-01 | Buscar al estudiante y ver sus préstamos activos | Flujo: buscar estudiante → seleccionar préstamo activo |
| RF-DEV-02 | Registrar devoluciones completas o parciales | Ambas en la misma pantalla, sin formularios distintos |
| RF-DEV-03 | Verificar cantidades y condiciones | Por cada artículo: cantidad devuelta, dañada o perdida |
| RF-DEV-04 | Mostrar los artículos pendientes | El pendiente se calcula, no se escribe a mano |
| RF-DEV-05 | Registrar incidentes de pérdidas y daños | Cada incidente queda asociado a un artículo y a su origen (depósito, préstamo o devolución). El estudiante solo se asocia cuando la responsabilidad está determinada; por defecto queda como «sin determinar» |
| RF-DEV-06 | Conservar el historial de cada devolución | Cada devolución es un registro fechado e inmutable |
| RF-DEV-07 | Cerrar automáticamente un préstamo completo | Cuando todo lo prestado ha sido devuelto, dañado o perdido |
| RF-DEV-08 | No devolver más de lo pendiente | El sistema rechaza con un mensaje que indica el máximo permitido |
| RF-DEV-09 | Registrar incidentes sin relacionarlos con un estudiante | Un daño o una pérdida en la facultad se registra sin estudiante asociado, y el sistema no atribuye la responsabilidad a nadie por omisión |
| RF-DEV-10 | Indicar la unidad concreta cuando el artículo tiene control individual | El incidente puede apuntar a una unidad con su código, en lugar de a una cantidad |
| RF-DEV-11 | Impedir que un artículo pendiente cuente como faltante | Mientras no se registre un incidente, lo pendiente se muestra como pendiente de devolución, nunca como pérdida |

### 2.5 Dashboard

| ID | Requisito | Criterio de aceptación |
|----|-----------|------------------------|
| RF-DAS-01 | Artículos registrados | Número total de artículos activos |
| RF-DAS-02 | Artículos disponibles | Suma de cantidades disponibles de todos los artículos |
| RF-DAS-03 | Préstamos activos | Número de préstamos con estado activo |
| RF-DAS-04 | Artículos pendientes de devolución | Suma de las cantidades pendientes de todos los préstamos |
| RF-DAS-05 | Incidentes registrados | Número de incidentes, con desglose de abiertos y resueltos |
| RF-DAS-06 | Solo datos reales | Con una base vacía, el dashboard muestra ceros. Nunca hay datos de ejemplo |

### 2.6 Reportes e historial

| ID | Requisito | Criterio de aceptación |
|----|-----------|------------------------|
| RF-REP-01 | Consultar historial de préstamos y devoluciones | Listado con columnas de estudiante, folio, fecha y estado |
| RF-REP-02 | Filtrar por estudiante y por fecha | Filtros combinables; rango de fechas inclusivo |
| RF-REP-03 | Mostrar el estado de los préstamos | Etiqueta clara y con color: activo, cerrado, anulado |
| RF-REP-04 | Exportar a PDF | La arquitectura lo permite; su implementación está prevista en una etapa posterior |
| RF-REP-05 | Exportar a CSV | Formato de texto plano, compatible con Excel, para uso administrativo |
| RF-REP-06 | Filtros por estado y categoría | Complementan los filtros por estudiante y fecha |

### 2.7 Alertas

| ID | Requisito | Criterio de aceptación |
|----|-----------|------------------------|
| RF-ALA-01 | Mostrar préstamos pendientes de devolución | Lista de préstamos activos con su pendiente |
| RF-ALA-02 | Diferenciar préstamos activos de incidentes sin resolver | Secciones separadas, nunca mezcladas |
| RF-ALA-03 | Sin vencimiento automático | No se marca «vencido» ningún préstamo mientras no exista `fecha_limite` registrada |
| RF-ALA-04 | Badge de incidentes abiertos | Contador visible en la navegación |

---

## 3. Requisitos no funcionales

| ID | Categoría | Requisito | Cómo se verifica |
|----|-----------|-----------|------------------|
| RNF-01 | Uso | Interfaz íntegramente en español, incluidos mensajes de error | Revisión de la interfaz |
| RNF-02 | Uso | Confirmación antes de toda acción que afecte cantidades o histórico | Revisión de la interfaz |
| RNF-03 | Uso | Una operación común (registrar una devolución) en pocos pasos | Prueba manual con Sonia |
| RNF-04 | Rendimiento | Arranque inferior a 3 segundos en un equipo de 2018 o posterior | Medición en el equipo real |
| RNF-05 | Rendimiento | Búsqueda de artículos con respuesta inferior a 300 ms con 500 artículos | Medición |
| RNF-06 | Rendimiento | Dashboard correcto en menos de 1 segundo | Medición |
| RNF-07 | Robustez | Las operaciones multi-tabla son atómicas: o se aplican todas o ninguna | Prueba de rollback |
| RNF-08 | Robustez | La aplicación no se cierra por un dato inesperado | Prueba de excepciones no capturadas |
| RNF-09 | Portabilidad | Funciona sin conexión a internet | Prueba en equipo sin red |
| RNF-10 | Portabilidad | Un ejecutable en Windows, sin instalación de Python | Prueba en equipo limpio |
| RNF-11 | Datos | La base de datos se ubica fuera de la carpeta del ejecutable | Inspección de rutas |
| RNF-12 | Datos | Los datos sobreviven a actualización y desinstalación | Prueba de actualización |
| RNF-13 | Datos | Copia de seguridad y restauración disponibles | Prueba de restauración |
| RNF-14 | Datos | Sin cifrado propietario, sin telemetría, sin envío a terceros | Revisión de las dependencias declaradas y de la ausencia de conexiones de red |
| RNF-15 | Mantenibilidad | Ningún módulo de `ui/` importa `sqlite3` | `tests/test_architecture.py` |
| RNF-16 | Mantenibilidad | Ningún módulo de `services/` importa `PySide6` | `tests/test_architecture.py` |
| RNF-17 | Mantenibilidad | Todas las reglas de negocio tienen prueba automatizada | Cobertura de `RF/RNF` |
| RNF-18 | Compatibilidad | Funciona en Windows 10 y Windows 11 de 64 bits | Prueba en ambos |
| RNF-19 | Accesibilidad | Contraste mínimo 4.5:1, foco visible, uso por teclado | Revisión visual |
| RNF-20 | Privacidad | Los datos de estudiantes no salen del equipo | Sin dependencias de red |

---

## 4. Reglas de negocio

Cada regla tiene un código, una descripción y el requisito del que se deriva.
**Todas se implementarán en la capa `services/` y todas tendrán prueba.**

**Son 61 reglas: `RN-01` a `RN-61`, sin huecos ni duplicados.** Las reglas
`RN-01` a `RN-49` son la base original; las reglas `RN-50` a `RN-61` se añadieron
con la revisión del modelo de datos y cubren tres cosas: identificación individual
de unidades, incidentes que no dependen de un préstamo e integridad de los
contadores de inventario.

### 4.1 Inventario

| ID | Regla | Deriva de |
|----|-------|-----------|
| RN-01 | La cantidad disponible nunca puede ser negativa. Cualquier operación que la vuelva negativa se rechaza y se revierte por completo | RF-INV-03, RF-INV-07 |
| RN-02 | Para todo artículo se cumple siempre: `total = disponible + prestado + dañado + faltante` | RF-INV-05 |
| RN-03 | No se puede prestar más de la cantidad disponible de un artículo en una misma operación | RF-INV-07 |
| RN-04 | En un préstamo, cada artículo figura en una sola línea con las cantidades acumuladas; la disponibilidad se valida contra esa suma, no línea por línea (ver RN-18) | RF-PRE-03 |
| RN-05 | Todo cambio de cantidad se registra como movimiento con motivo no vacío, fecha y resultado | RF-INV-06 |
| RN-06 | Un ajuste negativo solo puede descontar de la cantidad disponible; si no hay disponible suficiente, se rechaza | RF-INV-06 |
| RN-07 | Un artículo con cantidad total igual a cero no puede prestarse | RN-01 |
| RN-08 | Un artículo marcado como no disponible para préstamo no puede prestarse, aunque tenga existencias | RF-INV-09 |
| RN-09 | El nombre de un artículo es obligatorio, no vacío y único junto con su categoría | RF-INV-01 |
| RN-10 | El nombre de una categoría es obligatorio y único, ignorando mayúsculas y espacios | RF-INV-02 |

### 4.2 Estudiantes

| ID | Regla | Deriva de |
|----|-------|-----------|
| RN-11 | El código universitario es obligatorio, único y no vacío | RF-EST-01, RF-EST-02 |
| RN-12 | Nombres y apellidos son obligatorios y no pueden quedar solo espacios | RF-EST-01 |
| RN-13 | La búsqueda ignora mayúsculas, acentos finales y espacios sobrantes | RF-EST-03 |
| RN-14 | Un estudiante con al menos un préstamo no se elimina; solo se marca inactivo | RF-EST-06 |
| RN-15 | Editar los datos de un estudiante no altera su historial | RF-EST-05 |

### 4.3 Préstamos

| ID | Regla | Deriva de |
|----|-------|-----------|
| RN-16 | Un estudiante puede tener uno o varios préstamos activos simultáneamente | RF-PRE-04 |
| RN-17 | Un préstamo debe contener al menos un artículo con cantidad mayor que cero | RF-PRE-03 |
| RN-18 | En un préstamo, cada artículo aparece una sola vez; si se repite, las cantidades se suman | RF-PRE-03 |
| RN-19 | La cantidad de un artículo en un préstamo no puede superar su cantidad total | RN-01 |
| RN-20 | El folio de un préstamo es único, se genera al crear y no se reutiliza | RF-PRE-06 |
| RN-21 | Registrar un préstamo descuenta la disponibilidad y aumenta la cantidad prestada, en una sola transacción | RF-PRE-05, RNF-07 |
| RN-22 | Solo se anula un préstamo sin devoluciones; al anularlo, sus unidades vuelven a estar disponibles | RF-PRE-07 |
| RN-23 | Un préstamo anulado no se puede modificar ni devolver | RF-PRE-07 |
| RN-24 | La fecha del préstamo no puede ser futura | RF-PRE-02 |
| RN-25 | Si no se indica `fecha_limite`, el préstamo no tiene vencimiento | RF-ALA-03 |

### 4.4 Devoluciones

| ID | Regla | Deriva de |
|----|-------|-----------|
| RN-26 | Solo se puede devolver a un préstamo en estado activo | RF-DEV-01 |
| RN-27 | En cada renglón de devolución: `devuelta + dañada + perdida ≤ pendiente` | RF-DEV-02, RF-DEV-08 |
| RN-28 | No se puede devolver una cantidad superior a la pendiente; el mensaje indica el máximo | RF-DEV-08 |
| RN-29 | Las cantidades de una devolución son enteros mayores o iguales a cero | RF-DEV-03 |
| RN-30 | Una cantidad devuelta en buenas condiciones incrementa la disponibilidad | RF-DEV-03 |
| RN-31 | Una cantidad dañada incrementa `dañado` y **no** la disponibilidad | RF-DEV-03 |
| RN-32 | Una cantidad perdida incrementa `faltante` y **no** la disponibilidad | RF-DEV-05 |
| RN-33 | Registrar un daño o una pérdida **exige** un incidente asociado, con descripción | RF-DEV-05 |
| RN-34 | Un artículo dañado solo vuelve a estar disponible mediante un movimiento de reingreso con motivo | RF-DEV-03 |
| RN-35 | El préstamo pasa a `cerrado` cuando ningún renglón tiene cantidad pendiente mayor que cero | RF-DEV-07 |
| RN-36 | Un préstamo con devoluciones parciales sigue en estado `activo` | RF-DEV-02 |
| RN-37 | La devolución registra fecha y hora; por defecto el momento del registro | RF-DEV-06 |
| RN-38 | Una devolución registrada no se modifica ni se elimina; las correcciones son nuevas devoluciones | RF-DEV-06 |
| RN-39 | Un artículo pendiente de devolución **nunca** se reporta como faltante hasta que se registre un incidente de pérdida | RF-ALA-02 |

### 4.5 Incidentes

| ID | Regla | Deriva de |
|----|-------|-----------|
| RN-40 | Todo incidente declara su origen (`stock`, `prestamo` o `devolucion`) y está asociado a un artículo; solo se asocia a un estudiante cuando la responsabilidad está determinada | RF-DEV-05, RF-DEV-09 |
| RN-41 | Los tipos de incidente son `perdida`, `danio` y `otro` | RF-DEV-05 |
| RN-42 | Un incidente tiene estado `abierto` o `resuelto`, y no se elimina al resolverse | RF-ALA-02 |
| RN-43 | Resolver un incidente exige registrar la resolución en texto | RF-ALA-02 |
| RN-44 | La cantidad de un incidente no puede superar lo que hay en el origen: el pendiente del renglón (origen `prestamo` o `devolucion`) o la cantidad disponible (origen `stock`) | RN-27, RF-INV-11 |
| RN-45 | La cantidad perdida de un renglón no puede superar la cantidad pendiente más lo perdido en devoluciones previas | RN-27 |

### 4.6 Historial y trazabilidad

| ID | Regla | Deriva de |
|----|-------|-----------|
| RN-46 | No se elimina ningún registro histórico: préstamos, devoluciones, incidentes ni movimientos | RF-REP-01 |
| RN-47 | Un error de registro se corrige con un movimiento de ajuste con motivo, nunca borrando el movimiento anterior | RF-INV-06 |
| RN-48 | Toda operación que modifique préstamos e inventario se ejecuta en una sola transacción | RNF-07 |
| RN-49 | Los contadores de `articulo` deben coincidir con la suma de los movimientos; una prueba de reconciliación lo verifica | RF-INV-05 |

### 4.7 Identificación individual de unidades (opcional)

Estas reglas solo aplican a los artículos con `control_individual = 1`. Para el resto
no hay nada que hacer: se comportan igual que antes, con cantidades.

| ID | Regla | Deriva de |
|----|-------|-----------|
| RN-50 | Solo se crean unidades individuales para artículos con `control_individual = 1`; para los demás, `articulo_unidad` no tiene filas y el artículo se maneja solo con cantidades | RF-INV-08 |
| RN-51 | El código de una unidad individual es obligatorio, no vacío y único, ignorando mayúsculas | RF-INV-10 |
| RN-52 | Una unidad individual solo puede estar en uno de estos estados: `disponible`, `prestada`, `danada`, `faltante` o `baja`; `baja` es un estado, no un borrado | RF-INV-10, RN-46 |
| RN-53 | Prestar, devolver, dañar, perder o dar de baja una unidad actualiza a la vez su estado, su `prestamo_detalle_id` y los contadores del artículo, en una sola transacción | RF-INV-10, RNF-07 |

### 4.8 Incidentes independientes de préstamos

| ID | Regla | Deriva de |
|----|-------|-----------|
| RN-54 | Todo incidente declara su origen. Un incidente de `stock` no tiene `prestamo_id` ni `devolucion_id`; uno de `devolucion` tiene siempre ambos | RF-DEV-05, RF-INV-11 |
| RN-55 | La responsabilidad de un incidente es `sin_determinar` por defecto; para asignarla a un estudiante hay que elegirlo explícitamente, y esa decisión queda registrada con fecha y descripción | RF-DEV-05, RF-DEV-09 |
| RN-56 | Un incidente con `responsabilidad = 'estudiante'` exige `estudiante_id`; nunca se deduce solo del hecho de que exista un préstamo | RF-DEV-09 |
| RN-57 | El incidente no copia el nombre del estudiante: conserva el identificador y el vínculo con el préstamo, de modo que el historial no se duplica ni se desincroniza | RF-REP-01, RF-EST-05 |
| RN-58 | Cada unidad se resta de exactamente un cubo y se suma a exactamente un cubo; ninguna operación suma la misma unidad a dos estados a la vez | RF-INV-05, RN-02 |

### 4.9 Integridad de los contadores

| ID | Regla | Deriva de |
|----|-------|-----------|
| RN-59 | El cubo del que sale una unidad lo declara el tipo de movimiento: lo que venía de `prestada` se resta de `prestada`, lo que estaba en el depósito se resta de `disponible`. El efecto es determinista y no depende de que el servicio decida en el momento | RF-INV-05, RF-INV-06 |
| RN-60 | Registrar una pérdida nunca reduce la cantidad total: la unidad sigue bajo control de la facultad y consta como `faltante`. Solo una baja física reduce el total | RF-INV-05, RF-INV-06 |
| RN-61 | Para todo artículo con `control_individual = 1`, sus cinco contadores coinciden con el número de unidades en cada estado, contando como total las que no están en `baja` | RF-INV-10, RN-02 |

### 4.10 Resumen de las validaciones de la capa de servicio

| Tipo | Validación | Resultado |
|------|------------|-----------|
| Cantidad negativa o cero donde no se permite | `ReglaNegocioError` | Operación rechazada, sin cambios |
| Existencia insuficiente | `CantidadInsuficienteError` con detalle del disponible | Operación rechazada, sin cambios |
| Código de estudiante duplicado | `ValidacionError` | Operación rechazada, sin cambios |
| Entidad inexistente | `NoEncontradoError` | Operación rechazada, sin cambios |
| Transacción fallida a mitad | `PersistenciaError` | Rollback completo |
| Cualquiera de las anteriores | Mensaje en español comprensible | Sin datos técnicos en pantalla |

---

## 5. Modelo de estados

### 5.1 Préstamo

```
                 ┌──────────┐
   se crea ─────▶│  ACTIVO  │◀────── devoluciones parciales
                 └────┬─────┘
        todo devuelto│  │anulado (sin devoluciones previas)
        dañado o     │  ▼
        perdido   ┌───────┐        ┌─────────┐
                 │CERRADO│        │ ANULADO │
                 └───────┘        └─────────┘
```

`CERRADO` y `ANULADO` son estados finales: no admiten más cambios.

### 5.2 Renglón de préstamo

| Estado | Significado | Se alcanza cuando |
|--------|-------------|-------------------|
| `pendiente` | Nada ha vuelto todavía | Al crear el préstamo |
| `parcial` | Volvió parte | Tras una devolución parcial |
| `devuelto` | Volvió todo en buenas condiciones | `pendiente = 0` y no hay pérdidas |
| `con_incidente` | Con daños o pérdidas registrados | Tras un daño o una pérdida |

El estado es **derivado** de las cantidades y se recalcula en cada operación.
Se almacena para poder filtrar en SQL, pero la fuente de verdad son las cantidades.

### 5.3 Incidente

| Estado | Significado |
|--------|-------------|
| `abierto` | Sin resolver. Cuenta en el dashboard y en las alertas |
| `resuelto` | Resuelto con su descripción de resolución. Se conserva |

---

## 6. Vista de pantallas (no es el diseño definitivo)

Se define el alcance de cada sección, no su disposición exacta.

| Sección | Contenido | RF |
|---------|-----------|-----|
| **Panel** | Tarjetas con las cinco estadísticas reales, alertas de préstamos pendientes e incidentes abiertos | RF-DAS, RF-ALA |
| **Inventario** | Tabla de artículos con sus cuatro cantidades, buscador, alta/edición, registro de ajuste y, para los artículos con control individual, el detalle de unidades con su código | RF-INV |
| **Categorías** | Alta y edición de categorías | RF-INV-02 |
| **Estudiantes** | Tabla con buscador, alta/edición, ficha con historial de préstamos | RF-EST |
| **Préstamos** | Listado con filtros y alta de préstamo multi-artículo | RF-PRE |
| **Devoluciones** | Búsqueda de estudiante → préstamos activos → formulario de devolución por artículo | RF-DEV |
| **Incidentes** | Listado de incidentes abiertos y resueltos, con resolución. Distingue los ocurrido en el depósito de los situados en un préstamo o devolución, y permite dejar la responsabilidad «sin determinar» | RF-DEV-05, RF-DEV-09, RF-ALA |
| **Reportes** | Filtros por estudiante, fecha, estado y categoría; vista previa y exportación | RF-REP |
| **Respaldo** | Crear copia, listar copias, restaurar, verificar integridad, abrir carpeta de datos | RF-REP, RNF-13 |
| **Configuración** | Ruta de datos, número de copias conservadas, información del sistema | RNF-11, RNF-13 |

**El diseño de estas diez secciones ya está escrito** en `UI_SCREENS.md`. Al
diseñarlas ha aparecido una diferencia de agrupación: el diseño agrupa las diez en
seis entradas principales del menú lateral más tres secundarias, y deja Categorías
como pestaña de Inventario. **Ninguna sección de esta tabla desaparece, y ningún
requisito cambia**: lo que se decide es dónde aparece cada una en el menú. La
propuesta y lo que hay que decidir están en `UI_DESIGN.md` sección 10, contradicción
C-1.

### 6.1 Flujo principal de trabajo

```
Panel ──▶ Inventario ──▶ Préstamos ──▶ Devoluciones ──▶ Incidentes
  │                                                    │
  └──────────────────── Reportes ◀─────────────────────┘
```

Este es el recorrido que Sonia hará en cada clase. Debe ser lineal y sin
vueltas innecesarias: la ruta más larga entre el panel y una devolución
completa no debería superar unos pocos clics.

---

## 7. Requisitos fuera de alcance

Se documentan explícitamente para evitar que se interpreten como faltantes.

| Elemento | Motivo |
|----------|--------|
| Inicio de sesión y usuarios | Un solo usuario; el sistema no se expone a la red |
| Cifrado de la base de datos | Comprometería la portabilidad de los datos sin beneficio para el caso de uso |
| Envío de correo o notificaciones | Sin red |
| Código de barras / QR | No confirmado como necesidad; añadible después en la capa de presentación |
| Aplicación web o móvil | Fuera del alcance declarado |
| Sincronización entre equipos | Un solo equipo y una sola usuaria |

---

## 8. Preguntas abiertas para Sonia

Estas preguntas **ya no bloquean** el modelo de datos: el diseño las resuelve
admitiendo los dos casos a la vez (artículo con control individual y artículo sin él;
incidente con préstamo e incidente sin él). Lo que queda por responder afecta solo a
la carga inicial de datos, no al esquema.

| # | Pregunta | Impacto | Bloqueante |
|---|----------|---------|-----------|
| 1 | ¿Existe una fecha límite de devolución por curso o por tipo de práctica? | Define si `fecha_limite` se usa y si hay vencimientos. El campo ya existe y puede quedar vacío | No |
| 2 | ¿Qué equipos se controlan uno por uno con número de serie? | Solo define qué artículos se marcan con control individual. La tabla ya está diseñada (RF-INV-08, RN-50) | No |
| 3 | ¿Los estudiantes pueden tener préstamos simultáneos de distintas prácticas? | Confirma RN-16 | No |
| 4 | ¿Se necesita imprimir un vale de entrega que el estudiante firme? | Define si hace falta una vista de impresión | No |
| 5 | ¿Hay una lista de categorías ya establecida por la facultad? | Datos iniciales de `categoria` | No |
| 6 | ¿Quién decide la responsabilidad de una pérdida que ocurre en la facultad? | Define el valor por defecto de `responsabilidad`. Hoy es `sin_determinar` y no se culpa a nadie por omisión (RN-55) | No |
| 7 | ¿Con qué frecuencia se hará el inventario físico y se desireconciliar? | Define si hace falta una pantalla de conteo físico | No |
| 8 | ¿La facultad necesita algún formato de informe ya establecido? | Define las plantillas de PDF | No |
| 9 | ¿Hay más de una computadora que deba ver los mismos datos? | Afectaría a ADR-07 (instancia única) | No |
| 10 | ¿Se conserva el histórico indefinidamente o hay un periodo de depuración? | Afectaría a la política de respaldo y al volumen | No |

---

## 9. Trazabilidad entre documentos

| Documento | Contenido |
|-----------|-----------|
| `ARCHITECTURE.md` | Arquitectura, estructura de carpetas, decisiones técnicas (ADR) |
| `REQUIREMENTS.md` | Este documento: requisitos, reglas de negocio, pantallas previstas |
| `DATABASE_DESIGN.md` | Entidades, columnas, relaciones, DDL, índices, invariantes |
| `DEVELOPMENT_PLAN.md` | Etapas de trabajo, riesgos, decisiones pendientes |
| `UI_DESIGN.md` | Diseño de interfaz: identidad visual, ventana, navegación, accesibilidad, y las contradicciones detectadas en la sección 10 |
| `UI_SCREENS.md` | Diseño detallado de las pantallas, con el mapa de cobertura de requisitos de la sección 12 |
| `UI_COMPONENTS.md` | Catálogo de componentes de interfaz y sus estados |
| `UI_FLOWS.md` | Flujos, validaciones, mensajes y preguntas abiertas (sección 12) |

**Los cuatro documentos `UI_*.md` no cambian ningún requisito ni ninguna regla de
negocio de este documento.** Describen cómo se ven y cómo se recorren las pantallas
que la sección 6 ya preveía. La tabla de cobertura de `UI_SCREENS.md` sección 12
comprueba, requisito por requisito, que ninguno se queda sin pantalla. Las
contradicciones que han aparecido al diseñar están en `UI_DESIGN.md` sección 10, y
las preguntas que quedan abiertas, en `UI_FLOWS.md` sección 12.

Cada una de las 61 reglas de negocio de la sección 4 se implementará en un servicio
y tendrá una prueba identificada con su código. Ninguna regla puede quedar sin
cobertura.

**Reglas que se prueban con reconciliación, no solo con su propio caso:** RN-02 y
RN-49 tienen, además de su prueba específica, la prueba de reconciliación
`tests/integration/test_reconciliacion.py`, que recalcula los cuatro contadores
desde el libro de movimientos al terminar cada prueba de inventario, préstamo,
devolución o incidente. Lo mismo aplica a RN-61, que reconcilia los contadores
contra las unidades individuales.
