// Adaptadores puros de la capa de lectura de Estudiantes (Etapa C).
//
// Traducen los datos crudos de SQLite (snake_case, `src/types/studentsApi.ts`)
// a los modelos de presentación ya existentes (`src/types/students.ts`) sin
// tocar la interfaz todavía. Son funciones sin estado ni efectos: se pueden
// probar y reutilizar al conectar la pantalla.

import type {
  EstadisticasEstudiantes,
  EstudianteDirectorio,
  IncidenciaEstudiante,
  PrestamoHistorialEstudiante,
} from "../types/studentsApi";
import type {
  IncidentEstado,
  IncidentTipo,
  LoanEstado,
  Student,
  StudentIncident,
  StudentLoan,
  StudentSummary,
} from "../types/students";

/** Totales del directorio en el formato que consume la pantalla. */
export interface ResumenDirectorioEstudiantes {
  registrados: number;
  conPrestamosActivos: number;
  conIncidencias: number;
}

const ESTADO_PRESTAMO: Record<string, LoanEstado> = {
  activo: "Activo",
  cerrado: "Cerrado",
  anulado: "Anulado",
};

const ESTADO_INCIDENCIA: Record<string, IncidentEstado> = {
  abierto: "Abierto",
  resuelto: "Resuelto",
};

// Traducción literal de `incidente.tipo`: la base guarda `perdida`, `danio` u
// `otro` y cada valor se muestra con su propia etiqueta, sin reclasificar nada.
const TIPO_INCIDENCIA: Record<string, IncidentTipo> = {
  perdida: "Pérdida",
  danio: "Daño",
  otro: "Otro",
};

/** Convierte una fila del directorio en el `Student` de presentación. */
export function adaptStudent(dto: EstudianteDirectorio): Student {
  return {
    id: String(dto.id),
    codigoUniversitario: dto.codigo_universitario,
    nombres: dto.nombres,
    apellidos: dto.apellidos,
    activo: dto.activo,
    creadoEn: dto.creado_en,
  };
}

/** Fila del directorio con sus recuentos derivados (`StudentSummary`). */
export function adaptStudentSummary(dto: EstudianteDirectorio): StudentSummary {
  return {
    ...adaptStudent(dto),
    nombreCompleto: dto.nombre_completo,
    prestamosActivos: dto.prestamos_activos,
    prestamosFinalizados: dto.prestamos_finalizados,
    unidadesActivas: dto.unidades_activas,
    incidencias: dto.incidencias,
  };
}

/** Convierte el directorio crudo en resúmenes de presentación. */
export function adaptDirectory(
  estudiantes: EstudianteDirectorio[],
): StudentSummary[] {
  return estudiantes.map(adaptStudentSummary);
}

/** Totales del directorio al formato de presentación. */
export function adaptDirectoryStats(
  dto: EstadisticasEstudiantes,
): ResumenDirectorioEstudiantes {
  return {
    registrados: dto.registrados,
    conPrestamosActivos: dto.con_prestamos_activos,
    conIncidencias: dto.con_incidencias,
  };
}

/**
 * Préstamo del historial.
 *
 * El DTO del historial ya viene acotado a un estudiante, por lo que no incluye
 * `estudiante_id`: se recibe `studentId` como argumento. El total de renglones
 * (`renglones`) no forma parte del modelo de presentación y se descarta.
 */
export function adaptStudentLoan(
  dto: PrestamoHistorialEstudiante,
  studentId: string,
): StudentLoan {
  const estado = ESTADO_PRESTAMO[dto.estado];
  if (estado === undefined) {
    throw new Error(`Estado de préstamo desconocido: "${dto.estado}".`);
  }
  return {
    id: String(dto.id),
    folio: dto.folio,
    studentId,
    fecha: dto.fecha,
    fechaLimite: dto.fecha_limite,
    estado,
    unidades: dto.unidades,
  };
}

/**
 * Incidencia atribuida a un estudiante.
 *
 * SQLite no guarda un código de incidencia como `INC-2026-0007`; solo tiene el
 * `id` numérico. Para no inventar un folio oficial, `codigo` es la etiqueta del
 * id real (`#123`). El folio del préstamo de origen (`dto.folio`) no cabe en el
 * modelo de presentación actual y se descarta.
 */
export function adaptStudentIncident(
  dto: IncidenciaEstudiante,
  studentId: string,
): StudentIncident {
  const tipo = TIPO_INCIDENCIA[dto.tipo];
  if (tipo === undefined) {
    throw new Error(`Tipo de incidencia desconocido: "${dto.tipo}".`);
  }
  const estado = ESTADO_INCIDENCIA[dto.estado];
  if (estado === undefined) {
    throw new Error(`Estado de incidencia desconocido: "${dto.estado}".`);
  }
  return {
    id: String(dto.id),
    codigo: `#${dto.id}`,
    studentId,
    tipo,
    estado,
    fecha: dto.fecha,
    articulo: dto.articulo,
  };
}
