import { useEffect, useRef, useState } from "react";
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

const inputClass =
  "h-9 w-full rounded-md border bg-surface px-3 text-sm text-text placeholder:text-text-secondary/60 transition-colors duration-[120ms] hover:border-border-strong focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/20";

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
  const [touched, setTouched] = useState<Record<FieldKey, boolean>>({
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
        isEdit ? student?.id : undefined,
      );
      if (duplicado) {
        result.codigo = `Ya existe un estudiante con ese código: ${duplicado.nombres} ${duplicado.apellidos}.`;
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

  const markTouched = (key: FieldKey) =>
    setTouched((previous) => ({ ...previous, [key]: true }));

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
          : "Registra un nuevo estudiante en el directorio."
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
      <div className="flex flex-col gap-3">
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
          <input
            ref={codigoRef}
            id="estudiante-codigo"
            value={codigo}
            readOnly={isEdit}
            onChange={(event) => setCodigo(event.target.value)}
            onBlur={() => markTouched("codigo")}
            placeholder="Por ejemplo, 20231234567"
            aria-readonly={isEdit || undefined}
            className={`${inputClass} font-mono ${
              errors.codigo ? "border-error" : "border-border"
            } ${isEdit ? "cursor-not-allowed bg-[#F1F4F8] text-text-secondary" : ""}`}
          />
        </FormField>

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
            placeholder="Por ejemplo, Ana"
            className={`${inputClass} ${
              errors.nombres ? "border-error" : "border-border"
            }`}
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
            className={`${inputClass} ${
              errors.apellidos ? "border-error" : "border-border"
            }`}
          />
        </FormField>

        <FormField
          label="Nota"
          htmlFor="estudiante-nota"
          error={showError("nota")}
          hint="Opcional."
        >
          <div className="relative">
            <textarea
              id="estudiante-nota"
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

        <p className="text-[11.5px] leading-4 text-text-secondary">
          Datos de demostración. El guardado se habilitará cuando la pantalla se
          conecte a la base de datos.
        </p>
      </div>
    </Dialog>
  );
}
