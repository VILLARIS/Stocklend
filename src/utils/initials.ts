// Iniciales de nombres y apellidos para los avatares del directorio.
export function initials(nombres: string, apellidos: string): string {
  const first = nombres.trim().charAt(0);
  const second = apellidos.trim().charAt(0);

  return `${first}${second}`.toUpperCase();
}
