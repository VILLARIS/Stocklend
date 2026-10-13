export interface ArticuloInventario {
  id: number;
  codigo: string | null;
  nombre: string;
  categoria: string;
  categoria_id: number;
  notas: string | null;
  cantidad_total: number;
  cantidad_disponible: number;
  cantidad_prestada: number;
  cantidad_daniada: number;
  cantidad_faltante: number;
  prestable: boolean;
  control_individual: boolean;
  activo: boolean;
}

export interface UnidadInventario {
  id: number;
  codigo: string;
  articulo_id: number;
  articulo: string;
  categoria: string;
  estado: string;
  prestamo_detalle_id: number | null;
  prestamo_id: number | null;
  prestamo_folio: string | null;
  prestamo_estado: string | null;
  prestamo_fecha: string | null;
  estudiante_id: number | null;
  estudiante: string | null;
  incidente_id: number | null;
  incidente_tipo: string | null;
  incidente_estado: string | null;
}

export interface CategoriaInventario {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  articulos: number;
}

export interface EstadisticasInventario {
  articulos_registrados: number;
  articulos_activos: number;
  unidades_totales: number;
  unidades_disponibles: number;
  unidades_prestadas: number;
  unidades_daniadas: number;
  unidades_faltantes: number;
}
