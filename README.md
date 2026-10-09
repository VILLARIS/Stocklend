# StockLend

Sistema de escritorio para el inventario y el control de préstamos de los
utensilios de cocina, equipos y máquinas que utilizan los estudiantes en las clases
prácticas de industria alimentaria.

StockLend está pensado para sustituir los registros en cuadernos, fichas físicas y
archivos de Excel que se utilizan actualmente, y para que el historial de cada
artículo y de cada estudiante quede guardado de forma confiable.

> **Estado del proyecto: en desarrollo.**
> Existen la base de datos con sus migraciones (Etapa 1) y el dominio con sus
> repositorios (Etapa 2), con pruebas automatizadas en verde. **Todavía no hay
> servicios de negocio, pantallas ni ejecutable.**
>
> El diseño de interfaz está escrito como propuesta en los cuatro documentos
> `UI_*.md`. Eso es una especificación, no una maqueta: no hay todavía ningún widget
> de PySide6, ni una hoja de estilos, ni un icono en el repositorio.

---

## Qué hace (y qué hará)

- **Inventario.** Registro de artículos por nombre, categoría y cantidad, con
  búsqueda rápida y cuatro estados distinguidos: disponible, prestado, dañado y
  faltante.
- **Unidades individuales, cuando hacen falta.** Un artículo puede llevar el control
  individual y registrar cada unidad con su propio código (número de serie). Es
  opcional y se activa solo en los artículos que lo necesitan; los demás siguen
  manejándose por cantidad, sin ningún dato de más.
- **Estudiantes.** Registro por código universitario, con búsqueda por nombres y
  apellidos e historial de préstamos.
- **Préstamos.** Entregas con fecha y hora, varios artículos y cantidades en un
  mismo préstamo, y varios préstamos activos por estudiante.
- **Devoluciones.** Totales o parciales, con verificación de cantidades y
  condiciones, y registro de pérdidas y daños como incidentes.
- **Incidentes, con o sin préstamo.** Un daño o una pérdida se registra tanto si
  ocurrió en un artículo prestado como si ocurrió en el depósito y nunca salió. La
  responsabilidad queda «sin determinar» salvo que el propio registro diga a quién
  corresponde.
- **Panel.** Estadísticas obtenidas de la base de datos real, sin datos de ejemplo.
- **Historial y reportes.** Consulta de préstamos y devoluciones con filtros por
  estudiante, fecha y estado, y preparación para generar reportes en PDF.
- **Alertas.** Préstamos pendientes de devolución e incidentes sin resolver, en
  secciones separadas.

## Cómo está construido

| Componente | Elección |
|------------|----------|
| Lenguaje | Python 3.13.x (o 3.14.x en desarrollo) |
| Interfaz gráfica | PySide6 6.11.2 |
| Almacenamiento | SQLite, mediante el módulo `sqlite3` de la biblioteca estándar |
| Empaquetado para Windows | PyInstaller 6.22.3 |
| Pruebas automatizadas | pytest 9.1.1 y pytest-qt 4.5.0 |
| Calidad de código | ruff 0.16.9 |

La aplicación es un **monolito de escritorio en tres capas**, sin servidor web,
sin servicios externos y sin conexión a internet:

```
Interfaz gráfica  →  Lógica de negocio  →  Acceso a datos  →  SQLite
   stocklend/ui       stocklend/services    stocklend/data
```

El código de la base de datos no se mezcla con los componentes visuales, y las
reglas de negocio se prueban sin necesidad de abrir la interfaz.

## Dónde se guardan los datos

La base de datos **no** se guarda junto al programa. Se guarda en la carpeta de
datos de usuario de Windows:

```
%LOCALAPPDATA%\StockLend\
├── stocklend.sqlite      Base de datos
├── respaldos\            Copias de seguridad
├── registros\            Registro de actividad
└── config.ini            Preferencias
```

Esto implica que:

- Los datos **sobreviven** a la actualización y reinstalación del programa.
- Copiar esa carpeta a un USB es una copia de seguridad completa.
- El archivo `stocklend.sqlite` se puede abrir y consultar con cualquier
  herramienta estándar: el sistema no retiene, bloquea ni destruye los datos
  institucionales.
- No hay cifrado propietario, ni licencias, ni telemetría, ni envío de datos
  personales a servicios externos.

## Documentación

| Documento | Contenido |
|-----------|-----------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Arquitectura por capas, estructura de carpetas, versiones elegidas y decisiones técnicas |
| [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) | Requisitos funcionales y no funcionales, reglas de negocio, vista de pantallas |
| [`docs/DATABASE_DESIGN.md`](docs/DATABASE_DESIGN.md) | Modelo de datos, columnas, relaciones, SQL de referencia, índices e invariantes |
| [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md) | Etapas de desarrollo, riesgos y decisiones pendientes |
| [`docs/UI_DESIGN.md`](docs/UI_DESIGN.md) | Diseño de interfaz: identidad visual, paleta verificada, tipografía, espaciado, ventana, navegación y accesibilidad |
| [`docs/UI_SCREENS.md`](docs/UI_SCREENS.md) | Diseño de cada pantalla, sección por sección, y mapa de cobertura de requisitos |
| [`docs/UI_COMPONENTS.md`](docs/UI_COMPONENTS.md) | Catálogo de componentes reutilizables, con su anatomía, sus estados y su implementación en PySide6 |
| [`docs/UI_FLOWS.md`](docs/UI_FLOWS.md) | Recorridos de las tareas, catálogo de validaciones, mensajes y confirmaciones, y preguntas abiertas |

## Reglas de negocio principales

El sistema tiene **61 reglas de negocio** (`RN-01` a `RN-61`), todas con código
estable y con prueba obligatoria. Estas son las que explican el comportamiento:

1. La cantidad disponible **nunca** es negativa.
2. Para cada artículo siempre se cumple:
   `total = disponible + prestado + dañado + faltante`.
3. No se puede prestar más de lo disponible.
4. Un artículo dañado **no** vuelve automáticamente a estar disponible.
5. No se puede devolver más de lo pendiente.
6. Un artículo pendiente de devolución **nunca** se marca como faltante por sí solo:
   hace falta registrar un incidente de pérdida.
7. El historial no se borra. Las correcciones se hacen con ajustes o movimientos
   con motivo, nunca eliminando registros.
8. Toda operación que modifique préstamos e inventario a la vez se ejecuta
   dentro de una sola transacción.
9. No se marca ningún préstamo como vencido si no existe una fecha límite
   registrada.
10. Un daño o una pérdida se puede registrar **sin préstamo y sin estudiante**; el
    sistema no culpa a nadie por omisión.
11. En cada operación, una unidad sale de un único estado y entra en otro único.
    El estado del que sale lo declara el tipo de movimiento, no el servicio.
12. Si un artículo tiene control individual, sus contadores siempre coinciden con
    el número de unidades en cada estado.

## Estructura prevista del proyecto

```
StockLend/
├── README.md
├── pyproject.toml
├── docs/                  Documentación técnica
├── stocklend/
│   ├── core/              Rutas, configuración, registro
│   ├── domain/            Entidades y reglas de dominio
│   ├── data/              Base de datos, migraciones y repositorios
│   ├── services/          Lógica de negocio
│   ├── ui/                Interfaz gráfica
│   └── resources/         Iconos y estilos
├── tests/                 Pruebas automatizadas
├── tools/                 Utilidades de empaquetado
└── data/, logs/           Datos locales de desarrollo
```

## Etapas previstas

| Etapa | Resultado |
|-------|-----------|
| 0 | Documentación técnica y diseño de interfaz *(completada)* |
| 1 | Cimientos: estructura, rutas y base de datos creada y migrada *(completada)* |
| 2 | Dominio y acceso a datos *(implementada)* |
| 3 | Servicios de inventario y estudiantes |
| 4 | Servicios de préstamos, devoluciones e incidentes |
| 5 | Armazón de la interfaz: navegación y tema |
| 6 | Pantallas de operación |
| 7 | Panel, reportes y exportaciones |
| 8 | Copias de seguridad y restauración |
| 9 | Empaquetado en Windows |
| 10 | Estabilización y uso real |

## Estado actual

La **Etapa 1** está completada y commiteada: estructura del proyecto, entorno,
rutas, configuración, registro y base de datos con su migración inicial
(`0001_inicial.sql`, 11 tablas, 2 vistas, 13 índices). La **Etapa 2** está
implementada: `stocklend/domain/` (entidades, enums, value objects y excepciones) y
`stocklend/data/repositories/` (un repositorio por entidad, con SQL parametrizado,
paginación e historial). La suite `pytest` cubre las dos etapas y `ruff` no reporta
hallazgos. **Todavía no hay servicios de negocio, pantallas ni ejecutable.**

Las dos decisiones que quedaban abiertas **ya no bloquean nada**, porque el diseño
admite los dos casos a la vez en lugar de elegir uno:

- **Equipos con número de serie.** Cada artículo decide por separado si lleva
  control individual. Si ningún equipo lo necesita, la tabla de unidades queda
  vacía y nada cambia.
- **Faltante sin préstamo previo.** El incidente declara dónde ocurrió y puede
  registrar una pérdida en el depósito sin relacionarla con ningún estudiante.

Queda pendiente confirmar con Sonia, sin que bloquee el desarrollo, qué equipos
concretos usarán el control individual, y la ubicación de los datos en su equipo.
El detalle está en la sección 8 de `docs/REQUIREMENTS.md` y en la sección 8 de
`docs/DEVELOPMENT_PLAN.md`.

**El diseño de interfaz también está escrito**, en los cuatro documentos `UI_*.md`.
Al revisarlo han salido diez contradicciones y once preguntas abiertas, todas
registradas: las contradicciones en la sección 10 de `docs/UI_DESIGN.md` y las
preguntas en la sección 12 de `docs/UI_FLOWS.md`. **Ninguna se ha resuelto
modificando requisitos ni reglas de negocio.** Dos de ellas tienen un efecto
concreto sobre el trabajo siguiente:

- La paleta de `docs/ARCHITECTURE.md` declara un contraste mínimo de 4.5:1, pero su
  color de advertencia da 4.24:1 sobre blanco. El diseño añade un tono de texto más
  oscuro para poder cumplir el criterio, **sin cambiar el valor original**. Esa
  decisión hay que aprobarla.
- El menú solicitado tiene 6 secciones y `docs/REQUIREMENTS.md` describe 10
  pantallas. El diseño agrupa las cuatro restantes sin perder ninguna función:
  tres como entradas secundarias y Categorías como pestaña de Inventario. Esa
  agrupación también hay que aprobarla.
