import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { Dialog } from "../ui/Dialog";
import { FormField } from "../ui/FormField";
import { Button } from "../ui/Button";
import type { InventoryCategory } from "../../data/inventoryData";

type FormMode = "create" | "edit";

interface CategoryFormDialogProps {
  open: boolean;
  mode: FormMode;
  category?: InventoryCategory;
  existingNames: string[];
  onClose: () => void;
}

// RN-10: el nombre se compara ignorando mayúsculas y espacios.
function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

const inputClass =
  "h-9 w-full rounded-md border bg-surface px-3 text-sm text-text placeholder:text-text-secondary/60 transition-colors duration-[120ms] hover:border-border-strong focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/20";

export function CategoryFormDialog({
  open,
  mode,
  category,
  existingNames,
  onClose,
}: CategoryFormDialogProps) {
  const isEdit = mode === "edit";
  const nombreRef = useRef<HTMLInputElement>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [nombreTouched, setNombreTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNombre(category?.nombre ?? "");
    setDescripcion(category?.descripcion ?? "");
    setNombreTouched(false);
  }, [open, category]);

  const takenNames = existingNames.filter(
    (name) => normalize(name) !== normalize(category?.nombre ?? ""),
  );

  const nombreError =
    nombre.trim() === ""
      ? "El nombre de la categoría no puede estar vacío."
      : takenNames.some((name) => normalize(name) === normalize(nombre))
        ? `Ya existe una categoría llamada «${nombre.trim()}».`
        : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar categoría" : "Nueva categoría"}
      subtitle={
        isEdit
          ? "Modifica los datos de la categoría seleccionada."
          : "Organiza los artículos del inventario."
      }
      size="sm"
      initialFocusRef={nombreRef}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <span title="Disponible cuando se conecte la persistencia">
            <Button disabled>
              {isEdit ? "Guardar cambios" : "Crear categoría"}
            </Button>
          </span>
        </>
      }
    >
      <div className="mb-4 flex items-start gap-2 rounded-md border border-border-soft bg-[#F7F9FC] px-3 py-2.5 text-[12px] leading-4 text-text-secondary">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Vista de demostración. Los cambios no se guardan hasta conectar la
        persistencia.
      </div>

      <FormField
        label="Nombre de la categoría"
        htmlFor="categoria-nombre"
        required
        error={nombreTouched ? nombreError : null}
        hint="Debe ser único. Se ignoran las mayúsculas y los espacios al comparar."
      >
        <input
          ref={nombreRef}
          id="categoria-nombre"
          value={nombre}
          onChange={(event) => setNombre(event.target.value)}
          onBlur={() => setNombreTouched(true)}
          placeholder="Por ejemplo, Utensilios"
          className={`${inputClass} ${
            nombreTouched && nombreError ? "border-error" : "border-border"
          }`}
        />
      </FormField>

      <FormField
        label="Descripción (opcional)"
        htmlFor="categoria-descripcion"
        className="mt-3"
        hint="Nota breve sobre qué agrupa esta categoría."
      >
        <textarea
          id="categoria-descripcion"
          value={descripcion}
          rows={3}
          onChange={(event) => setDescripcion(event.target.value)}
          placeholder="Información útil para el día a día"
          className="w-full resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-secondary/60 transition-colors duration-[120ms] hover:border-border-strong focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/20"
        />
      </FormField>
    </Dialog>
  );
}
