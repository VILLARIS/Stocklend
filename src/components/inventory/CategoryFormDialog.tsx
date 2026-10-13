import { useEffect, useRef, useState } from "react";
import { CircleAlert, Info, Loader2 } from "lucide-react";
import { Dialog } from "../ui/Dialog";
import { FormField } from "../ui/FormField";
import { Button } from "../ui/Button";
import type { InventoryCategory } from "../../data/inventoryData";

type FormMode = "create" | "edit";

export interface CategoryFormValues {
  nombre: string;
  descripcion: string | null;
}

interface CategoryFormDialogProps {
  open: boolean;
  mode: FormMode;
  category?: InventoryCategory;
  existingNames: string[];
  saving: boolean;
  serverError: string | null;
  onClose: () => void;
  onSubmit: (values: CategoryFormValues) => void;
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
  saving,
  serverError,
  onClose,
  onSubmit,
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

  const canSubmit = !saving && nombreError === null;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNombreTouched(true);
    if (nombreError !== null) {
      return;
    }
    const descripcionLimpia = descripcion.trim();
    onSubmit({
      nombre: nombre.trim(),
      descripcion: descripcionLimpia === "" ? null : descripcionLimpia,
    });
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? () => undefined : onClose}
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
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="categoria-form"
            disabled={!canSubmit}
          >
            {saving && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isEdit ? "Guardar" : "Crear categoría"}
          </Button>
        </>
      }
    >
      {serverError && (
        <div
          role="alert"
          className="mb-3 flex items-start gap-2 rounded-md border border-error/40 bg-error-tint px-3 py-2 text-[12.5px] leading-5 text-error"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      <div
        className="
          mb-3 flex items-start gap-2
          rounded-md border border-[#DCEEFF]
          bg-[#EFF6FF] px-3 py-2
          text-[11.5px] leading-4
          text-[#3E6FA8]
        "
      >
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          {isEdit
            ? "Los artículos asociados conservarán su vínculo con esta categoría."
            : "Podrás editar o desactivar la categoría más adelante; nunca se elimina."}
        </span>
      </div>

      <form id="categoria-form" onSubmit={handleSubmit} noValidate>
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
            disabled={saving}
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
            disabled={saving}
            onChange={(event) => setDescripcion(event.target.value)}
            placeholder="Información útil para el día a día"
            className="w-full resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-secondary/60 transition-colors duration-[120ms] hover:border-border-strong focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/20"
          />
        </FormField>
      </form>
    </Dialog>
  );
}
