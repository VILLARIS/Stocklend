
import { useEffect, useMemo, useRef, useState } from "react";

import {
  Sparkles,
  PackagePlus,
  PackageCheck,
  Boxes,
  Info,
  Hash,
} from "lucide-react";

import { Dialog } from "../ui/Dialog";
import { FormField } from "../ui/FormField";
import { SelectField } from "../ui/SelectField";
import { QuantityInput } from "../ui/QuantityInput";
import { Button } from "../ui/Button";

import type {
  InventoryArticle,
  InventoryUnit,
} from "../../data/inventoryData";

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

type FormErrors = {
  nombre?: string;
  categoria?: string;
  cantidad?: string;
  codes?: string;
  nota?: string;
};

// ========================================
// UTILIDADES
// ========================================

function codePrefix(nombre: string): string {
  const letters = nombre
    .trim()
    .split(/\s+/)
    .map((word) =>
      word
        .replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "")
        .charAt(0)
    )
    .filter(Boolean)
    .join("")
    .toUpperCase();

  return (letters || "UNI").slice(0, 3);
}

function padCodes(prefix: string, count: number): string[] {
  return Array.from(
    { length: count },
    (_, index) =>
      `${prefix}-${String(index + 1).padStart(3, "0")}`
  );
}

// ========================================
// INTERRUPTOR
// ========================================

interface SwitchRowProps {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label: string;
  hint: string;
  icon: React.ReactNode;
  accent?: "blue" | "green";
}

function SwitchRow({
  id,
  checked,
  onChange,
  disabled = false,
  label,
  hint,
  icon,
  accent = "blue",
}: SwitchRowProps) {
  const enabledColor =
    accent === "green"
      ? "bg-[#18AD78]"
      : "bg-[#287FF0]";

  const iconColor =
    accent === "green"
      ? "text-[#17A574]"
      : "text-[#287FF0]";

  return (
    <label
      htmlFor={id}
      className={`
        group flex min-w-0 items-center
        justify-between gap-3
        rounded-xl border
        border-[#E5ECF5]
        bg-[#FAFCFF]
        px-3.5 py-3

        transition-[border-color,background-color]
        duration-200

        ${
          disabled
            ? "cursor-not-allowed opacity-65"
            : "cursor-pointer hover:border-[#C9DDF8] hover:bg-[#F6FAFF]"
        }
      `}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`
            flex h-9 w-9 shrink-0
            items-center justify-center
            rounded-[10px] bg-white
            shadow-[0_1px_4px_rgba(30,65,120,0.06)]
            ${iconColor}
          `}
        >
          {icon}
        </div>

        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold text-[#20365A]">
            {label}
          </p>

          <p className="mt-0.5 text-[11px] leading-[16px] text-[#8392AA]">
            {hint}
          </p>
        </div>
      </div>

      <span className="relative inline-flex shrink-0 items-center">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(event) =>
            onChange(event.target.checked)
          }
          className="
            peer absolute inset-0
            h-full w-full cursor-inherit
            opacity-0
          "
        />

        <span
          aria-hidden="true"
          className={`
            flex h-[23px] w-[42px]
            items-center rounded-full
            p-[3px]
            transition-colors duration-200
            peer-focus-visible:outline
            peer-focus-visible:outline-2
            peer-focus-visible:outline-offset-2
            peer-focus-visible:outline-[#398BFF]

            ${
              checked
                ? enabledColor
                : "bg-[#CDD6E4]"
            }
          `}
        >
          <span
            className={`
              h-[17px] w-[17px]
              rounded-full bg-white
              shadow-[0_1px_3px_rgba(0,0,0,0.12)]
              transition-transform duration-200

              ${
                checked
                  ? "translate-x-[19px]"
                  : "translate-x-0"
              }
            `}
          />
        </span>
      </span>
    </label>
  );
}

// ========================================
// ENCABEZADO DE SECCIÓN
// ========================================

function SectionHeading({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div
        className="
          flex h-8 w-8 shrink-0
          items-center justify-center
          rounded-[10px]
          bg-[#EAF3FF]
          text-[#287FF0]
        "
      >
        {icon}
      </div>

      <div className="min-w-0">
        <h3 className="text-[12.5px] font-semibold text-[#22385C]">
          {title}
        </h3>

        {description && (
          <p className="mt-0.5 text-[10.5px] text-[#8695AD]">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

// ========================================
// MODAL PRINCIPAL
// ========================================

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

  // ----------------------------------------
  // ESTADO
  // ----------------------------------------

  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("");
  const [cantidad, setCantidad] = useState(0);
  const [controlIndividual, setControlIndividual] =
    useState(false);
  const [prestable, setPrestable] = useState(true);
  const [nota, setNota] = useState("");
  const [unitCodes, setUnitCodes] = useState<string[]>([]);

  const [touched, setTouched] = useState<
    Record<string, boolean>
  >({});

  const nombreRef = useRef<HTMLInputElement>(null);

  // ----------------------------------------
  // CARGA INICIAL
  // ----------------------------------------

  useEffect(() => {
    if (!open) return;

    if (mode === "edit" && article) {
      setNombre(article.nombre);
      setCategoria(article.categoria);

      setCantidad(
        article.disponible +
          article.prestado +
          article.danado +
          article.faltante
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

  // ----------------------------------------
  // SINCRONIZACIÓN DE CÓDIGOS
  // ----------------------------------------

  useEffect(() => {
    if (!controlIndividual) return;

    setUnitCodes((previous) => {
      if (previous.length === cantidad) {
        return previous;
      }

      const next = previous.slice(0, cantidad);

      while (next.length < cantidad) {
        next.push("");
      }

      return next;
    });
  }, [controlIndividual, cantidad]);

  const prefix = useMemo(
    () => codePrefix(nombre),
    [nombre]
  );

  const repeatedCodes = useMemo(() => {
    const counts = new Map<string, number>();

    unitCodes.slice(0, cantidad).forEach((code) => {
      const key = code.trim().toLowerCase();

      if (key === "") return;

      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return new Set(
      [...counts.entries()]
        .filter(([, total]) => total > 1)
        .map(([key]) => key)
    );
  }, [unitCodes, cantidad]);

  // ----------------------------------------
  // VALIDACIONES
  // ----------------------------------------

  const computeErrors = (): FormErrors => {
    const result: FormErrors = {};

    const name = nombre.trim();

    if (name === "") {
      result.nombre =
        "El nombre del artículo es obligatorio.";
    } else {
      const own =
        article?.nombre.trim().toLowerCase();

      const duplicate = existingNames.some(
        (candidate) => {
          const value =
            candidate.trim().toLowerCase();

          if (isEdit && value === own) {
            return false;
          }

          return value === name.toLowerCase();
        }
      );

      if (duplicate) {
        result.nombre =
          `Ya existe un artículo llamado «${name}».`;
      }
    }

    if (
      categoria === "" ||
      !categorias.includes(categoria)
    ) {
      result.categoria =
        "Elige una categoría de la lista.";
    }

    if (cantidad < 0) {
      result.cantidad =
        "La cantidad no puede ser menor que cero.";
    } else if (
      controlIndividual &&
      cantidad <= 0
    ) {
      result.cantidad =
        "Un artículo con control individual necesita al menos una unidad.";
    }

    if (controlIndividual && cantidad > 0) {
      const codes = unitCodes
        .slice(0, cantidad)
        .map((code) => code.trim());

      if (codes.some((code) => code === "")) {
        result.codes =
          "Cada unidad necesita un código.";
      } else if (repeatedCodes.size > 0) {
        const sample = [...repeatedCodes]
          .slice(0, 2)
          .map((code) => `«${code.toUpperCase()}»`)
          .join(" y ");

        result.codes =
          `Los códigos ${sample} están repetidos. Cada unidad necesita un código único.`;
      }
    }

    if (nota.length > NOTA_MAX) {
      result.nota =
        "La nota no puede pasar de 200 caracteres.";
    }

    return result;
  };

  const errors = computeErrors();

  const markTouched = (key: string) => {
    setTouched((previous) => ({
      ...previous,
      [key]: true,
    }));
  };

  const showError = (
    key: keyof FormErrors
  ) => touched[key] ? errors[key] : undefined;

  const fillCodes = () => {
    setUnitCodes(padCodes(prefix, cantidad));
    markTouched("codes");
  };

  // ----------------------------------------
  // ESTILOS
  // ----------------------------------------

  const inputClass = `
    h-[39px] w-full
    rounded-[9px]
    border border-[#DFE7F2]
    bg-white px-3
    text-[12.5px]
    text-[#243B60]

    placeholder:text-[#9AA8BC]

    transition-[border-color,box-shadow]
    duration-200

    hover:border-[#BAD0EC]

    focus:border-[#398BFF]
    focus:outline-none
    focus:ring-2
    focus:ring-[#398BFF]/10
  `;

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        isEdit
          ? "Editar artículo"
          : "Nuevo artículo"
      }
      subtitle={
        isEdit
          ? "Actualiza la información del artículo seleccionado."
          : "Registra un nuevo artículo en el inventario."
      }
      size="lg"
      initialFocusRef={nombreRef}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
          >
            Cancelar
          </Button>

          <span
            title="Disponible cuando se conecte la persistencia"
          >
            <Button disabled>
              {isEdit
                ? "Guardar cambios"
                : "Registrar artículo"}
            </Button>
          </span>
        </>
      }
    >
      <div className="space-y-4">

        {/* =====================================
            INFORMACIÓN GENERAL
        ===================================== */}

        <section className="min-w-0">
          <SectionHeading
            icon={<PackagePlus className="h-[17px] w-[17px]" />}
            title="Información general"
            description="Datos principales del artículo"
          />

          <div
            className="
              mt-3 grid grid-cols-1
              gap-x-4 gap-y-3
              sm:grid-cols-2
            "
          >
            {/* NOMBRE */}
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
                onChange={(event) =>
                  setNombre(event.target.value)
                }
                onBlur={() =>
                  markTouched("nombre")
                }
                placeholder="Por ejemplo, Olla grande"
                className={inputClass}
              />
            </FormField>

            {/* CÓDIGO */}
            <FormField
              label="Código"
              hint="Generado automáticamente por el sistema."
            >
              <div className="relative">
                <Hash
                  className="
                    pointer-events-none
                    absolute left-3 top-1/2
                    h-4 w-4 -translate-y-1/2
                    text-[#9CABBE]
                  "
                />

                <input
                  readOnly
                  value={
                    isEdit
                      ? article?.codigo ?? "—"
                      : ""
                  }
                  placeholder="Automático"
                  aria-label="Código del artículo"
                  className="
                    h-[39px] w-full
                    cursor-not-allowed
                    rounded-[9px]
                    border border-[#E2E8F1]
                    bg-[#F3F6FA]
                    pl-9 pr-3
                    font-mono text-[12px]
                    text-[#70819C]
                    placeholder:font-sans
                    placeholder:text-[#9BA9BC]
                  "
                />
              </div>
            </FormField>

            {/* CATEGORÍA */}
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
              options={categorias.map(
                (value) => ({
                  value,
                  label: value,
                })
              )}
              error={showError("categoria")}
            />

            {/* NOTA */}
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
                  rows={2}
                  maxLength={NOTA_MAX}
                  onChange={(event) =>
                    setNota(event.target.value)
                  }
                  onBlur={() =>
                    markTouched("nota")
                  }
                  placeholder="Información útil para el día a día..."
                  className="
                    w-full resize-none
                    rounded-[9px]
                    border border-[#DFE7F2]
                    bg-white
                    px-3 py-2.5 pb-6
                    text-[12.5px] leading-5
                    text-[#243B60]
                    placeholder:text-[#9AA8BC]

                    transition-[border-color,box-shadow]
                    duration-200

                    hover:border-[#BAD0EC]
                    focus:border-[#398BFF]
                    focus:outline-none
                    focus:ring-2
                    focus:ring-[#398BFF]/10
                  "
                />

                <span
                  className="
                    pointer-events-none
                    absolute bottom-2 right-3
                    text-[10px] tabular-nums
                    text-[#96A4B8]
                  "
                >
                  {nota.length}/{NOTA_MAX}
                </span>
              </div>
            </FormField>
          </div>
        </section>

        {/* SEPARADOR */}
        <div className="h-px bg-[#E9EEF6]" />

        {/* =====================================
            CONTROL DEL INVENTARIO
        ===================================== */}

        <section className="min-w-0">
          <SectionHeading
            icon={<Boxes className="h-[17px] w-[17px]" />}
            title="Control de inventario"
            description="Cantidad y configuración de las unidades"
          />

          <div className="mt-3 space-y-3">

            {/* CANTIDAD */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                label={
                  isEdit
                    ? "Cantidad total"
                    : "Cantidad inicial"
                }
                htmlFor="articulo-cantidad"
                required
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
                  onBlur={() =>
                    markTouched("cantidad")
                  }
                  disabled={isEdit}
                  invalid={Boolean(
                    showError("cantidad")
                  )}
                  ariaLabel={
                    isEdit
                      ? "Cantidad total"
                      : "Cantidad inicial"
                  }
                />
              </FormField>

              {/* NOTA DE CANTIDAD */}
              <div
                className="
                  flex items-center gap-2.5
                  rounded-xl
                  bg-[#F3F8FF]
                  px-3 py-2.5
                "
              >
                <Info
                  className="
                    h-4 w-4 shrink-0
                    text-[#398BFF]
                  "
                />

                <p
                  className="
                    text-[11px] leading-[17px]
                    text-[#6380A6]
                  "
                >
                  {isEdit
                    ? "Las existencias se actualizan desde el ajuste de inventario."
                    : "Indica cuántas unidades tendrá este artículo inicialmente."}
                </p>
              </div>
            </div>

            {/* INTERRUPTORES */}
            <div className="grid grid-cols-1 gap-2.5">
              {isEdit ? (
                <div
                  className="
                    flex items-center gap-3
                    rounded-xl border
                    border-[#E5ECF5]
                    bg-[#FAFCFF]
                    px-3.5 py-3
                  "
                >
                  <div
                    className="
                      flex h-9 w-9 shrink-0
                      items-center justify-center
                      rounded-[10px]
                      bg-white text-[#287FF0]
                    "
                  >
                    <Boxes className="h-[18px] w-[18px]" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-[12.5px] font-semibold text-[#20365A]">
                      Control individual de unidades
                    </p>

                    <p className="mt-0.5 text-[11px] text-[#8392AA]">
                      {controlIndividual
                        ? "Activado: cada unidad tiene su propio código."
                        : "Desactivado: se gestiona por cantidad."}
                    </p>
                  </div>

                  <span
                    className={`
                      ml-auto shrink-0
                      rounded-lg px-2.5 py-1
                      text-[10.5px] font-semibold

                      ${
                        controlIndividual
                          ? "bg-[#EAF3FF] text-[#287FF0]"
                          : "bg-[#EEF1F5] text-[#8290A4]"
                      }
                    `}
                  >
                    {controlIndividual
                      ? "Activado"
                      : "Desactivado"}
                  </span>
                </div>
              ) : (
                <SwitchRow
                  id="articulo-control"
                  checked={controlIndividual}
                  onChange={(value) => {
                    setControlIndividual(value);
                    markTouched("cantidad");
                    markTouched("codes");
                  }}
                  icon={<Boxes className="h-[18px] w-[18px]" />}
                  label="Control individual de unidades"
                  hint="Cada unidad tendrá un código de identificación."
                />
              )}

              <SwitchRow
                id="articulo-prestable"
                checked={prestable}
                onChange={setPrestable}
                icon={<PackageCheck className="h-[18px] w-[18px]" />}
                accent="green"
                label="Puede prestarse"
                hint="Desactívalo si el artículo está en reparación o restringido."
              />
            </div>

            {/* =====================================
                CÓDIGOS INDIVIDUALES
            ===================================== */}

            {controlIndividual && (
              <div
                className="
                  rounded-xl
                  border border-[#E1EAF6]
                  bg-[#F8FBFF]
                  p-3.5
                "
              >
                <div
                  className="
                    flex flex-wrap
                    items-center justify-between
                    gap-2
                  "
                >
                  <div>
                    <p
                      className="
                        text-[12px] font-semibold
                        text-[#253C60]
                      "
                    >
                      Códigos de unidad ({cantidad})
                    </p>

                    <p
                      className="
                        mt-0.5 text-[10.5px]
                        text-[#8293AB]
                      "
                    >
                      Patrón sugerido: {prefix}-001 a{" "}
                      {prefix}-
                      {String(
                        Math.max(cantidad, 1)
                      ).padStart(3, "0")}
                    </p>
                  </div>

                  {!isEdit && (
                    <Button
                      type="button"
                      variant="secondary"
                      className="
                        h-8 min-w-0
                        px-3 text-[11.5px]
                      "
                      onClick={fillCodes}
                    >
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      Generar códigos
                    </Button>
                  )}
                </div>

                {unitCodes.length > 0 && (
                  <div
                    className="
                      mt-3 grid max-h-[140px]
                      grid-cols-2 gap-2
                      overflow-y-auto pr-1
                      sm:grid-cols-3
                    "
                  >
                    {unitCodes
                      .slice(0, cantidad)
                      .map((code, index) => {
                        const invalid =
                          repeatedCodes.has(
                            code.trim().toLowerCase()
                          );

                        return (
                          <input
                            key={index}
                            value={code}
                            readOnly={isEdit}
                            onChange={(event) => {
                              const value =
                                event.target.value;

                              setUnitCodes((previous) =>
                                previous.map(
                                  (item, position) =>
                                    position === index
                                      ? value
                                      : item
                                )
                              );

                              markTouched("codes");
                            }}
                            aria-label={
                              `Código de la unidad ${index + 1}`
                            }
                            placeholder={
                              `${prefix}-${String(index + 1).padStart(3, "0")}`
                            }
                            className={`
                              h-9 min-w-0
                              rounded-lg border
                              bg-white px-2.5
                              font-mono text-[11.5px]
                              text-[#31496C]

                              focus:outline-none
                              focus:ring-2
                              focus:ring-[#398BFF]/10

                              ${
                                invalid
                                  ? "border-[#E96B75] focus:border-[#E96B75]"
                                  : "border-[#DFE7F2] focus:border-[#398BFF]"
                              }

                              ${
                                isEdit
                                  ? "cursor-not-allowed bg-[#F0F3F8]"
                                  : ""
                              }
                            `}
                          />
                        );
                      })}
                  </div>
                )}

                {showError("codes") && (
                  <p
                    className="
                      mt-2 text-[11px]
                      leading-4 text-error
                    "
                  >
                    {errors.codes}
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </Dialog>
  );
}
