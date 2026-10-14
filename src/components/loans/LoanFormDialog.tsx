import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CalendarDays, Info, ListChecks } from "lucide-react";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { SectionTitle } from "./SectionTitle";
import { LoanStudentField } from "./LoanStudentField";
import { LoanArticleField, type SelectedArticle } from "./LoanArticleField";
import { loanInputClass } from "./formStyles";
import type { StudentSummary } from "../../types/students";
import type {
  LoanInventorySource,
  LoanStudentSource,
} from "../../types/loansForm";
import type {
  LineaPrestamoInput,
  RegistrarPrestamoArgs,
} from "../../services/loans";

interface LoanFormDialogProps {
  open: boolean;
  students: LoanStudentSource;
  inventory: LoanInventorySource;
  saving: boolean;
  serverError: string | null;
  onClose: () => void;
  onSubmit: (datos: RegistrarPrestamoArgs) => void;
}

const NOTA_MAX = 200;

/** Fecha local de hoy en `YYYY-MM-DD`, comparable con un `<input type="date">`. */
function hoy(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function LoanFormDialog({
  open,
  students,
  inventory,
  saving,
  serverError,
  onClose,
  onSubmit,
}: LoanFormDialogProps) {
  const [selectedStudent, setSelectedStudent] = useState<StudentSummary | null>(
    null,
  );
  const [selectedArticles, setSelectedArticles] = useState<SelectedArticle[]>(
    [],
  );
  const [deadline, setDeadline] = useState("");
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);

  const studentInputRef = useRef<HTMLInputElement>(null);
  const today = hoy();

  useEffect(() => {
    if (!open) return;

    setSelectedStudent(null);
    setSelectedArticles([]);
    setDeadline("");
    setNote("");
    setConfirming(false);
  }, [open]);

  const articleById = useMemo(
    () => new Map(inventory.articles.map((article) => [article.id, article])),
    [inventory.articles],
  );

  const unitById = useMemo(
    () => new Map(inventory.units.map((unit) => [unit.id, unit])),
    [inventory.units],
  );

  // ========================================
  // VALIDACIÓN
  // ========================================

  const sinEstudiante = selectedStudent === null;
  const sinArticulos = selectedArticles.length === 0;

  const lineaInvalida = selectedArticles.some((selected) => {
    const article = articleById.get(selected.articuloId);
    if (!article) return true;

    if (article.control_individual) {
      return selected.unidadIds.length === 0;
    }

    return (
      selected.cantidad < 1 || selected.cantidad > article.cantidad_disponible
    );
  });

  const fechaInvalida = deadline !== "" && deadline < today;

  const puedeRegistrar =
    !saving && !sinEstudiante && !sinArticulos && !lineaInvalida && !fechaInvalida;

  const motivo = sinEstudiante
    ? "Selecciona el estudiante responsable del préstamo."
    : sinArticulos
      ? "Agrega al menos un artículo al préstamo."
      : lineaInvalida
        ? "Completa las unidades o cantidades de cada artículo."
        : fechaInvalida
          ? "La fecha límite no puede ser anterior a hoy."
          : null;

  const lineas: LineaPrestamoInput[] = selectedArticles.map((selected) => {
    const article = articleById.get(selected.articuloId);

    if (article?.control_individual) {
      return {
        articulo_id: selected.articuloId,
        unidad_ids: selected.unidadIds,
      };
    }

    return { articulo_id: selected.articuloId, cantidad: selected.cantidad };
  });

  const totalUnits = selectedArticles.reduce(
    (total, selected) =>
      selected.unidadIds.length > 0
        ? total + selected.unidadIds.length
        : total + selected.cantidad,
    0,
  );

  const confirmar = () => {
    if (!puedeRegistrar || selectedStudent === null) return;

    onSubmit({
      estudiante_id: Number(selectedStudent.id),
      lineas,
      fecha_limite: deadline === "" ? null : deadline,
      comentario: note.trim() === "" ? null : note.trim(),
    });
  };

  // ========================================
  // PASO DE CONFIRMACIÓN
  // ========================================

  if (confirming && selectedStudent !== null) {
    return (
      <Dialog
        open={open}
        onClose={() => {
          if (!saving) setConfirming(false);
        }}
        title="Confirmar préstamo"
        subtitle="Revisa los datos antes de guardar la entrega."
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              disabled={saving}
              onClick={() => setConfirming(false)}
            >
              Volver
            </Button>

            <Button disabled={saving} onClick={confirmar}>
              {saving ? "Registrando…" : "Confirmar y registrar"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-[#E4ECF7] bg-[#F8FAFE] px-3.5 py-3">
            <p className="text-[11.5px] font-semibold text-[#405676]">
              Estudiante responsable
            </p>

            <p className="mt-1 text-[12.5px] font-semibold text-[#253B5D]">
              {selectedStudent.nombreCompleto}
            </p>

            <p className="mt-0.5 font-mono text-[11px] text-[#8797AE]">
              {selectedStudent.codigoUniversitario}
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#E4ECF7]">
            <div className="border-b border-[#E9EEF6] bg-[#F8FAFE] px-3.5 py-2.5 text-[11.5px] font-semibold text-[#405676]">
              Artículos ({selectedArticles.length} tipos)
            </div>

            <ul className="divide-y divide-[#E9EEF6]">
              {selectedArticles.map((selected) => {
                const article = articleById.get(selected.articuloId);
                if (!article) return null;

                const codigos = selected.unidadIds
                  .map((id) => unitById.get(id)?.codigo)
                  .filter((codigo): codigo is string => Boolean(codigo));

                return (
                  <li
                    key={selected.articuloId}
                    className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-semibold text-[#253B5D]">
                        {article.nombre}
                      </p>

                      {article.control_individual && codigos.length > 0 && (
                        <p className="mt-0.5 font-mono text-[10.5px] text-[#6A4FC4]">
                          {codigos.join(", ")}
                        </p>
                      )}
                    </div>

                    <span className="shrink-0 rounded-lg bg-[#EAF2FF] px-2.5 py-1 text-[10.5px] font-semibold tabular-nums text-[#3478D5]">
                      {article.control_individual
                        ? `${selected.unidadIds.length} ${
                            selected.unidadIds.length === 1
                              ? "unidad"
                              : "unidades"
                          }`
                        : `${selected.cantidad} ${
                            selected.cantidad === 1 ? "unidad" : "unidades"
                          }`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#E4ECF7] bg-white px-3.5 py-3">
              <p className="text-[11.5px] font-semibold text-[#405676]">
                Fecha límite
              </p>

              <p className="mt-1 text-[12.5px] text-[#253B5D]">
                {deadline === "" ? "Sin fecha límite" : deadline}
              </p>
            </div>

            <div className="rounded-xl border border-[#E4ECF7] bg-white px-3.5 py-3">
              <p className="text-[11.5px] font-semibold text-[#405676]">
                Total de unidades
              </p>

              <p className="mt-1 text-[12.5px] font-bold tabular-nums text-[#267BF0]">
                {totalUnits}
              </p>
            </div>
          </div>

          {note.trim() !== "" && (
            <div className="rounded-xl border border-[#E4ECF7] bg-white px-3.5 py-3">
              <p className="text-[11.5px] font-semibold text-[#405676]">
                Observaciones
              </p>

              <p className="mt-1 whitespace-pre-line text-[12px] leading-5 text-[#435F92]">
                {note.trim()}
              </p>
            </div>
          )}

          {serverError !== null && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-[#F3C9CC] bg-[#FDECEE] px-3.5 py-2.5 text-[12px] font-medium text-[#B23540]"
            >
              <AlertCircle className="mt-px h-4 w-4 shrink-0" />
              <span>{serverError}</span>
            </p>
          )}
        </div>
      </Dialog>
    );
  }

  // ========================================
  // PASO DE FORMULARIO
  // ========================================

  return (
    <Dialog
      open={open}
      onClose={saving ? () => undefined : onClose}
      title="Nuevo préstamo"
      subtitle="Prepara una entrega de artículos a un estudiante."
      size="xl"
      initialFocusRef={studentInputRef}
      footer={
        <>
          <Button variant="secondary" disabled={saving} onClick={onClose}>
            Cancelar
          </Button>

          <span title={motivo ?? undefined}>
            <Button
              disabled={!puedeRegistrar}
              onClick={() => setConfirming(true)}
            >
              Registrar préstamo
            </Button>
          </span>
        </>
      }
    >
      <div className="space-y-4">
        <LoanStudentField
          open={open}
          source={students}
          value={selectedStudent}
          onChange={setSelectedStudent}
          inputRef={studentInputRef}
        />

        <div className="h-px bg-[#E9EEF6]" />

        <LoanArticleField
          open={open}
          source={inventory}
          value={selectedArticles}
          onChange={setSelectedArticles}
        />

        <div className="h-px bg-[#E9EEF6]" />

        <section>
          <SectionTitle
            icon={<CalendarDays className="h-[17px] w-[17px]" />}
            title="Plazo y observaciones"
            description="Define la fecha límite e indicaciones adicionales."
          />

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="loan-deadline"
                className="mb-1.5 block text-[11.5px] font-semibold text-[#455875]"
              >
                Fecha límite
                <span className="ml-1 font-normal text-[#9AA8BC]">
                  (opcional)
                </span>
              </label>

              <input
                id="loan-deadline"
                type="date"
                min={today}
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
                className={loanInputClass}
              />

              {fechaInvalida && (
                <p className="mt-1.5 flex items-center gap-1 text-[10.5px] text-[#B23540]">
                  <AlertCircle className="h-3.5 w-3.5" />
                  La fecha límite no puede ser anterior a hoy.
                </p>
              )}
            </div>

            <div className="flex items-start gap-2.5 rounded-xl border border-[#E1EBFA] bg-[#F3F8FF] px-3 py-2.5">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#347CE6]" />

              <p className="text-[10.5px] leading-[17px] text-[#6881A4]">
                Las existencias se descuentan automáticamente al registrar el
                préstamo. Las cantidades mostradas son las disponibles ahora.
              </p>
            </div>
          </div>

          <div className="mt-3">
            <label
              htmlFor="loan-note"
              className="mb-1.5 block text-[11.5px] font-semibold text-[#455875]"
            >
              Observaciones
              <span className="ml-1 font-normal text-[#9AA8BC]">(opcional)</span>
            </label>

            <div className="relative">
              <textarea
                id="loan-note"
                rows={2}
                maxLength={NOTA_MAX}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Indicaciones para la devolución..."
                className={`${loanInputClass} h-auto resize-none py-2.5 pb-6`}
              />

              <span className="pointer-events-none absolute bottom-2 right-3 text-[10px] tabular-nums text-[#9AA8BC]">
                {note.length}/{NOTA_MAX}
              </span>
            </div>
          </div>
        </section>

        {serverError !== null && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-[#F3C9CC] bg-[#FDECEE] px-3.5 py-2.5 text-[12px] font-medium text-[#B23540]"
          >
            <AlertCircle className="mt-px h-4 w-4 shrink-0" />
            <span>{serverError}</span>
          </p>
        )}

        {motivo !== null && (
          <p className="flex items-center gap-2 rounded-xl border border-[#F3E2BE] bg-[#FFF8E8] px-3 py-2 text-[11.5px] text-[#8A6412]">
            <ListChecks className="h-4 w-4 shrink-0 text-[#D89A1F]" />
            {motivo}
          </p>
        )}
      </div>
    </Dialog>
  );
}
