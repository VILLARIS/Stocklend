import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Dialog } from "../ui/Dialog";
import { FormField } from "../ui/FormField";
import { SelectField } from "../ui/SelectField";
import { QuantityInput } from "../ui/QuantityInput";
import { Button } from "../ui/Button";
import type { InventoryArticle, InventoryUnit } from "../../data/inventoryData";

const NOTA_MAX = 200;

type FormMode = "create" | "edit";

interface ArticleFormDialogProps {
  open: boolean;
  mode: FormMode;
  article?: InventoryArticle;
  unidades?: InventoryUnit[];
  categorias: string[];
  existingNames: string[];
  onClose: () => void;
}

function codePrefix(nombre: string): string {
  const letters = nombre
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "").charAt(0))
    .filter(Boolean)
    .join("")
    .toUpperCase();
  return (letters || "UNI").slice(0, 3);
}

function padCodes(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) =>
    `${prefix}-${String(index + 1).padStart(3, "0")}`,
  );
}

interface CheckboxRowProps {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label: string;
  hint?: string;
}

function CheckboxRow({
  id,
  checked,
  onChange,
  disabled = false,
  label,
  hint,
}: CheckboxRowProps) {
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-border-strong accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50"
      />
      <div className="min-w-0">
        <label
          htmlFor={id}
          className={`text-[13px] font-medium ${
            disabled ? "text-text-secondary" : "text-text"
          }`}
        >
          {label}
        </label>
        {hint && (
          <p className="mt-0.5 text-[11.5px] leading-4 text-text-secondary">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

export function ArticleFormDialog({
  open,
  mode,
  article,
  unidades = [],
  categorias,
  existingNames,
  onClose,
}: ArticleFormDialogProps) {
  const isEdit = mode === "edit";

  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("");
  const [cantidad, setCantidad] = useState(0);
  const [controlIndividual, setControlIndividual] = useState(false);
  const [prestable, setPrestable] = useState(true);
  const [nota, setNota] = useState("");
  const [unitCodes, setUnitCodes] = useState<string[]>([]);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const nombreRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && article) {
      setNombre(article.nombre);
      setCategoria(article.categoria);
      setCantidad(
        article.disponible +
          article.prestado +
          article.danado +
          article.faltante,
      );
      setControlIndividual(article.controlIndividual);
      setPrestable(article.prestable);
      setNota("");
      setUnitCodes(unidades.map((unit) => unit.codigo));
    } else {
      setNombre("");
      setCategoria("");
      setCantidad(0);
      setControlIndividual(false);
      setPrestable(true);
      setNota("");
      setUnitCodes([]);
    }
    setTouched({});
  }, [open, mode, article, unidades]);

  useEffect(() => {
    if (!controlIndividual) return;
    setUnitCodes((previous) => {
      if (previous.length === cantidad) return previous;
      const next = previous.slice(0, cantidad);
      while (next.length < cantidad) next.push("");
      return next;
    });
  }, [controlIndividual, cantidad]);

  const prefix = useMemo(() => codePrefix(nombre), [nombre]);

  const repeatedCodes = useMemo(() => {
    const counts = new Map<string, number>();
    unitCodes.slice(0, cantidad).forEach((code) => {
      const key = code.trim().toLowerCase();
      if (key === "") return;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return new Set(
      [...counts.entries()].filter(([, total]) => total > 1).map(([key]) => key),
    );
  }, [unitCodes, cantidad]);

  const computeErrors = (): {
    nombre?: string;
    categoria?: string;
    cantidad?: string;
    codes?: string;
    nota?: string;
  } => {
    const result: {
      nombre?: string;
      categoria?: string;
      cantidad?: string;
      codes?: string;
      nota?: string;
    } = {};

    const name = nombre.trim();
    if (name === "") {
      result.nombre = "El nombre del artículo es obligatorio.";
    } else {
      const own = article?.nombre.trim().toLowerCase();
      const duplicate = existingNames.some((candidate) => {
        const value = candidate.trim().toLowerCase();
        if (isEdit && value === own) return false;
        return value === name.toLowerCase();
      });
      if (duplicate) result.nombre = `Ya existe un artículo llamado «${name}».`;
    }

    if (categoria === "" || !categorias.includes(categoria)) {
      result.categoria = "Elige una categoría de la lista.";
    }

    if (cantidad < 0) {
      result.cantidad = "La cantidad no puede ser menor que cero.";
    } else if (controlIndividual && cantidad <= 0) {
      result.cantidad =
        "Un artículo con control individual necesita al menos una unidad.";
    }

    if (controlIndividual && cantidad > 0) {
      const codes = unitCodes.slice(0, cantidad).map((code) => code.trim());
      if (codes.some((code) => code === "")) {
        result.codes = "Cada unidad necesita un código.";
      } else if (repeatedCodes.size > 0) {
        const sample = [...repeatedCodes]
          .slice(0, 2)
          .map((code) => `«${code.toUpperCase()}»`)
          .join(" y ");
        result.codes = `Los códigos ${sample} están repetidos. Cada unidad necesita un código único.`;
      }
    }

    if (nota.length > NOTA_MAX) {
      result.nota = "La nota no puede pasar de 200 caracteres.";
    }

    return result;
  };

  const errors = computeErrors();

  const markTouched = (key: string) =>
    setTouched((previous) => ({ ...previous, [key]: true }));

  const showError = (key: keyof ReturnType<typeof computeErrors>) =>
    touched[key] ? errors[key] : undefined;

  const fillCodes = () => setUnitCodes(padCodes(prefix, cantidad));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar artículo" : "Nuevo artículo"}
      subtitle={
        isEdit
          ? "Modifica la información del artículo seleccionado."
          : "Registra un nuevo artículo en el inventario."
      }
      size="lg"
      initialFocusRef={nombreRef}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <span title="Disponible cuando se conecte la persistencia">
            <Button disabled>
              {isEdit ? "Guardar cambios" : "Registrar artículo"}
            </Button>
          </span>
        </>
      }
    >
      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
          Información general
        </h3>
        <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          <FormField
            label="Nombre del artículo"
            htmlFor="articulo-nombre"
            required
            error={showError("nombre")}
            className="sm:col-span-2"
          >
            <input
              ref={nombreRef}
              id="articulo-nombre"
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              onBlur={() => markTouched("nombre")}
              placeholder="Por ejemplo, Olla grande"
              className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-text placeholder:text-text-secondary/60 transition-colors duration-[120ms] hover:border-border-strong focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/20"
            />
          </FormField>

          <FormField label="Código" hint="El sistema lo genera automáticamente.">
            <input
              readOnly
              value={isEdit ? article?.codigo ?? "—" : ""}
              placeholder="Automático"
              aria-label="Código del artículo"
              className="h-9 w-full cursor-not-allowed rounded-md border border-border bg-[#F1F4F8] px-3 font-mono text-sm text-text-secondary placeholder:font-sans placeholder:text-text-secondary/60"
            />
          </FormField>

          <SelectField
            id="articulo-categoria"
            label="Categoría"
            required
            value={categoria}
            onChange={(value) => {
              setCategoria(value);
              markTouched("categoria");
            }}
            placeholder="Elige una categoría"
            options={categorias.map((value) => ({ value, label: value }))}
            error={showError("categoria")}
          />

          <FormField
            label="Nota (opcional)"
            htmlFor="articulo-nota"
            error={showError("nota")}
            className="sm:col-span-2"
          >
            <div className="relative">
              <textarea
                id="articulo-nota"
                value={nota}
                rows={3}
                onChange={(event) => setNota(event.target.value)}
                onBlur={() => markTouched("nota")}
                placeholder="Información útil para el día a día"
                className={`w-full resize-none rounded-md border bg-surface px-3 py-2 pb-6 text-sm text-text placeholder:text-text-secondary/60 transition-colors duration-[120ms] hover:border-border-strong focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 ${
                  errors.nota ? "border-error" : "border-border"
                }`}
              />
              <span className="pointer-events-none absolute bottom-1.5 right-2 text-[11px] tabular-nums text-text-secondary">
                {nota.length} de {NOTA_MAX}
              </span>
            </div>
          </FormField>
        </div>
      </section>

      <section className="mt-5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
          Control de inventario
        </h3>
        <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          <FormField
            label={isEdit ? "Cantidad total" : "Cantidad inicial"}
            required
            htmlFor="articulo-cantidad"
            error={showError("cantidad")}
            hint={
              isEdit
                ? "La cantidad se cambia con «Ajustar existencias»."
                : undefined
            }
          >
            <QuantityInput
              id="articulo-cantidad"
              value={cantidad}
              onChange={setCantidad}
              onBlur={() => markTouched("cantidad")}
              disabled={isEdit}
              invalid={Boolean(showError("cantidad"))}
              ariaLabel={isEdit ? "Cantidad total" : "Cantidad inicial"}
            />
          </FormField>

          <div className="flex flex-col justify-start sm:col-span-2">
            {isEdit ? (
              <div className="rounded-md border border-border-soft bg-[#F7F9FC] px-3 py-2.5">
                <p className="text-[13px] font-medium text-text">
                  Control individual de unidades:{" "}
                  <span className="text-text-secondary">
                    {controlIndividual ? "Activado" : "Desactivado"}
                  </span>
                </p>
                <p className="mt-0.5 text-[11.5px] leading-4 text-text-secondary">
                  {controlIndividual
                    ? "Este artículo se gestiona unidad por unidad con su código."
                    : "Este artículo se gestiona por cantidad."}
                </p>
              </div>
            ) : (
              <CheckboxRow
                id="articulo-control"
                checked={controlIndividual}
                onChange={(value) => {
                  setControlIndividual(value);
                  markTouched("cantidad");
                  markTouched("codes");
                }}
                label="Control individual de unidades"
                hint="Si está activo, el sistema pide un código por unidad."
              />
            )}
          </div>

          {controlIndividual && (
            <div className="rounded-md border border-border-soft bg-[#F7F9FC] p-3 sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[12.5px] font-medium text-text">
                  Códigos de unidad ({cantidad})
                </p>
                {!isEdit && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-8 min-w-0 px-3 text-[12.5px]"
                    onClick={fillCodes}
                  >
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    Generar códigos
                  </Button>
                )}
              </div>
              <p className="mt-1 text-[11.5px] leading-4 text-text-secondary">
                Patrón sugerido {prefix}-001 … {prefix}-
                {String(Math.max(cantidad, 1)).padStart(3, "0")}. Cada código se
                puede editar.
              </p>
              {unitCodes.length > 0 && (
                <div className="mt-2 grid max-h-[150px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
                  {unitCodes.slice(0, cantidad).map((code, index) => {
                    const invalid = repeatedCodes.has(code.trim().toLowerCase());
                    return (
                      <input
                        key={index}
                        value={code}
                        readOnly={isEdit}
                        onChange={(event) => {
                          const value = event.target.value;
                          setUnitCodes((previous) =>
                            previous.map((item, position) =>
                              position === index ? value : item,
                            ),
                          );
                          markTouched("codes");
                        }}
                        aria-label={`Código de la unidad ${index + 1}`}
                        placeholder={`${prefix}-${String(index + 1).padStart(3, "0")}`}
                        className={`h-8 rounded-md border bg-surface px-2 font-mono text-[12px] text-text placeholder:text-text-secondary/50 focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 ${
                          invalid ? "border-error" : "border-border"
                        } ${isEdit ? "cursor-not-allowed bg-[#F1F4F8]" : ""}`}
                      />
                    );
                  })}
                </div>
              )}
              {showError("codes") && (
                <p className="mt-2 text-[11.5px] leading-4 text-error">
                  {errors.codes}
                </p>
              )}
            </div>
          )}

          <div className="sm:col-span-2">
            <CheckboxRow
              id="articulo-prestable"
              checked={prestable}
              onChange={setPrestable}
              label="Puede prestarse"
              hint="Desactívalo si el artículo está en reparación."
            />
          </div>
        </div>
      </section>
    </Dialog>
  );
}
