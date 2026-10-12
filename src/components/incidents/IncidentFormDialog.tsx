
import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ClipboardList,
  Info,
  Package,
  UserRound,
} from "lucide-react";

import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";

import type {
  IncidentType,
} from "../../data/demoIncidents";

interface IncidentFormDialogProps {
  open: boolean;
  onClose: () => void;
}

const controlClass = `
  h-10 w-full rounded-[10px]
  border border-[#DFE7F2]
  bg-white px-3
  text-[12px] text-[#2A4061]
  outline-none
  placeholder:text-[#9AA8BC]
  transition-[border-color,box-shadow] duration-200
  hover:border-[#BAD0EC]
  focus:border-[#398BFF]
  focus:ring-2 focus:ring-[#398BFF]/10
`;

export function IncidentFormDialog({
  open,
  onClose,
}: IncidentFormDialogProps) {
  const [type, setType] =
    useState<IncidentType>("Daño");

  const [article, setArticle] = useState("");
  const [responsible, setResponsible] = useState("");
  const [loan, setLoan] = useState("");
  const [description, setDescription] = useState("");

  const firstRef = useRef<HTMLSelectElement>(null);

  // REINICIAR AL ABRIR
  useEffect(() => {
    if (!open) return;

    setType("Daño");
    setArticle("");
    setResponsible("");
    setLoan("");
    setDescription("");
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nueva incidencia"
      subtitle="Registra un daño, pérdida o faltante del inventario."
      size="lg"
      initialFocusRef={firstRef}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
          >
            Cancelar
          </Button>

          <span title="El registro estará disponible cuando se implemente el guardado">
            <Button disabled>
              Registrar incidencia
            </Button>
          </span>
        </>
      }
    >
      <div className="space-y-4">
        {/* TÍTULO DE SECCIÓN */}
        <div className="flex items-center gap-2.5">
          <div
            className="
              flex h-9 w-9 items-center
              justify-center rounded-xl
              bg-[#EAF3FF] text-[#287FF0]
            "
          >
            <ClipboardList className="h-5 w-5" />
          </div>

          <div>
            <h3 className="text-[12.5px] font-semibold text-[#253D61]">
              Información de la incidencia
            </h3>

            <p className="text-[11px] text-[#8293AA]">
              Formulario visual de demostración
            </p>
          </div>
        </div>

        {/* CAMPOS */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-[11.5px] font-semibold text-[#455875]">
            Tipo de incidencia
            <span className="ml-1 text-[#E05B67]">*</span>

            <select
              ref={firstRef}
              value={type}
              onChange={(event) =>
                setType(event.target.value as IncidentType)
              }
              className={`mt-1.5 ${controlClass}`}
            >
              <option value="Daño">Daño</option>
              <option value="Pérdida">Pérdida</option>
              <option value="Faltante">Faltante</option>
            </select>
          </label>

          <label className="block text-[11.5px] font-semibold text-[#455875]">
            Préstamo asociado

            <input
              value={loan}
              onChange={(event) =>
                setLoan(event.target.value)
              }
              placeholder="Ej. PRE-2026-015"
              className={`mt-1.5 ${controlClass}`}
            />
          </label>

          <label className="block text-[11.5px] font-semibold text-[#455875]">
            <span className="flex items-center gap-1">
              <Package className="h-3.5 w-3.5" />
              Artículo
              <span className="text-[#E05B67]">*</span>
            </span>

            <input
              value={article}
              onChange={(event) =>
                setArticle(event.target.value)
              }
              placeholder="Ej. Olla grande"
              className={`mt-1.5 ${controlClass}`}
            />
          </label>

          <label className="block text-[11.5px] font-semibold text-[#455875]">
            <span className="flex items-center gap-1">
              <UserRound className="h-3.5 w-3.5" />
              Estudiante responsable
              <span className="text-[#E05B67]">*</span>
            </span>

            <input
              value={responsible}
              onChange={(event) =>
                setResponsible(event.target.value)
              }
              placeholder="Nombre y apellidos"
              className={`mt-1.5 ${controlClass}`}
            />
          </label>
        </div>

        {/* DESCRIPCIÓN */}
        <label className="block text-[11.5px] font-semibold text-[#455875]">
          Descripción

          <textarea
            rows={3}
            maxLength={250}
            value={description}
            onChange={(event) =>
              setDescription(event.target.value)
            }
            placeholder="¿Qué sucedió con el artículo?"
            className="
              mt-1.5 w-full resize-none
              rounded-[10px]
              border border-[#DFE7F2]
              bg-white px-3 py-2
              text-[12px] leading-5
              text-[#2A4061]
              outline-none
              placeholder:text-[#9AA8BC]
              focus:border-[#398BFF]
              focus:ring-2 focus:ring-[#398BFF]/10
            "
          />

          <span className="block text-right text-[10px] font-normal tabular-nums text-[#9AA8BC]">
            {description.length}/250
          </span>
        </label>

        {/* NOTA DEMO */}
        <div className="flex items-start gap-2.5 rounded-xl border border-[#E1EBFA] bg-[#F3F8FF] px-3 py-2.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#347CE6]" />

          <p className="text-[11px] font-normal leading-4 text-[#6881A4]">
            Esta pantalla es una demostración visual.
            Los cambios no se guardan ni afectan los
            préstamos, devoluciones o inventario.
          </p>
        </div>
      </div>
    </Dialog>
  );
}
