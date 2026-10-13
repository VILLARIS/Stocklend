import type { UnitState } from "../data/inventoryData";
import type {
  ArticuloInventario,
  CategoriaInventario,
  UnidadInventario,
} from "../types/inventory";

export interface AdaptedArticle {
  id: string;
  codigo: string | null;
  nombre: string;
  categoria: string;
  categoriaId: number;
  notas: string | null;
  disponible: number;
  prestado: number;
  danado: number;
  faltante: number;
  total: number;
  prestable: boolean;
  controlIndividual: boolean;
  activo: boolean;
}

export interface AdaptedUnit {
  id: string;
  codigo: string;
  articuloId: number;
  articulo: string;
  categoria: string;
  estado: UnitState;
  estudiante: string | null;
  prestamo: string | null;
  prestamoId: number | null;
  prestamoFolio: string | null;
  prestamoFecha: string | null;
  prestamoEstado: string | null;
  incidente: string | null;
  incidenteId: number | null;
  incidenteTipo: string | null;
  incidenteEstado: string | null;
}

export interface AdaptedCategory {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  articulos: number;
}

const DB_TO_UNIT_STATE: Record<string, UnitState> = {
  disponible: "Disponible",
  prestada: "Prestada",
  danada: "Dañada",
  faltante: "Faltante",
  baja: "Baja",
};

export function adaptUnitState(estado: string): UnitState {
  return DB_TO_UNIT_STATE[estado] ?? "Disponible";
}

export function adaptArticle(raw: ArticuloInventario): AdaptedArticle {
  return {
    id: String(raw.id),
    codigo: raw.codigo,
    nombre: raw.nombre,
    categoria: raw.categoria,
    categoriaId: raw.categoria_id,
    notas: raw.notas,
    disponible: raw.cantidad_disponible,
    prestado: raw.cantidad_prestada,
    danado: raw.cantidad_daniada,
    faltante: raw.cantidad_faltante,
    total: raw.cantidad_total,
    prestable: raw.prestable,
    controlIndividual: raw.control_individual,
    activo: raw.activo,
  };
}

export function adaptArticles(items: ArticuloInventario[]): AdaptedArticle[] {
  return items.map(adaptArticle);
}

export function adaptUnit(raw: UnidadInventario): AdaptedUnit {
  return {
    id: String(raw.id),
    codigo: raw.codigo,
    articuloId: raw.articulo_id,
    articulo: raw.articulo,
    categoria: raw.categoria,
    estado: adaptUnitState(raw.estado),
    estudiante: raw.estudiante,
    prestamo: raw.prestamo_folio,
    prestamoId: raw.prestamo_id,
    prestamoFolio: raw.prestamo_folio,
    prestamoFecha: raw.prestamo_fecha,
    prestamoEstado: raw.prestamo_estado,
    incidente: raw.incidente_id != null ? String(raw.incidente_id) : null,
    incidenteId: raw.incidente_id,
    incidenteTipo: raw.incidente_tipo,
    incidenteEstado: raw.incidente_estado,
  };
}

export function adaptUnits(items: UnidadInventario[]): AdaptedUnit[] {
  return items.map(adaptUnit);
}

export function adaptCategory(raw: CategoriaInventario): AdaptedCategory {
  return {
    id: String(raw.id),
    nombre: raw.nombre,
    descripcion: raw.descripcion,
    activo: raw.activo,
    articulos: raw.articulos,
  };
}

export function adaptCategories(
  items: CategoriaInventario[],
): AdaptedCategory[] {
  return items.map(adaptCategory);
}
