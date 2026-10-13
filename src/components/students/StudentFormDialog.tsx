
import { useEffect, useRef, useState } from "react";
import { GraduationCap, Info, UserRound, Hash } from "lucide-react";

import { Dialog } from "../ui/Dialog";
import { FormField } from "../ui/FormField";
import { Button } from "../ui/Button";

import {
  findStudentByCodigo,
  type Student,
} from "../../data/demoStudents";

const NOTA_MAX = 200;

export type StudentFormMode = "create" | "edit";

interface StudentFormDialogProps {
  open: boolean;
  mode: StudentFormMode;
  student?: Student;
  onClose: () => void;
}

type FieldKey = "codigo" | "nombres" | "apellidos" | "nota";

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
  onClose,
}: StudentFormDialogProps) {
  const isEdit = mode === "edit";

  const [codigo, setCodigo] = useState("");
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [nota, setNota] = useState("");

  const [touched, setTouched] = useState<
    Record<FieldKey, boolean>
  >({
    codigo: false,
    nombres: false,
    apellidos: false,
    nota: false,
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

    setNota("");
    setTouched({
      codigo: false,
      nombres: false,
      apellidos: false,
      nota: false,
    });
  }, [open, isEdit, student]);

  const computeErrors = (): Partial<Record<FieldKey, string>> => {
    const result: Partial<Record<FieldKey, string>> = {};

    const codigoLimpio = codigo.trim();

    if (codigoLimpio === "") {
      result.codigo = "El código universitario es obligatorio.";
    } else {
      const duplicado = findStudentByCodigo(
        codigoLimpio,
        isEdit ? student?.id : undefined
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

    if (nota.length > NOTA_MAX) {
      result.nota = "La nota no puede pasar de 200 caracteres.";
    }

    return result;
  };

  const errors = computeErrors();

  const markTouched = (key: FieldKey) => {
    setTouched((previous) => ({
      ...previous,
      [key]: true,
    }));
  };

  const showError = (key: FieldKey) =>
    touched[key] ? errors[key] : undefined;

  return (
    <Dialog
      open={open}
      onClose={onClose}
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
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>

          <span title="Disponible cuando se conecte la persistencia">
            <Button disabled>
              {isEdit ? "Guardar cambios" : "Registrar estudiante"}
            </Button>
          </span>
        </>
      }
    >
      <div className="space-y-4">
        <section>
          <SectionTitle
            icon={<GraduationCap className="h-[18px] w-[18px]" />}
            title="Información del estudiante"
            description="Datos utilizados para identificar al responsable"
          />

          <div className="mt-3 space-y-3.5">
            <FormField
              label="Código universitario"
              htmlFor="estudiante-codigo"
              required
              error={showError("codigo")}
              hint={
                isEdit
                  ? "El código identifica al estudiante y no cambia."
                  : "Puede contener letras, números y guiones."
              }
            >
              <div className="relative">
                <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8DA0BA]" />

                <input
                  ref={codigoRef}
                  id="estudiante-codigo"
                  value={codigo}
                  readOnly={isEdit}
                  onChange={(event) => setCodigo(event.target.value)}
                  onBlur={() => markTouched("codigo")}
                  placeholder="Por ejemplo, 20231234567"
                  aria-readonly={isEdit || undefined}
                  aria-invalid={Boolean(showError("codigo"))}
                  className={`
                    ${inputClass} pl-10 font-mono
                    ${
                      showError("codigo")
                        ? "border-error"
                        : "border-[#DFE7F2]"
                    }
                    ${
                      isEdit
                        ? "cursor-not-allowed bg-[#F3F6FA] text-[#7485A0]"
                        : ""
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
        </section>

        <div className="h-px bg-[#E9EEF6]" />

        <section>
          <SectionTitle
            icon={<UserRound className="h-[17px] w-[17px]" />}
            title="Información adicional"
            description="Observaciones opcionales del registro"
          />

          <div className="mt-3">
            <FormField
              label="Nota (opcional)"
              htmlFor="estudiante-nota"
              error={showError("nota")}
            >
              <div className="relative">
                <textarea
                  id="estudiante-nota"
                  value={nota}
                  rows={2}
                  maxLength={NOTA_MAX}
                  onChange={(event) => setNota(event.target.value)}
                  onBlur={() => markTouched("nota")}
                  placeholder="Información útil para el día a día..."
                  aria-invalid={Boolean(showError("nota"))}
                  className={`
                    w-full resize-none rounded-[10px]
                    border bg-white px-3.5 py-2.5 pb-6
                    text-[12.5px] leading-5 text-[#243B60]
                    placeholder:text-[#9AA8BC]
                    transition-[border-color,box-shadow] duration-200
                    hover:border-[#BAD0EC]
                    focus:border-[#398BFF] focus:outline-none
                    focus:ring-2 focus:ring-[#398BFF]/10
                    ${
                      showError("nota")
                        ? "border-error"
                        : "border-[#DFE7F2]"
                    }
                  `}
                />

                <span className="pointer-events-none absolute bottom-2 right-3 text-[10px] tabular-nums text-[#96A4B8]">
                  {nota.length}/{NOTA_MAX}
                </span>
              </div>
            </FormField>
          </div>
        </section>

        <div className="flex items-start gap-2.5 rounded-xl border border-[#DFEAFE] bg-[#F3F8FF] px-3 py-2.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#398BFF]" />

          <p className="text-[11px] leading-[17px] text-[#6881A4]">
            Datos de demostración. El guardado estará disponible
            cuando esta pantalla se conecte a la base de datos.
          </p>
        </div>
      </div>
    </Dialog>
  );
}
