
export type IncidentType = "Daño" | "Pérdida" | "Faltante";

export type IncidentStatus =
  | "Abierto"
  | "En revisión"
  | "Resuelto";

export interface DemoIncident {
  id: string;
  codigo: string;
  tipo: IncidentType;
  articulo: string;
  estudiante: string;
  codigoUniversitario: string;
  fecha: string;
  estado: IncidentStatus;
  prestamo: string;
  descripcion: string;
  resolucion?: string;
}

export const demoIncidents: DemoIncident[] = [
  {
    id: "i1",
    codigo: "INC-2026-001",
    tipo: "Daño",
    articulo: "Olla grande",
    estudiante: "Ana Ramírez Solís",
    codigoUniversitario: "202310245",
    fecha: "2026-10-11",
    estado: "Abierto",
    prestamo: "PRE-2026-015",
    descripcion: "Asa deteriorada durante una práctica.",
  },
  {
    id: "i2",
    codigo: "INC-2026-002",
    tipo: "Pérdida",
    articulo: "Llave inglesa",
    estudiante: "Bruno Díaz Navarro",
    codigoUniversitario: "202210398",
    fecha: "2026-10-10",
    estado: "En revisión",
    prestamo: "PRE-2026-014",
    descripcion:
      "El artículo no fue entregado al finalizar la clase.",
  },
  {
    id: "i3",
    codigo: "INC-2026-003",
    tipo: "Faltante",
    articulo: "Paño de limpieza",
    estudiante: "Carla Mendoza Ríos",
    codigoUniversitario: "202410156",
    fecha: "2026-10-09",
    estado: "Resuelto",
    prestamo: "PRE-2026-013",
    descripcion:
      "Faltó una unidad en el conteo de devolución.",
    resolucion: "Se repuso el material.",
  },
  {
    id: "i4",
    codigo: "INC-2026-004",
    tipo: "Daño",
    articulo: "Licuadora industrial",
    estudiante: "Diego Torres Lima",
    codigoUniversitario: "202311872",
    fecha: "2026-10-08",
    estado: "Abierto",
    prestamo: "PRE-2026-012",
    descripcion: "El vaso presenta una fisura.",
  },
  {
    id: "i5",
    codigo: "INC-2026-005",
    tipo: "Pérdida",
    articulo: "Vaso medidor",
    estudiante: "Elena Vargas Ponce",
    codigoUniversitario: "202312774",
    fecha: "2026-10-07",
    estado: "Resuelto",
    prestamo: "PRE-2026-011",
    descripcion:
      "No se localizó el vaso al devolver el equipo.",
    resolucion: "El estudiante entregó un reemplazo.",
  },
  {
    id: "i6",
    codigo: "INC-2026-006",
    tipo: "Faltante",
    articulo: "Cuchillo de chef",
    estudiante: "Fernando Rojas",
    codigoUniversitario: "202314528",
    fecha: "2026-10-06",
    estado: "En revisión",
    prestamo: "PRE-2026-010",
    descripcion: "Una unidad pendiente de devolución.",
  },
  {
    id: "i7",
    codigo: "INC-2026-007",
    tipo: "Daño",
    articulo: "Tabla de picar",
    estudiante: "Gabriela Castillo",
    codigoUniversitario: "202410235",
    fecha: "2026-10-05",
    estado: "Resuelto",
    prestamo: "PRE-2026-009",
    descripcion: "Superficie dañada.",
    resolucion: "Artículo reemplazado.",
  },
  {
    id: "i8",
    codigo: "INC-2026-008",
    tipo: "Faltante",
    articulo: "Colador grande",
    estudiante: "Héctor Salinas",
    codigoUniversitario: "202210245",
    fecha: "2026-10-04",
    estado: "Abierto",
    prestamo: "PRE-2026-008",
    descripcion: "No se devolvió una unidad.",
  },
  {
    id: "i9",
    codigo: "INC-2026-009",
    tipo: "Pérdida",
    articulo: "Espátula",
    estudiante: "Isabel Núñez",
    codigoUniversitario: "202411485",
    fecha: "2026-10-03",
    estado: "Resuelto",
    prestamo: "PRE-2026-007",
    descripcion: "Artículo extraviado.",
    resolucion: "Se repuso la espátula.",
  },
];

export const incidentsSummary = {
  abiertas: demoIncidents.filter(
    (incident) => incident.estado === "Abierto"
  ).length,

  revision: demoIncidents.filter(
    (incident) => incident.estado === "En revisión"
  ).length,

  resueltas: demoIncidents.filter(
    (incident) => incident.estado === "Resuelto"
  ).length,

  total: demoIncidents.length,
};

export function formatIncidentDate(value: string): string {
  const parts = value.split("-");

  if (parts.length !== 3) {
    return value;
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}
