import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  AlertCircle,
  CheckCircle2,
  GraduationCap,
  Loader2,
  RefreshCw,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { SectionTitle } from "./SectionTitle";
import { loanInputClass } from "./formStyles";
import { initials } from "../../utils/initials";
import { normalizeText } from "../../utils/normalize";
import type { StudentSummary } from "../../types/students";
import type { LoanStudentSource } from "../../types/loansForm";

interface LoanStudentFieldProps {
  open: boolean;
  source: LoanStudentSource;
  value: StudentSummary | null;
  onChange: (student: StudentSummary | null) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}

/** Sección "Responsable del préstamo": buscador y estudiante elegido. */
export function LoanStudentField({
  open,
  source,
  value,
  onChange,
  inputRef,
}: LoanStudentFieldProps) {
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    setQuery("");
    setSearchOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  // Solo estudiantes activos: los inactivos no pueden recibir préstamos.
  const activeStudents = useMemo(
    () => source.students.filter((student) => student.activo),
    [source.students],
  );

  const results = useMemo(() => {
    const term = normalizeText(query);

    return activeStudents
      .filter((student) => {
        if (!term) return true;

        return (
          normalizeText(student.nombreCompleto).includes(term) ||
          normalizeText(student.codigoUniversitario).includes(term)
        );
      })
      .slice(0, 8);
  }, [activeStudents, query]);

  const selectStudent = (student: StudentSummary) => {
    onChange(student);
    setQuery("");
    setSearchOpen(false);
  };

  const clearStudent = () => {
    onChange(null);
    setQuery("");
    setSearchOpen(false);

    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  return (
    <section>
      <SectionTitle
        icon={<GraduationCap className="h-[17px] w-[17px]" />}
        title="Responsable del préstamo"
        description="Busca al estudiante que recibirá los artículos."
      />

      <div ref={searchRef} className="relative mt-3">
        <label
          htmlFor="loan-student-search"
          className="mb-1.5 block text-[11.5px] font-semibold text-[#455875]"
        >
          Estudiante responsable
          <span className="ml-1 text-[#E05B67]">*</span>
        </label>

        {value ? (
          <div className="flex min-h-[54px] items-center gap-3 rounded-xl border border-[#CFE2FF] bg-[#F2F7FF] px-3 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#DFECFF] text-[12px] font-bold text-[#347AD7]">
              {initials(value.nombres, value.apellidos)}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-[#233A5D]">
                {value.nombreCompleto}
              </p>

              <p className="mt-0.5 font-mono text-[10.5px] text-[#6882A6]">
                {value.codigoUniversitario}
              </p>
            </div>

            <CheckCircle2 className="h-[17px] w-[17px] shrink-0 text-[#20AE73]" />

            <button
              type="button"
              onClick={clearStudent}
              aria-label="Cambiar estudiante"
              title="Cambiar estudiante"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#7890B0] hover:bg-white hover:text-[#D65367]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#8C9BB2]" />

              <input
                ref={inputRef}
                id="loan-student-search"
                type="search"
                role="combobox"
                aria-expanded={searchOpen}
                aria-controls="loan-student-results"
                aria-autocomplete="list"
                autoComplete="off"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setSearchOpen(false);
                  }

                  if (
                    event.key === "Enter" &&
                    searchOpen &&
                    results.length > 0
                  ) {
                    event.preventDefault();
                    selectStudent(results[0]);
                  }
                }}
                placeholder="Buscar por nombre, apellido o código..."
                className={`${loanInputClass} pl-10`}
              />
            </div>

            {searchOpen && (
              <div
                id="loan-student-results"
                role="listbox"
                aria-label="Resultados de estudiantes"
                className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[220px] overflow-y-auto rounded-xl border border-[#DCE7F5] bg-white p-1.5 shadow-[0_12px_30px_rgba(29,62,110,0.14)]"
              >
                {source.status === "loading" ? (
                  <div className="flex items-center justify-center gap-2 px-3 py-5 text-[12px] text-[#7486A1]">
                    <Loader2 className="h-4 w-4 animate-spin text-[#398BFF]" />
                    Buscando estudiantes…
                  </div>
                ) : source.status === "error" ? (
                  <div className="px-3 py-4 text-center">
                    <AlertCircle className="mx-auto h-6 w-6 text-[#D65367]" />

                    <p className="mt-2 text-[12px] text-[#B23540]">
                      {source.error ??
                        "No se pudo cargar la lista de estudiantes."}
                    </p>

                    <button
                      type="button"
                      onClick={source.onRetry}
                      className="mx-auto mt-2 flex items-center gap-1.5 rounded-lg border border-[#DCE7F5] px-2.5 py-1 text-[11.5px] font-semibold text-[#3478D5] hover:bg-[#F0F6FF]"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Reintentar
                    </button>
                  </div>
                ) : activeStudents.length === 0 ? (
                  <div className="px-3 py-5 text-center">
                    <UserRound className="mx-auto h-6 w-6 text-[#A8B8CC]" />

                    <p className="mt-2 text-[12px] text-[#7486A1]">
                      No hay estudiantes activos registrados.
                    </p>
                  </div>
                ) : results.length > 0 ? (
                  results.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => selectStudent(student)}
                      className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-[#F0F6FF] focus:bg-[#F0F6FF] focus:outline-none"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EDF4FF] text-[11px] font-bold text-[#4381D7]">
                        {initials(student.nombres, student.apellidos)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold text-[#283F61]">
                          {student.nombreCompleto}
                        </p>

                        <p className="mt-0.5 font-mono text-[10.5px] text-[#8797AE]">
                          {student.codigoUniversitario}
                        </p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-5 text-center">
                    <UserRound className="mx-auto h-6 w-6 text-[#A8B8CC]" />

                    <p className="mt-2 text-[12px] text-[#7486A1]">
                      No se encontraron estudiantes.
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
