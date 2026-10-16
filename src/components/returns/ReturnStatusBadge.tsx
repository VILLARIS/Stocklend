import type { ReturnStatus } from "../../types/returns";

/**
 * Paleta única de los estados de devolución.
 *
 * La comparten la tabla (`ReturnsTable`) y el detalle
 * (`ReturnDetailsDialog`), que antes repetían el mismo mapa de clases.
 * `container` es el recuadro con borde y color de texto; `dot` es el punto
 * sólido que usa la tabla (el detalle conserva su punto `bg-current`).
 */
export const RETURN_STATUS_STYLES: Record<
  ReturnStatus,
  { container: string; dot: string }
> = {
  Pendiente: {
    container: "border-[#D8E8FF] bg-[#EDF5FF] text-[#357CDD]",
    dot: "bg-[#398BFF]",
  },
  Parcial: {
    container: "border-[#E8DFFF] bg-[#F3EEFF] text-[#7B62CE]",
    dot: "bg-[#8D74E5]",
  },
  Completada: {
    container: "border-[#CFE9D8] bg-[#EDF8F1] text-[#1B8E57]",
    dot: "bg-[#1FB56C]",
  },
  Vencida: {
    container: "border-[#F9E2C2] bg-[#FFF4E7] text-[#B87916]",
    dot: "bg-[#F5AD35]",
  },
};

/** Insignia de estado con punto sólido, usada en el listado. */
export function ReturnStatusBadge({
  status,
}: {
  status: ReturnStatus;
}) {
  const styles = RETURN_STATUS_STYLES[status];

  return (
    <span
      className={`
        inline-flex h-8 items-center gap-2
        whitespace-nowrap rounded-xl border px-3
        text-[11.5px] font-semibold
        ${styles.container}
      `}
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${styles.dot}`}
      />
      {status}
    </span>
  );
}
