// Estados de carga y error reutilizables dentro del módulo Estudiantes.
//
// Mantienen el mismo tratamiento visual que el resto de la aplicación (spinner
// y aviso con reintento) para que la conexión con SQLite no introduzca estilos
// nuevos.

import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "../ui/Button";

/** Indicador de carga mientras se consulta un recurso. */
export function ResourceLoading() {
  return (
    <div className="flex min-h-[160px] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-[#267BFA]" />
    </div>
  );
}

/** Mensaje de error con acción de reintento para volver a consultar. */
export function ResourceError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex min-h-[160px] flex-col items-center justify-center gap-3 px-4 text-center"
    >
      <AlertCircle className="h-8 w-8 text-[#E43F50]" />

      <p className="max-w-md text-[13px] leading-5 text-[#435F92]">
        {message}
      </p>

      <Button variant="secondary" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  );
}
