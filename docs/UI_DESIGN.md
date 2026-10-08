# StockLend — Diseño de interfaz y experiencia de usuario

> **Estado del documento:** propuesta de diseño. **Ninguna pantalla está
> implementada, maquetada ni probada.** No hay código de interfaz, ni tema QSS, ni
> recursos gráficos en el repositorio. Todo lo que hay aquí son especificaciones
> escritas.
>
> **Etapa:** diseño de interfaz. Precede a la implementación de las pantallas
> (etapas 5 y 6 de `DEVELOPMENT_PLAN.md`).
>
> **No se ha modificado ninguna regla de negocio, requisito ni decisión de
> arquitectura.** Las contradicciones detectadas están registradas en la sección 10
> para que Sonia decida, no resueltas por cuenta propia.

---

## 1. Propósito y alcance

Este documento fija el lenguaje visual de StockLend y la forma de la ventana
principal: colores, tipografía, espaciado, estructura de navegación y
comportamiento general de la aplicación.

| Documento | Contenido |
|-----------|-----------|
| `UI_DESIGN.md` | **Este.** Identidad visual, distribución de la ventana, menú lateral, estados globales, accesibilidad y recomendaciones de implementación |
| `UI_SCREENS.md` | Diseño detallado de cada pantalla, sección por sección |
| `UI_COMPONENTS.md` | Catálogo de componentes visuales reutilizables y sus estados |
| `UI_FLOWS.md` | Recorridos de navegación, catálogo de validaciones, mensajes y confirmaciones |

Documentos de la etapa anterior que este diseño **no sustituye**:

| Documento | Relación con este diseño |
|-----------|--------------------------|
| `ARCHITECTURE.md` | Define la arquitectura y ya fija la paleta base, la tipografía y la navegación con `QStackedWidget`. Este documento las concreta y las amplía |
| `REQUIREMENTS.md` | Define los requisitos, las 61 reglas de negocio y las 10 pantallas previstas. Aquí se detallan visualmente, sin cambiar su alcance |
| `DATABASE_DESIGN.md` | Define el modelo de datos. De ahí salen los estados que la interfaz muestra |
| `DEVELOPMENT_PLAN.md` | Define el orden de trabajo. Este diseño ocupa el papel de la etapa 0 para la parte visual |

### 1.1 Fuera de alcance de este diseño

- Especificar el SQL o alterar el modelo de datos.
- Definir reglas de negocio nuevas o modificar las existentes.
- Decidir la librería de PDF (D-05 sigue abierta).
- Diseñar la exportación a CSV o PDF, más allá de reservar el hueco en la interfaz.
- Diseñar la aplicación móvil o web. StockLend es una aplicación de escritorio.

---

## 2. Principios de diseño

Siete principios que resuelven cada decisión concreta. Cuando dos reglas se choquen,
manda el de número más bajo.

| # | Principio | Qué significa en la práctica | De dónde sale |
|---|-----------|------------------------------|--------------|
| 1 | **El número correcto a la vista** | La interfaz enseña el dato real tal como está en la base, con su unidad y su contexto. Nunca un valor aproximado, nunca una estimación, nunca un dato de ejemplo (RF-DAS-06) | RF-INV-05, RF-DAS-06, RN-02 |
| 2 | **Un paso por decisión** | Sonia nunca tiene que recordar en qué pantalla está. Cada pantalla resuelve una tarea completa, y la tarea se puede abandonar sin dejar datos a medias | Sección 10 de `REQUIREMENTS.md` (flujo principal) |
| 3 | **Menos campos, no campos más pequeños** | Un formulario pide solo lo imprescindible. Lo que el sistema puede deducir, no se pregunta (RNF-02 y RF-EST-01: ni correo ni teléfono) | RF-EST-01, revisión 2 de `DATABASE_DESIGN.md` |
| 4 | **Nada de lo que se hace es invisible** | Toda acción que altera cantidades o historial muestra confirmación previa y resultado posterior. RNF-02 lo exige; aquí se concreta en un patrón único | RNF-02, RNF-03 |
| 5 | **El error se explica en la frase que lo evita** | Un mensaje dice qué pasó, qué valor era válido y cuál era el máximo disponible. Nunca «error de validación» ni el nombre de una tabla | RNF-01, RNF-08 |
| 6 | **El color significa algo** | Cada color de la interfaz tiene un significado fijo y está siempre acompañado de texto o icono. El color nunca es el único portador de información | WCAG 1.4.1 |
| 7 | **La velocidad de Sonia es la métrica** | Se mide en clics y en minutos por clase, no en si la pantalla se ve bien. Cada elemento visual tiene que pagar su espacio con información | RNF-03, RNF-04 |

**Sobre el principio 1 y las cifras de ejemplo.** El prompt de esta etapa pide no
usar cifras ficticias. La regla concreta que se aplica: las tarjetas del panel
muestran `0` cuando no hay datos, con un texto que lo explica, y **no** hay ningún
número de relleno, ni gráfico decorativo, ni «datos de muestra». Si una pantalla está
vacía, se dice que está vacía.

---

## 3. Identidad visual

### 3.1 Color

La paleta es casi monocroma: un azul como color de marca y de acción, una escala de
grises para el texto y las superficies, y tres colores semánticos reservados
exclusivamente para estado. No hay colores decorativos.

**Tokens de color.** Los valores que no están marcados como *nuevo* vienen de
`ARCHITECTURE.md` sección 4 y **no se modifican**. Los marcados como *nuevo* son
pasos de color que se añaden para poder cumplir el criterio de contraste que la
propia arquitectura declara (ver 3.2).

| Rol | Token | Valor | Uso |
|-----|-------|-------|-----|
| Marca y acción | `azul_primario` | `#1E5AA8` | Botón primario, enlaces, elemento activo, anillo de foco |
| Marca oscura | `azul_primario_oscuro` | `#153E75` | Fondo de la barra lateral, encabezado de ventana |
| Marca hover | `azul_primario_hover` | `#2861A5` | Estado presionado del botón primario (nuevo) |
| Fondo de marca | `azul_claro` | `#E8F0FB` | Fondo de pastilla informativa, fila seleccionada |
| Fondo de página | `fondo` | `#F5F7FA` | Fondo general de la zona de contenido |
| Superficie | `superficie` | `#FFFFFF` | Tarjetas, diálogos, cabeceras de tabla |
| Separador suave | `borde_suave` | `#E6EBF2` | Divisores internos, fondos de fila alterna |
| Borde decorativo | `borde` | `#D8DEE7` | Borde de tarjeta, borde de campo deshabilitado |
| Borde de control | `borde_fuerte` | `#828D9E` | Borde de campo de formulario y de botón secundario (nuevo) |
| Texto principal | `texto` | `#1B2430` | Títulos, valores de tabla, texto de campo |
| Texto secundario | `texto_secundario` | `#5A6672` | Etiquetas, unidades, texto de apoyo |
| Estado correcto | `exito` | `#1E7B45` | «Disponible», confirmaciones, texto de éxito |
| Fondo de correcto | `exito_claro` | `#E6F4EC` | Pastilla de estado disponible (nuevo) |
| Estado de atención | `advertencia` | `#B26A00` | Relleno de icono o barra de atención (nuevo, ver 3.2) |
| Texto de atención | `advertencia_texto` | `#9C5800` | Texto y pastilla de «dañado», «pendiente de atención» (nuevo) |
| Fondo de atención | `advertencia_claro` | `#FDF1E0` | Pastilla de «dañado» (nuevo) |
| Estado de problema | `error` | `#B3261E` | «Faltante», errores, botón destructivo |
| Fondo de problema | `error_claro` | `#FCEAE9` | Pastilla de «faltante», fondo de aviso inline (nuevo) |
| Barra lateral | `sidebar_fg` | `#FFFFFF` | Texto e iconos de la barra lateral |
| Barra lateral apagada | `sidebar_fg_apagado` | `#B9CCE6` | Texto secundario en la barra lateral (nuevo) |
| Barra lateral activa | `sidebar_activo` | `#2E6FBF` | Fondo del elemento activo (nuevo) |
| Foco | `foco` | `#1E5AA8` | Anillo de foco de teclado |

#### 3.2 Contraste verificado

Los ratios se calcularon con la fórmula de luminancia relativa de WCAG 2.1 sobre los
valores de la tabla anterior. Resultado: **24 de 24 combinaciones cumplen**. Las más
delicadas, que son las que hay que vigilar al maquetar:

| Combinación | Ratio | Mínimo | Nota |
|-------------|-------|--------|------|
| Texto principal sobre superficie | 15.65:1 | 4.5 | holgado |
| Texto secundario sobre superficie | 5.87:1 | 4.5 | justo, no bajar el color |
| Texto secundario sobre fila resaltada | 5.22:1 | 4.5 | el resaltado no puede aclarar mucho el texto |
| Texto de la barra lateral, elemento activo | 5.07:1 | 4.5 | el activo es el de menor margen |
| Pastilla «dañado» (texto sobre fondo ámbar) | 4.94:1 | 4.5 | ver aviso siguiente |
| Pastilla «pendiente» neutra | 4.90:1 | 4.5 | |
| Borde de campo de formulario | 3.36:1 | 3.0 | WCAG 1.4.11, controles no textuales |
| Anillo de foco sobre superficie | 6.81:1 | 3.0 | |

**Aviso 1 — la paleta de `ARCHITECTURE.md` incumple su propio criterio.** La sección 4
de `ARCHITECTURE.md` declara «Contraste mínimo 4.5:1» y fija `#B26A00` como color de
advertencia. Ese valor da **4.24:1** sobre blanco, por debajo del mínimo que el
documento exige. No se modifica el valor original: se conserva para rellenos y se
añade `advertencia_texto` (`#9C5800`, 5.51:1 sobre blanco) para texto y pastillas.
Queda registrado como contradicción C-2 en la sección 10.

**Aviso 2 — el borde decorativo no sirve para un campo de formulario.** `#D8DEE7`
distingue bien una tarjeta del fondo (1.35:1) pero no cumple el 3:1 que WCAG 1.4.11
exige en un control que hay que poder identificar. Por eso `borde_fuerte`
(`#828D9E`, 3.36:1) es el borde de los campos, y `borde` se queda para las tarjetas.

#### 3.3 Reglas de uso del color

- **El azul no es decorativo.** Solo aparece donde hay acción, selección o foco.
- **Los colores semánticos son excluyentes.** Verde, ámbar y rojo significan
  disponible, dañado y faltante. No se usan para subrayar, para marcar un campo
  obligatorio ni para resaltar una fila seleccionada.
- **Ningún estado se comunica solo con color** (WCAG 1.4.1). Cada pastilla lleva
  texto, y si la pastilla lleva icono, el icono acompaña siempre al texto.
- **El fondo de página nunca es blanco puro.** El blanco se reserva para las
  superficies con relieve, para que las tarjetas se lean como elevadas sin sombra
  fuerte.
- **Sin gradientes.** Salvo la barra lateral, que usa un azul sólido.

### 3.4 Tipografía

Familia: **Segoe UI**, la del sistema Windows, sin empaquetar. Si no está disponible,
Qt cae en la siguiente de la lista. `ARCHITECTURE.md` ya fijó esta decisión.

| Token | Tamaño | Peso | Interlineado | Uso |
|-------|--------|------|--------------|-----|
| `titulo_seccion` | 22 px | Semibold (600) | 28 px | Título de la pantalla, en la cabecera de contenido |
| `subtitulo` | 16 px | Semibold (600) | 22 px | Título de tarjeta, encabezado de columna importante |
| `cuerpo` | 14 px | Regular (400) | 20 px | Texto de párrafo, celdas de tabla, campos |
| `cuerpo_fuerte` | 14 px | Semibold (600) | 20 px | Valores que hay que leer de un vistazo, total de una tarjeta |
| `secundario` | 13 px | Regular (400) | 18 px | Etiquetas, texto de apoyo, unidades |
| `dato_destacado` | 30 px | Semibold (600) | 34 px | Cifra grande de una tarjeta del panel |
| `etiqueta` | 11 px | Semibold (600), mayúsculas, +0.4 px | 14 px | Solo rótulos de columna agrupada. No se usa en frases |

**Reglas de tipografía**

- **Como máximo dos pesos por pantalla visible** (400 y 600). Si hace falta un
  tercer peso, el problema es de jerarquía, de no de tipografía.
- **Las cifras usan cifras tabulares.** En columnas de cantidades y en las tarjetas
  del panel, para que los números queden alineados en vertical y se puedan comparar
  de un vistazo. En PySide6 se fuerza con un tipo de fuente tabular.
- **Las unidades nunca se omiten.** `8 de 12` en columna «disponibles», no un `8`
  suelto que obliga a mirar la cabecera.
- **El texto en mayúsculas es solo para etiquetas cortas.** Una frase en mayúsculas
  es más lenta de leer, y aquí el espacio es escaso.
- **Nunca por debajo de 11 px.** Con la escala de pantalla de Windows al 125 % o
  150 %, 11 px ya se lee de sobra.

### 3.5 Espaciado y ritmo

Base de **4 px**. Todos los valores salen de esa base: 4, 8, 12, 16, 20, 24, 32, 40,
48. Ningún margen del diseño es un número arbitrario.

| Relación | Separación | Ejemplo |
|----------|-----------|---------|
| Dentro de un mismo grupo (etiqueta y campo) | 4–8 px | Etiqueta encima del campo de texto |
| Entre campos de un formulario | 16 px | Cantidad, después de «Artículo» |
| Entre grupos de un formulario | 24 px | Bloque «artículos» separado del bloque «estudiante» |
| Entre bloques de una pantalla | 24–32 px | Lista bajo las tarjetas del panel |
| Relleno del contenido de la página | 24–32 px | Margen del contenido dentro de la ventana |
| Relleno de tarjeta | 16–20 px | |
| Relleno de diálogo | 24 px | |

**Alturas fijas de componentes** (elemento más alto a más alto, sin excepciones, para
que las filas se lean alineadas):

| Componente | Alto |
|------------|------|
| Botón (normal / grande) | 36 px / 44 px |
| Campo de formulario | 36 px |
| Campo de búsqueda en la barra de herramientas | 36 px |
| Selector incremental de cantidad | 36 px |
| Fila de la barra lateral | 44 px |
| Fila de tabla | 40 px |
| Cabecera de tabla | 40 px |
| Pastilla de estado | 24 px |

### 3.6 Bordes, radios y elevación

| Token | Valor | Dónde |
|-------|-------|-------|
| `radio_s` | 4 px | Pastillas, campos pequeños, botones |
| `radio_m` | 6 px | Botones, campos de formulario, menús |
| `radio_l` | 8 px | Tarjetas, diálogos |
| `sombra_nivel_1` | `0 1px 2px rgba(27,36,48,.06)` | Tarjetas |
| `sombra_nivel_2` | `0 4px 12px rgba(27,36,48,.10)` | Diálogos, menús desplegables |
| `sombra_nivel_3` | `0 12px 32px rgba(27,36,48,.14)` | Solo confirmación destructiva |

La elevación se apoya en el fondo y el borde antes que en la sombra. Una tarjeta se
reconoce porque es blanca sobre un fondo gris claro, no porque «flote».

### 3.7 Iconografía

- **Estilo:** línea (contorno) de 1.5 px, esquinas redondeadas, retícula de 24 px.
  Sin iconos rellenos ni con degradados.
- **Tamaños:** 20 px en la barra lateral y en botones, 16 px dentro de tablas y
  pastillas.
- **Consistencia:** un icono, un significado, en toda la aplicación. El mismo icono
  nunca representa dos cosas.
- **Regla de la tabla:** dentro de una tabla densa, el icono solo aparece si acompaña
  a un texto en la misma celda. Un icono suelto en una columna obliga a aprender un
  código visual.
- **Iconos necesarios:** panel, inventario, estudiantes, préstamos, devoluciones,
  reportes, incidentes, respaldo, configuración, buscar, añadir, editar, borrar,
  confirmar, cerrar, filtro, exportar, advertencia, error, correcto, vacío, código
  de unidad, chevron.

### 3.8 Movimiento

| Duración | Uso |
|----------|-----|
| 120 ms | Cambio de color al pasar el ratón, aparición de un foco |
| 180 ms | Transición de una tarjeta, apertura de un menú desplegable |
| 240 ms | Cambio de pantalla con `QStackedWidget` |

Curva `ease-out`. **Sin animación decorativa**: nada rebota, nada gira, nada entra
deslizándose. La única animación con sentido es la que confirma que algo ha cambiado
(un contador que se actualiza, una fila que se despliega). Con «reducir animación»
activado en Windows, todas las duraciones bajan a 0 y las transiciones se
sustituyen por un corte.

---

## 4. Distribución de la ventana principal

### 4.1 Estructura

Una sola ventana. Sin ventanas independientes para la navegación. Confirmado por
`ARCHITECTURE.md` (navegación por páginas con `QStackedWidget`) y coherente con la
indicación de esta etapa de no abrir numerosas ventanas.

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│  ▪ StockLend                                    Configuración · Incidentes (2)   │  ← barra de título del sistema
├────────────────┬──────────────────────────────────────────────────────────────────┤
│                │  Préstamos                                          [ + Nuevo ]   │  ← cabecera de contenido
│  StockLend     │  Registro de entregas a estudiantes                               │  ← subtítulo
│                ├──────────────────────────────────────────────────────────────────┤
│  ▣  Panel      │                                                                  │
│  ▢  Inventario │   ┌──────────────────────────────┐ ┌──────────────────────────┐   │
│  ▢  Estudiantes│   │  Zona de trabajo             │ │  Zona de apoyo           │   │
│  ▣  Préstamos  │   │                              │ │                          │   │
│  ▢  Devoluciones│  │  Tabla, formulario o         │ │  Resumen del contexto    │   │
│  ▢  Reportes   │   │  lista de la sección         │ │  (detalle, ayuda,        │   │
│                │   │                              │ │   totales)               │   │
│                │   │  El ancho de esta zona       │ │  320–360 px fijos        │   │
│                │   │  es flexible                 │ │                          │   │
│                │   │                              │ │                          │   │
│                │   └──────────────────────────────┘ └──────────────────────────┘   │
│                │                                                                  │
│ ─ ─ ─ ─ ─ ─ ─ ─│                                                                  │
│  ◷ Incidentes  │                                                                  │
│  ⛁ Respaldo     │                                                                  │
│  ⚙ Configuración│                                                                  │
├────────────────┴──────────────────────────────────────────────────────────────────┤
│  Base: stocklend.sqlite · Último respaldo: sin registro      Listo              │  ← barra de estado
└───────────────────────────────────────────────────────────────────────────────────┘
   240 px fijo                                                        flexible
```

Las cifras que aparecen en los alámbricos de este documento son ilustrativas del
hueco que ocupan, no datos de ejemplo que se mostrarían en pantalla (ver principio 1
en la sección 2).

### 4.2 Reglas por región

| Región | Contenido | Comportamiento |
|--------|-----------|----------------|
| **Barra lateral** | Marca, secciones, secciones secundarias | Ancho fijo de 240 px. No se redimensiona. Es la única columna fija de la ventana |
| **Cabecera de contenido** | Título de sección, subtítulo, acción principal de la sección | Fija al desplazarse el contenido; la acción principal siempre a la derecha |
| **Zona de trabajo** | Lo que hace la sección | Flexible. Ocupa todo el ancho restante |
| **Zona de apoyo** | Detalle del elemento seleccionado, totales, ayuda de la tarea | Fija en 320–360 px. **Oculta por debajo de 1200 px de ancho**; su contenido pasa a un diálogo |
| **Barra de estado** | Ruta de la base, último respaldo, estado de la operación | 24 px. Solo texto informativo, nunca acciones |

La zona de apoyo existe para que Sonia vea el contexto de lo que tiene seleccionado
sin abrir un diálogo. Es la diferencia entre una pantalla que obliga a hacer clic
para entender y una que muestra la información a la vez.

### 4.3 Tamaños y adaptabilidad

| Ancho de ventana | Comportamiento |
|------------------|----------------|
| ≥ 1440 px | Zona de trabajo y zona de apoyo. Las tablas muestran todas sus columnas |
| 1200–1439 px | Igual, con menos columnas en tabla: se ocultan las menos usadas, nunca el nombre ni las cantidades |
| 1024–1199 px | **La zona de apoyo se oculta.** Las tablas muestran nombre, estado y cantidades; el resto pasa a la ficha de detalle |
| < 1024 px | No soportado. Se muestra un aviso pidiendo ampliar la ventana |

| Alto de ventana | Comportamiento |
|----------------|-----------------|
| ≥ 800 px | Todo visible sin desplazamiento vertical en el panel |
| 640–799 px | El contenido se desplaza. La barra lateral mantiene su altura y su posición |
| < 640 px | No soportado |

**Tamaño por defecto: 1360 × 840 px**, con el botón «Maximizar» disponible. **Mínimo
absoluto: 1024 × 640 px.** RNF-04 solo fija que el equipo es de 2018 o posterior; la
resolución concreta no está indicada en ninguna parte, así que el mínimo se fija
aquí de forma conservadora y habría que contrastarlo con el equipo real de Sonia.

**La barra lateral no se colapsa ni se oculta.** Es el punto de partida de la
orientación de Sonia, y reducirla sería un ahorro de espacio a cambio de
desorientación. En ventanas estrechas se recorta el ancho a 200 px, no desaparece.

### 4.4 Título y comportamiento de la ventana

- Título del sistema: `StockLend`. El sistema añade el nombre de la sección activa,
  por ejemplo `StockLend — Préstamos`, para que Sonia sepa qué está mirando incluso
  si la ventana pierde el foco.
- Icono: el logotipo de StockLend, también presente en la barra lateral.
- Tamaño y posición se recuerdan entre sesiones, en `configuracion`.
- Una sola instancia: si Sonia intenta abrir StockLend otra vez, la ventana
  existente se trae al frente (ADR-07). El aviso dice por qué no ocurrió nada.

---

## 5. Menú lateral

### 5.1 Estructura

```
┌──────────────────────┐
│  StockLend           │  ← marca, 64 px de alto, logotipo + nombre
├──────────────────────┤
│  ▣  Panel            │  ← sección principal
│  ▢  Inventario       │
│  ▢  Estudiantes      │
│  ▢  Préstamos        │
│  ▢  Devoluciones     │
│  ▢  Reportes         │
│                      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─   │  ← separador: 1 px, borde suave
│                      │
│  ◷  Incidentes  (n)  │  ← sección secundaria; la insignia es un contador real
│  ⛁  Respaldo          │
│  ⚙  Configuración     │
├──────────────────────┤
│  v1 · esquema 1      │  ← versión y número de esquema, 28 px
└──────────────────────┘
```

**Seis secciones principales** — las que pide esta etapa: Panel, Inventario,
Estudiantes, Préstamos, Devoluciones y Reportes.

**Tres entradas secundarias**, separadas por una línea y con los iconos atenuados:
Incidentes, Respaldo y Configuración. **Categorías** no es una entrada propia sino
una pestaña dentro de Inventario (ver C-1 en la sección 10).

| Entrada | Va a | Insignia | Atajo |
|---------|------|----------|-------|
| Panel | `dashboard` | — | `Ctrl+1` |
| Inventario | `inventario` | — | `Ctrl+2` |
| Estudiantes | `estudiantes` | — | `Ctrl+3` |
| Préstamos | `prestamos` | Número de préstamos con artículos pendientes | `Ctrl+4` |
| Devoluciones | `devoluciones` | — | `Ctrl+5` |
| Reportes | `reportes` | — | `Ctrl+6` |
| Incidentes | `incidentes` | Número de incidentes abiertos | `Ctrl+7` |
| Respaldo | `respaldo` | Aviso si no hay copia en 7 días | — |
| Configuración | `configuracion` | — | — |

Las insignias solo aparecen cuando hay algo que requiere atención, y son números
reales de la base. **Nunca hay una insignia sin datos detrás.** Un `0` no se muestra
como insignia; si no hay nada pendiente, no hay insignia.

### 5.2 Estados de una entrada

| Estado | Fondo | Texto | Indicator |
|--------|-------|-------|-----------|
| Reposo | Transparente | `sidebar_fg` | — |
| Ratón encima | `azul_primario_hover` al 20 % | `sidebar_fg` | — |
| **Activa** | `sidebar_activo` | `sidebar_fg` | Barra vertical blanca de 3 px en el borde izquierdo |
| Foco de teclado | Translúcido del color de foco | `sidebar_fg` | Contorno visible de 2 px |
| Deshabilitada | Transparente | `sidebar_fg_apagado` al 60 % | Sin insignia |

La sección activa se identifica por **tres** señales a la vez: el fondo, la barra
lateral izquierda y el título grande de la cabecera de contenido. Con solo una de
ellas no bastaría.

### 5.3 Atajos globales

| Atajo | Acción |
|-------|--------|
| `Ctrl+1` … `Ctrl+6` | Ir a la sección principal correspondiente |
| `Ctrl+N` | Nuevo registro, en la sección activa (artículo, estudiante, préstamo…) |
| `Ctrl+F` | Enfocar el buscador de la sección activa |
| `Ctrl+S` | Guardar, si la sección tiene un formulario abierto |
| `F5` | Actualizar los datos de la pantalla |
| `Esc` | Cerrar el diálogo activo, o limpiar el buscador si no hay ninguno abierto |
| `F1` | Ayuda contextual de la sección activa |
| `Ctrl+,` | Abrir Configuración |
| `Alt+1` … `Alt+6` | Foco directo en la sección actual: contenido, buscador, tabla, filtros, acción principal, zona de apoyo |

---

## 6. Estados globales de la aplicación

Estos cinco estados existen en cualquier pantalla con datos. Ninguna pantalla
implementa los suyos: todos usan los mismos componentes.

### 6.1 Estados de una pantalla con datos

| Estado | Qué se ve | Duración máxima aceptable |
|--------|-----------|---------------------------|
| **Cargando** | Esquema de la pantalla con bloques grises, o un indicador en la barra de la tabla si ya hay contenido previo | 200 ms para la navegación entre secciones; 1 s para una búsqueda con más de 500 filas |
| **Con datos** | El contenido real | — |
| **Vacío** | Icono grande, frase que explica qué falta y un botón con la acción para crearlo | — |
| **Vacío por filtro** | «Ningún artículo coincide con la búsqueda», el texto del filtro aplicado y un botón «Quitar filtros» | — |
| **Error** | Mensaje en la zona donde ocurriría el contenido, con el detalle técnico solo en el registro | — |

**Regla de los mensajes vacíos.** Nunca «Sin datos». El mensaje nombra la pantalla y
ofrece el siguiente paso: «Todavía no hay artículos registrados. Registra el primero
para empezar a controlar las existencias». Y el botón hace exactamente eso.

### 6.2 Estados de una operación

| Estado | Componente | Cuándo | Cómo se va |
|--------|-----------|--------|-----------|
| En curso | El botón se deshabilita y muestra un indicador; la fila afectada se atenúa | La acción dura más de 300 ms | Solo al terminar |
| Correcto | Aviso flotante de 4 s, esquina inferior derecha, con el resumen de lo ocurrido | Toda operación confirmada | Solo o con «Deshacer» si la regla lo permite |
| Error de negocio | Aviso flotante ámbar o rojo, 6 s, con el mensaje completo y sin detalle técnico | Validación de `services/` | `Esc` o clic |
| Error inesperado | Diálogo con el mensaje en español, el identificador del registro de log y los botones «Reintentar» y «Cerrar» | Excepción no controlada | Obligatorio |

### 6.3 Confirmación antes de actuar

RNF-02 exige confirmación en toda acción que afecte cantidades o historial. Se
aplica con un criterio único, no criterio por pantalla:

| La operación… | Pide confirmación |
|---------------|------------------|
| Solo lee datos | No |
| Registra datos nuevos sin alterar cantidades ni historial | No |
| Altera cantidades, movimientos, préstamos, devoluciones o incidentes | **Sí** |
| Cierra o resuelve un registro de forma permanente | **Sí** |

La confirmación muestra el nombre del registro afectado, qué va a cambiar y cuántas
unidades. El botón destructivo nunca dice «Aceptar» ni «OK»: dice lo que hace
(«Anular préstamo», «Dar de baja», «Eliminar categoría»).

**Anular un préstamo con unidades en poder del estudiante requiere una segunda
confirmación**, porque las unidades vuelven a estar disponibles y el estudiante deja
de tenerlas registradas. Es el mismo patrón que RNF-02, aplicado dos veces.

### 6.4 Estados de la base de datos

StockLend es local, así que no hay estado «sin conexión». Sí hay tres estados de la
base que hay que diseñar:

| Estado | Qué muestra |
|--------|-------------|
| **Abriendo** | Ventana de carga con el logotipo, sin barra de progreso (no se sabe cuánto dura) |
| **Migrando** | Aviso «Actualizando la base de datos. No cierre la aplicación.» con el número de versión. `DATABASE_DESIGN.md` garantiza copia previa antes de migrar |
| **Bloqueada** | Si otra instancia tiene la base abierta: mensaje claro con el motivo, sin detalles de SQLite |

---

## 7. Componentes visuales compartidos

Resumen. La especificación completa, con anatomía y estados, está en
`UI_COMPONENTS.md`.

| Componente | Se usa en | Para qué |
|------------|-----------|----------|
| `StatCard` | Panel, Reportes | Una cifra real con su etiqueta y su unidad |
| `DataTable` | Todas las secciones con listado | Tabla con orden, filtro, selección y estados vacíos |
| `SearchBar` | Todas las secciones con listado | Búsqueda incremental con contador de resultados |
| `DataTable` con columnas de cantidad | Inventario, Préstamos, Devoluciones | Cifras tabulares y estado en columna |
| `StatusChip` | Inventario, Préstamos, Devoluciones, Incidentes | Estado como texto + color |
| `FormField` | Todos los formularios | Etiqueta, campo, ayuda y error en una unidad |
| `QuantityInput` | Préstamos, Devoluciones | Cantidad con selector incremental y tope visible |
| `Toolbar` | Todas las secciones | Acción principal a la derecha, filtros al centro |
| `EmptyState` | Todas | Estado vacío con icono, frase y acción |
| `ConfirmDialog` | Todas | Confirmación con el nombre del registro afectado |
| `Toast` | Todas | Resultado de una operación ya confirmada |
| `TabBar` | Inventario, Reportes, ficha del estudiante | Secciones dentro de una pantalla |
| `DetailPanel` | Inventario, Estudiantes, Préstamos | Contexto del elemento seleccionado en la zona de apoyo |
| `UnitCodeBadge` | Inventario, Préstamos, Devoluciones, Incidentes | Código de unidad individual con su estado |

Los dos últimos son los que hacen útil el control individual de unidades: sin ellos,
`articulo_unidad` sería una tabla que la interfaz no sabe mostrar.

---

## 8. Accesibilidad

`ARCHITECTURE.md` fija contraste 4.5:1, foco visible y navegación por teclado. Aquí
se concreta el resto.

### 8.1 Contraste y color

Verificado en 3.2: 24 combinaciones, todas cumplen. Regla de diseño: **el estado se
comunica con texto además de con color**, porque hay personas que no distinguen el
ámbar del rojo, y porque un 5 % de los hombres tiene alguna deficiencia en la
visión del color.

### 8.2 Teclado

| Requisito | Cómo se cumple |
|-----------|----------------|
| Todo se puede hacer sin ratón | Cada elemento interactivo es enfocable y activable con `Enter` o `Espacio` |
| El foco siempre se ve | Anillo de 2 px con 2 px de separación, en todos los estados, incluido el foco dentro de tablas |
| El orden del foco sigue la lectura | Se declara explícitamente; no se depende del orden de creación de los widgets |
| Los diálogos atrapan el foco | `Tab` circula dentro del diálogo y no sale de él hasta que se cierra |
| `Esc` siempre cierra | Primero el diálogo, después el menú, después limpia el buscador |

Ningún atajo de una sola letra sin `Ctrl` cuando el foco está en un campo de texto:
escribir «a» en el buscador tiene que escribir «a», no saltar de sección.

### 8.3 Tamaño y densidad

| Requisito | Cómo se cumple |
|-----------|----------------|
| Áreas de pulsación comfortable | Alturas fijas de 36 px en botones y campos, 44 px en las filas de la barra lateral |
| Escalado del sistema respetado | Pruebas al 100 %, 125 % y 150 %. El diseño no usa alturas fijas en píxeles de contenido, solo en contenedores |
| Sin dependencia del color | Toda la información de estado lleva texto |
| Sin dependencia de la posición | El estado de una columna se lee en su celda, no por su posición en la fila |

### 8.4 Lectores de pantalla

Qt expone el texto accesible de cada widget. Este diseño lo fija como requisito:

| Elemento | Texto accesible |
|----------|-----------------|
| Icono sin texto | Obligatorio: nunca un icono solo. Si aparece solo, es decorativo y no se anuncia |
| Pastilla de estado | «Disponible», «5 de 12 disponibles», «1 dañada» |
| Selector de cantidad | «Cantidad de ollas», valor, y el máximo permitido como descripción |
| Columna de tabla | Nombre de la columna y, en las de cantidad, la unidad |
| Fila de tabla | Se anuncia como una frase: «Olla, Utensilios, 10 total, 8 disponibles» |

---

## 9. Recomendaciones para implementar en PySide6

Estas recomendaciones no cambian la arquitectura de `ARCHITECTURE.md`: la
materializan. Widgets nativos de `QtWidgets`, sin QML, como ya está decidido.

### 9.1 Correspondencia entre el diseño y Qt

| Concepto de diseño | Widget de PySide6 | Nota |
|--------------------|-------------------|------|
| Ventana con menú lateral y páginas | `QMainWindow` + `QStackedWidget` | Ya decidido en la arquitectura |
| Menú lateral | `QListWidget` con `QListView` customised, o lista propia sobre `QAbstractListModel` | `ListView` de Qt se ve genérica; conviene un delegate propio |
| Barra de herramientas de sección | `QWidget` con `QHBoxLayout` | No usar `QToolBar`: su aspecto nativo rompe el tema |
| Tabla | `QTableView` + `QAbstractTableModel` | Nunca `QTableWidget` (decidido en la arquitectura) |
| Pastilla de estado | `QStyledItemDelegate` | Permite el fondo redondeado y el texto centrado |
| Cifra grande de `StatCard` | `QWidget` con dos `QLabel` | Sin `QFrame` con sombra, para controlar el borde |
| Campo de formulario con etiqueta y error | `QFormLayout` con `AboveField` (ya decidido) + un `QLabel` de error fijo debajo | El alto del campo se reserva para que no «salte» al aparecer el error |
| Buscador | `QLineEdit` con `QTimer` de 250 ms + `QCompleter` opcional | El retardo evita una consulta por pulsación |
| Selector de cantidad | `QSpinBox` con botones propios | Los nativos de Qt rompen el tema |
| Diálogo de confirmación | `QDialog` propio, no `QMessageBox` | Se necesita el nombre del registro y un botón con la acción |
| Aviso flotante | `QWidget` no modal en la ventana principal, con `QTimer` | `QMessageBox` no es un toast |
| Filtros de Reportes | `QDateEdit` para fechas, `QComboBox` para estado y categoría | En la barra de herramientas, no en un diálogo aparte |

### 9.2 Cómo organizar el tema

Recomendación de estructura, coherente con `ARCHITECTURE.md` (`core/` y
`ui/theme.py`):

1. Un módulo de tokens: una estructura de datos con **todos** los valores de las
   secciones 3.1, 3.4, 3.5 y 3.6. Es la única fuente de verdad.
2. `ui/theme.py` **genera** la hoja de estilos a partir de esos tokens en lugar de
   tener el QSS escrito a mano. Si un color cambia, cambia en un sitio.
3. El QSS se aplica a `QApplication` una vez, al arrancar.
4. Los colores que QSS no alcanza (delegates, gráficos) se toman del mismo módulo de
   tokens, nunca de un literal suelto.
5. Todas las medidas en píxeles, nunca en puntos, para que el escalado de Windows
   funcione sin conversiones.

### 9.3 Rendimiento

- **Ninguna consulta en el hilo de la interfaz.** Búsquedas y agregados del panel
  van en `QThreadPool`. Mientras cargan, la interfaz sigue respondiendo; es el
  requisito de RNF-06 (panel en menos de 1 segundo) y de RNF-08 (la aplicación no se
  cierra por un dato inesperado).
- **`QAbstractTableModel` con carga por páginas** para Reportes, en vez de cargar
  todo el historial en memoria.
- Los filtros de tabla se aplican en la consulta, no recorriendo filas en Python.

### 9.4 Pruebas

- Cada componente con nombre de objeto estable (`objectName`), para que `pytest-qt`
  pueda encontrarlo sin depender del texto visible.
- Los estados de la paleta como constantes, para que un test pueda comprobar el
  contraste de cualquier par nuevo que se añada.
- Pruebas de maquetado a 1024 × 640, 1360 × 840 y 1920 × 1080, y con escalado del
  125 %.

### 9.5 Lo que conviene decidir antes de maquetar

| Decisión | Por qué hay que cerrarla antes |
|----------|-------------------------------|
| Librería de iconos (SVG propios, Material Symbols u otra) | Determina si hay que generar los iconos y cómo se empaquetan en PyInstaller |
| Si `QTableView` se personaliza con `QSS` o con delegates | Afecta a todos los listados de la aplicación |
| Formato de los datos exportados | La pantalla de reportes necesita un hueco reservado, aunque la exportación sea de una etapa posterior |
| Idioma de la interfaz si algún día se usa en otro país | Ahora es solo español; no dejarlo a medias sería más caro que hacerlo bien |

---

## 10. Contradicciones detectadas

Ninguna se ha resuelto modificando reglas de negocio. Se listan con la propuesta de
diseño y lo que hace falta decidir.

| # | Contradicción | Dónde | Propuesta de diseño | Qué hace falta |
|---|--------------|-------|---------------------|----------------|
| **C-1** | Esta etapa pide un menú de **6 secciones**. `REQUIREMENTS.md` sección 6 define **10 pantallas**, que incluyen Categorías, Incidentes, Respaldo y Configuración | Prompt 3 §3 frente a `REQUIREMENTS.md` §6 | Las 6 pedidas son las entradas principales. Las otras 4 se mantienen: Incidentes, Respaldo y Configuración como entradas secundarias separadas, y Categorías como pestaña dentro de Inventario. Ninguna función se pierde | Confirmar con Sonia que el agrupamiento le sirve. Si prefiere exactamente 6, habría que mover Incidentes a un diálogo, lo que **contradiría** RF-ALA-02 |
| **C-2** | La paleta de `ARCHITECTURE.md` §4 declara contraste mínimo 4.5:1, pero su color de advertencia `#B26A00` da **4.24:1** sobre blanco | `ARCHITECTURE.md` §4 | Se conserva `#B26A00` y se añade un tono de texto más oscuro, `#9C5800` (5.51:1), para texto y pastillas | Decidir si se acepta el tono adicional o se corrige el valor en `ARCHITECTURE.md`. **No se ha modificado ese documento** |
| **C-3** | «Estadísticas del inventario» aparece dos veces en el prompt: en el panel principal (§4) y en Reportes (§9) | Prompt 3 §4 y §9 | El Panel muestra cifras operativas del día; Reportes muestra el análisis agregado por categoría, estado y periodo. No son la misma consulta ni la misma granularidad | Confirmar que la separación es la esperada |
| **C-4** | El flujo de devolución pide «seleccionar el préstamo correspondiente» (singular), pero un estudiante puede tener **varios** préstamos activos (RN-16) y el modelo exige que cada devolución pertenezca a un solo `prestamo_id` | Prompt 3 §8 frente a RN-16 y `DATABASE_DESIGN.md` §4.7 | Se devuelve de un préstamo cada vez. Si Sonia quiere devolver artículos de dos préstamos, confirma dos devoluciones. Es lo que el modelo permite sin cambios | Sonia puede preferir una pantalla que permita marcar dos préstamos y genere las dos devoluciones en una sola confirmación. Sería un cambio de comportamiento, y se documentaría antes de implementarlo |
| **C-5** | El Panel debe mostrar «préstamos que necesitan atención», pero el término no está definido en ninguna parte | Prompt 3 §4 | La quinta tarjeta la ocupa RF-DAS-05 (incidentes registrados, con desglose). «Préstamos que necesitan atención» se resuelve como una **lista** bajo las tarjetas, no como una cifra más. Definición propuesta: un préstamo entra en esa lista si (a) tiene unidades pendientes de devolución, o (b) tiene un incidente abierto, o (c) tiene `fecha_limite` registrada y la fecha ya pasó | Validar la definición. En particular, decidir si (c) debe existir siquiera, porque ADR-04 dice que no hay fecha límite real, y por tanto (c) sería código muerto |
| **C-6** | El prompt pide distinguir «préstamos activos, vencidos e incidentes pendientes», pero RN-25, ADR-04 y RF-ALA-03 establecen que no se marca vencido nada mientras no exista `fecha_limite` | Prompt 3 §4 frente a RN-25 y RF-ALA-03 | No hay categoría «vencido» en el Panel. En su lugar, «pendiente de devolución». El estado «vencido» existe en el modelo, pero se muestra solo si algún día hay `fecha_limite` | Ninguno: el prompt y las reglas coinciden. Se documenta para que no se implemente por inercia una etiqueta de «vencido» que el sistema no puede calcular |
| **C-7** | El prompt pide cinco cifras en el Panel y la quinta es «préstamos que necesitan atención». RF-DAS-01 a RF-DAS-05 también definen cinco cifras, y la quinta es «incidentes registrados» | Prompt 3 §4 frente a RF-DAS-05 | Las cinco tarjetas siguen a RF-DAS-01…RF-DAS-05, porque son requisitos con criterio de aceptación verificable. «Préstamos que necesitan atención» se añade como lista. Así se cumplen las cinco cifras del prompt y ningún requisito queda sin tarjeta | Confirmar que el Panel con cinco tarjetas más una lista es aceptable, o si Sonia prefiere sustituir la quinta tarjeta por el recuento de préstamos que necesitan atención |
| **C-8** | `ARCHITECTURE.md` indicaba que los mensajes y errores se muestran con `QMessageBox`, mientras que este diseño y `UI_COMPONENTS.md` usan `ConfirmDialog`, `InlineNotice` y avisos flotantes propios | `ARCHITECTURE.md` §7 frente a `UI_DESIGN.md` §9 y `UI_COMPONENTS.md` | Gana este diseño: `QMessageBox` no admite ni el nombre del registro, ni botón con verbo propio, ni doble confirmación. Los mensajes salen por los componentes de `UI_COMPONENTS.md` | Ninguno. Es una decisión técnica, no una regla de negocio, así que `ARCHITECTURE.md` §7 se ha actualizado para que ambos documentos digan lo mismo |

---

## 11. Lo que este diseño no cubre

- El contenido de cada pantalla, que está en `UI_SCREENS.md`.
- La especificación de cada componente, que está en `UI_COMPONENTS.md`.
- Los recorridos paso a paso y el catálogo de mensajes, que están en `UI_FLOWS.md`.
- Cualquier decisión sobre implementación, que corresponde a las etapas 5 y 6 de
  `DEVELOPMENT_PLAN.md`.
