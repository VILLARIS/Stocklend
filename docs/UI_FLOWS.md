# StockLend — Flujos, validaciones y mensajes

> **Estado del documento:** propuesta de diseño. **Ningún flujo está implementado ni
> probado.** No hay código de interfaz, ni servicios, ni validaciones en el
> repositorio.
>
> **Los mensajes de este documento son la especificación del texto que verá Sonia.**
> Si un mensaje aquí y la implementación difieren, hay un error: o en el texto, o en el
> código. RNF-01 exige que todo esté en español, incluidos los errores.

---

## 1. Cómo usar este documento

| Documento | Contenido |
|-----------|-----------|
| `UI_DESIGN.md` | Idioma visual, ventana, navegación, accesibilidad |
| `UI_SCREENS.md` | Las pantallas, sección por sección |
| `UI_COMPONENTS.md` | Los componentes y sus estados |
| `UI_FLOWS.md` | **Este.** Recorridos completos, validaciones, mensajes y confirmaciones |

**Ninguna validación de este documento añade una regla de negocio.** Todas
proceden de `REQUIREMENTS.md` o de `DATABASE_DESIGN.md`. La columna «De dónde sale»
de cada tabla lo dice. Si aquí aparece una restricción que no está en ninguna de las
dos, es un error de este documento y hay que corregirlo, no el requisito.

---

## 2. Los seis flujos

| # | Flujo | Pasos | Requisitos |
|---|-------|-------|------------|
| 3 | [Registrar un préstamo](#3-flujo-registrar-un-préstamo) | 6 | RF-PRE-01…09, RF-INV-07, RF-INV-08 |
| 4 | [Registrar una devolución](#4-flujo-registrar-una-devolución) | 5 | RF-DEV-01…11, RNF-03 |
| 5 | [Registrar un artículo](#5-flujo-registrar-un-artículo) | 4 | RF-INV-01, RF-INV-08, RF-INV-10 |
| 6 | [Ajustar existencias](#6-flujo-ajustar-existencias) | 4 | RF-INV-03, RF-INV-06, RN-07 |
| 7 | [Anular un préstamo](#7-flujo-anular-un-préstamo) | 3 | RF-PRE-07, RNF-02 |
| 8 | [Registrar un incidente](#8-flujo-registrar-un-incidente) | 4 | RF-DEV-05, RF-DEV-09, RF-DEV-10 |

## 2.1 Los dos flujos que no tienen formulario

| Flujo | Requisitos | Por qué no tiene formulario |
|-------|-----------|----------------------------|
| Cerrar un préstamo | RF-DEV-07 | No hay nada que decidir. Cuando lo pendiente llega a cero, el estado cambia solo. La interfaz solo lo **anuncia** en el resumen previo |
| Crear una categoría | RF-INV-02 | Es un campo y un botón. Un diálogo para una palabra sería un obstáculo |

---

## 3. Flujo: registrar un préstamo

**Objetivo de la etapa:** que Sonia registre una entrega completa sin salirse de la
pantalla de Préstamos y sin pasar por más de dos diálogos.

```
  Préstamos  ·  [+ Préstamo]
       │
       │  1. Abre el diálogo. Paso 1: buscar al estudiante
       ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  [ Buscar por nombre o código…                       ]       │
  │  ┌──────────────────────────────────────────────────────┐    │
  │  │ 20231234567  Ana Ramírez Solís                       │    │
  │  │ 20231234568  Bruno Díaz Navarro                      │    │
  │  └──────────────────────────────────────────────────────┘    │
  │  ⚠  Ana Ramírez Solís tiene 2 unidades pendientes de         │
  │     otros préstamos.                                          │
  │                                                              │
  │                              [ Cancelar ]  [ Continuar → ]    │
  └──────────────────────────────────────────────────────────────┘
       │
       │  2. Paso 2: artículos, cantidades, comentario, fecha
       ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  1  Estudiante   Ana Ramírez Solís · 20231234567  [ Cambiar ] │
  │  ──────────────────────────────────────────────────────────  │
  │  [ Buscar artículo…                                  ]       │
  │  ┌──────────────────────────────────────────────────────┐    │
  │  │ Olla grande   8 disponibles      Cantidad [ − 2 + ]   │    │
  │  │ Ollera mediana 6 disponibles     Cantidad [ − 1 + ]   │    │
  │  └──────────────────────────────────────────────────────┘    │
  │                                                              │
  │  Añadidos                                                     │
  │    Olla grande     2                                          │
  │    Ollera mediana  1                                    [ × ] │
  │    ─────────────────                                            │
  │    Total 3 unidades                                            │
  │                                                              │
  │  Comentario (opcional)                                        │
  │  ┌──────────────────────────────────────────────────────┐    │
  │  │ Práctica 3 — medición de densidades                   │    │
  │  └──────────────────────────────────────────────────────┘    │
  │                                                              │
  │  Fecha y hora  [ 25/09/2026 09:14 ]                           │
  │                                                              │
  │                      [ Cancelar ]   [ Registrar préstamo ]    │
  └──────────────────────────────────────────────────────────────┘
       │
       │  3. Confirmación previa: qué va a cambiar
       ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  Registrar préstamo                                           │
  │                                                              │
  │  Vas a registrar un préstamo a Ana Ramírez Solís.            │
  │                                                              │
  │  Esto hace dos cosas:                                         │
  │   · descuenta 3 unidades del inventario                       │
  │   · deja constancia de la entrega con fecha de hoy            │
  │                                                              │
  │  El descuento se aplica en la misma operación.                │
  │                                                              │
  │              [ Cancelar ]   [ Registrar préstamo ]            │
  └──────────────────────────────────────────────────────────────┘
       │
       │  4. Resultado
       ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  ✓  Préstamo PRE-2026-000013 registrado: 3 unidades          │
  │                                                              │
  │     PRÉSTAMOS   Añadido: Olla grande 2 · Ollera mediana 1     │
  └──────────────────────────────────────────────────────────────┘
```

### 3.1 Los seis pasos, y por qué

| # | Paso | Detalle |
|---|------|---------|
| 1 | Abrir el diálogo | Desde «+ Préstamo» o con `Ctrl+N` en Préstamos. Se abre en el **paso 1**, con el buscador ya enfocado |
| 2 | Elegir estudiante | Se escribe el nombre o el código. Filtra mientras se escribe. `↓` elige la primera fila, `Enter` confirma la selección |
| 3 | Avisar de pendientes, sin bloquear | Si tiene unidades pendientes de otros préstamos, se avisa y se continúa (RF-PRE-04). No se bloquea el flujo |
| 4 | Elegir artículos y cantidades | Buscador por nombre o código. El máximo de cada cantidad es la disponibilidad **de ese momento** |
| 5 | Confirmar | Diálogo con los dos efectos y con los números. Obligatorio: afecta cantidades e historial (RNF-02) |
| 6 | Resultado | `Toast` con el folio generado y el detalle de lo descontado |

**El botón de acción está deshabilitado hasta el paso 4.** En cuanto falta el
estudiante o no hay unidades, el botón lo dice: «Añade al menos un artículo para
registrar el préstamo».

**El folio se genera al guardar** y no antes (RF-PRE-06). Sonia no ve un folio
tentativo: ve el real, en el mensaje de resultado.

### 3.2 Casos especiales

| Caso | Comportamiento | Requisito |
|------|----------------|-----------|
| Artículo con control individual | La cantidad se elige marcando unidades con su código, no con un número. Se muestran los códigos, para que Sonia pueda leerlos en voz alta en clase | RF-INV-08, RF-INV-10 |
| Artículo con 0 disponibles | Aparece en la lista, atenuado, con la pastilla «Sin existencias», y su cantidad está deshabilitada. **No desaparece de la lista**: Sonia necesita verlo para saber que existe | RF-INV-07 |
| Artículo no prestable | Aparece con la pastilla «No prestable» y deshabilitado. Se puede devolver, no prestar (RF-INV-09) | RF-INV-09 |
| Dos unidades de un artículo que quedan en 1 | El campo de cantidad sube a 2 y se marca: «Solo hay 1 unidad disponible». No se recorta en silencio | RF-INV-07 |
| Estudiante inactivo | Se muestra atenuado y no se puede seleccionar. El motivo está escrito al lado | RF-EST-06 |
| El artículo se agota mientras se rellena | La confirmación falla con un aviso y un botón «Reintentar». No se guarda a medias (RNF-07) | RNF-07 |
| Préstamo sin comentario | Se guarda igual. El comentario es opcional (RF-PRE-09) | RF-PRE-09 |
| Fecha modificada a mano | Se acepta, y el valor guardado es el que Sonia escribió (RF-PRE-02) | RF-PRE-02 |

### 3.3 Validaciones

| Campo | Regla | Mensaje | De dónde sale |
|-------|-------|---------|--------------|
| Estudiante | Obligatorio | «Elige un estudiante de la lista.» | RF-PRE-01 |
| Estudiante | Debe estar activo | «Este estudiante está marcado como inactivo y no puede recibir préstamos nuevos.» | RF-EST-06 |
| Artículos | Al menos una unidad | «Añade al menos un artículo para registrar el préstamo.» | RF-PRE-03 |
| Cantidad | Mayor que 0 | «La cantidad tiene que ser al menos 1.» | RF-INV-01 |
| Cantidad | Menor o igual a lo disponible | «Solo hay *n* unidades disponibles de *artículo*.» | RF-INV-07 |
| Unidad individual | No puede estar prestada o dañada | «La unidad *OLG-003* ya está prestada. Elige otra.» | RF-INV-08 |
| Comentario | Máximo 200 caracteres | «El comentario no puede pasar de 200 caracteres.» | RF-PRE-09 |
| Fecha | Formato de fecha y hora | «Escribe la fecha como día/mes/año y la hora como hora:minuto.» | RF-PRE-02 |

**Las validaciones de cantidad se aplican al perder el foco del campo**, no al
pulsar «Registrar». Un formulario con siete errores en rojo al enviar es un muro.

---

## 4. Flujo: registrar una devolución

**Es la operación común de Sonia (RNF-03).** El objetivo declarado es cerrarla en
**cinco pasos o menos**, y la estructura de `UI_SCREENS.md` 6.3 está pensada para
conseguirlo.

```
  Devoluciones  ·  [+ Devolución]
       │
       │  1. Buscar al estudiante
       ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  [ Buscar por nombre o código…                       ]       │
  │  ┌──────────────────────────────────────────────────────┐    │
  │  │ 20231234567  Ana Ramírez Solís   · 2 pendientes      │    │
  │  │ 20231234568  Bruno Díaz Navarro  · 0 pendientes      │    │
  │  └──────────────────────────────────────────────────────┘    │
  │  ⚠  Bruno Díaz Navarro no tiene préstamos pendientes.        │
  │     Elige a otro estudiante.                                  │
  └──────────────────────────────────────────────────────────────┘
       │
       │  2. Elegir el préstamo
       ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  1  Estudiante   Ana Ramírez Solís · 20231234567  [ Cambiar ] │
  │  ──────────────────────────────────────────────────────────  │
  │  2  Préstamos activos                                          │
  │  ┌──────────────────────────────────────────────────────┐    │
  │  │ PRE-2026-000012   12/09/2026   4 prestadas   2 pend.  │    │
  │  │ PRE-2026-000008   28/08/2026   3 prestadas   3 pend.  │    │
  │  └──────────────────────────────────────────────────────┘    │
  └──────────────────────────────────────────────────────────────┘
       │
       │  3. Indicar qué vuelve y en qué estado
       ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  1  Estudiante   Ana Ramírez Solís · 20231234567  [ Cambiar ] │
  │  2  Préstamo     PRE-2026-000012 · 2 pendientes  [ Cambiar ] │
  │  ──────────────────────────────────────────────────────────  │
  │                                                              │
  │    Olera mediana   1 prestada                                 │
  │      Cantidad que vuelve [ − 1 + ]   Bueno [ 1 ]  Dañada [ 0 ]│
  │                                                              │
  │    Olla grande     2 prestadas                                │
  │      Cantidad que vuelve [ − 2 + ]   Bueno [ 2 ]  Dañada [ 0 ]│
  │                                                              │
  │    Paño             1 prestada                                │
  │      Cantidad que vuelve [ − 0 + ]  Bueno [0] Dañ. [ 0 ]     │
  │                                                              │
  │  ──────────────────────────────────────────────────────────  │
  │  3 unidades vuelven · 0 dañadas · 0 perdidas                 │
  │  1 unidad queda pendiente                                     │
  │  Al guardar, PRE-2026-000012 seguirá Activo.                  │
  └──────────────────────────────────────────────────────────────┘
       │
       │  4. Confirmación, solo si algo se pierde o se daña
       ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  Registrar devolución                                         │
  │                                                              │
  │  Vas a registrar la devolución de PRE-2026-000012.           │
  │                                                              │
  │  3 unidades vuelven en buen estado.                          │
  │  1 unidad se registra como dañada:                           │
  │    · Olla grande · 1 unidad                                  │
  │    · se genera un incidente de daño                          │
  │                                                              │
  │  La responsabilidad del daño se registrará como «sin        │
  │  determinar». Puedes asignarla en Incidentes.                │
  │                                                              │
  │              [ Cancelar ]   [ Registrar devolución ]         │
  └──────────────────────────────────────────────────────────────┘
       │
       │  5. Resultado
       ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  ✓  Devolución registrada: 3 unidades devueltas, 1 dañada     │
  │                                                              │
  │     PRÉSTAMOS   PRE-2026-000012 · 1 unidad pendiente          │
  └──────────────────────────────────────────────────────────────┘
```

### 4.1 Los cinco pasos, y por qué

| # | Paso | Detalle |
|---|------|---------|
| 1 | Buscar al estudiante | Filtra mientras se escribe, insensible a acentos (RF-EST-03) |
| 2 | Elegir el préstamo | Solo los que tienen pendiente. Los que no, se muestran con el motivo |
| 3 | Qué vuelve y en qué estado | Cantidad y condición **en la misma fila** (RF-DEV-03) |
| 4 | Confirmar | **Solo si hay algo dañado o perdido.** Si las tres unidades vuelven en buen estado, no hay confirmación: no cambia nada que pueda contar mal |
| 5 | Resultado | `Toast` con el resumen y el estado en que queda el préstamo |

**El paso 4 es condicional a propósito.** RNF-02 pide confirmación de toda acción
que afecte cantidades o histórico, y una devolución los afecta. Pero añadir un
diálogo a la operación más frecuente del programa (RNF-03) cuesta un paso en cada
operación, y ese paso se paga cientos de veces. La regla que este diseño propone es:

> Si la devolución **no crea ningún incidente**, el botón «Registrar devolución» es
> el que confirma. Si **crea al menos un incidente**, hay diálogo.

Esto se registra como una decisión de diseño pendiente de validar con Sonia, porque
es una lectura de RNF-02 que podría no ser la que ella quiera. Si prefiere
confirmación siempre, se añade el diálogo y el flujo pasa a seis pasos.

### 4.2 Validaciones

| Campo | Regla | Mensaje | De dónde sale |
|-------|-------|---------|--------------|
| Estudiante | Obligatorio | «Busca al estudiante que devuelve.» | RF-DEV-01 |
| Préstamo | Debe tener pendiente | «Este préstamo no tiene unidades pendientes de devolución.» | RF-DEV-04 |
| Cantidad devuelta | De 0 a lo pendiente | «Quedan *n* unidades pendientes como máximo.» | RF-DEV-08 |
| Suma de condiciones | No puede superar lo pendiente | «Has asignado *x* unidades, pero solo quedan *n* pendientes.» | RF-DEV-08 |
| Cantidad devuelta | Mayor o igual a 0 | «La cantidad no puede ser menor que cero.» | RF-DEV-07 |
| Dañada o perdida | Mayor o igual a 0 | «La cantidad no puede ser menor que cero.» | RF-DEV-05 |
| Unidad individual | Estado elegido | «Indica en qué estado vuelve *OLG-003*.» | RF-DEV-10 |
| Unidad ya dañada | Solo «bueno» o «perdida» | «*OLG-004* ya venía dañada. Solo puedes registrarla como perdida.» | RF-DEV-10 |

**El último caso es una decisión de diseño que hay que validar.** La interfaz asume
que una unidad que ya estaba dañada no puede empeorarse, y por eso no ofrece esa
opción. Si Sonia necesita registrar que una unidad dañada se rompió del todo, el
formulario necesita una cuarta opción, y eso sería un cambio de la regla.

### 4.3 El resumen, que es lo más importante del paso 3

Bajo la lista de artículos hay una línea que se recalcula con cada cambio:

```
  3 unidades vuelven · 0 dañadas · 0 perdidas
  1 unidad queda pendiente
  Al guardar, PRE-2026-000012 seguirá Activo.
```

Tres cosas que hace, y que no hace ninguna otra parte de la aplicación:

1. **Duelve la suma** de lo que Sonia ha marcado, sin que tenga que calcularla.
2. **Dice qué queda pendiente** después de guardar. Es la pregunta que Sonia se
   hace al devolver una parte (RF-DEV-04).
3. **Anuncia el cierre del préstamo** si no va a quedar nada pendiente
   (RF-DEV-07). Sonia ve que el préstamo se va a cerrar antes de cerrarlo.

**Si la suma no cuadra**, el resumen se pone en `error` y el botón de guardar se
deshabilita: «Has asignado 3 unidades, pero solo quedan 2 pendientes». Nunca se
guarda una devolución imposible (RF-DEV-08).

---

## 5. Flujo: registrar un artículo

```
  Inventario  ·  [+ Artículo]
       │
       ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  Registrar artículo                                          │
  │                                                              │
  │  Nombre del artículo *                                       │
  │  ┌──────────────────────────────────────────────────────┐    │
  │  │ Olla grande                                            │    │
  │  └──────────────────────────────────────────────────────┘    │
  │                                                              │
  │  Categoría *                        [ Utensilios · Ollas ▾ ]  │
  │                                                              │
  │  Cantidad inicial *                  [ − 10 + ]              │
  │                                                              │
  │  ☐ Control individual de unidades                             │
  │     Si está activo, el sistema pide un código por unidad.     │
  │                                                              │
  │  ☑ Puede prestarse                                           │
  │     Desactívalo si el artículo está en reparación.            │
  │                                                              │
  │  Nota (opcional)                                              │
  │  ┌──────────────────────────────────────────────────────┐    │
  │  │                                                      │    │
  │  └──────────────────────────────────────────────────────┘    │
  │                                                              │
  │                  [ Cancelar ]        [ Registrar artículo ]    │
  └──────────────────────────────────────────────────────────────┘
       │
       │  Si se activa el control individual, aparece esto:
       ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  Códigos de unidad (10)                                       │
  │                                                              │
  │  [ Generar códigos con el patrón OLG-001…OLG-010 ]            │
  │                                                              │
  │  OLG-001  OLG-002  OLG-003  OLG-004  OLG-005  …               │
  │                                                              │
  │  ⚠ 2 códigos repetidos. Cada unidad necesita un código único. │
  │                                                              │
  │  El patrón se propone con el prefijo del artículo, pero Sonia  │
  │  puede cambiar cada código. Nada se asigna sin que se vea.     │
  └──────────────────────────────────────────────────────────────┘
```

| # | Paso | Detalle |
|---|------|---------|
| 1 | Abrir el diálogo | Con el foco en el campo de nombre |
| 2 | Nombre y categoría | El nombre se valida al perder el foco. La categoría se elige de las existentes |
| 3 | Cantidad inicial | 0 es válido. Un artículo que se crea sin existencias es legítimo |
| 4 | Control individual | Si se activa, aparecen los códigos. Si la cantidad es 0, se avisa: «Un artículo con control individual necesita al menos una unidad» |
| 5 | Prestable | Marcado por defecto. Desmarcarlo significa «en reparación» (RF-INV-09) |
| 6 | Registrar | Sin confirmación: crear un registro nuevo no altera cantidades existentes ni historial (RNF-02) |

**Los códigos se proponen, no se imponen.** El patrón automático es una comodidad
(RF-INV-08 pide que el sistema pida un código por unidad, y generarlo es la forma
de que Sonia no escriba diez códigos a mano), pero los códigos se ven, se pueden
cambiar uno a uno, y si hay repetidos el botón se deshabilita y lo dice. Nada se
guarda sin que Sonia lo haya visto (RF-INV-10).

### 5.1 Validaciones

| Campo | Regla | Mensaje | De dónde sale |
|-------|-------|---------|--------------|
| Nombre | Obligatorio | «El nombre del artículo es obligatorio.» | RF-INV-01 |
| Nombre | Único, ignorando mayúsculas y espacios | «Ya existe un artículo llamado *Olla grande*.» | RF-INV-01 |
| Categoría | Obligatoria y existente | «Elige una categoría de la lista.» | RF-INV-01 |
| Cantidad | Mayor o igual a 0 | «La cantidad no puede ser menor que cero.» | RF-INV-01 |
| Control individual | Solo si la cantidad es mayor que 0 | «Un artículo con control individual necesita al menos una unidad.» | RF-INV-08 |
| Códigos | Único por unidad | «Los códigos *OLG-003* y *OLG-007* están repetidos. Cada unidad necesita un código único.» | RF-INV-10 |
| Nota | Máximo 200 caracteres | «La nota no puede pasar de 200 caracteres.» | — |

### 5.2 Modificar un artículo

Editar un artículo que ya está en el inventario tiene una diferencia importante con
crearlo: **la cantidad no se edita en el formulario de artículo.** Se cambia por el
flujo de ajuste, que es el que deja rastro (RF-INV-06).

| Campo | Editable | Por qué |
|-------|----------|---------|
| Nombre | Sí | No afecta al historial. Los movimientos guardan el nombre en su momento, o el identificador, según `DATABASE_DESIGN.md` |
| Categoría | Sí | No afecta al historial |
| Cantidad | **No** | Cambiarla aquí no dejaría rastro. Va por el flujo de ajuste, con motivo |
| Control individual | Sí, pero **no se puede desactivar** si ya hay unidades registradas | Desactivarlo dejaría esas unidades sin poder seguirse. Si ya no se controlan, el aviso explica por qué |
| Prestable | Sí | Desactivarlo impide préstamos nuevos, pero no impide devoluciones (RF-INV-09) |
| Nota | Sí | |

---

## 6. Flujo: ajustar existencias

```
  Inventario  ·  fila · ⋯ · Ajustar cantidad
       │
       ▼
  ┌──────────────────────────── Ajustar existencias ─────────────────────────────┐
  │                                                                              │
  │  Olla grande · Utensilios · Ollas                                             │
  │                                                                              │
  │  Cantidad actual          [ − 10 + ]                                         │
  │                                                                              │
  │  Nueva cantidad           [ − 9 + ]        Ajuste: −1                          │
  │                                                                              │
  │  ────────────────────────────────────────────────────────────────────────    │
  │  Motivo (obligatorio)                                                         │
  │  ┌────────────────────────────────────────────────────────────────────────┐  │
  │  │ Se rompió una durante la clase de química                             │  │
  │  └────────────────────────────────────────────────────────────────────────┘  │
  │  El motivo no puede estar vacío: es la explicación que quedará en el         │
  │  historial.                                                                  │
  │                                                                              │
  │                        [ Cancelar ]        [ Registrar movimiento ]          │
  └──────────────────────────────────────────────────────────────────────────────┘
       │
       ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  Registrar movimiento                                      │
  │                                                              │
  │  Vas a registrar una pérdida de 1 unidad de Olla grande.    │
  │                                                              │
  │  Esto hace dos cosas:                                         │
  │   · la unidad pasa de «disponible» a «dañado»                │
  │   · genera un incidente de daño sin responsable               │
  │                                                              │
  │  El movimiento queda registrado en el historial.              │
  │                                                              │
  │                  [ Cancelar ]   [ Registrar movimiento ]      │
  └──────────────────────────────────────────────────────────────┘
```

| # | Paso | Detalle |
|---|------|---------|
| 1 | Abrir el diálogo | Con la cantidad actual ya cargada, y el ajuste calculado en vivo mientras Sonia escribe |
| 2 | Nueva cantidad | El ajuste se ve **antes** de aplicar: «Ajuste: −1», en rojo si baja, en verde si sube |
| 3 | Motivo | Obligatorio, con la explicación en el propio campo |
| 4 | Confirmar | Obligatorio: altera cantidades e historial (RNF-02) |

**El ajuste de cantidad tiene un detalle que no se inventa:** el diálogo calcula el
ajuste, pero el diálogo no decide el estado. Si Sonia baja de 10 a 9, la interfaz
pregunta en qué estado entra esa unidad, porque bajar la cantidad por una rotura y
bajarla por una pérdida dan resultados distintos. Ese paso solo aparece cuando el
ajuste cambia la suma de los estados.

### 6.1 Validaciones

| Campo | Regla | Mensaje | De dónde sale |
|-------|-------|---------|--------------|
| Nueva cantidad | Mayor o igual a 0 | «La cantidad no puede ser menor que cero.» | RN-07 |
| Nueva cantidad | No puede bajar de lo prestado | «No puedes bajar la cantidad total por debajo de lo que está prestado. Tienes *n* unidades prestadas.» | RF-INV-05 |
| Motivo | Obligatorio, no vacío | «Escribe el motivo del movimiento.» | RF-INV-06 |
| Motivo | Máximo 200 caracteres | «El motivo no puede pasar de 200 caracteres.» | RF-INV-06 |
| Estado | Obligatorio si el ajuste cambia la suma | «Indica en qué estado queda la unidad.» | RF-INV-05 |

### 6.2 El movimiento, en el historial

Cada ajuste deja una fila en el historial del artículo, con la fecha, el tipo de
movimiento, el antes y el después, y el motivo. **El historial no se edita ni se
borra** (RF-INV-06). Es la diferencia entre «el inventario está mal» y «este artículo
se rompió el martes y aquí está el motivo».

---

## 7. Flujo: anular un préstamo

```
  Préstamos  ·  fila · ⋯ · Anular
       │
       ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  Anular préstamo                                            │
  │                                                              │
  │  Vas a anular el préstamo PRE-2026-000012 de Ana Ramírez      │
  │  Solís.                                                      │
  │                                                              │
  │  Esto hace dos cosas:                                         │
  │   · devuelve 4 unidades al inventario como disponibles        │
  │   · marca el préstamo como anulado, sin borrarlo              │
  │                                                              │
  │  El movimiento queda registrado en el historial.              │
  │                                                              │
  │                  [ Cancelar ]   [ Anular préstamo ]            │
  └──────────────────────────────────────────────────────────────┘
       │
       │  Segunda confirmación
       ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  Anular préstamo                                            │
  │                                                              │
  │  Vas a anular el préstamo PRE-2026-000012 de Ana Ramírez      │
  │  Solís.                                                      │
  │                                                              │
  │  Esto hace dos cosas:                                         │
  │   · devuelve 4 unidades al inventario como disponibles        │
  │   · marca el préstamo como anulado, sin borrarlo              │
  │                                                              │
  │  El movimiento queda registrado en el historial.              │
  │                                                              │
  │  Para confirmar, escribe ANULAR:                              │
  │  ┌──────────────────────────────────────────────────────┐    │
  │  │                                                      │    │
  │  └──────────────────────────────────────────────────────┘    │
  │                                                              │
  │                  [ Cancelar ]   [ Anular préstamo ]            │
  │                                          (deshabilitado)      │
  └──────────────────────────────────────────────────────────────┘
```

| Regla | Detalle | Requisito |
|-------|---------|-----------|
| Solo si no hay devoluciones | Si el préstamo tiene devoluciones, la acción no aparece en el menú. Si se fuerza por otra vía, el mensaje es «Este préstamo tiene devoluciones registradas y no se puede anular» | RF-PRE-07 |
| Doble confirmación | Es el único flujo, junto con restaurar un respaldo, que pide dos veces | RNF-02 |
| El botón destructivo lleva el verbo | «Anular préstamo», no «Aceptar» ni «OK» | — |
| No se borra nunca | El préstamo queda con estado «anulado» y su historial intacto | RF-PRE-07 |
| Las unidades vuelven | Como **disponibles**, nunca a un estado que Sonia no haya pedido | RF-INV-03 |
| Se ve el resultado | `Toast` con el detalle: «Préstamo anulado. 4 unidades devueltas al inventario» | RNF-08 |

---

## 8. Flujo: registrar un incidente

Un incidente se genera **automáticamente** al marcar algo como dañado o perdido, y
también se puede **registrar a mano** cuando algo se rompe o desaparece en la
depósito sin que haya salido nunca en préstamo (RF-INV-11, RF-DEV-09).

```
  Incidentes  ·  [+ Nuevo ]
       │
       ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  Registrar incidente                                        │
  │                                                              │
  │  Artículo *                        [ Olla grande       ▾ ]   │
  │                                                              │
  │  Tipo *                    ( ● ) Daño   (   ) Pérdida         │
  │                                                              │
  │  Procedencia *          ( ● ) Depósito                       │
  │                        (   ) Préstamo                        │
  │                        (   ) Devolución                      │
  │                                                              │
  │  Unidades afectadas                                              │
  │  ┌──────────────────────────────────────────────────────┐    │
  │  │ Cantidad [ − 1 + ]   o   Unidad [ OLG-004 ▾ ]         │    │
  │  └──────────────────────────────────────────────────────┘    │
  │                                                              │
  │  ☐ La responsabilidad es de un estudiante                   │
  │     Sin marcar, el incidente queda sin determinar.            │
  │                                                              │
  │     ┌──────────────────────────────────────────────────┐    │
  │     │  [ Buscar estudiante…                         ]    │    │
  │     └──────────────────────────────────────────────────┘    │
  │                                                              │
  │  Descripción (opcional)                                      │
  │  ┌──────────────────────────────────────────────────────┐    │
  │  │ Se rompió al caer en la práctica                    │    │
  │  └──────────────────────────────────────────────────────┘    │
  │                                                              │
  │                  [ Cancelar ]        [ Registrar incidente ]   │
  └──────────────────────────────────────────────────────────────┘
```

| # | Paso | Detalle |
|---|------|---------|
| 1 | Elegir artículo | Buscador. Si el artículo tiene control individual, se elige la unidad; si no, la cantidad |
| 2 | Tipo | Daño o pérdida. Determina si la unidad pasa a «dañado» o a «faltante» |
| 3 | Procedencia | **Depósito**, **Préstamo** o **Devolución**. Distingue «se rompió en la facultad» de «volvió roto de un préstamo» (RF-DEV-05) |
| 4 | Responsable | Casilla. **Sin marcar, el campo de estudiante no se muestra** (RF-DEV-09) |
| 5 | Registrar | Sin confirmación: registra un hecho. Pero **sí avisa** de que la cantidad del inventario va a cambiar |

### 8.1 El aviso, no la confirmación

Registrar un incidente **altera la cantidad disponible del inventario**, así que
cumple el criterio de RNF-02 y merece confirmación. Pero el diálogo de confirmación
llegaría después de haber rellenado seis campos, y un «Cancelar» al final obliga a
volver atrás. El diseño usa un `InlineNotice` **dentro** del formulario:

```
┌──────────────────────────────────────────────────────────────┐
│  ⚠  Al registrar este incidente, 1 unidad de Olla grande      │
│     pasará de «disponible» a «dañado».                        │
└──────────────────────────────────────────────────────────────┘
```

Sonia ve la consecuencia **mientras rellena**, antes de confirmar. Es el mismo
principio que el resumen de la devolución, aplicado al otro lado del formulario.

### 8.2 Validaciones

| Campo | Regla | Mensaje | De dónde sale |
|-------|-------|---------|--------------|
| Artículo | Obligatorio | «Elige el artículo del incidente.» | RF-DEV-05 |
| Tipo | Obligatorio | «Indica si es un daño o una pérdida.» | RF-DEV-05 |
| Procedencia | Obligatorio | «Indica dónde ocurrió.» | RF-DEV-05 |
| Unidades | Mayor que 0, o una unidad | «Indica cuántas unidades, o elige una.» | RF-DEV-10 |
| Unidades | No puede superar lo disponible | «Solo hay *n* unidades disponibles de *artículo*.» | RF-INV-07 |
| Estudiante | Obligatorio si se marca responsable | «Elige el estudiante responsable.» | RF-DEV-05 |
| Procedencia «depósito» | No admite estudiante | Un artículo que se rompe en la facultad no tiene por qué señalarse a un estudiante. La casilla «La responsabilidad es de un estudiante» **se deshabilita** y el motivo aparece al lado | RF-DEV-09 |
| Descripción | Máximo 200 caracteres | «La descripción no puede pasar de 200 caracteres.» | — |

**La regla de la procedencia «depósito» es una decisión de diseño que hay que
validar.** RF-DEV-09 dice que el estudiante se asocia «cuando la responsabilidad
esté determinada», y este diseño asume que un incidente de depósito nunca lo tiene
automáticamente. Si Sonia necesita poder atribuir un daño del depósito a un
estudiante concreto, la casilla se rehabilita para ese caso.

---

## 9. Catálogo de mensajes del sistema

### 9.1 Los cinco mensajes de error del sistema

Todos en español, sin nombres de tabla ni de columna (RNF-01, RNF-08).

| Situación | Mensaje | Detalle técnico |
|-----------|---------|-----------------|
| La base no existe | «No se encontró la base de datos de StockLend. Indica dónde está o crea una nueva.» | Ruta buscada |
| La base está bloqueada | «StockLend ya está abierto en otra ventana. Ciérrala antes de continuar.» | Sin detalles de SQLite |
| La base se está migrando | «Actualizando la base de datos. No cierres la aplicación.» | Versión de origen y destino |
| Error de escritura inesperado | «No se pudo guardar el cambio. Los datos no se han modificado.» | Referencia del log |
| Error de lectura inesperado | «No se pudieron cargar los datos. Vuelve a intentarlo.» | Referencia del log |

**Ningún error inesperado cierra la aplicación** (RNF-08). Y ninguno muestra un
`Traceback` a Sonia: el identificador del log es para reproducir el fallo, no para
que ella lo investigue.

### 9.2 Los mensajes de resultado

| Operación | Mensaje |
|-----------|---------|
| Artículo registrado | «Artículo *Olla grande* registrado» |
| Artículo modificado | «Artículo *Olla grande* actualizado» |
| Ajuste registrado | «Movimiento registrado: *Olla grande*, −1 unidad, disponible 8 → 7» |
| Estudiante registrado | «Estudiante *Ana Ramírez Solís* registrado» |
| Estudiante modificado | «Datos de *Ana Ramírez Solís* actualizados» |
| Préstamo registrado | «Préstamo *PRE-2026-000013* registrado: 3 unidades» |
| Préstamo anulado | «Préstamo *PRE-2026-000012* anulado. 4 unidades devueltas al inventario» |
| Devolución registrada | «Devolución registrada: 3 unidades devueltas, 1 dañada» |
| Préstamo cerrado | «*PRE-2026-000012* se cerró automáticamente: no queda nada pendiente» |
| Incidente registrado | «Incidente *INC-2026-0007* registrado: 1 unidad de *Olla grande* pasa a dañada» |
| Incidente resuelto | «Incidente *INC-2026-0007* marcado como resuelto» |
| Copia creada | «Copia guardada: 25/09/2026 18:40» |
| Copia restaurada | «Base restaurada desde la copia del 18/09/2026. Reinicia StockLend.» |
| Exportación | «41 préstamos exportados a *stocklend_prestamos_2026-09-12_2026-09-25.csv*» |
| Categoría creada | «Categoría *Limpieza* creada» |

**Todos llevan el identificador del registro.** «Préstamo registrado» sin folio
obligaría a Sonia a buscarlo en la tabla; con folio, puede ir directamente a él.

### 9.3 Los mensajes vacíos

Los tres de `UI_COMPONENTS.md` 5.1, más dos específicos:

| Pantalla | Mensaje |
|----------|---------|
| Panel, lista de atención | «No hay préstamos que necesiten atención» |
| Panel, lista de incidentes | «No hay incidentes abiertos. Todos los registrados están resueltos.» |
| Devoluciones, sin préstamo elegible | «Este estudiante no tiene préstamos pendientes de devolución» |
| Préstamos, sin resultados del filtro | «No hay préstamos anulados» |
| Inventario, artículo sin unidades | «Este artículo no tiene control individual de unidades» |

### 9.4 Lo que nunca se dice

| Prohibido | Por qué | En su lugar |
|-----------|---------|-------------|
| «Error de validación» | No dice nada | El mensaje concreto del campo |
| «Operación fallida» | No dice qué operación | «No se pudo registrar el préstamo» |
| «FATAL», «EXCEPTION», «SQL» | No es un lenguaje de Sonia | «La base no se pudo abrir» |
| «¿Está seguro?» sin más | No dice de qué | «Vas a anular el préstamo *PRE-2026-000012*» |
| «Contraseña incorrecta» | No hay contraseñas | — |
| «NULL», «undefined» | Son valores internos, no mensajes | «Sin indicar» |
| Un número de error sin texto | Obliga a buscarlo en otro sitio | El texto, con la referencia del log aparte |
| Texto en inglés | RNF-01 | Todo en español, sin excepciones |

---

## 10. Atajos de teclado por flujo

| Flujo | Atajos |
|-------|--------|
| Abrir el flujo | `Ctrl+N` en la sección activa, o el botón de la cabecera |
| Moverse en el buscador | `↓` y `↑` recorren los resultados, `Enter` elige el primero |
| Moverse en la lista de artículos | `↓` y `↑` recorren, `Enter` añade el artículo al préstamo |
| Cambiar la cantidad | `↑` y `↓` de uno en uno, `Ctrl` + flecha de cinco en cinco, `Mayús` + flecha a la máxima |
| Validar un campo | `Tab` o `Enter` |
| Confirmar el diálogo | `Enter`, **solo si el formulario es válido** |
| Cancelar | `Esc` |
| Añadir otra línea | `Ctrl+Enter` en el campo de cantidad, para no soltar el ratón al añadir varios artículos |

---

## 11. Tiempos y objetivo de la operación

Los tiempos son los que fija `REQUIREMENTS.md`, no otros nuevos.

| Objetivo | Requisito | Cómo lo afecta este diseño |
|----------|-----------|---------------------------|
| Arranque en menos de 3 s | RNF-04 | La ventana aparece con la barra lateral y la sección activa. Las cifras del Panel llegan después, con un esqueleto. No hay pantalla de bienvenida |
| Panel correcto en menos de 1 s | RNF-06 | Las cinco cifras y las dos listas en una sola consulta. Nada de gráficos ni de consultas en cascada |
| Búsqueda de artículos en menos de 300 ms con 500 artículos | RNF-05 | Filtro en memoria para inventarios y estudiantes, con 250 ms de retardo de tecleo. El margen es de 50 ms, así que **el filtro no puede ser una consulta a la base** |
| Una operación común en pocos pasos | RNF-03 | El flujo de devolución, en cinco pasos |

**El arranque se mide hasta que la ventana es utilizable**, no hasta que la base
está abierta. Si abrir la base tarda, la ventana aparece igual y el contenido se
carga detrás. Sonia puede empezar a navegar mientras el Panel carga.

---

## 12. Preguntas abiertas para Sonia

Estas decisiones las bloquea la interfaz, no la arquitectura. Ninguna se ha resuelto
por cuenta propia.

| # | Pregunta | Qué depende de la respuesta |
|---|----------|---------------------------|
| 1 | ¿La devolución con todo en buen estado necesita confirmación, o basta con el botón? | El flujo 4 pasa de 5 a 6 pasos (sección 4.1). Registrada como contradicción **C-9** en `UI_DESIGN.md` sección 10 |
| 2 | ¿Una unidad que ya venía dañada puede empeorarse a «perdida» en la devolución? | El selector de estado de la unidad pierde una opción (sección 4.2) |
| 3 | ¿Un incidente de depósito puede atribuirse a un estudiante concreto? | La casilla de responsable se rehabilita para ese caso (sección 8.2) |
| 4 | ¿Con qué procedimiento se determina la responsabilidad de una pérdida? | La sección 8.1 tiene un hueco, y el formulario necesita recogerlo |
| 5 | ¿Qué se hace con los estudiantes inactivos que tienen unidades fuera? | Hoy el diseño solo bloquea el préstamo nuevo, no la devolución |
| 6 | ¿Con qué frecuencia se hacen los inventarios físicos? | Ninguna pantalla lo necesita hoy, pero el flujo 6 podría necesitar un tipo de movimiento nuevo |
| 7 | ¿Cuántas copias de respaldo se conservan, y dónde? | La sección Respaldo de `UI_SCREENS.md` propone 10, en la carpeta por defecto |
| 8 | ¿Hace falta subcategorías de más de dos niveles? | El modelo actual es de dos niveles, y `DATABASE_DESIGN.md` lo documenta |
| 9 | ¿Hace falta exportar la ficha de estudiante, o basta con el historial de préstamos? | No está entre los requisitos, y este diseño no lo añade |
| 10 | ¿Hay un segundo usuario previsto? | La interfaz es de un solo usuario. Un segundo usuario cambia el modelo de datos, no solo las pantallas |
| 11 | ¿El registro de un incidente necesita una confirmación final además del aviso en línea? | La sección 8.1 usa un `InlineNotice` en vez de `ConfirmDialog`. Registrada como contradicción **C-10** en `UI_DESIGN.md` sección 10 |
