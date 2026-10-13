// Datos de demostración del Inventario — Fases 2.4 a 2.6.
// Separados por completo de la capa de presentación y de cualquier fuente real.
// NO provienen de SQLite. Reflejan el modelo documentado (REQUIREMENTS.md §2.1,
// DATABASE_DESIGN.md): cuatro cubos por artículo (disponible, prestado, dañado,
// faltante), control individual opcional por artículo y los cinco estados de
// unidad de `articulo_unidad.estado` (disponible, prestada, danada, faltante, baja).
//
// Los nombres de estudiantes son ficticios: no corresponden a personas reales.
//
// Coherencia de identificadores (Fase 2.6): el código de artículo y el código de
// unidad individual son identificadores distintos. Los artículos con control
// individual usan una base de tres letras (p. ej. OLG) y sus unidades se numeran
// como OLG-001, OLG-002… Esa base es única por artículo, de modo que ningún código
// de unidad se repite entre artículos (RF-INV-10).

export type InventoryArticle = {
  id: string;
  nombre: string;
  codigo: string | null;
  categoria: string;
  // Identificador de la categoría y nota reales. Opcionales para no romper los
  // datos de demostración, que no los declaran.
  categoriaId?: number;
  notas?: string | null;
  disponible: number;
  prestado: number;
  danado: number;
  faltante: number;
  prestable: boolean;
  controlIndividual: boolean;
};

export type UnitState = "Disponible" | "Prestada" | "Dañada" | "Faltante" | "Baja";

export type InventoryUnit = {
  id: string;
  codigo: string;
  articulo: string;
  categoria: string;
  estado: UnitState;
  estudiante: string | null;
  prestamo: string | null;
  prestamoFecha: string | null;
  prestamoEstado: string | null;
  incidente: string | null;
  incidenteTipo: string | null;
  incidenteEstado: string | null;
};

export type InventoryCategory = {
  id: string;
  nombre: string;
  descripcion: string | null;
  articulos: number;
  // Estado real de la categoría (`activo`). Opcional para no romper los datos de
  // demostración, que no lo declaran.
  activo?: boolean;
};

export const inventoryArticles: InventoryArticle[] = [
  { id: "a01", nombre: "Olla grande", codigo: "OLG", categoria: "Utensilios", disponible: 8, prestado: 1, danado: 1, faltante: 0, prestable: true, controlIndividual: true },
  { id: "a02", nombre: "Olla mediana", codigo: "OLM", categoria: "Utensilios", disponible: 5, prestado: 0, danado: 0, faltante: 0, prestable: true, controlIndividual: true },
  { id: "a03", nombre: "Tabla de picar", codigo: "TAB-01", categoria: "Utensilios", disponible: 12, prestado: 3, danado: 0, faltante: 0, prestable: true, controlIndividual: false },
  { id: "a04", nombre: "Cuchillo de chef", codigo: "CCH", categoria: "Utensilios", disponible: 4, prestado: 1, danado: 0, faltante: 1, prestable: true, controlIndividual: true },
  { id: "a05", nombre: "Sartén antiadherente", codigo: "SAR-01", categoria: "Utensilios", disponible: 6, prestado: 0, danado: 0, faltante: 0, prestable: true, controlIndividual: false },
  { id: "a06", nombre: "Prensa de ajos", codigo: "PRE-01", categoria: "Utensilios", disponible: 4, prestado: 0, danado: 0, faltante: 0, prestable: true, controlIndividual: false },
  { id: "a07", nombre: "Colador grande", codigo: "COL-01", categoria: "Utensilios", disponible: 0, prestado: 0, danado: 1, faltante: 0, prestable: false, controlIndividual: false },
  { id: "a08", nombre: "Mandolina", codigo: "MAN-01", categoria: "Utensilios", disponible: 2, prestado: 0, danado: 1, faltante: 0, prestable: false, controlIndividual: false },
  { id: "a09", nombre: "Rallador de cuatro caras", codigo: "RAL-01", categoria: "Utensilios", disponible: 7, prestado: 0, danado: 0, faltante: 0, prestable: true, controlIndividual: false },
  { id: "a10", nombre: "Paleta de madera", codigo: "PAL-01", categoria: "Utensilios", disponible: 6, prestado: 0, danado: 0, faltante: 0, prestable: true, controlIndividual: false },

  { id: "a11", nombre: "Licuadora", codigo: "LIC", categoria: "Electrodomésticos", disponible: 2, prestado: 1, danado: 1, faltante: 0, prestable: true, controlIndividual: true },
  { id: "a12", nombre: "Batidora de mano", codigo: "BAT-01", categoria: "Electrodomésticos", disponible: 3, prestado: 0, danado: 0, faltante: 0, prestable: true, controlIndividual: false },
  { id: "a13", nombre: "Cafetera", codigo: "CAF", categoria: "Electrodomésticos", disponible: 2, prestado: 1, danado: 0, faltante: 0, prestable: true, controlIndividual: true },
  { id: "a14", nombre: "Exprimidor", codigo: "EXP-01", categoria: "Electrodomésticos", disponible: 1, prestado: 0, danado: 0, faltante: 0, prestable: true, controlIndividual: false },
  { id: "a15", nombre: "Tostadora", codigo: "TOS-01", categoria: "Electrodomésticos", disponible: 2, prestado: 0, danado: 0, faltante: 0, prestable: true, controlIndividual: false },

  { id: "a16", nombre: "Vaso medidor", codigo: "VAS-01", categoria: "Menaje", disponible: 9, prestado: 0, danado: 0, faltante: 0, prestable: true, controlIndividual: false },
  { id: "a17", nombre: "Cuchara de madera", codigo: "CUM-01", categoria: "Menaje", disponible: 20, prestado: 0, danado: 0, faltante: 0, prestable: true, controlIndividual: false },
  { id: "a18", nombre: "Espátula de silicona", codigo: "ESP-01", categoria: "Menaje", disponible: 15, prestado: 0, danado: 0, faltante: 0, prestable: true, controlIndividual: false },
  { id: "a19", nombre: "Bowls de acero inoxidable", codigo: "BOW-01", categoria: "Menaje", disponible: 24, prestado: 0, danado: 0, faltante: 0, prestable: true, controlIndividual: false },
  { id: "a20", nombre: "Servilletas de tela", codigo: "SER-01", categoria: "Menaje", disponible: 30, prestado: 0, danado: 0, faltante: 0, prestable: true, controlIndividual: false },
  { id: "a21", nombre: "Bandeja para horno", codigo: "BAN-01", categoria: "Menaje", disponible: 4, prestado: 0, danado: 0, faltante: 0, prestable: true, controlIndividual: false },

  { id: "a22", nombre: "Refractario de vidrio", codigo: "REF-01", categoria: "Cristalería", disponible: 6, prestado: 0, danado: 1, faltante: 0, prestable: true, controlIndividual: false },
  { id: "a23", nombre: "Juego de tazas", codigo: "TAZ-01", categoria: "Cristalería", disponible: 18, prestado: 0, danado: 0, faltante: 0, prestable: true, controlIndividual: false },
  { id: "a24", nombre: "Copas de vino", codigo: "COP-01", categoria: "Cristalería", disponible: 10, prestado: 2, danado: 0, faltante: 0, prestable: true, controlIndividual: false },
  { id: "a25", nombre: "Jarra de vidrio", codigo: "JAR-01", categoria: "Cristalería", disponible: 5, prestado: 0, danado: 0, faltante: 0, prestable: true, controlIndividual: false },

  { id: "a26", nombre: "Termómetro de cocina", codigo: "TER-01", categoria: "Herramientas", disponible: 5, prestado: 0, danado: 0, faltante: 0, prestable: true, controlIndividual: false },
  { id: "a27", nombre: "Balanza de cocina", codigo: "BAL-01", categoria: "Herramientas", disponible: 3, prestado: 0, danado: 0, faltante: 0, prestable: true, controlIndividual: false },
  { id: "a28", nombre: "Cronómetro de cocina", codigo: "CRO-01", categoria: "Herramientas", disponible: 4, prestado: 0, danado: 0, faltante: 0, prestable: true, controlIndividual: false },
];

const DEMO_STUDENTS = [
  "Ana Ramírez Solís",
  "Luis Fernando Ortega",
  "Camila Reyes",
  "Diego Salinas",
  "Valeria Ponce",
];

const LOAN_DATES = ["2026-09-14", "2026-09-21", "2026-09-28", "2026-10-02"];

function buildUnits(article: InventoryArticle): InventoryUnit[] {
  if (!article.controlIndividual) return [];
  const prefix = article.codigo
    ? article.codigo.split("-")[0]
    : article.id.toUpperCase();
  const articleNumber = Number(article.id.replace(/\D/g, "")) || 0;
  const units: InventoryUnit[] = [];
  let n = 0;
  let loans = 0;
  let incidents = 0;

  const add = (estado: UnitState, extra?: Partial<InventoryUnit>) => {
    n += 1;
    units.push({
      id: `${article.id}-u${n}`,
      codigo: `${prefix}-${String(n).padStart(3, "0")}`,
      articulo: article.nombre,
      categoria: article.categoria,
      estado,
      estudiante: null,
      prestamo: null,
      prestamoFecha: null,
      prestamoEstado: null,
      incidente: null,
      incidenteTipo: null,
      incidenteEstado: null,
      ...extra,
    });
  };

  for (let i = 0; i < article.disponible; i++) add("Disponible");

  for (let i = 0; i < article.prestado; i++) {
    loans += 1;
    add("Prestada", {
      estudiante: DEMO_STUDENTS[(articleNumber + loans) % DEMO_STUDENTS.length],
      prestamo: `PRE-2026-${String(articleNumber * 10 + loans).padStart(4, "0")}`,
      prestamoFecha: LOAN_DATES[(articleNumber + loans) % LOAN_DATES.length],
      prestamoEstado: "Activo",
    });
  }

  const addIncident = (estado: UnitState, tipo: string) => {
    incidents += 1;
    add(estado, {
      incidente: `INC-2026-${String(articleNumber * 10 + incidents).padStart(4, "0")}`,
      incidenteTipo: tipo,
      incidenteEstado: "Abierto",
    });
  };

  for (let i = 0; i < article.danado; i++) addIncident("Dañada", "Daño");
  for (let i = 0; i < article.faltante; i++) addIncident("Faltante", "Pérdida");

  // Una unidad dada de baja (estado documentado 'baja') para demostrar que las
  // unidades descartadas se conservan como histórico y quedan fuera del total
  // (RN-61). No la produce ningún contador del artículo.
  if (article.id === "a11") {
    add("Baja", {
      incidente: "INC-2026-0115",
      incidenteTipo: "Daño irreparable",
      incidenteEstado: "Resuelto",
    });
  }

  return units;
}

export const inventoryUnits: InventoryUnit[] = inventoryArticles.flatMap(buildUnits);

// Fuente única de categorías. El número de artículos no se escribe: se calcula
// a partir de los artículos asociados, de modo que nunca queda desactualizado.
const CATEGORY_DEFS: { nombre: string; descripcion: string | null }[] = [
  { nombre: "Utensilios", descripcion: "Ollas, sartenes, cuchillos y utensilios de cocina." },
  { nombre: "Electrodomésticos", descripcion: "Aparatos eléctricos de uso en cocina." },
  { nombre: "Menaje", descripcion: "Vajilla, cubiertos y recipientes básicos." },
  { nombre: "Cristalería", descripcion: "Vasos, copas y piezas de vidrio." },
  { nombre: "Herramientas", descripcion: "Instrumentos de medición y apoyo." },
  { nombre: "Desechables", descripcion: "Material de un solo uso." },
];

export const inventoryCategories: InventoryCategory[] = CATEGORY_DEFS.map(
  (categoria, index) => ({
    id: `cat-${String(index + 1).padStart(2, "0")}`,
    nombre: categoria.nombre,
    descripcion: categoria.descripcion,
    articulos: inventoryArticles.filter((a) => a.categoria === categoria.nombre)
      .length,
  }),
);

export const inventoryCategoryNames: string[] = CATEGORY_DEFS.map(
  (categoria) => categoria.nombre,
);
