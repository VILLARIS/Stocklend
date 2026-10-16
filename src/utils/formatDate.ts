// Utilidad para mostrar fechas locales provenientes de SQLite.
//
// SQLite guarda fechas locales "naive" (`YYYY-MM-DD` o `YYYY-MM-DDTHH:MM:SS`),
// sin zona horaria. `new Date("2026-10-10")` las interpretaría como UTC y
// podría desplazar el día; aquí se construyen con componentes locales para
// evitar cualquier corrimiento. No se modifica el valor original.

const SQLITE_DATE =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

/**
 * Convierte una fecha de SQLite en un `Date` local, sin desplazamiento de zona
 * horaria. Devuelve `null` si el texto no es una fecha ISO válida.
 */
export function parseLocalDate(value: string): Date | null {
  if (typeof value !== "string") {
    return null;
  }

  const match = SQLITE_DATE.exec(value.trim());
  if (match === null) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hours = match[4] === undefined ? 0 : Number(match[4]);
  const minutes = match[5] === undefined ? 0 : Number(match[5]);
  const seconds = match[6] === undefined ? 0 : Number(match[6]);

  if (month < 1 || month > 12) {
    return null;
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    return null;
  }
  if (hours > 23 || minutes > 59 || seconds > 59) {
    return null;
  }

  return new Date(year, month - 1, day, hours, minutes, seconds);
}

/**
 * Formatea una fecha de préstamo en formato ISO `YYYY-MM-DD` como fecha local
 * legible `dd/mm/aaaa`. Devuelve "—" cuando no hay fecha y el texto original si
 * no trae el formato esperado. Se usa en las tablas de Préstamos y Devoluciones.
 */
export function formatLoanDate(value: string | null): string {
  if (value === null || value === "") return "—";
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Formatea una fecha de SQLite como fecha local legible (por defecto
 * `dd/mm/aaaa`). Devuelve una cadena vacía si la fecha no es válida.
 */
export function formatLocalDate(value: string, locale = "es-PE"): string {
  const date = parseLocalDate(value);
  if (date === null) {
    return "";
  }

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
