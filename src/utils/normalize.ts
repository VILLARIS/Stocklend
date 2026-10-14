// Compara texto ignorando mayúsculas, acentos y espacios sobrantes.
//
// La usaban por separado la tabla de Préstamos y el formulario de préstamo
// (buscador de estudiantes y de artículos). Se centraliza para que los tres
// busquen igual.

/** Normaliza un texto para comparar: sin acentos, en minúsculas y recortado. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
