# StockLend — Diseño de las pantallas

> **Estado del documento:** propuesta de diseño. **Ninguna pantalla está
> implementada, maquetada ni probada.** No hay widgets, modelos, señales ni
> recursos de interfaz en el repositorio.
>
> **No se ha modificado ningún requisito ni regla de negocio.** Las pantallas se
> derivan de `REQUIREMENTS.md` y `DATABASE_DESIGN.md`; las contradicciones
> detectadas están en `UI_DESIGN.md` sección 10.

---

## 1. Cómo usar este documento

Cada pantalla se describe con la misma estructura, para que se puedan comparar entre
sí:

1. **Propósito**: qué resuelve Sonia aquí.
2. **Requisitos que cubre**: los identificadores exactos de `REQUIREMENTS.md`.
3. **Estructura**: qué bloques hay, de arriba abajo y de izquierda a derecha.
4. **Columnas y campos**: el contenido exacto de la tabla y del formulario.
5. **Estados**: vacío, con datos, sin permiso de acción, error.
6. **Acciones**: qué botones hay y cuál es el principal.

| Documento | Contenido |
|-----------|-----------|
| `UI_DESIGN.md` | Idioma visual, ventana, navegación, accesibilidad |
| `UI_SCREENS.md` | **Este.** Las seis pantallas principales y las tres secciones secundarias |
| `UI_COMPONENTS.md` | Los componentes reutilizables, con su anatomía y sus estados |
| `UI_FLOWS.md` | Recorridos completos, validaciones, mensajes y confirmaciones |

### 1.1 Índice

| # | Pantalla | Requisitos principales |
|---|----------|------------------------|
| 2 | [Panel](#2-panel) | RF-DAS-01…06, RF-ALA-01…04 |
| 3 | [Inventario](#3-inventario) | RF-INV-01…11 (la pestaña Categorías cubre RF-INV-02) |
| 4 | [Estudiantes](#4-estudiantes) | RF-EST-01…06 |
| 5 | [Préstamos](#5-préstamos) | RF-PRE-01…09 |
| 6 | [Devoluciones](#6-devoluciones) | RF-DEV-01…11 |
| 7 | [Reportes](#7-reportes) | RF-REP-01…06 |
| 8 | [Incidentes](#8-incidentes-sección-secundaria) | RF-DEV-05, RF-DEV-09, RF-DEV-10, RF-ALA-02, RF-ALA-04 |
| 9 | [Respaldo](#9-respaldo-sección-secundaria) | RNF-13, RNF-12, RNF-11 |
| 10 | [Configuración](#10-configuración-sección-secundaria) | RF-INV-08, RNF-11, RNF-18 |
| 11 | [Categorías](#11-categorías) (pestaña de Inventario) | RF-INV-02 |

---

## 2. Panel

### 2.1 Propósito

Responder en menos de diez segundos, al abrir la aplicación, tres preguntas: ¿hay
algo que se haya roto?, ¿qué está fuera con los estudiantes? y ¿puedo hacer la
clase de hoy?

No es una pantalla de análisis. Es una pantalla de arranque. Por eso no lleva
gráficos: las cifras son pocas, y con cinco tarjetas se leen de un vistazo.

### 2.2 Requisitos que cubre

RF-DAS-01, RF-DAS-02, RF-DAS-03, RF-DAS-04, RF-DAS-05, RF-DAS-06, RF-ALA-01,
RF-ALA-02, RF-ALA-03, RF-ALA-04.

### 2.3 Estructura

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│  Panel                                                                          │
│  Resumen del estado actual del inventario                                       │
├───────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────┐  │
│  │     142     │  │     318     │  │      7      │  │     24      │  │   2    │  │
│  │  artículos  │  │ disponibles │  │  préstamos  │  │  pendientes │  │inciden-│  │
│  │  registrados│  │             │  │   activos   │  │  de devolu- │  │  tes   │  │
│  │             │  │             │  │             │  │    ción     │  │ abiertos│ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  └────────┘  │
│    RF-DAS-01          RF-DAS-02         RF-DAS-03         RF-DAS-04      RF-DAS-05│
│                                                                                   │
│  ┌──────────────────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │  Préstamos que necesitan atención         │  │  Incidentes sin resolver        │  │
│  │  RF-ALA-01                             │  │  RF-ALA-02                     │  │
│  │                                          │  │                                 │  │
│  │  Estudiante  ·  PRE-2026-0000xx  ·  …    │  │  Olla grande  ·  dañada  ·  …   │  │
│  │  2 pendientes                            │  │  Depósito, sin responsable     │  │
│  │                                          │  │                                 │  │
│  │  [ Ver todos ]                           │  │  [ Ver todos ]                  │  │
│  └──────────────────────────────────────────┘  └─────────────────────────────────┘  │
│                                                                                   │
└───────────────────────────────────────────────────────────────────────────────────┘
```

Las dos listas están **separadas y nunca mezcladas**, como exige RF-ALA-02. Un
préstamo pendiente y un incidente abierto son cosas distintas, con responsables
distintos, y verlas en la misma tabla llevaría a Sonia a mezclarlos.

### 2.4 Las cinco tarjetas

| # | Tarjeta | Requisito | Valor exacto | Texto de apoyo |
|---|---------|-----------|--------------|----------------|
| 1 | **Artículos registrados** | RF-DAS-01 | `COUNT(articulo)` de artículos activos | «de los que N tienen control individual» |
| 2 | **Disponibles** | RF-DAS-02 | `SUM(cantidad_disponible)` de todos los artículos | «unidades listas para prestar» |
| 3 | **Préstamos activos** | RF-DAS-03 | `COUNT(prestamo)` con estado activo | «con estudiantes» |
| 4 | **Pendientes de devolución** | RF-DAS-04 | `SUM(cantidad_pendiente)` de los préstamos activos | «unidades por devolver» |
| 5 | **Incidentes abiertos** | RF-DAS-05 | `COUNT(incidente)` no resueltos, con el total de resueltos en el texto de apoyo | «N resueltos» |

**Las cifras son agregados reales de la base.** Con una base vacía, las cinco
tarjetas muestran `0` y el texto de apoyo dice «0 resueltos», sin ningún dato de
ejemplo (RF-DAS-06). El objetivo de rendimiento es el del requisito: la pantalla
completa, con las cinco cifras y las dos listas, en menos de un segundo (RNF-06).

**Las cifras son clicables** y llevan a la sección correspondiente ya filtrada:
«Pendientes de devolución» abre Préstamos filtrado por estado activo, e
«Incidentes abiertos» abre Incidentes. Es el atajo de RNF-03, que busca que la
operación común se resuelva en pocos pasos.

### 2.5 La lista de préstamos que necesitan atención

**No hay tarjeta para esto.** La quinta tarjeta ya la ocupa RF-DAS-05, y meter una
sexta cifra haría que el Panel dejara de leerse de un vistazo. Es una lista, y su
contenido es una decisión pendiente de validar (contradicción C-5 de `UI_DESIGN.md`).

| Columna | Contenido |
|---------|-----------|
| Estudiante | Código y nombre completo |
| Préstamo | Folio `PRE-AAAA-NNNNNN` |
| Préstado | Cantidad de unidades |
| Pendiente | Cantidad de unidades pendientes de devolución |
| Desde | Fecha del préstamo |
| Motivo de atención | Texto, no color: «pendiente de devolución», «incidente abierto», «fecha límite superada» |

**El motivo va escrito.** Es la regla de «el color no es el único portador de
información»: una fila en ámbar sin texto obliga a Sonia a interpretar el color.

**No existe la etiqueta «vencido».** Mientras no haya `fecha_limite` registrada, un
préstamo no vence por el paso del tiempo (RF-ALA-03, RN-25, ADR-04). La fecha límite
solo aparece si algún día existe, y entonces se muestra como una columna más.

### 2.6 Estados

| Estado | Qué se ve |
|--------|-----------|
| Base vacía | Las cinco tarjetas en `0`, y las dos listas con su estado vacío («No hay préstamos activos», «No hay incidentes abiertos») |
| Base con datos | Todo lo del alámbrico |
| Sin cambio desde la última visita | Ninguna marca visual. Los datos se recargan al abrir y con `F5` |

### 2.7 Acciones

| Acción | Dónde | Efecto |
|--------|-------|--------|
| Ver todos los préstamos | En la lista de atención | Abre Préstamos |
| Ver todos los incidentes | En la lista de incidentes | Abre Incidentes |
| Clic en una tarjeta | En la tarjeta | Abre la sección filtrada |
| Actualizar | `F5` | Recarga las cifras y las listas |

**El Panel no tiene ninguna acción de escritura.** Sonia nunca cambia un dato desde
aquí. Es de lectura, y por eso no pide confirmación en nada.

---

## 3. Inventario

### 3.1 Propósito

Responder «¿cuánto tengo de cada cosa y de qué tipo?» y «¿qué se ha roto?», y
corregir las existencias con rastro.

Es la pantalla con más información de la aplicación: cuatro cantidades por artículo,
más el desglose por unidad cuando el artículo tiene control individual. La clave
para que siga siendo legible es que esas cuatro cantidades **se lean sin
interpretación**.

### 3.2 Requisitos que cubre

RF-INV-01, RF-INV-02, RF-INV-03, RF-INV-04, RF-INV-05, RF-INV-06, RF-INV-07,
RF-INV-08, RF-INV-09, RF-INV-10, RF-INV-11.

### 3.3 Estructura

Desde el rediseño de la Etapa 6.5, la pantalla abre con una **fila de cuatro tarjetas**
con cifras reales (agregado SQL, no de ejemplo) y agrupa pestañas, buscador, filtro y
tabla dentro de un único contenedor:

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│  Inventario                                                                      │
│  Artículos, unidades y existencias                                              │
├───────────────────────────────────────────────────────────────────────────────────┤
│ ┌── Artículos ──┐ ┌── Unidades ───┐ ┌── Disponibles ┐ ┌── Prestadas ──┐           │  ← 4 StatCard
│ │     6    ▨    │ │    42    ▨    │ │    38    ✓    │ │    4    ▨     │           │  (refluye a 2/1)
│ │  registrados  │ │ en existencia │ │ listas para…  │ │ fuera con…    │           │
│ └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘           │
│ ┌─────────────────────────────────────────────────────────────────────────────────┐│
│ │ Artículos │ Unidades │ Categorías                                              ││  ← pestañas (izq.)
│ ├─────────────────────────────────────────────────────────────────────────────────┤│
│ │ [ Buscar por nombre o código…        ]  Categoría [ Todas ▾ ]                   ││  ← filtros
│ ├──────────┬────────┬────────────┬─────┬─────┬─────┬─────┬─────┬───────────┬─────┤│
│ │ Nombre   │ Código │ Categoría  │Disp │Prest│Dañ  │Falt │Total│ Estado    │  ⋯  ││
│ │ Olla     │ OLL-01 │ Utensilios │  8  │  1  │  1  │  0  │  10 │[Prestable]│  ⋯  ││
│ │ Llave    │   —    │ Herramienta│  3  │  0  │  0  │  0  │   3 │[No prest.]│  ⋯  ││
│ └──────────┴────────┴────────────┴─────┴─────┴─────┴─────┴─────┴───────────┴─────┘│
│                                              (detalle lateral al seleccionar)     │
│  6 artículos                                                                     │
│ └─────────────────────────────────────────────────────────────────────────────────┘│
└───────────────────────────────────────────────────────────────────────────────────┘
```

El contenedor principal (`QFrame#contenedor_inventario`) lleva las pestañas **alineadas
a la izquierda** (icono + etiqueta, subrayado azul en la activa), la fila de filtros y
el área de tabla + detalle. La acción `+ Artículo` de la cabecera y el campo de nueva
categoría aparecen **solo en la pestaña que les corresponde**.

### 3.4 Las tres pestañas

| Pestaña | Para qué | Requisitos |
|---------|----------|------------|
| **Artículos** | El listado principal, con las cuatro cantidades por artículo | RF-INV-05, RF-INV-04, RF-INV-03 |
| **Unidades** | Solo tiene contenido si algún artículo activa el control individual | RF-INV-08, RF-INV-10 |
| **Categorías** | Alta y listado de categorías | RF-INV-02 |

**Categorías es una pestaña, no una entrada del menú lateral.** Es la resolución de
la contradicción C-1: la función existe y es accesible en un clic, pero no compite
en la navegación principal con las tareas del día. Ver [sección 11](#11-categorías).

### 3.5 Pestaña Artículos: columnas

La tabla es una sola y compartida con las tres pestañas; la pestaña activa decide las
columnas, los delegates y el estado vacío. Para Artículos son diez:

| Columna | Contenido | Ancho | Notas |
|---------|-----------|-------|-------|
| Nombre | Nombre del artículo | Flexible (stretch) | Columna que absorbe el ancho sobrante |
| Código | Código interno | 120 px | Se genera solo. No se pide (RF-INV-01); «—» si no tiene |
| Categoría | Categoría asignada | 150 px | Etiqueta neutra, no semántica |
| Disponible | Cantidad | 100 px | Cifra tabular (`QuantityCell`), verde si es mayor que 0 |
| Prestado | Cantidad | 100 px | Cifra tabular |
| Dañado | Cantidad | 90 px | Cifra tabular, ámbar si es mayor que 0 |
| Faltante | Cantidad | 90 px | Cifra tabular, rojo si es mayor que 0 |
| Total | Suma de las cuatro | 90 px | Cifra tabular en semibold. **Suma siempre, sin excepción** (RF-INV-05) |
| Estado | Prestable / No prestable | 130 px | Pastilla (`StatusChip`); «No prestable» se pinta en neutro (RF-INV-09) |
| Acciones | ⋯ | 48 px | `AccionesCellDelegate`: situado en la última columna, abre el menú de fila |

**El control por unidad no es una columna.** Se consulta en la pestaña Unidades, que
solo tiene contenido cuando algún artículo lo activa (RF-INV-08, RF-INV-10). La
columna `Acciones` (`⋯`) reutiliza el menú de fila: editar, ajustar existencias (solo
si el artículo no tiene control individual), ver unidades (solo si lo tiene) y
registrar incidente.

**Las cuatro cantidades se muestran siempre, aunque sean cero.** No se ocultan
las columnas vacías: si «dañado» desaparece cuando no hay nada dañado, Sonia no
puede saber si el filtro está mal o si de verdad no hay. El cero es información.

**Las cuatro cantidades se muestran siempre, aunque sean cero.** No se ocultan
las columnas vacías: si «dañado» desaparece cuando no hay nada dañado, Sonia no
puede saber si el filtro está mal o si de verdad no hay. El cero es información.

**El total se calcula en la consulta, no sumando en pantalla.** Es la suma de
disponible, prestado, dañado y faltante (RF-INV-05), y si algún día dejara de
coincidir, la fila lo marcaría en rojo. Hoy siempre coincide, y por eso el
comportamiento está especificado de todas formas.

### 3.6 Fila de artículo: dos niveles

> **Nota (Etapa 6.5):** el rediseño materializa el detalle por unidad a través de la
> pestaña **Unidades** y del panel de detalle lateral (al seleccionar una fila), no
> mediante filas expandidas dentro de la tabla. La acción «Ver unidades» del menú de
> fila cambia a la pestaña Unidades con el nombre del artículo como término de
> búsqueda. El diseño de dos niveles descrito a continuación queda como referencia.

Una fila ocupa hasta 40 px si el artículo no tiene control individual, y hasta 72 px
si lo tiene. El segundo nivel existe porque el control por unidad cambia lo que
significa «disponible» (RF-INV-08, RF-INV-10).

```
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │ ▨ Olla grande          Utensilios · Ollas      SÍ   8   1   1   0   10        │
  │   Unidad: OLG-001 disponible · OLG-002 disponible · OLG-003 prestada ·        │
  │   OLG-004 dañada · OLG-005 disponible · +4 más                                │
  └──────────────────────────────────────────────────────────────────────────────┘
```

Reglas del segundo nivel:

- **Solo para artículos con control individual.** Los demás lo ocupan en una línea.
- **Se muestran hasta cinco códigos** y el resto como «+N más». Abajo del todo hay
  un enlace «Ver las 10 unidades» que abre la pestaña Unidades filtrada.
- **El código es el identificador, no el estado.** La interfaz enseña el código real
  de `articulo_unidad` (RF-INV-10) y su estado al lado, para que Sonia pueda leer el
  código en voz alta en clase y buscarlo después.
- **Desplegar la fila no cambia los contadores de la cabecera.** Solo revela el
  detalle.

### 3.7 Pestaña Unidades

Listado de todas las unidades individuales de todos los artículos con control
individual. Existe porque RF-INV-10 exige poder consultar unidades, y porque es la
forma rápida de encontrar «¿dónde está OLG-004?».

| Columna | Contenido | Notas |
|---------|-----------|-------|
| Código de unidad | `OLG-004` | Texto monoespaciado. Es un identificador, se lee y se copia |
| Artículo | Nombre | |
| Categoría | | |
| Estado | Disponible / Prestada / Dañada / Faltante | Pastilla con texto (RF-INV-05) |
| Estudiante | Nombre o «—» | Solo si está prestada |
| Préstamo | Folio o «—» | Solo si está prestada |
| Incidente | Referencia o «—» | Si tiene uno abierto |

Buscar por código de unidad con `Ctrl+F` filtra también por `articulo_unidad.codigo`,
no solo por el nombre del artículo. Es el caso de uso real: Sonia recibe el código y
necesita el estado en menos de cinco segundos.

### 3.8 Pestaña Categorías

Listado de categorías con el número de artículos que referencia cada una, y alta de
categorías nuevas. **No se permite borrar una categoría que tenga artículos
asignados**; el botón de eliminar está deshabilitado con un texto que explica por
qué, no solo en gris (principio 5). Los nombres son únicos (RF-INV-02): si Sonia
escribe un nombre que ya existe, el mensaje lo dice y ofrece seleccionar la
existente.

### 3.9 Formulario de artículo

Un diálogo, no una pantalla aparte. Se abre desde «+ Artículo» o desde «Editar» en el
menú de fila.

| Campo | Tipo | Obligatorio | Regla | Mensaje de error |
|-------|------|-------------|-------|-----------------|
| Nombre | Texto | Sí | Único, no vacío | «Ya existe un artículo llamado *X*.» |
| Categoría | Selector | Sí | Debe existir | «Elige una categoría de la lista.» |
| Cantidad inicial | Número | Sí | ≥ 0 | «La cantidad no puede ser menor que cero.» |
| Control por unidad | Casilla | No | Si está activa, se pide un código por unidad | — |
| Prestable | Casilla | Sí, marcada | RF-INV-09 | — |
| Nota | Texto largo | No | 200 caracteres | «La nota no puede pasar de 200 caracteres.» |

**El control por unidad cambia el formulario, no solo un dato.** Si Sonia marca la
casilla, aparece un bloque de códigos de unidad: uno por unidad de la cantidad
inicial, cada uno editable y con validación de unicidad (RF-INV-10). Si la cantidad
es alta, el bloque ofrece «generar códigos automáticamente con el patrón
OLG-001…OLG-010» y Sonia los revisa. La regla de que el sistema *pide un código por
unidad* viene de RF-INV-08, y el patrón automático es una sugerencia de
comodidad, no una asignación silenciosa: los códigos se ven y se pueden cambiar.

**No se piden datos que el sistema puede deducir.** Ni correo, ni teléfono, ni
documento de identidad. No existen en el modelo (`DATABASE_DESIGN.md`, revisión 2) y
no se inventan.

### 3.10 Ajuste de existencias

Ajuste de cantidad, con motivo obligatorio (RF-INV-06). Se accede desde el menú de
fila.

```
┌────────────────────────────── Ajustar existencias ──────────────────────────────┐
│                                                                                │
│  Artículo                                                                       │
│  Olla grande · Utensilios · Ollas                                               │
│                                                                                │
│  Cantidad actual                                                               │
│  ┌──────────────────────────────┐                                             │
│  │  10                          │                                             │
│  └──────────────────────────────┘                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Disponible│  │ Prestado │  │  Dañado  │  │ Faltante │  │  Total   │           │
│  │    8     │  │    1     │  │    1     │  │    0     │  │   10     │           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
│                                                                                │
│  Nueva cantidad      [  9  ]   ·  Ajuste: −1                                  │
│                                                                                │
│  Motivo (obligatorio)                                                          │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  Se rompió una durante la clase de química                                 │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│  El motivo no puede estar vacío: es la explicación que quedará en el historial. │
│                                                                                │
│                          [ Cancelar ]              [ Registrar movimiento ]      │
└────────────────────────────────────────────────────────────────────────────────────┘
```

Reglas del formulario:

- **El motivo es obligatorio y se explica en el propio campo**, no solo tras
  confirmar. Es el requisito de «nada de lo que se hace es invisible».
- **El ajuste se muestra antes de aplicarse**: «Ajuste: −1», en el mismo sitio donde
  Sonia está mirando. Nunca se descubre el cambio en la tabla después de la
  confirmación.
- **El diálogo es modal**, pero el ajuste no se aplica hasta pulsar «Registrar
  movimiento». Cancelar no deja rastro.
- Si el artículo tiene control individual, el ajuste de cantidad **se sustituye por
  un movimiento por unidad**, con el código de la unidad. No se puede «restar una
  olla» de un artículo de 10 unidades: hay que decir cuál (RF-INV-08, RF-INV-10).

### 3.11 Estados

| Estado | Qué se ve |
|--------|-----------|
| Sin artículos | Icono, «Todavía no hay artículos registrados» y el botón «Registrar el primero». Las pestañas Unidades y Categorías muestran su propio vacío |
| Con filtro de búsqueda sin resultados | «Ningún artículo coincide con *«olla»*» y «Quitar búsqueda» |
| Filtro de categoría sin resultados | «No hay artículos en *Utensilios · Ollas*» y «Ver todas las categorías» |
| Artículo no prestable | La fila se marca con la pastilla «No prestable»; los números siguen visibles, porque el artículo se puede devolver (RF-INV-09) |
| Fila con unidades desplegadas | Segundo nivel visible, contadores sin cambios |

---

## 4. Estudiantes

### 4.1 Propósito

Encontrar a un estudiante en segundos y ver de un vistazo qué tiene en su poder.

El campo de búsqueda es el protagonista de esta pantalla. Sonia llega aquí desde
Préstamos o Devoluciones para localizar a una persona concreta, y lo hace escribiendo
apellidos. Todo lo demás es secundario.

### 4.2 Requisitos que cubre

RF-EST-01, RF-EST-02, RF-EST-03, RF-EST-04, RF-EST-05, RF-EST-06.

### 4.3 Estructura

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│  Estudiantes                                                                     │
│  Directorio de estudiantes y sus préstamos                                        │
├───────────────────────────────────────────────────────────────────────────────────┤
│ [ Buscar por nombre o código…                          ]        [ + Estudiante ]│
├───────────────────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────────┐  ┌──────────────────┐  │
│ │ 20231234567  Ana Ramírez Solís        2   4   Activo    │  │  Ana Ramírez     │  │
│ │                                              (n)     │  │  Solís           │  │
│ │ 20231234568  Bruno Díaz Navarro       0   0   Activo    │  │  ──────────────  │  │
│ │                                                       │  │  20231234567     │  │
│ │ 19876543210  Carla Mendoza Ríos       1   1   Inactivo  │  │  Activo          │  │
│ │                                                      │  │                  │  │
│ │                                                       │  │  Prestamos       │  │
│ │                                                       │  │  activos     2   │  │
│ │                                                       │  │  pendientes  4   │  │
│ │                                                       │  │  devoluciones    │  │
│ │                                                       │  │                  │  │
│ │                                                       │  │  Últimos         │  │
│ │                                                       │  │  PRE-2026-0000xx │  │
│ │                                                       │  │  12/09/2026      │  │
│ │                                                       │  │  Olera mediana 1 │  │
│ │                                                       │  │  [ Ver ficha ]   │  │
│ └───────────────────────────────────────────────────────┘  └──────────────────┘  │
│  3 estudiantes de 3                                              (zona apoyo)   │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### 4.4 Columnas

| Columna | Contenido | Notas |
|---------|-----------|-------|
| Código | Código universitario | Monoespaciado, único (RF-EST-01, RF-EST-02) |
| Nombre | Nombres y apellidos | Búsqueda parcial e insensible a mayúsculas sobre este campo (RF-EST-03) |
| Préstamos activos | Recuento | Cifra tabular |
| Pendientes | Unidades pendientes de devolución de todos sus préstamos | Cifra tabular |
| Estado | Activo / Inactivo | Pastilla. Un estudiante con historial no se borra, se marca inactivo (RF-EST-06) |
| ⋯ | Menú de fila | Ver ficha, editar, marcar inactivo, registrar préstamo, registrar devolución |

**La búsqueda escribe un guion entre nombre y apellidos** («Ana Ramírez Solís» se
busca también como «Ramírez Solís» y como «Solís»), porque así es como Sonia escribe
el nombre cuando lo busca.

### 4.5 Zona de apoyo: el resumen del estudiante

Es la ficha resumida, sin salir de la sección. Muestra lo que Sonia necesita antes de
empezar un préstamo o una devolución:

| Dato | Origen |
|------|--------|
| Código, nombre, estado | `estudiante` |
| Préstamos activos | `prestamo` con estado activo |
| Unidades pendientes de devolución | Suma de `cantidad_pendiente` de sus préstamos activos |
| Últimos préstamos, con fecha, folio y artículos | `prestamo` ordenado por fecha descendente |

**Por debajo de 1200 px de ancho esta zona se oculta** y la ficha completa está
disponible con «Ver ficha», que abre un diálogo con la misma información y el
historial completo (RF-EST-04).

### 4.6 Formulario de estudiante

| Campo | Tipo | Obligatorio | Regla | Nota |
|-------|------|-------------|-------|------|
| Código universitario | Texto | Sí | Único en toda la aplicación | Se muestra el error si ya existe, con el estudiante homónimo (RF-EST-02) |
| Nombres | Texto | Sí | No vacío | Sin tildes obligatorias: se comparan insensible a mayúsculas y acentos |
| Apellidos | Texto | Sí | No vacío | Idem |
| Nota | Texto largo | No | 200 caracteres | Opcional |

**El formulario tiene cuatro campos y ninguno es más.** Correo, teléfono y documento
no se piden (RF-EST-01 los limita a los tres campos) y no existen en el modelo.
Si un día se necesitan, se añaden con un cambio documentado, no se anticipan.

### 4.7 Estados

| Estado | Qué se ve |
|--------|-----------|
| Sin estudiantes | «Todavía no hay estudiantes registrados» y «Registrar el primero» |
| Búsqueda sin resultados | «Ningún estudiante coincide con *«Ramírez»*» y «Quitar búsqueda» |
| Estudiante inactivo | Fila atenuada al 70 %, pastilla «Inactivo», y **el botón de devolver deshabilitado**: no se presta ni se devuelve a un inactivo. El motivo se explica en el texto de ayuda del botón |
| Estudiante seleccionado | La zona de apoyo muestra su resumen; la fila queda resaltada |
---

## 5. Préstamos

### 5.1 Propósito

Registrar la entrega de artículos a un estudiante en el menor número de pasos, y
dejar constancia de a quién, qué, cuánto y cuándo.

### 5.2 Requisitos que cubre

RF-PRE-01, RF-PRE-02, RF-PRE-03, RF-PRE-04, RF-PRE-05, RF-PRE-06, RF-PRE-07,
RF-PRE-08, RF-PRE-09.

### 5.3 Estructura

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│  Préstamos                                                                       │
│  Registro de entregas a estudiantes                                              │
├───────────────────────────────────────────────────────────────────────────────────┤
│ [ Buscar por estudiante o folio…     ]  Estado [ Todos ▾ ]       [ + Préstamo ]  │
├───────────────────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────────┐  ┌──────────────────┐  │
│ │ Folio         Estudiante        Fecha    Prestado Pend.│  │  PRE-2026-000012 │  │
│ │                                                Est.  │  │  ──────────────  │  │
│ │ PRE-2026-000012  Ana Ramírez   12/09/2026  4    2   Act. │  │  Ana Ramírez     │  │
│ │ PRE-2026-000011  Bruno Díaz    10/09/2026  6    0   Cerr│  │  Solís           │  │
│ │ PRE-2026-000010  Carla Mendoza  05/09/2026  2    0   Anul│  │                  │  │
│ │                                                       │  │  12/09/2026      │  │
│ │                                                       │  │                  │  │
│ │                                                       │  │  4 prestadas     │  │
│ │                                                       │  │  2 pendientes    │  │
│ │                                                       │  │                  │  │
│ │                                                       │  │  Olera mediana 1  │  │
│ │                                                       │  │  Olla grande    2  │  │
│ │                                                       │  │  Paño           1  │  │
│ │                                                       │  │                  │  │
│ │                                                       │  │  [ Registrar      │  │
│ │                                                       │  │   devolución ]    │  │
│ └───────────────────────────────────────────────────────┘  └──────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### 5.4 Columnas

| Columna | Contenido | Notas |
|---------|-----------|-------|
| Folio | `PRE-AAAA-NNNNNN` | **No editable y no reutilizable** (RF-PRE-06). Se genera en el alta y no se puede cambiar |
| Estudiante | Código y nombre | |
| Fecha | Fecha y hora de entrega | Con hora y minuto (RF-PRE-02) |
| Unidades | Total prestado | Suma de las líneas del préstamo |
| Pendientes | Unidades pendientes de devolución | Cifra tabular. En rojo si es mayor que 0, siempre con el número al lado |
| Estado | Activo / Cerrado / Anulado | Pastilla con texto y color (RF-REP-03) |
| ⋯ | Menú de fila | Registrar devolución, anular, ver detalle |

**El estado «vencido» no existe en esta columna**, por RF-ALA-03, RN-25 y ADR-04. La
columna de pendientes ya dice lo que hay que saber.

### 5.5 Formulario de préstamo

Un diálogo de dos pasos dentro de una sola ventana, para no perder lo escrito al
pasar de un paso a otro.

**Paso 1: estudiante**

| Campo | Comportamiento |
|-------|----------------|
| Buscador de estudiante | Escribe nombre o código. Filtra mientras se escribe (RF-EST-03) |
| Resultado seleccionado | Muestra código, nombre y, en una línea, su resumen de pendientes. Si tiene algo pendiente, se avisa **antes** de continuar: «Tiene 2 unidades pendientes de otros préstamos. Puedes registrar este préstamo igualmente.» (RF-PRE-04: no hay límite) |
| Estudiante ya inactivo | El buscador lo muestra atenuado con la pastilla «Inactivo», y el botón de continuar queda deshabilitado con la explicación a la vista |

**Paso 2: artículos**

| Campo | Comportamiento |
|-------|----------------|
| Buscador de artículo | Por nombre o código, filtra mientras se escribe (RF-INV-04) |
| Cantidad por artículo | Selector incremental. El máximo es la cantidad disponible **calculada en el momento** (RF-INV-07) |
| Selección por unidad | Si el artículo tiene control individual activo, la cantidad se elige marcando unidades con su código, no con un número (RF-INV-08) |
| Artículos acumulados | Lista de lo ya añadido, con su cantidad editable, y el total de unidades al pie |
| Comentario | Texto libre opcional, 200 caracteres. Para contexto de clase o práctica (RF-PRE-09) |
| Fecha y hora | Prellenada con el momento actual, editable (RF-PRE-02) |

**El botón de guardar está deshabilitado hasta que haya estudiante y al menos una
unidad.** En cuanto falta algo, el botón lo dice: «Añade al menos un artículo para
registrar el préstamo». Nunca se pulsa y se descubre después.

**Al guardar, la disponibilidad baja en la misma transacción** (RF-PRE-05), no en un
segundo paso. Si algo falla a mitad, no queda nada a medias: o se guarda el préstamo
completo con el inventario ya descontado, o no se guarda nada (RNF-07).

### 5.6 Anulación de un préstamo

Solo disponible si el préstamo no tiene devoluciones (RF-PRE-07), y con una doble
confirmación, porque devuelve unidades al inventario y hace desaparecer la entrega
del historial del estudiante.

```
┌───────────────────────────── Anular préstamo ──────────────────────────────┐
│                                                                             │
│  Vas a anular el préstamo PRE-2026-000012 de Ana Ramírez Solís.           │
│                                                                             │
│  Esto hace dos cosas:                                                        │
│   · devuelve 4 unidades al inventario como disponibles                      │
│   · marca el préstamo como anulado, sin borrarlo                           │
│                                                                             │
│  El movimiento queda registrado en el historial.                            │
│                                                                             │
│                    [ Cancelar ]        [ Anular préstamo ]                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

El botón dice «Anular préstamo», no «Aceptar». Si el préstamo ya tiene devoluciones,
el botón está deshabilitado y el motivo se escribe al lado: «Este préstamo tiene
devoluciones registradas y no se puede anular».

El dibujo anterior es **la primera** de las dos confirmaciones. La segunda, donde
hay que escribir **ANULAR** en un campo para habilitar el botón, está en el
recorrido completo de `UI_FLOWS.md` sección 7 (y en `UI_COMPONENTS.md` 5.3); aquí
solo se documenta la primera para no repetir el mismo diálogo dos veces.

### 5.7 Estados

| Estado | Qué se ve |
|--------|-----------|
| Sin préstamos | «Todavía no hay préstamos registrados» y «Registrar el primero» |
| Filtro de estado sin resultados | «No hay préstamos anulados» y «Ver todos los estados» |
| Préstamo cerrado | Fila normal, pastilla «Cerrado», menú de fila sin «anular» |
| Préstamo anulado | Fila atenuada al 70 %, pastilla «Anulado», y la zona de apoyo indica quién lo anuló y cuándo |
| Estudiante inactivo con préstamo activo | El préstamo sigue visible y se puede devolver. Solo se bloquea el préstamo **nuevo** |

---

## 6. Devoluciones

### 6.1 Propósito

Registrar lo que vuelve, en cuántas piezas y en qué estado, en la misma pantalla,
sin formularios distintos para devolución total y parcial (RF-DEV-02).

Es la operación común de Sonia (RNF-03) y, por tanto, la pantalla más cuidada del
proyecto. El objetivo declarado es **cerrar una devolución en cinco pasos o menos**.

### 6.2 Requisitos que cubre

RF-DEV-01, RF-DEV-02, RF-DEV-03, RF-DEV-04, RF-DEV-05, RF-DEV-06, RF-DEV-07,
RF-DEV-08, RF-DEV-09, RF-DEV-10, RF-DEV-11.

### 6.3 Estructura: dos columnas y un paso

```
┌────────────────────────────── Registrar devolución ───────────────────────────┐
│                                                                               │
│  1  Estudiante       Ana Ramírez Solís  ·  20231234567        [ Cambiar ]     │
│  ─────────────────────────────────────────────────────────────────────────     │
│  2  Préstamo         PRE-2026-000012 · 12/09/2026 · 4 prestadas · 2 pend.     │
│  ─────────────────────────────────────────────────────────────────────────     │
│                                                                               │
│     Artículos de este préstamo                      Lo que vuelve ahora        │
│     ─────────────────────────────                     ────────────────────    │
│                                                                               │
│     Olera mediana            1 prestada                                      │
│       ┌──────────────────────────┐     ┌──────────────────────────────────┐    │
│       │  Cantidad que vuelve  1  │     │  En buen estado  [  1  ]         │    │
│       │  [ − ]  1  [ + ]          │     │  Dañada         [  0  ]         │    │
│       │  Mínimo 0 · Máximo 1      │     │  Perdida        [  0  ]         │    │
│       └──────────────────────────┘     └──────────────────────────────────┘    │
│                                                                               │
│     Olla grande             2 prestadas                                    │
│       ┌──────────────────────────┐     ┌──────────────────────────────────┐    │
│       │  Cantidad que vuelve  2  │     │  En buen estado  [  2  ]         │    │
│       │  [ − ]  2  [ + ]          │     │  Dañada         [  0  ]  máx 0   │    │
│       │  Mínimo 0 · Máximo 2      │     │  Perdida        [  0  ]  máx 0   │    │
│       └──────────────────────────┘     └──────────────────────────────────┘    │
│                                                                               │
│     Paño                    1 prestada                                      │
│       ┌──────────────────────────┐     ┌──────────────────────────────────┐    │
│       │  Cantidad que vuelve  0  │     │  En buen estado  [  0  ]         │    │
│       │  [ 0 ]  dejar pendiente   │     │  Dañada         [  0  ]         │    │
│       │  Mínimo 0 · Máximo 1      │     │  Perdida        [  0  ]         │    │
│       └──────────────────────────┘     └──────────────────────────────────┘    │
│                                                                               │
│  ─────────────────────────────────────────────────────────────────────────    │
│  Resumen:  3 unidades vuelven · 0 dañadas · 0 perdidas · 1 queda pendiente    │
│  Al guardar, PRE-2026-000012 pasará a «Cerrado» si no queda nada pendiente.   │
│                                                                               │
│                              [ Cancelar ]   [ Registrar devolución ]         │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 6.4 Por qué este diseño

| Decisión | Motivo |
|----------|--------|
| **Estudiante y préstamo arriba, fijos** | Sonia ve siempre de quién y de qué préstamo está devolviendo. No puede dudarlo (RF-DEV-01) |
| **Una sola pantalla, no dos formularios** | RF-DEV-02 lo exige: devolución completa y parcial en la misma pantalla |
| **Cantidad y condición en la misma fila** | Preguntar «¿cuántas vuelven?» y «¿en qué estado?» en la misma línea evita el error de contarlos en un sitio y clasificarlos en otro (RF-DEV-03) |
| **El máximo visible junto al campo** | Sonia ve el tope sin probar (RF-DEV-08). No hay que cometer un error para descubrir el límite para descubrir el límite |
| **El estado de la unidad se elige con números, no con selectores** | Un `QSpinBox` con tres campos es más rápido de usar que un grupo de opciones, y cabe en el ancho disponible |
| **El resumen al pie, antes de guardar** | Sonia ve el efecto de lo que va a hacer antes de hacerlo. Incluye si el préstamo se cerrará (RF-DEV-07) |
| **Nada se guarda por partes** | Cada devolución es un registro fechado e inmutable (RF-DEV-06) |

### 6.5 Las tres columnas de condición

| Columna | Significado | Efecto al guardar |
|---------|-------------|-------------------|
| **En buen estado** | Vuelve utilizable | Queda disponible en el inventario |
| **Dañada** | Vuelve, pero no prestable | Pasa a `dañado`. Genera incidente de daño (RF-DEV-05) |
| **Perdida** | No vuelve | Pasa a `faltante`. Genera incidente de pérdida (RF-DEV-05) |

**La suma de las tres no puede superar lo pendiente.** El campo «En buen estado»
acepta como máximo lo pendiente menos lo que ya lleva dañada y perdida. Si se supera,
el campo se marca y el resumen se pone en rojo: «Has asignado 3 unidades pero solo
quedan 2 pendientes». No se permite guardar (RF-DEV-08).

**Dejar la cantidad a cero es una decisión válida** y significa «esto sigue fuera».
No es «no he escrito nada». Por eso el total de pendientes se recalcula en vivo y
se ve en el resumen.

### 6.6 Cuando el artículo tiene control individual

Si el préstamo contiene unidades con código, en lugar de los tres campos numéricos
aparece la lista de unidades del artículo con su código y su estado actual:

```
  Olla grande  (2 prestadas)
    OLG-003   Prestada    [ En buen estado ▾ ]
    OLG-004   Dañada      [ En buen estado ▾ ]     ← ya venía dañada del depósito
```

- Cada unidad se resuelve por separado (RF-DEV-10).
- La unidad `OLG-004` ya estaba dañada, así que su selector solo ofrece «En buen
  estado» y «Perdida»: no se puede empeorar un daño que ya está registrado.
- Al pie, el mismo resumen: unidades que vuelven, que estaban dañadas y que se
  pierden.

### 6.7 Incidentes generados por la devolución

Cuando Sonia marca «dañada» o «perdida», se genera un incidente. **El estudiante solo
se asocia si Sonia lo marca explícitamente** (RF-DEV-05, RF-DEV-09). Por defecto el
incidente queda «sin determinar» y el sistema no atribuye la responsabilidad a nadie
por omisión.

| Campo | Obligatorio | Comportamiento |
|-------|-------------|----------------|
| Tipo | Sí | Daño o pérdida, derivado de lo que Sonia marcó |
| Artículo y unidades | Sí | Los mismos que está devolviendo |
| Préstamo | Sí | El préstamo que se está cerrando |
| Responsable | **No** | Casilla «La responsabilidad es de este estudiante». Sin marcar, queda sin determinar |
| Descripción | No | Texto de 200 caracteres. Ejemplo: «Se rompió al caer en la práctica» |
| Procedimiento | No | Si se marcó responsable: «Sonia lo determina y lo escribe aquí» |

**La última fila es deliberadamente ambigua y no es parte de este diseño.** Se
documenta aquí solo para recordar que la atribución de responsabilidad es una
pregunta abierta (ver `REQUIREMENTS.md`, preguntas para Sonia) y que el formulario
tiene que estar preparado para recogerla sin suponerla.

### 6.8 Estados

| Estado | Comportamiento |
|--------|----------------|
| Préstamo con todo devuelto | Los tres campos quedan en 0 y deshabilitados, con el mensaje «Este préstamo ya no tiene nada pendiente». El botón pasa a «Cerrar y registrar devolución» si queda algún incidente |
| Sin devoluciones registradas | Estado vacío del historial, con «No hay devoluciones registradas para este préstamo» |
| Estudiante inactivo | **La devolución se permite.** Bloquearla dejaría unidades atrapadas fuera de la facultad sin salida. Solo el préstamo nuevo queda bloqueado |

---

## 7. Reportes

### 7.1 Propósito

Consultar el historial y sacar las cifras que Sonia necesita para justificar una
decisión o entregar un conteo.

No es una pantalla de auditoría. Es una pantalla de consulta con filtros y, cuando
haga falta, exportación.

### 7.2 Requisitos que cubre

RF-REP-01, RF-REP-02, RF-REP-03, RF-REP-04, RF-REP-05, RF-REP-06, y las cifras de
inventario que el prompt sitúa también aquí (contradicción C-3 de `UI_DESIGN.md`).

### 7.3 Estructura

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│  Reportes                                                                        │
│  Histórico y estadísticas                                                        │
├───────────────────────────────────────────────────────────────────────────────────┤
│  [ Préstamos ]  [ Devoluciones ]  [ Inventario ]                                   │
├───────────────────────────────────────────────────────────────────────────────────┤
│  Filtros:  Estudiante [ Todos ▾ ]  Desde [ __/__/____ ]  Hasta [ __/__/____ ]   │
│            Estado [ Todos ▾ ]   Categoría [ Todas ▾ ]        [ Aplicar ] [ ⋯ ]    │
├───────────────────────────────────────────────────────────────────────────────────┤
│  [ Exportar CSV ]  [ Exportar PDF ]  (deshabilitados si no hay resultados)        │
├───────────────────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────────┐  ┌──────────────────┐  │
│ │ Folio         Estudiante      Fecha   Estado   Comet.  │  │  Resumen         │  │
│ │                                                       │  │  ──────────────  │  │
│ │ PRE-2026-000012  Ana Ramírez  12/09/2026  Cerrado  — │  │  Préstamos: 12   │  │
│ │ PRE-2026-000011  Bruno Díaz   10/09/2026  Cerrado  — │  │  Activos:    7   │  │
│ │ PRE-2026-000010  Carla Mend.  05/09/2026  Anulado  — │  │  Cerrados:   4   │  │
│ │                                                       │  │  Anulados:   1   │  │
│ │                                                       │  │                  │  │
│ │                                                       │  │  Unidades       │  │
│ │                                                       │  │  prestadas: 44   │  │
│ │                                                       │  │  devueltas: 36   │  │
│ │                                                       │  │  pendientes:  8   │  │
│ │                                                       │  │  dañadas:     1   │  │
│ │                                                       │  │  perdidas:    0   │  │
│ └───────────────────────────────────────────────────────┘  └──────────────────┘  │
│  3 préstamos de 3                                                 (zona apoyo)  │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### 7.4 Filtros

Los cuatro filtros de RF-REP-02 y RF-REP-06, **combinables** y con rango de fechas
**inclusivo**:

| Filtro | Comportamiento |
|--------|----------------|
| Estudiante | Selector con búsqueda. Se llena desde el buscador de la pantalla Estudiantes |
| Desde / Hasta | Fechas. Ambas incluidas en el rango (RF-REP-02). Si «Desde» es posterior a «Hasta», se avisa en línea y no se aplica |
| Estado | Activo / Cerrado / Anulado, con pastilla de color en el propio selector (RF-REP-03) |
| Categoría | Artículos de esa categoría y subcategorías |

Los filtros **no se aplican solos** mientras Sonia escribe: hay un botón «Aplicar».
Aplicarlos en cada pulsación con tres filtros sería una consulta por tecla, y en un
equipo modesto eso se nota. El botón «Aplicar» muestra un contador: «Aplicar (2)»
cuando hay dos filtros sin aplicar.

**Los filtros activos se muestran como etiquetas debajo de la barra**, cada una con
su «×» para quitarla. Es la forma de que Sonia sepa qué está viendo, sin tener que
recordar qué filtro dejó puesto.

### 7.5 Pestaña Inventario

Las estadísticas agregadas del inventario, que el prompt sitúa también aquí. Se
distingue del Panel en granularidad: el Panel cuenta el estado de **ahora**, y esta
pestaña cuenta **el periodo filtrado**.

| Fila | Contenido |
|------|-----------|
| Por categoría | Artículos y unidades por categoría, con disponible, prestado, dañado y faltante |
| Por estado de unidad | Recuento de unidades en cada estado, en porcentaje sobre el total |
| Movimientos del periodo | Entradas y salidas por tipo de movimiento, con el total de unidades |
| Artículos con más movimientos | Los diez primeros, ordenados de más a menos |

**Ninguna cifra de esta pestaña es inventada.** Si el periodo no tiene movimientos,
la tabla lo dice con un estado vacío. **No hay gráficos**: con cuatro o cinco filas
por categoría, una tabla se lee más rápido que un diagrama, y no obliga a Sonia a
interpretar un eje.

### 7.6 Exportación

| Botón | Estado | Requisito |
|-------|--------|-----------|
| **Exportar CSV** | Habilitado solo si hay resultados | RF-REP-05. CSV compatible con Excel, con los mismos datos y el mismo orden que la tabla, respetando los filtros activos |
| **Exportar PDF** | Habilitado solo si hay resultados | RF-REP-04. La arquitectura lo permite; la implementación está prevista en una etapa posterior. La librería sigue sin decidir (D-05) |

**El nombre del archivo se propone y Sonia lo puede cambiar.** Propuesta:
`stocklend_prestamos_2026-09-12_2026-09-25.csv`, con el rango de fechas del filtro.
**El CSV se escribe con codificación UTF-8 y separador `;`**, que es lo que Excel en
español abre sin preguntar nada.

**Los botones de exportación son deshabilitados, no ocultos, cuando no hay
resultados.** Sonia ve que la función existe y por qué no puede usarla. Si se
ocultaran, parecería que la aplicación no puede exportar.

### 7.7 Estados

| Estado | Qué se ve |
|--------|-----------|
| Sin resultados | «Ningún préstamo coincide con estos filtros», con los filtros enumerados y un botón «Quitar filtros» |
| Resultados | La tabla, con la zona de apoyo mostrando el resumen de lo filtrado |
| Rango inválido | Aviso en línea bajo los campos de fecha: «La fecha inicial es posterior a la final. Corrige el rango.» No se deshabilita el botón; se explica |
| Sin filtros | Todos los préstamos, ordenados por fecha descendente |
| Zona de apoyo oculta | Por debajo de 1200 px, el resumen pasa a un botón «Ver resumen» que abre un diálogo |

---

## 8. Incidentes (sección secundaria)

### 8.1 Propósito

Registrar y seguir pérdidas y daños, con o sin responsable identificado. Es la
sección que responde «¿qué se perdió en la facultad y a quién se le avisó?».

### 8.2 Requisitos que cubre

RF-DEV-05, RF-DEV-09, RF-DEV-10, RF-ALA-02, RF-ALA-04.

### 8.3 Estructura

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│  Incidentes                                              (2 abiertos)  [ + Nuevo ] │
│  Pérdidas, daños y roturas registradas                                            │
├───────────────────────────────────────────────────────────────────────────────────┤
│ [ Buscar… ]  Tipo [ Todos ▾ ]  Estado [ Abiertos ▾ ]  Procedencia [ Todas ▾ ]    │
├───────────────────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────────┐  ┌──────────────────┐  │
│ │ Fecha   Artículo        Tipo  Procedencia  Resp.     │  │  INC-2026-0007   │  │
│ │                                                      │  │  ──────────────  │  │
│ │ 12/09/26  Olla grande   Daño   Préstamo   Ana R.      │  │  Daño            │  │
│ │ 10/09/26  Paño          Pérdida Depósito  Sin det.    │  │  Olla grande     │  │
│ │ 05/09/26  Olla pequeña  Daño   Préstamo   Bruno D.    │  │  2 unidades     │  │
│ │                                                      │  │                  │  │
│ │                                                      │  │  Procedencia:    │  │
│ │                                                      │  │  Préstamo        │  │
│ │                                                      │  │  PRE-2026-000012 │  │
│ │                                                      │  │                  │  │
│ │                                                      │  │  Responsable:    │  │
│ │                                                      │  │  Ana Ramírez     │  │
│ │                                                      │  │                  │  │
│ │                                                      │  │  [ Marcar        │  │
│ │                                                      │  │    resuelto ]    │  │
│ └───────────────────────────────────────────────────────┘  └──────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### 8.4 Columnas y filtros

| Columna | Contenido | Nota |
|---------|-----------|------|
| Fecha | Fecha de registro | |
| Artículo | Nombre y unidades afectadas | Con el código de unidad si el artículo tiene control individual (RF-DEV-10) |
| Tipo | Daño / Pérdida | Pastilla ámbar o roja |
| Procedencia | Depósito / Préstamo / Devolución | **Clave para entender el caso**: no es lo mismo algo que se rompió en la facultad que algo que volvió roto de un préstamo (RF-DEV-05) |
| Responsable | Nombre o **«Sin determinar»** | Nunca vacío. «Sin determinar» es un valor explícito, no una falta de datos (RF-DEV-09) |
| Estado | Abierto / Resuelto | Pastilla |
| ⋯ | Menú de fila | Ver detalle, marcar resuelto, reabrir |

Filtros: por tipo, por estado (por defecto «abiertos», que es lo que Sonia viene a
mirar) y por procedencia. El contador de la barra lateral es el de incidentes
**abiertos** (RF-ALA-04).

### 8.5 Incidente sin estudiante, la regla

`DATABASE_DESIGN.md` define que el estudiante del incidente es opcional, y
RF-DEV-09 exige que exista el caso «pérdida en la facultad sin estudiante
asociado». La interfaz lo materializa así:

- El campo «Responsable» es una casilla: «La responsabilidad es de este
  estudiante».
- **Sin marcar, el campo de estudiante ni siquiera se muestra.** Se esconde en vez
  de aparecer vacío, para que no parezca un formulario mal rellenado.
- Con la casilla marcada, aparece el buscador de estudiante.
- La columna «Responsable» muestra **«Sin determinar»** con estilo neutro. Nunca
  queda en blanco, porque un blanco parece un dato ausente por error.
- El filtro «Procedencia: Depósito» es la forma de encontrar los casos de la
  facultad que no tienen Prestamo asociado.

### 8.6 Estados

| Estado | Comportamiento |
|--------|----------------|
| Sin incidentes | «Todavía no hay incidentes registrados» y «Registrar el primero» |
| Filtro «abiertos» vacío | «No hay incidentes abiertos. Todos los registrados están resueltos» |
| Incidente resuelto | Fila atenuada al 70 %, con la fecha de resolución en la zona de apoyo |

---

## 9. Respaldo (sección secundaria)

### 9.1 Propósito

Que Sonia pueda hacer una copia de la base de datos y recuperar una anterior, sin
necesitar saber nada de SQLite ni del sistema operativo.

### 9.2 Requisitos que cubre

RNF-13 (copia y restauración disponibles), RNF-12 (los datos sobreviven a
actualización y desinstalación), RNF-11 (la base vive fuera de la carpeta del
ejecutable).

### 9.3 Estructura

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│  Respaldo                                                                          │
│  Copias de seguridad de la base de datos                                          │
├───────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │  Última copia: hace 3 días, 18/09/2026 18:40 · 2,1 MB                     │  │  │
│  │                                                                             │  │
│  │  [ Crear copia ahora ]                              [ Abrir carpeta… ]      │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │  Copias disponibles                                                          │  │
│  │                                                                             │  │
│  │  25/09/2026 18:40   2,1 MB   [ Restaurar ] [ Mostrar ruta ]                  │  │
│  │  18/09/2026 18:40   2,1 MB   [ Restaurar ] [ Mostrar ruta ]                  │  │
│  │  11/09/2026 18:40   2,0 MB   [ Restaurar ] [ Mostrar ruta ]                  │  │
│  │  04/09/2026 18:40   2,0 MB   [ Restaurar ] [ Mostrar ruta ]                  │  │
│  │                                                                             │  │
│  │  Conservadas: las 10 más recientes                                           │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                   │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### 9.4 Reglas

- **Una copia al día, automática**, al abrir la aplicación. Son las 18:40 del
  ejemplo, pero la hora es la de la última copia real, no una hora fija.
- **Se conservan las 10 más recientes** y las más antiguas se borran solas. El
  número es una decisión de diseño pendiente de validar con Sonia: si el volumen de
  la facultad hace que 2 MB por copia y 10 copias ocupen demasiado, se ajusta.
- **Restaurar pide doble confirmación** y muestra, en la primera, qué se va a
  reemplazar y cuántas copias hay. La segunda pide escribir la palabra «RESTAURAR».
  Es la única acción de la aplicación que puede perder trabajo, porque sustituye la
  base actual por una anterior.
- **La ruta de la base y la de las copias se muestran siempre**, en la barra de
  estado y en un botón «Mostrar ruta». RNF-11 exige que la base esté fuera de la
  carpeta del ejecutable, y Sonia necesita poder verlo.
- **La barra de estado lleva la fecha del último respaldo**, y la entrada «Respaldo»
  del menú lateral muestra un aviso si no hay copia en más de siete días.

---

## 10. Configuración (sección secundaria)

### 10.1 Propósito

Los ajustes que cambian el comportamiento de la aplicación, en un solo sitio y sin
ocultarlos en un diálogo que nadie encuentra.

### 10.2 Requisitos que cubre

RF-INV-08 (control individual por artículo, que se activa desde Inventario pero se
resume aquí), RNF-11 (ruta de la base), RNF-18, y las preferencias de interfaz.

### 10.3 Secciones

Configuración son tres pestañas, no una pantalla con veinte campos.

**Preferencias de inventario**

| Ajuste | Tipo | Valor por defecto | Efecto |
|--------|------|-------------------|--------|
| Control individual por artículo | Por artículo | Desactivado | Ver RF-INV-08 |
| Aviso si no hay existencias suficientes | Casilla | Activado | Aviso al buscar en un préstamo |
| Confirmar antes de ajustes de cantidad | Casilla | Activado | RNF-02. Desactivarla reduce pasos, a costa de confirmar menos |

**Apariencia**

| Ajuste | Tipo | Valor por defecto |
|--------|------|-------------------|
| Tamaño de fuente | Selector | La del sistema |
| Vista de densidad de tabla | Selector | Normal |
| Conservar tamaño y posición de ventana | Casilla | Activado |

**Datos y mantenimiento**

| Ajuste | Contenido |
|--------|-----------|
| Ruta de la base de datos | Solo lectura, con botón «Abrir carpeta» y «Copiar ruta» (RNF-11) |
| Número de esquema | Solo lectura |
| Integridad de la base | Botón «Comprobar ahora» que ejecuta `PRAGMA integrity_check` y dice el resultado en español |
| Mantenimiento | Enlace a Respaldo |

**Lo que Configuración no tiene.** No hay tema oscuro, no hay opción de idioma, no
hay cuenta de usuario, no hay ajustes de red. La aplicación es local y en español
(RNF-09, RNF-20, RNF-01), así que esas opciones serían decorativas.

---

## 11. Categorías

No es una entrada del menú lateral, sino una pestaña de Inventario. Se documenta
aparte porque es el caso particular de la contradicción C-1.

### 11.1 Requisitos

RF-INV-02: categorías con nombre único, sin duplicados.

### 11.2 Estructura

```
┌───────────────── Categorías ─────────────────────────────────────────────────────┐
│                                                                                   │
│  ┌───────────────────────────────────────────────────────┐  ┌──────────────────┐  │
│  │ Categoría              Artículos   Unidades          │  │  Añadir           │  │
│  │                                                       │  │                  │  │
│  │ Utensilios · Ollas              3        24           │  │  Nombre          │  │
│  │ Utensilios · Cuchillos           1         6           │  │  [ __________ ]  │  │
│  │ Limpieza                         4        11           │  │                  │  │
│  │ reactingivos de laboratorio       2         4           │  │  [ Añadir ]      │  │
│  │                                                       │  │                  │  │
│  └───────────────────────────────────────────────────────┘  └──────────────────┘  │
│  4 categorías                                                                  │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### 11.3 Reglas

- **El nombre es único, con mayúsculas y espacios ignorados** al comparar. Crear
  «utensilios · ollas» cuando ya existe «Utensilios · Ollas» se rechaza con un
  mensaje que lo explica (RF-INV-02).
- **No se borra una categoría con artículos asignados.** El botón está deshabilitado
  con el motivo al lado: «Esta categoría tiene 3 artículos. Muévelos a otra
  categoría antes de eliminarla».
- **La categoría admite dos niveles separados por « · »**, que es la convención que
  ya usa el modelo. No hay un árbol de subcategorías con niveles ilimitados, porque
  el modelo no lo tiene.
- **Alta en línea, sin diálogo**: un campo y un botón. Crear una categoría es una
  operación de un solo campo, así que no merece un formulario modal.

---

## 12. Resumen de cobertura

Cada requisito funcional tiene una pantalla y un lugar en ella. Esta tabla es la
comprobación de que no se ha olvidado nada.

| Requisito | Pantalla | Dónde se ve |
|-----------|----------|-------------|
| RF-DAS-01 | Panel | Tarjeta «Artículos registrados» |
| RF-DAS-02 | Panel | Tarjeta «Disponibles» |
| RF-DAS-03 | Panel | Tarjeta «Préstamos activos» |
| RF-DAS-04 | Panel | Tarjeta «Pendientes de devolución» |
| RF-DAS-05 | Panel | Tarjeta «Incidentes abiertos» |
| RF-DAS-06 | Panel | Regla general: cero en base vacía, sin datos de ejemplo |
| RF-REP-01 | Reportes | Pestaña Préstamos |
| RF-REP-02 | Reportes | Filtros de estudiante y rango de fechas |
| RF-REP-03 | Reportes, Préstamos | Columna Estado con pastilla |
| RF-REP-04 | Reportes | Botón «Exportar PDF» |
| RF-REP-05 | Reportes | Botón «Exportar CSV» |
| RF-REP-06 | Reportes | Filtros de estado y categoría |
| RF-ALA-01 | Panel | Lista «Préstamos que necesitan atención» |
| RF-ALA-02 | Panel, Incidentes | Dos listas separadas; «Procedencia» en el listado de incidentes |
| RF-ALA-03 | Panel, Préstamos | Sin etiqueta «vencido» en ninguna columna |
| RF-ALA-04 | Navegación | Insignia de Incidentes en la barra lateral |
| RF-INV-01 | Inventario | Pestaña Artículos y formulario de artículo |
| RF-INV-02 | Inventario | Pestaña Categorías |
| RF-INV-03 | Inventario | Columnas de cantidad y formulario de ajuste |
| RF-INV-04 | Inventario, Préstamos | Buscador incremental, también por código de unidad |
| RF-INV-05 | Inventario | Las cuatro cantidades visibles, siempre |
| RF-INV-06 | Inventario | Formulario de ajuste con motivo obligatorio |
| RF-INV-07 | Préstamos | Máximo de cantidad calculado, con mensaje al superarlo |
| RF-INV-08 | Inventario, Préstamos, Configuración | Casilla en el artículo, selector por unidad en el préstamo |
| RF-INV-09 | Inventario | Columna «Prestable» y filtro |
| RF-INV-10 | Inventario | Pestaña Unidades y códigos por fila |
| RF-INV-11 | Incidentes | Procedencia «Depósito», sin estudiante |
| RF-EST-01 | Estudiantes | Formulario de estudiante |
| RF-EST-02 | Estudiantes | Unicidad del código, con error explícito |
| RF-EST-03 | Estudiantes | Búsqueda parcial e insensible a mayúsculas |
| RF-EST-04 | Estudiantes | Zona de apoyo y «Ver ficha» |
| RF-EST-05 | Estudiantes | Menú de fila «Editar» |
| RF-EST-06 | Estudiantes | Marca «Inactivo» en vez de borrado |
| RF-PRE-01 | Préstamos | Paso 1 del formulario |
| RF-PRE-02 | Préstamos | Campo de fecha y hora, prellenado |
| RF-PRE-03 | Préstamos | Lista de artículos acumulados en el paso 2 |
| RF-PRE-04 | Préstamos | Aviso de pendientes, sin bloqueo |
| RF-PRE-05 | Préstamos | La disponibilidad baja en la misma transacción |
| RF-PRE-06 | Préstamos | Columna Folio, no editable |
| RF-PRE-07 | Préstamos | Menú de fila «Anular», con doble confirmación |
| RF-PRE-08 | Préstamos | Filtro por estado y por estudiante |
| RF-PRE-09 | Préstamos | Campo de comentario opcional |
| RF-DEV-01 | Devoluciones | Cabecera fija con estudiante y préstamo |
| RF-DEV-02 | Devoluciones | Una sola pantalla, total y parcial |
| RF-DEV-03 | Devoluciones | Cantidad y condición en la misma fila |
| RF-DEV-04 | Devoluciones | Cantidad pendiente calculada, campo de cantidad devuelta |
| RF-DEV-05 | Devoluciones | Columnas «Dañada» y «Perdida», incidente asociado |
| RF-DEV-06 | Devoluciones | Registro único e inmutable al guardar |
| RF-DEV-07 | Devoluciones | Aviso previo en el resumen: «pasará a Cerrado» |
| RF-DEV-08 | Devoluciones | Máximo visible y resumen en rojo al superarlo |
| RF-DEV-09 | Incidentes | Procedencia «Depósito», responsable «Sin determinar» |
| RF-DEV-10 | Devoluciones, Incidentes | Selector por código de unidad |
| RF-DEV-11 | Devoluciones, Panel | «Pendiente de devolución» nunca se muestra como pérdida |

---

## 13. Lo que estas pantallas no resuelven

- **El diseño de la atribución de responsabilidad.** El formulario tiene hueco, pero
  el procedimiento concreto sigue siendo una pregunta abierta para Sonia.
- **La periodicidad del inventario físico.** Ninguna pantalla la necesita, porque
  ningún requisito la define.
- **El formato del PDF.** El botón existe porque RF-REP-04 lo pide; la librería
  sigue sin decidirse (D-05).
- **La exportación de la ficha de estudiante**, que no está entre los requisitos
  aunque sería útil. No se diseña lo que no se ha pedido.
