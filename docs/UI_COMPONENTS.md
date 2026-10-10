# StockLend — Catálogo de componentes

> **Estado del documento:** propuesta de diseño. **Ningún componente está
> implementado.** No hay clases de PySide6, ni hojas de estilo, ni recursos en el
> repositorio. Este documento es la especificación que habría que maquetar.
>
> El lenguaje visual del que dependen estos componentes está en `UI_DESIGN.md`. Las
> pantallas donde se usan están en `UI_SCREENS.md`.

---

## 1. Reglas comunes

### 1.1 Qué significa «reutilizable»

Un componente entra en este catálogo si cumple las tres condiciones:

1. Se usa en **dos o más** pantallas, o en dos o más lugares de la misma pantalla.
2. Encaja en un `QWidget` propio, sin lógica de negocio.
3. Su aspecto y su comportamiento se pueden describir por completo aquí.

Un widget que solo se usa en un sitio no se documenta aquí: se documenta dentro de
la pantalla correspondiente, en `UI_SCREENS.md`.

### 1.2 Reglas que valen para todos

| Regla | Detalle |
|-------|---------|
| **Un solo origen de verdad** | Todos los valores salen de los tokens de `UI_DESIGN.md` sección 3. Ningún componente escribe un color o una medida literal |
| **El nombre de objeto es estable** | Cada componente tiene un `objectName` fijo, para que `pytest-qt` lo encuentre sin depender del texto visible |
| **Todo es alcanzable con teclado** | Foco, activación con `Enter` o `Espacio`, y anillo de foco visible en todos los estados |
| **El estado vacío es parte del componente** | Ningún componente se responsabiliza de inventar su propio mensaje de vacío: usa `EmptyState` |
| **Nada de texto en un icono** | Un icono sin texto visible necesita nombre accesible; un icono visible sin texto, no |
| **Cifras tabulares** | Todo componente que muestre cantidades usa cifras de ancho fijo |
| **Altura fija** | Las alturas de `UI_DESIGN.md` 3.5 no se negocian por componente |

### 1.3 Inventario

| # | Componente | Tipo | Pantallas |
|---|------------|------|-----------|
| 1 | `SectionHeader` | Estructural | Todas |
| 2 | `StatCard` | Presentación | Panel, Reportes |
| 3 | `DataTable` | Presentación | Todas las de listado |
| 4 | `QuantityCell` | Presentación | Inventario, Préstamos, Devoluciones, Reportes |
| 5 | `StatusChip` | Presentación | Inventario, Préstamos, Devoluciones, Incidentes |
| 6 | `UnitCodeBadge` | Presentación | Inventario, Préstamos, Devoluciones, Incidentes |
| 7 | `SearchBar` | Entrada | Todas las de listado |
| 8 | `FilterBar` | Entrada | Reportes, Inventario |
| 9 | `FormField` | Entrada | Todos los formularios |
| 10 | `QuantityInput` | Entrada | Préstamos, Devoluciones, Inventario |
| 11 | `UnitSelector` | Entrada | Préstamos, Devoluciones, Inventario |
| 12 | `TextArea` | Entrada | Formularios de nota y comentario |
| 13 | `Toolbar` | Estructural | Todas las de listado |
| 14 | `TabBar` | Estructural | Inventario, Reportes, Configuración |
| 15 | `DetailPanel` | Estructural | Inventario, Estudiantes, Préstamos, Incidentes |
| 16 | `KeyValueList` | Presentación | `DetailPanel`, diálogos de ficha |
| 17 | `EmptyState` | Estado | Todas |
| 18 | `InlineNotice` | Estado | Todas |
| 19 | `ConfirmDialog` | Diálogo | Todas |
| 20 | `FormDialog` | Diálogo | Todos los formularios |
| 21 | `Toast` | Estado | Todas |
| 22 | `RowMenu` | Entrada | Todas las tablas |
| 23 | `CountBadge` | Presentación | Navegación |
| 24 | `LoadingSkeleton` | Estado | Todas |
| 25 | `Button` | Entrada | Todas |

---

## 2. Componentes estructurales

### 2.1 `SectionHeader`

La cabecera de contenido de cada pantalla: título, subtítulo y acción principal.

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  Préstamos                                                       [ + Préstamo ]  │
│  Registro de entregas a estudiantes                                             │
└────────────────────────────────────────────────────────────────────────────────┘
```

| Parte | Token | Regla |
|-------|-------|-------|
| Título | `titulo_seccion` | Título de la sección, en plural, sin el verbo |
| Subtítulo | `secundario` | Una frase que dice qué se hace aquí. Opcional |
| Acción | `Button` primario | **Una sola acción primaria por pantalla**, siempre a la derecha |
| Relleno | — | 24 px arriba y abajo, 32 px a los lados |

**Reglas**

- El título **no cambia** al filtrar ni al seleccionar. La sección es la sección.
- Si una pantalla necesita dos acciones de peso similar, la segunda va en
  `Toolbar`, no en la cabecera.
- El subtítulo no supera una línea. Si no cabe, se quita: un subtítulo largo es
  un párrafo, y aquí no cabe.

| Qt | Notas |
|----|-------|
| `QWidget` con `QHBoxLayout` + dos `QLabel` | Sin `QHeaderView` ni barras de Qt. El aspecto nativo rompe el tema |

### 2.2 `Toolbar`

La fila de herramientas de un listado: buscador, filtros y acciones.

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ [ Buscar…                          ]   Categoría [ Todas ▾ ]    [ + Artículo ]  │
└────────────────────────────────────────────────────────────────────────────────┘
```

| Regla | Detalle |
|-------|---------|
| Búsqueda a la izquierda | Ocupa el ancho sobrante, con un mínimo de 200 px |
| Filtros en el centro | Cada uno con su etiqueta, uno al lado del otro |
| Acción principal a la derecha | Alineada con la acción de `SectionHeader` |
| Altura | 36 px, la de los campos |
| Separación inferior | 1 px, `borde_suave` |
| Sin separadores verticales | Los grupos se distinguen por el espacio, no por líneas |

**Si no cabe en 1024 px**, los filtros pasan a una fila segunda, que se pliega tras
«Filtros (2)». Nunca se ocultan filtros sin avisar.

| Qt | Notas |
|----|-------|
| `QWidget` con `QHBoxLayout` | **No usar `QToolBar`**: su comportamiento de arrastre y su aspecto nativo no son los del diseño |

### 2.3 `TabBar`

Pestañas dentro de una pantalla. Se usa en Inventario, Reportes y Configuración.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Artículos  │  Unidades  │  Categorías                             │
│  ══════════  │            │                                          │
└──────────────────────────────────────────────────────────────────────┘
```

| Estado | Indicador |
|--------|-----------|
| Activa | Texto en `texto`, peso 600, y una línea de 2 px en `azul_primario` bajo la etiqueta |
| Inactiva | Texto en `texto_secundario` |
| Foco de teclado | Anillo de foco alrededor de la etiqueta completa |
| Con contenido que requiere atención | Punto de 6 px en `advertencia` a la derecha de la etiqueta, con nombre accesible que lo explique |

**La línea de la pestaña activa va debajo, no detrás.** Detrás reduces el contraste
del texto de la pestaña activa, y además es la convención de las pestañas del
sistema, contra la que el ojo ya está entrenado.

| Qt | Notas |
|----|-------|
| `QTabWidget` con `setDocumentMode(True)` y `setDrawBase(False)` | Es el camino corto: con esos dos ajustes, el aspecto se controla desde QSS |

### 2.4 `DetailPanel`

La zona de apoyo: el contexto de lo que está seleccionado, sin salir de la sección.

```
┌──────────────────┐
│  Olla grande     │  título
│  ──────────────  │
│  Control por     │
│  unidad: activo  │  datos
│                  │
│  10 unidades     │
│   8 disponibles   │
│   1 prestada     │
│   1 dañada        │
│                  │
│  [ Registrar     │  acción
│    incidencia ]  │
└──────────────────┘
```

| Regla | Detalle |
|-------|---------|
| Título | El nombre del elemento seleccionado, en `subtitulo` |
| Separador | 1 px, `borde_suave`, con 12 px de espacio a cada lado |
| Contenido | `KeyValueList` y, si cabe, una tabla corta |
| Acción | **Una sola**, al pie, con 24 px de separación. Nunca más de una |
| Sin selección | Estado vacío: «Selecciona una fila para ver su detalle» |
| Ancho | 320–360 px, fijo |
| Por debajo de 1200 px de ventana | Se oculta; su contenido pasa a un diálogo con el botón que lo abría |

**`DetailPanel` no es un diálogo disfrazado.** Si al ocultarse su contenido se
pierde, es que la acción cabía mejor dentro de la tabla. Se comprueba en la prueba
de maquetado a 1024 px.

| Qt | Notas |
|----|-------|
| `QWidget` con `QVBoxLayout` dentro de un `QSplitter` fijo | Con `setStretchFactor(0, 0)` para que no crezca al ensanchar |

### 2.5 `Button`

Cinco variantes, y solo cinco. Si aparece una sexta, es que una de las cinco hace
dos trabajos.

| Variante | Aspecto | Uso | Ancho |
|----------|---------|-----|-------|
| **Primaria** | Relleno `azul_primario`, texto blanco | La acción principal de la pantalla o del diálogo | Contenido + 32 px, mínimo 96 px |
| **Secundaria** | Fondo `superficie`, borde `borde_fuerte`, texto `azul_primario` | Acciones secundarias, alternativa a la primaria | Idéntico |
| **Terciaria** | Sin fondo ni borde, texto `azul_primario` | Acciones terciarias, enlaces de acción, «Quitar filtros» | Contenido + 16 px |
| **Destructiva** | Relleno `error`, texto blanco | Anular, dar de baja, eliminar, restaurar | Contenido + 32 px |
| **De icono** | Cuadrado de 36 px, sin texto | Fila de tabla, cerrar diálogo | 36 × 36 px |

| Estado | Primaria | Terciaria | De icono |
|--------|----------|-----------|----------|
| Reposo | `azul_primario` | Sin fondo | Sin fondo |
| Ratón encima | `azul_primario_hover` | Fondo `azul_claro` | Fondo `borde_suave` |
| Pulsado | `azul_primario_oscuro` | Fondo `azul_claro` | Fondo `borde_suave` |
| Foco | Anillo de 2 px, 2 px de separación | Igual | Igual |
| Deshabilitado | Fondo `borde_suave`, texto `texto_secundario` al 60 % | Sin fondo, texto al 45 % | Igual |
| En curso | Se deshabilita y muestra un indicador a la izquierda; **conserva el ancho** | — | — |

**Reglas**

- **El botón de icono siempre lleva nombre accesible.** Un «×» sin nombre es
  inaccesible y además ambiguo: puede ser cerrar, cancelar o eliminar.
- **El botón conserva su ancho cuando entra en estado «en curso».** Si el texto
  desaparece y aparece un indicador, la tabla se descuadra y Sonia hace clic donde
  no era. Es el error más frecuente en interfaces de escritorio.
- **Un botón destructivo dice lo que hace.** «Anular préstamo», no «Aceptar».
- **El botón deshabilitado explica por qué** con un texto al lado. Un botón gris sin
  explicación obliga a adivinar.
- Alto: 36 px. Solo el botón principal de una pantalla vacía usa 44 px.

| Qt | Notas |
|----|-------|
| `QPushButton` con QSS | Los iconos de `QPushButton` no admiten color, así que el indicador de progreso es un `QLabel` hermano dentro de un `QWidget` contenedor |

---

## 3. Componentes de presentación

### 3.1 `StatCard`

Una cifra real con su etiqueta y su unidad. Es el componente que más riesgo tiene de
convertir el Panel en un tablero de publicidad, y por eso tiene reglas duras.

```
┌─────────────┐
│     142     │  dato_destacado, cifras tabulares
│  artículos  │  etiqueta
│  registrados│
│             │
│  12 con     │  texto de apoyo, texto_secundario
│  control    │
│  individual │
└─────────────┘
```

| Regla | Detalle |
|-------|---------|
| Cifra | `dato_destacado`, semibold, cifras tabulares, alineada a la izquierda |
| Etiqueta | `secundario`, una o dos líneas, siempre en el singular o en la unidad concreta («artículos», «unidades», «préstamos») |
| Texto de apoyo | `secundario`, una línea, opcional. Es donde va el desglose, no una cifra más |
| Relleno | 20 px |
| Alto | Fijo, 132 px. **Las cinco tarjetas del Panel miden lo mismo**, para que el Panel se lea como una fila y no como cinco cajas distintas |
| Fondo | `superficie`, borde de 1 px `borde`, radio `radio_l`, `sombra_nivel_1` |
| Interacción | Si la cifra lleva a otra sección, la tarjeta entera es clicable y tiene anillo de foco. Si no lleva a ningún sitio, no parece clicable |

**Prohibido**

- Poner un porcentaje grande sin decir de qué es porcentaje.
- Poner una cifra que no salga de la base, ni un valor de ejemplo (RF-DAS-06).
- Usar color en la cifra para «marcar» el estado. Si una cifra es un problema, lo
  dice el texto de apoyo.
- Poner más de un dato_destacado en la misma tarjeta.

| Qt | Notas |
|----|-------|
| `QFrame` con `QLabel` × 3 dentro de un `QVBoxLayout` | Con `setObjectName` propio para el test de contraste y de tamaño |

**Icono opcional (Etapa 6.5).** El constructor acepta un `icono: QPixmap` opcional que
se coloca alineado arriba a la derecha de la cifra (objectName `icono_estadistica`).
Debe ser decorativo: la cifra y la etiqueta se leen sin él. Se usa en la fila de
tarjetas de Inventario.

**`FilaEstadisticas` (Etapa 6.5).** Contenedor de tarjetas que las reflowa según el
ancho disponible: 4 columnas a partir de 820 px, 2 a partir de 420 px y 1 por debajo.
Así la fila de Inventario pasa a dos filas en pantallas pequeñas sin encoger las
cifras hasta hacerlas ilegibles. (`widgets/feedback.py`.)

### 3.2 `DataTable`

El componente central de la aplicación. Ocho de las diez pantallas son, en el fondo,
esta tabla.

```
┌──────────────────────────────────────────────────────────────────┐
│  Nombre        Categoría   Disponible  Prestado  Dañado  Total  │  cabecera
├──────────────────────────────────────────────────────────────────┤
│ ▨ Olla grande  Utensilios       8         1        1      10   │  fila
│   OLG-001 disponible · OLG-002 …                               │  segundo nivel
├──────────────────────────────────────────────────────────────────┤
│   Olla pequeña Utensilios       6         0        0       6   │  fila
└──────────────────────────────────────────────────────────────────┘
```

**Anatomía**

| Parte | Altura | Regla |
|-------|--------|-------|
| Cabecera | 40 px | Fondo `superficie`, texto `secundario` en 600. **Fija al desplazarse** |
| Fila | 40 px | Fondo `superficie`. Cifras tabulares alineadas a la derecha |
| Fila con cursor encima | 40 px | Fondo `hover_fila` |
| Fila seleccionada | 40 px | Fondo `azul_claro` y una barra de 2 px en `azul_primario` a la izquierda |
| Segundo nivel | 32 px | Texto `secundario`, sangrado 24 px, como en `UI_SCREENS.md` 3.6 |
| Pie, opcional | 40 px | «6 artículos» y el total de la selección |

**Estados**

| Estado | Comportamiento |
|--------|----------------|
| Cargando | `LoadingSkeleton` en las filas, con la altura real de 40 px, para que la tabla no salte al llegar los datos |
| Con datos | Tabla normal |
| Vacía | `EmptyState` ocupando el alto de la tabla, no una fila con el texto «sin datos» |
| Vacía por filtro | `EmptyState` con el texto del filtro y un botón «Quitar filtros» |
| Error | `InlineNotice` de error dentro del área de la tabla, con «Reintentar» |
| Sin columnas suficientes | Si no cabe ninguna columna, la tabla avisa: «Amplía la ventana para ver todas las columnas» |

**Reglas**

- **La cabecera es el contrato de la tabla.** Si una columna no tiene un nombre
  claro, no se añade. «Otros» no es un nombre de columna.
- **Las columnas numéricas se alinean a la derecha.** Es la única forma de comparar
  magnitudes de un vistazo.
- **El orden de las columnas es fijo** y no se puede reordenar arrastrando. Una tabla
  reordenable obliga a Sonia a reconstruir la disposición mental cada vez.
- **Solo las columnas de identificación y de texto admiten tamaño variable.** Las de
  cantidad tienen ancho fijo (90 px), porque su contenido son cifras.
- **La selección es de una fila, o de varias con `Ctrl`, o de un rango con
  `Mayús`.** Nunca una casilla por fila: Sonia no viene a marcar veinte artículos,
  viene a mirar veinte artículos.
- **Los valores de la tabla nunca se editan en la celda.** Se edita en el formulario.
  Editar en la celda obliga a repetir las reglas de validación en otro sitio.
- **La tabla es de lectura, pero todas las acciones pasan por `RowMenu`.** Un icono
  suelto por fila obligaría a aprender un código de iconos.

**Prioridad de columnas por ancho.** Al estrechar, se ocultan por este orden, que es
el inverso al de importancia:

| Se oculta | A partir de |
|-----------|-------------|
| Columnas de texto secundario (comentario, procedencia) | 1200 px |
| Columnas de estado derivado (procedencia, «prestable») | 1100 px |
| Columnas de total | 1024 px |
| **Nunca** nombre, categoría, disponible ni pendientes | — |

| Qt | Notas |
|----|-------|
| `QTableView` + `QAbstractTableModel` | **Nunca `QTableWidget`**, que no escala y ya está descartado en `ARCHITECTURE.md` |
| Selección y resaltado | `QAbstractItemView.SelectRows` y `setAlternatingRowColors(False)`; la alternancia se hace a mano para controlar el color exacto |
| Segundo nivel de fila | Filas reales con `Qt.UserRole` que marca el nivel, no un widget dentro de la celda |
| Foco dentro de la tabla | `setFocusPolicy`, y anillo de foco dibujado en el `paint` del delegate |

### 3.3 `QuantityCell`

Una celda de cantidad, que es un caso aparte porque es la que más errores de lectura
produce.

```
  8 de 12          total y disponible, si cabe
  8                solo la cifra, si la columna es estrecha
  8/12             formato compacto, solo en reportes
```

| Regla | Detalle |
|-------|---------|
| Cifra | Cifras tabulares, alineada a la derecha |
| Unidad | Siempre visible en el inventario: «unidades», «artículos» o «prestados», en `secundario` debajo o detrás |
| Cero | Se muestra `0`, nunca una raya ni un guion. Un cero es información; un guion es ausencia de información |
| Negativo | Imposible por RN-07. Si algún día apareciera, se muestra en `error` y con signo, para que se note |
| Fragmento «de 12» | Solo en columnas anchas. Aporta el denominador, que es lo que hace falta para decidir si el stock es suficiente |
| Color | Ninguno por defecto. Se usa `exito` si es mayor que 0, `advertencia` si es 0, `error` solo si es un faltante confirmado. **El número está siempre al lado** |

| Qt | Notas |
|----|-------|
| `QStyledItemDelegate` con `Qt.TextAlignRight` y fuente tabular en el `QFont` del rol | El texto se compone en el modelo, no en el delegate, para que el mismo dato sirva para exportar |

### 3.4 `StatusChip`

La pastilla de estado. Es donde se materializa la regla «el color nunca es el único
portador de información».

```
  ● Disponible        ● Prestada        ● Dañada        ● Faltante
```

| Estado | Texto | Texto y fondo | Fondo | Se usa en |
|--------|-------|---------------|-------|-----------|
| Correcto | Disponible, Devuelto, Cerrado, Resuelto, Sin incidencias | `exito` sobre `exito_claro` | `exito_claro` | Inventario, Devoluciones, Préstamos, Incidentes |
| Atención | Dañado, Dañada, Pendiente de devolución, Sin determinar | `advertencia_texto` sobre `advertencia_claro` | `advertencia_claro` | Inventario, Incidentes, Panel |
| Problema | Faltante, Perdido, Perdida, Anulado, Error | `error` sobre `error_claro` | `error_claro` | Inventario, Devoluciones, Préstamos |
| Neutro | Activo, Cerrado, En buen estado, **No prestable** | `texto_secundario` sobre `borde_suave` | `borde_suave` | Préstamos, Reportes, Inventario |
| Éxito (disponibilidad) | **Prestable** | `exito` sobre `exito_claro` | `exito_claro` | Inventario (columna Estado) |
| Informativo | Con control individual, Procedencia: depósito | `azul_primario` sobre `azul_claro` | `azul_claro` | Inventario, Incidentes |

**El texto de la columna «Estado» de Préstamos** usa el grupo neutro para «Activo» y
«Cerrado», y el de problema para «Anulado». Un préstamo anulado no es un error
técnico, pero sí es un estado que hay que notar.

| Regla | Detalle |
|-------|---------|
| Texto | **Siempre presente.** La pastilla sin texto es un punto de color, y un punto de color no se lee |
| Icono | Opcional, 12 px, a la izquierda. Si hay icono, **el texto sigue estando** |
| Alto | 24 px, radio `radio_s`, relleno horizontal 8 px |
| Tipografía | `secundario`, 600. En la tabla, la misma altura de línea que la fila |
| Longitud | Se recorta a 22 caracteres con puntos suspensivos, y el texto completo va en el nombre accesible. «Pendiente de devolución» sí cabe; «Pendiente de devolución de la práctica 3» no, y no debería existir |
| Mayúsculas | **No.** Una pastilla en mayúsculas grita, y en una tabla con 30 filas son 30 gritos |
| En tablas densas | Si hay más de 200 filas, se puede sustituir por el texto sin fondo, conservando el color. Menos ruido visual a costa de menos énfasis |

| Qt | Notas |
|----|-------|
| `QStyledItemDelegate` | El delegate dibuja el rectángulo redondeado y pinta el texto centrado. Es más ligero que un widget por celda, y `QTableWidget` con widgets se rompe en cuanto hay 500 filas |

**`AccionesCellDelegate` (Etapa 6.5).** Delegate de la última columna de la tabla de
Inventario: pinta el glifo `⋯` centrado en `azul_primario` y resalta el fondo cuando la
fila está bajo el cursor o seleccionada. La celda no edita nada: al pulsarla, la página
abre el mismo menú de fila que el clic derecho (`RowMenu`), de modo que todas las
acciones siguen pasando por un único sitio. El texto `⋯` vive en el modelo, para que la
exportación lo reciba igual.

### 3.5 `KeyValueList`

Pares de etiqueta y valor, el contenido habitual de `DetailPanel` y de las fichas.

```
  Control por unidad        activo
  Categoría                 Utensilios · Ollas
  Creado                    05/09/2026
```

| Regla | Detalle |
|-------|---------|
| Etiqueta | `secundario`, alineada a la izquierda, ancho fijo de 140 px |
| Valor | `cuerpo`, alineado a la izquierda, con cifras tabulares si es un número |
| Separación vertical | 8 px entre pares, 16 px entre grupos |
| Valores largos | Se envuelven. Un valor que se corta es peor que una lista más alta |
| Valores que son acción | Van como `Button` terciario al final de la fila, no como texto gris |

**En la tabla de Reportes y en los resúmenes** el par puede ir apilado: etiqueta
arriba, valor debajo. Se elige el formato según el ancho, nunca el que quede mejor.

| Qt | Notas |
|----|-------|
| `QFormLayout` con `QFormLayout.RowRole` y `setLabelAlignment` | Es exactamente el caso para el que existe. Etiqueta fija, valor elástico |

### 3.6 `CountBadge`

El contador de la barra lateral.

```
  ◷  Incidentes  2
```

| Regla | Detalle |
|-------|---------|
| Contenido | Número entero, sin signo ni separador de miles. `1`, `2`, `23`, nunca `1.234` |
| Cuándo aparece | **Solo si hay algo que requiera atención.** Si el número es 0, la insignia no existe |
| Color | Fondo `error` si son incidentes abiertos, `advertencia` si es el aviso de respaldo atrasado. Fondo `sidebar_fg` al 20 % si es informativo |
| Límite | A partir de 100 se muestra `99+`. La insignia es un aviso, no un informe |
| Accesible | Nombre accesible: «2 incidentes abiertos», no «2» |

**Nunca hay una insignia sin nada detrás.** Una insignia que dice `0` enseña a
Sonia a ignorar las insignias.

---

### 3.7 `UnitCodeBadge`

La celda de código de unidad individual (`articulo_unidad.codigo`). Está en el
catálogo de `UI_DESIGN.md` sección 7 y es la contraparte de `QuantityCell` para
los artículos con control individual: donde `QuantityCell` muestra una cifra,
ésta muestra un identificador.

```
  OLG-004                código solo, en columna estrecha
  OLG-004   ● Dañado     con su estado, si la columna lo permite
```

| Regla | Detalle |
|-------|---------|
| Fuente | Monoespaciada y alineada a la izquierda: es un identificador que se lee y se copia (`UI_SCREENS.md` 3.7) |
| Estado | Si la columna es ancha, muestra la pastilla de estado atenuada a la derecha; si no, el estado vive en la columna «Estado» |
| Selección | Un clic selecciona la fila, como el resto de la tabla. Ninguna acción extra: la copia es la selección de texto normal |
| Sin unidad | Si el artículo no tiene control individual no hay celda: la tabla de unidades tiene su propio `EmptyState` |
| Accesible | Nombre accesible = el código completo, nunca truncado |

| Qt | Notas |
|----|-------|
| `QStyledItemDelegate` | Como `QuantityCell` y `StatusChip`: dibuja texto y pastilla; el código va en el modelo para que la exportación lo sirva igual |

---

## 4. Componentes de entrada

### 4.1 `SearchBar`

El buscador incremental. Es el componente que más uso tiene en la aplicación y el
que más fácilmente se implementa mal.

```
┌──────────────────────────────────────────────┐
│  Buscar por nombre o código…            🔍   │
└──────────────────────────────────────────────┘
```

| Regla | Detalle |
|-------|---------|
| Filtro | Mientras se escribe, con 250 ms de retardo. Sin botón de buscar (RF-INV-04) |
| Qué busca | Nombre, código interno y, en Inventario, **código de unidad** (RF-INV-10) |
| Sensibilidad | Insensible a mayúsculas **y a acentos** (RF-EST-03): «Ramirez» encuentra «Ramírez» |
| Contador | A la derecha del campo: «6 de 24». Sin el, Sonia no sabe si filtró o si no hay datos |
| Estado de carga | Un indicador discreto dentro del campo, sin bloquear la escritura |
| Limpiar | Un «×» que aparece solo si hay texto. `Esc` también lo limpia |
| Ancho | Mínimo 200 px, máximo 420 px. Crece con la ventana hasta ese máximo |
| Altura | 36 px |

**Reglas que vienen de los requisitos**

- **Sin botón de buscar.** RF-INV-04 dice «sin botón adicional».
- **Con menos de 500 artículos, la respuesta tiene que ser inferior a 300 ms**
  (RNF-05). Con el retardo de 250 ms, la consulta tiene menos de 50 ms de margen:
  es un filtro en memoria, no una consulta a la base, para los listados de
  inventario y estudiantes.
- **La búsqueda no borra filtros ni cambia el modo de ordenación**, y la barra lo
  dice si los hay.

| Qt | Notas |
|----|-------|
| `QLineEdit` + `QTimer` (intervalo único, 250 ms) | El temporizador se reinicia en cada tecla. Es el patrón correcto; `keyPressEvent` con consulta directa es el que produce el tirón al teclear rápido |
| Texto de ejemplo | `setPlaceholderText`, solo como ayuda. **Nunca contiene datos de ejemplo reales** |

### 4.2 `FilterBar`

Los filtros de la barra de herramientas, y las etiquetas de filtro activo.

| Regla | Detalle |
|-------|---------|
| Composición | Etiqueta a la izquierda del control, siempre. Un filtro sin etiqueta es un menú sin significado |
| Aplicación | Con botón «Aplicar», no automática. Con contador: «Aplicar (2)» |
| Etiquetas activas | Debajo de la barra, cada filtro como etiqueta con su texto y una «×» |
| Rango de fechas | Dos campos contiguos, con «Desde» y «Hasta», y aviso en línea si el rango es inválido |
| Reiniciar | «Quitar filtros», terciario, solo visible si hay algún filtro activo |
| Colapso | Por debajo de 1024 px, los filtros pasan a «Filtros (n)», que despliega una fila adicional. **Con el número de filtros activos a la vista** |

### 4.3 `FormField`

La unidad básica de un formulario: etiqueta, campo, ayuda y error, juntos.

```
  Nombre del artículo *
  ┌──────────────────────────────────────┐
  │                                      │
  └──────────────────────────────────────┘
  Ya existe un artículo llamado «Olla grande».
```

| Regla | Detalle |
|-------|---------|
| Etiqueta | Siempre **encima** del campo (`AboveField`, decidido en `ARCHITECTURE.md`). Nunca a la izquierda: obliga a estrechar el campo |
| Obligatorio | Asterisco después de la etiqueta, y el campo con borde `borde_fuerte`. Un campo obligatorio se marca, no se explica en un pie de página |
| Ayuda | `secundario`, debajo del campo. **Ocupada siempre, aunque esté vacía**, para que el alto del campo no cambie al aparecer un error |
| Error | `error`, debajo, con icono. Aparece donde está la ayuda, sin desplazar el resto del formulario |
| Alto | Campo 36 px, más 20 px de espacio reservado para ayuda o error |
| Ancho | Fijo y limitado: 320 px para texto, 120 px para números. Un campo de 800 px para un nombre es un campo de nombre de 800 px |
| Foco | Anillo de 2 px, 2 px de separación, del color `foco` |
| Errores en bloque | No se descarga todo en rojo al enviar. **Se valida al perder el foco del campo**, campo a campo |

**El error se escribe en la frase que lo evita.** Nunca «campo inválido», nunca
«error de validación», nunca el nombre de la tabla. Un buen mensaje dice qué pasó,
qué valor era válido y cuál era el máximo.

| Qt | Notas |
|----|-------|
| `QFormLayout` en `AboveField`, o `QVBoxLayout` con etiqueta, campo y mensaje | El mensaje de error es un `QLabel` con altura fija, nunca un `setText` que cambia el alto del layout |

### 4.4 `QuantityInput`

El selector de cantidad. Es el campo donde más se equivoca la gente, y por eso lleva
el tope a la vista.

```
  ┌─────────────────────────────────────────────┐
  │  [ − ]   8   [ + ]     Disponible: 8        │
  └─────────────────────────────────────────────┘
```

| Regla | Detalle |
|-------|---------|
| Valor inicial | El mínimo válido, no 1 a ciegas. En una devolución, el valor por defecto es 0 («sigue fuera»), porque devolver es una decisión consciente |
| Mínimo y máximo | **Escrito junto al campo**, siempre. «Disponible: 8» o «Máximo 1 pendiente» |
| Teclado | Se puede escribir directamente. `↑` y `↓` suben y bajan de uno en uno |
| Al superar el máximo | El campo se marca en `error`, el valor no se acepta, y un mensaje dice el máximo. **No se recorta en silencio** |
| Saltos | Con `Ctrl` + flecha, de cinco en cinco. `Mayús` + flecha, a la máxima |
| Ancho | 120 px. Suficiente para cifras de tres dígitos y su unidad |
| Vida útil | En devoluciones, la cantidad **no se borra** al cambiar de artículo. Sonia compara con la fila anterior |

| Qt | Notas |
|----|-------|
| `QSpinBox` con `setButtonSymbols` propios, o `QLineEdit` con `QValidator` | El `QSpinBox` nativo no permite escribir un valor por encima del máximo: lo bloquea en silencio. Eso es justo el comportamiento que este diseño no quiere, así que el control es propio |

### 4.5 `UnitSelector`

El selector de unidades individuales, para artículos con control individual. Es lo que
convierte una tabla de cantidades en un inventario real.

```
  Olla grande · 8 disponibles
  ┌──────────────────────────────────────────────────┐
  │  ☑  OLG-001   Disponible                         │
  │  ☑  OLG-002   Disponible                         │
  │  ☐  OLG-003   Prestada · PRE-2026-000012         │
  │  ☐  OLG-004   Dañada · 05/09/2026                │
  └──────────────────────────────────────────────────┘
  2 unidades seleccionadas
```

| Regla | Detalle |
|-------|---------|
| Fila | Casilla, código en monoespaciado, estado con su pastilla y su contexto |
| Prestada | Casilla deshabilitada, con el motivo al lado («Prestada · PRE-2026-000012»). No se puede prestar dos veces la misma unidad |
| Dañada | Casilla deshabilitada, con «Dañada» y la fecha. Una unidad dañada no se presta |
| Faltante | No aparece en la lista de seleccionables |
| Selección | Casillas. Aquí sí, porque se elige un conjunto heterogéneo de unidades, no un rango de filas |
| Contador | «N unidades seleccionadas», actualizado en vivo |
| Capacidad | 50 unidades visibles con desplazamiento interno. Con más, se muestran las disponibles y un contador |
| Sustituto | En devoluciones, el mismo componente sin casillas: cada fila tiene un selector de estado nuevo |

**La lista se ordena por código, no por estado.** Ordenar por estado obligaría a
Sonia a recorrer la lista para encontrar un código, que es lo que se viene a hacer.

| Qt | Notas |
|----|-------|
| `QListWidget` con `setUniformItemSizes(True)` o lista sobre `QAbstractListModel` | Con `QAbstractListModel` se puede filtrar por artículo sin reconstruir el widget |

### 4.6 `TextArea`

El campo de texto largo, para notas, descripciones y comentarios.

| Regla | Detalle |
|-------|---------|
| Uso | Nota de artículo, comentario de préstamo, descripción de incidente |
| Alto | 3 líneas visibles, redimensionable hasta 8 |
| Contador | «142 de 200», en `secundario`, alineado a la derecha debajo |
| Límite | 200 caracteres, que es el de los tres usos |
| Resize | Con el diálogo, no con el contenido |
| Anillo de foco | Igual que `FormField` |

---

## 5. Componentes de estado

### 5.1 `EmptyState`

El estado vacío. Ninguna pantalla escribe su propio mensaje: todas usan este
componente, cambiando el icono y el texto.

```
┌────────────────────────────────────────────────────────────────┐
│                                                                 │
│                          ╭─────────╮                            │
│                          │         │                            │
│                          ╰─────────╯                            │
│                                                                 │
│              Todavía no hay artículos registrados              │
│              Registra el primero para empezar a controlar       │
│              las existencias.                                   │
│                                                                 │
│                    [ + Registrar artículo ]                     │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

| Regla | Detalle |
|-------|---------|
| Icono | 48 px, monocromo, `texto_secundario` al 40 %. Nunca de colores, nunca una ilustración |
| Título | `subtitulo`, una frase, en la forma «Todavía no hay X» o «No hay X que coincida con Y» |
| Explicación | `cuerpo`, `texto_secundario`, **una línea que dice qué hacer** |
| Acción | `Button` primario, solo si hay algo que hacer. Sin acción, el vacío es un callejón sin salida |
| Alto | Ocupa el espacio disponible, centrado vertical y horizontalmente |
| Nunca | «Sin datos», «No hay resultados», «—», ni una tabla con una fila de texto |

**Los tres mensajes que sí se usan**

| Contexto | Título | Explicación | Acción |
|----------|--------|-------------|--------|
| Sin registros | «Todavía no hay X» | «Crea el primero para …» | Crear |
| Con filtro, sin resultados | «No hay X que coincida con *«búsqueda»*» | «Prueba con otro término o quita los filtros.» | Quitar filtros |
| Sin selección | «Selecciona una fila para ver su detalle» | — | — |

| Qt | Notas |
|----|-------|
| `QWidget` con `QVBoxLayout` y `QSizePolicy.Expanding` | Reemplaza el contenido de la tabla, no se añade encima. Una tabla visible bajo un «vacío» es una tabla vacía |

### 5.2 `InlineNotice`

Un aviso dentro de la página, sin diálogo. Cuatro tonos, y solo cuatro.

| Tono | Fondo | Texto | Uso | Con acción |
|------|-------|-------|-----|------------|
| Info | `azul_claro` | `azul_primario` | Contexto, Recordatorios neutros | «Entendido» |
| Correcto | `exito_claro` | `exito` | Resultado que debe quedar en la pantalla | «Descartar» |
| Atención | `advertencia_claro` | `advertencia_texto` | Algo que Sonia debería saber antes de seguir | «Ver detalle» |
| Error | `error_claro` | `error` | Error de negocio o de sistema | «Reintentar» |

```
┌────────────────────────────────────────────────────────────────┐
│  ⚠  Tiene 2 unidades pendientes de otros préstamos. Puede      │
│     registrar este préstamo igualmente.                       │
│                                            [ Continuar ]       │
└────────────────────────────────────────────────────────────────┘
```

| Regla | Detalle |
|-------|---------|
| Icono | 16 px, a la izquierda. **Siempre con texto**, nunca solo |
| Título | Opcional, en 600 |
| Texto | En el tono correspondiente, verificado con contraste |
| Acción | A la derecha, terciaria. Solo si hay algo que hacer |
| Cierre | Con «Continuar» o una «×», el aviso desaparece. Los avisos de error **no** se cierran solos: se sustituyen por su solución |
| Ancho | El de su contenedor. En tablas, el ancho de la tabla |
| Antes de un diálogo | **No.** Si el aviso tiene un botón que abre algo, es un diálogo. Un aviso con acción que no cambia de pantalla es una notificación |

### 5.3 `ConfirmDialog`

La confirmación previa. RNF-02 la exige para toda acción que afecte cantidades o
histórico, y este es el único componente que la produce.

```
┌───────────────────────── Anular préstamo ─────────────────────────┐
│                                                                   │
│  Vas a anular el préstamo PRE-2026-000012 de Ana Ramírez Solís.  │
│                                                                   │
│  Esto hace dos cosas:                                              │
│   · devuelve 4 unidades al inventario como disponibles            │
│   · marca el préstamo como anulado, sin borrarlo                  │
│                                                                   │
│  El movimiento queda registrado en el historial.                   │
│                                                                   │
│                  [ Cancelar ]        [ Anular préstamo ]           │
└───────────────────────────────────────────────────────────────────┘
```

| Regla | Detalle |
|-------|---------|
| Título | El verbo de la acción: «Anular préstamo», «Dar de baja», «Eliminar categoría», «Restaurar copia» |
| Cuerpo | **Qué va a pasar, con números.** Cuántas unidades, de qué registro, qué se escribe en el historial |
| Lista de efectos | Viñetas, máximo tres. Con más, el diálogo ya no es una confirmación, es una explicación |
| Botones | Izquierdo «Cancelar», derecho el de la acción. **El de la acción lleva el verbo**, nunca «Aceptar» ni «OK» |
| Orden | «Cancelar» a la izquierda y el de acción a la derecha, que es la convención de Windows y donde el cursor está por defecto |
| Foco inicial | **«Cancelar»**, para que `Enter` no ejecute la acción destructiva por inercia |
| `Esc` | Cancela |
| Posición | Centrada respecto a la ventana principal, no respecto a la pantalla |

**Doble confirmación.** Se pide en dos casos, porque son los únicos que pueden
perder trabajo o descuadrar el inventario:

| Caso | Primera | Segunda |
|------|---------|---------|
| Anular un préstamo con unidades en poder del estudiante | Diálogo de confirmación normal | Idéntico, pero con el botón deshabilitado hasta escribir `ANULAR` |
| Restaurar una copia de respaldo | Diálogo con el número de copias y la fecha de la que se restaura | Idéntico, con el botón deshabilitado hasta escribir `RESTAURAR` |

**No hay confirmación** para leer, ni para crear registros nuevos, ni para cambiar
filtros, ni para cerrar un formulario vacío. Si se pone una confirmación donde no
hace falta, Sonia aprende a pulsarla sin leer, y entonces sí deja de servir para
cuando importa.

| Qt | Notas |
|----|-------|
| `QDialog` propio, **no `QMessageBox`** | `QMessageBox` no admite lista de efectos, ni botón con verbo propio, ni doble confirmación, y su estilo no se puede tematizar |
| Modalidad | `Qt.ApplicationModal`, para que no se pueda interactuar con la ventana de detrás |

### 5.4 `Toast`

El aviso flotante de resultado. Confirma que algo ha pasado; no pide nada.

```
┌──────────────────────────────────────────────┐
│  ✓  Préstamo PRE-2026-000013 registrado       │
└──────────────────────────────────────────────┘
```

| Regla | Detalle |
|-------|---------|
| Contenido | **El resultado en una frase, con el identificador.** «Préstamo PRE-2026-000013 registrado», no «Operación correcta» |
| Posición | Esquina inferior derecha de la ventana, 24 px de margen, encima de la barra de estado |
| Duración | 4 s para lo correcto, 6 s para el error de negocio. Con barra de progreso de 2 px que se vacía |
| Apilamiento | Hasta tres. El cuarto desplaza al primero. Con más de tres a la vez hay un problema de diseño, no de componente |
| Tono | Correcto, error o atención. **El error de negocio va en toast si no requiere decisión; si la requiere, va en diálogo** |
| Accesibilidad | announced con `QAccessible`, y el foco **no** salta al toast. Saltar el foco interrumpe a quien está escribiendo |
| Al cerrarse | Desaparece solo, sin que Sonia tenga que hacer nada |

**Un toast no se usa para errores que requieren acción.** Si Sonia tiene que hacer
algo para resolverlo, no es un toast: es un diálogo o un `InlineNotice` en la
pantalla.

| Qt | Notas |
|----|-------|
| `QWidget` sin padre modal, o hijo de la ventana con `Qt.Tool` | Con `QTimer` de un solo disparo. Es el componente más fácil de implementar mal: si no se cierra nunca, tapa los botones de abajo |

### 5.5 `LoadingSkeleton`

El estado de carga. Sustituye a los «cargando…» de texto y a los «spinners»
centrados.

| Regla | Detalle |
|-------|---------|
| Forma | Bloques grises con `borde_suave`, con la **forma y el tamaño de lo que va a aparecer** |
| En tablas | Filas de la altura real, sin texto, en `borde_suave` al 50 % |
| En tarjetas | Un rectángulo por zona, con la altura de `StatCard` |
| Brillo | Un pulso de opacidad de 1200 ms, o nada si «reducir animación» está activo |
| Duración mínima | **250 ms.** Un esqueleto que aparece y desaparece en 80 ms se lee como un parpadeo y molesta más que no mostrar nada |
| Progreso | Nunca una barra de progreso sin porcentaje real. StockLend no sabe cuánto va a tardar |
| Cancelación | Si la consulta tarda más de 5 s, aparece un botón «Esperar» y un aviso: «La consulta está tardando más de lo normal» |
| Foco | No es enfocable. Mientras carga, el contenido anterior sigue siendo alcanzable con el teclado |

---

## 6. `RowMenu`

El menú de fila, la «⋯» de la última columna de cada tabla.

| Regla | Detalle |
|-------|---------|
| Ícono | «⋯», 16 px, en `texto_secundario`. Enfocable con `Tab`, activable con `Enter` |
| Posición | Última columna, ancho fijo de 44 px, centrada |
| Contenido | Solo las acciones que aplican a esa fila, en un orden fijo |
| Separadores | Entre grupos de acciones distintas, máximo dos separadores |
| Acción destructiva | Al final, con `error`, y con separador antes |
| Acción no disponible | No aparece. Si desaparece una acción que ayer estaba, la opción más segura es dejarla y explicar por qué está deshabilitada |
| Teclado | `↑` y `↓` recorren, `Esc` cierra, el foco vuelve a la fila |
| Cuándo se abre | Al pulsar. Con `Enter` se abre directamente, sin un clic intermedio |

**Los menús por fila, con las acciones que de verdad aplican**

| Pantalla | Acciones |
|----------|----------|
| Inventario, artículos | Editar · Ajustar cantidad · Registrar incidencia · Dar de baja |
| Inventario, unidades | Registrar incidencia · Ver historial de la unidad |
| Estudiantes | Ver ficha · Editar · Marcar inactivo o activo · Registrar préstamo · Registrar devolución |
| Préstamos | Registrar devolución · Anular · Ver detalle |
| Devoluciones | Ver detalle |
| Incidentes | Ver detalle · Marcar resuelto · Reabrir |
| Categorías | Editar · Eliminar |

| Qt | Notas |
|----|-------|
| `QMenu` con acciones Disabled con `setEnabled(False)` y `setToolTip` con el motivo | El motivo de un elemento deshabilitado **solo se ve en el tooltip**, que es un problema de accesibilidad. La alternativa es permitir la pulsación y mostrar el motivo en un `InlineNotice`, que es lo que se recomienda para las acciones bloqueadas por estado |

---

## 7. Componentes de diálogo

### 7.1 `FormDialog`

La base de todos los formularios en diálogo. Ocho de los once diálogos de la
aplicación son de este tipo.

```
┌────────────── Ajustar existencias ──────────────┐
│                                                 │
│  Contenido del formulario                        │
│                                                 │
│                              [ Cancelar ] [ ✓ ]  │
└─────────────────────────────────────────────────┘
```

| Regla | Detalle |
|-------|---------|
| Título | El verbo de la acción: «Ajustar existencias», «Registrar artículo», «Nuevo estudiante» |
| Ancho | 480 px para un formulario corto, 640 px para uno con lista. Fijo por tipo de formulario, para que Sonia lo sepa |
| Alto | Automático hasta 80 % del alto de la ventana. Con desplazamiento interno si hace falta |
| Botones | «Cancelar» a la izquierda, el de acción a la derecha, con el verbo («Registrar movimiento», «Anular préstamo», «Guardar») |
| Foco inicial | El primer campo del formulario. **Nunca** el botón de acción, para que `Enter` no confirme un formulario vacío |
| `Enter` | Confirma el formulario, **desde cualquier campo**, pero solo si el formulario es válido |
| `Esc` | Cierra sin guardar, sin preguntar. Si hay algo escrito, se pregunta |
| Errores | En línea, en cada campo. No hay un resumen de errores arriba |
| Dirty state | Si hay cambios sin guardar, el botón de la «×» de la barra de título pide confirmación |
| beneath | El diálogo se abre centrado respecto a la ventana principal, no respecto a la pantalla, para que la pantalla no parezca un parche |

**Lista de diálogos**

| Diálogo | Pantalla | Campos |
|---------|----------|--------|
| Registrar artículo | Inventario | Nombre, categoría, cantidad, control individual, prestable, nota |
| Ajustar existencias | Inventario | Cantidad, estado, motivo obligatorio |
| Registrar incidencia | Inventario, Incidentes | Artículo, unidades o unidad, tipo, procedencia, responsable, descripción |
| Categoría | Inventario | Nombre |
| Estudiante | Estudiantes | Código, nombres, apellidos, nota |
| Préstamo, paso 1 | Préstamos | Buscador de estudiante |
| Préstamo, paso 2 | Préstamos | Buscador de artículo, cantidades, comentario, fecha |
| Devolución | Devoluciones | Cantidades y condiciones por artículo |
| Incidente | Incidentes | Tipo, artículo, unidades, procedencia, responsable, descripción |
| Configuración, restaurar | Respaldo | Confirmación de la copia a restaurar |
| Ficha de estudiante | Estudiantes | Solo lectura, historial completo |

| Qt | Notas |
|----|-------|
| `QDialog` con botones propios | `QDialogButtonBox` queda descartado: acepta los botones del tema del sistema, que es justo lo que no se quiere. Los botones se crean a mano con `QPushButton`, para controlar el texto y el orden |
| Tamaño | `setFixedWidth` para el ancho, `setMinimumHeight` y desplazamiento interno. **Nunca** `resize()` por código después de construir el formulario |

---

## 8. Reglas de implementación transversales

| Regla | Detalle |
|-------|---------|
| **Sin consultas en el hilo de la interfaz** | Todo `SELECT` va en `QThreadPool`. Un `fetchall()` en el hilo principal bloquea la ventana, y con 5000 unidades de inventario se nota (RNF-06) |
| **El modelo es la fuente del dato para pantalla** | La vista no consulta. Recibe el modelo ya filtrado, y eso hace que el componente se pueda probar sin base de datos |
| **Un delegate por tipo de celda** | `StatusChip`, `QuantityCell` y `UnitCodeBadge` son delegates distintos. Un delegate que hace de todo es un delegate que hay que depurar |
| **`objectName` en todo** | Sin excepciones. Es lo que permite que `pytest-qt` verifique que un componente existe sin acoplarse al texto |
| **Nada de literales de color fuera de los tokens** | Ni en QSS, ni en el `paint` de un delegate, ni en un `setStyleSheet` de una pantalla |
| **El tema se genera desde los tokens** | `ui/theme.py` construye el QSS. El QSS no se escribe a mano, para que un cambio de color no obligue a recorrer la aplicación |
| **Pruebas de maquetado** | 1024 × 640, 1360 × 840 y 1920 × 1080. Con escalado del 125 %. Un componente que solo funciona a una resolución no está terminado |
| **Sin dependencias de `ui/` con la base de datos** | RNF-15: ningún módulo de `ui/` importa `sqlite3`. Un componente que consulta la base directamente no es un componente, es un atajo que rompe la prueba de arquitectura |

---

## 9. Componentes que este diseño NO incluye

| No hay | Por qué |
|--------|---------|
| Gráficos ni curvas | Con las cifras de StockLend, una tabla se lee más rápido que un diagrama, y un diagrama obliga a interpretar un eje (ver `UI_DESIGN.md`, sección 2) |
| Notificaciones push del sistema | La aplicación es local y de un solo usuario. Un aviso del sistema para un aviso de StockLend sería ruido |
| Menú de contexto con el botón derecho | Duplicaría `RowMenu` y multiplicaría los caminos para la misma acción |
| Panel de personalización | No hay nada que personalizar: la ventana es una, el tema es uno y el idioma es uno |
| Arrastrar y soltar para mover columnas | Una tabla reordenable obliga a reconstruir la disposición mental en cada visita |
| Indicador de progreso por porcentaje | StockLend no sabe cuánto va a tardar. Un 73 % inventado es peor que un esqueleto |
| Relieve o sombra fuerte | La elevación se apoya en el fondo y el borde. Una sombra fuerte es ruido visual |
