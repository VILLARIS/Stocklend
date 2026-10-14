
import { useEffect, useRef, useState } from "react";
import { CircleAlert, GraduationCap, Hash, Info, Loader2 } from "lucide-react";

import { Dialog } from "../ui/Dialog";
import { FormField } from "../ui/FormField";
import { Button } from "../ui/Button";

import type { Student } from "../../types/students";

export type StudentFormMode = "create" | "edit";

export interface StudentFormValues {
  codigo: string;
  nombres: string;
  apellidos: string;
}

interface StudentFormDialogProps {
  open: boolean;
  mode: StudentFormMode;
  student?: Student;
  /** Directorio real, usado para avisar de códigos universitarios repetidos. */
  students: Student[];
  /** Hay un guardado en curso. */
  saving: boolean;
  /** Error devuelto por el backend al guardar. */
  serverError: string | null;
  onClose: () => void;
  onSubmit: (values: StudentFormValues) => void;
}

type FieldKey = "codigo" | "nombres" | "apellidos";

const inputClass = `
  h-10 w-full rounded-[10px]
  border bg-white px-3.5
  text-[12.5px] text-[#243B60]
  placeholder:text-[#9AA8BC]
  transition-[border-color,box-shadow] duration-200
  hover:border-[#BAD0EC]
  focus:border-[#398BFF]
  focus:outline-none
  focus:ring-2 focus:ring-[#398BFF]/10
`;

function SectionTitle({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF3FF] text-[#287FF0]">
        {icon}
      </span>

      <div>
        <h3 className="text-[12.5px] font-semibold text-[#22385C]">
          {title}
        </h3>
        <p className="mt-0.5 text-[11px] text-[#8695AD]">
          {description}
        </p>
      </div>
    </div>
  );
}

export function StudentFormDialog({
  open,
  mode,
  student,
  students,
  saving,
  serverError,
  onClose,
  onSubmit,
}: StudentFormDialogProps) {
  const isEdit = mode === "edit";

  const [codigo, setCodigo] = useState("");
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");

  const [touched, setTouched] = useState<
    Record<FieldKey, boolean>
  >({
    codigo: false,
    nombres: false,
    apellidos: false,
  });

  const codigoRef = useRef<HTMLInputElement>(null);
  const nombresRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    if (isEdit && student) {
      setCodigo(student.codigoUniversitario);
      setNombres(student.nombres);
      setApellidos(student.apellidos);
    } else {
      setCodigo("");
      setNombres("");
      setApellidos("");
    }

    setTouched({
      codigo: false,
      nombres: false,
      apellidos: false,
    });
  }, [open, isEdit, student]);

  const computeErrors = (): Partial<Record<FieldKey, string>> => {
    const result: Partial<Record<FieldKey, string>> = {};

    const codigoLimpio = codigo.trim();

    if (codigoLimpio === "") {
      result.codigo = "El código universitario es obligatorio.";
    } else {
      const objetivo = codigoLimpio.toLowerCase();
      const duplicado = students.find(
        (item) =>
          item.id !== (isEdit ? student?.id : undefined) &&
          item.codigoUniversitario.trim().toLowerCase() ===
            objetivo
      );

      if (duplicado) {
        result.codigo =
          `Ya existe un estudiante con ese código: ${duplicado.nombres} ${duplicado.apellidos}.`;
      }
    }

    if (nombres.trim() === "") {
      result.nombres = "Los nombres son obligatorios.";
    }

    if (apellidos.trim() === "") {
      result.apellidos = "Los apellidos son obligatorios.";
    }

    return result;
  };

  const errors = computeErrors();
  const canSubmit = !saving && Object.keys(errors).length === 0;

  const markTouched = (key: FieldKey) => {
    setTouched((previous) => ({
      ...previous,
      [key]: true,
    }));
  };

  const showError = (key: FieldKey) =>
    touched[key] ? errors[key] : undefined;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched({ codigo: true, nombres: true, apellidos: true });
    if (Object.keys(errors).length > 0) {
      return;
    }
    onSubmit({
      codigo: codigo.trim(),
      nombres: nombres.trim(),
      apellidos: apellidos.trim(),
    });
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? () => undefined : onClose}
      title={isEdit ? "Editar estudiante" : "Nuevo estudiante"}
      subtitle={
        isEdit
          ? "Actualiza la información del estudiante seleccionado."
          : "Registra un estudiante para gestionar sus préstamos."
      }
      size="sm"
      initialFocusRef={isEdit ? nombresRef : codigoRef}
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

          <Button type="submit" form="estudiante-form" disabled={!canSubmit}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Guardar cambios" : "Registrar estudiante"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {serverError !== null && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-[#F6CBCB] bg-[#FDF1F1] px-3 py-2.5"
          >
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-error" />

            <p className="text-[11px] leading-[17px] text-error">
              {serverError}
            </p>
          </div>
        )}

        <section>
          <SectionTitle
            icon={<GraduationCap className="h-[18px] w-[18px]" />}
            title="Información del estudiante"
            description="Datos utilizados para identificar al responsable"
          />

          <form id="estudiante-form" onSubmit={handleSubmit} noValidate>
            <div className="mt-3 space-y-3.5">
              <FormField
                label="Código universitario"
                htmlFor="estudiante-codigo"
                required
                error={showError("codigo")}
                hint={
                  isEdit
                    ? "Puedes corregir el código, pero debe seguir siendo único."
                    : "Puede contener letras, números y guiones."
                }
              >
                <div className="relative">
                  <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8DA0BA]" />

                  <input
                    ref={codigoRef}
                    id="estudiante-codigo"
                    value={codigo}
                    disabled={saving}
                    onChange={(event) => setCodigo(event.target.value)}
                    onBlur={() => markTouched("codigo")}
                    placeholder="Por ejemplo, 20231234567"
                    aria-invalid={Boolean(showError("codigo"))}
                    className={`
                      ${inputClass} pl-10 font-mono
                      ${
                        showError("codigo")
                          ? "border-error"
                          : "border-[#DFE7F2]"
                      }
                    `}
                  />
                </div>
              </FormField>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField
                  label="Nombres"
                  htmlFor="estudiante-nombres"
                  required
                  error={showError("nombres")}
                >
                  <input
                    ref={nombresRef}
                    id="estudiante-nombres"
                    value={nombres}
                    disabled={saving}
                    onChange={(event) => setNombres(event.target.value)}
                    onBlur={() => markTouched("nombres")}
                    placeholder="Por ejemplo, Ana María"
                    aria-invalid={Boolean(showError("nombres"))}
                    className={`
                      ${inputClass}
                      ${
                        showError("nombres")
                          ? "border-error"
                          : "border-[#DFE7F2]"
                      }
                    `}
                  />
                </FormField>

                <FormField
                  label="Apellidos"
                  htmlFor="estudiante-apellidos"
                  required
                  error={showError("apellidos")}
                >
                  <input
                    id="estudiante-apellidos"
                    value={apellidos}
                    disabled={saving}
                    onChange={(event) => setApellidos(event.target.value)}
                    onBlur={() => markTouched("apellidos")}
                    placeholder="Por ejemplo, Ramírez Solís"
                    aria-invalid={Boolean(showError("apellidos"))}
                    className={`
                      ${inputClass}
                      ${
                        showError("apellidos")
                          ? "border-error"
                          : "border-[#DFE7F2]"
                      }
                    `}
                  />
                </FormField>
              </div>
            </div>
          </form>
        </section>

        <div className="flex items-start gap-2.5 rounded-xl border border-[#DFEAFE] bg-[#F3F8FF] px-3 py-2.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#398BFF]" />

          <p className="text-[11px] leading-[17px] text-[#6881A4]">
            El código universitario debe ser único. Los estudiantes no se
            eliminan: solo se marcan como inactivos cuando dejan de usar el
            servicio.
          </p>
        </div>
      </div>
    </Dialog>
  );
}
