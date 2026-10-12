// Indicador global de modo demostración.
//
// El Panel de control ya no depende de datos de demostración: toda su
// información proviene de SQLite a través del comando `obtener_panel`. Otros
// módulos (Estudiantes, Inventario) todavía consumen esta bandera para mostrar
// el distintivo "Vista de demostración", por lo que debe conservarse mientras
// ellos la utilicen.

export const DEMO_MODE = true;
