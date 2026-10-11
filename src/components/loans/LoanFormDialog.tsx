
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  Info,
  Minus,
  Package,
  PackagePlus,
  Plus,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";

import { studentsWithSummary } from "../../data/demoStudents";

import {
  inventoryArticles,
  type InventoryArticle,
} from "../../data/inventoryData";

interface LoanFormDialogProps {
  open: boolean;
  onClose: () => void;
}

interface SelectedArticle {
  id: InventoryArticle["id"];
  cantidad: number;
}

const NOTA_MAX = 200;

const inputClass = `
  h-10 w-full rounded-[10px]
  border border-[#DFE7F2]
  bg-white px-3
  text-[12px] text-[#2A4061]
  placeholder:text-[#9AA8BC]
  outline-none
  transition-[border-color,box-shadow] duration-200
  hover:border-[#BAD0EC]
  focus:border-[#398BFF]
  focus:ring-2 focus:ring-[#398BFF]/10
`;

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function initials(
  nombres: string,
  apellidos: string
): string {
  return `${nombres.trim().charAt(0)}${apellidos
    .trim()
    .charAt(0)}`.toUpperCase();
}

function SectionTitle({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#EAF3FF] text-[#287FF0]">
        {icon}
      </div>

      <div className="min-w-0">
        <h3 className="text-[12.5px] font-semibold text-[#253D61]">
          {title}
        </h3>

        {description && (
          <p className="mt-0.5 text-[10.5px] leading-4 text-[#8293AA]">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

// ========================================
// CONTROL DE CANTIDAD EDITABLE
// ========================================

function QuantityEditor({
  value,
  max,
  articleName,
  onChange,
}: {
  value: number;
  max: number;
  articleName: string;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const parsed = Number(draft);

    const next =
      draft.trim() === "" || !Number.isFinite(parsed)
        ? 1
        : Math.min(
            Math.max(1, Math.trunc(parsed)),
            Math.max(1, max)
          );

    setDraft(String(next));
    onChange(next);
  };

  return (
    <div
      className="
        flex shrink-0 items-center gap-1
        rounded-[10px]
        border border-[#DFE7F2]
        bg-white p-1
        transition-colors duration-200
        focus-within:border-[#398BFF]
        focus-within:ring-2
        focus-within:ring-[#398BFF]/10
      "
    >
      <button
        type="button"
        aria-label={`Restar una unidad de ${articleName}`}
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
        className="
          flex h-7 w-7 items-center justify-center
          rounded-md text-[#617794]
          hover:bg-[#EDF5FF] hover:text-[#287FF0]
          disabled:cursor-not-allowed disabled:opacity-30
        "
      >
        <Minus className="h-3.5 w-3.5" />
      </button>

      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft}
        onChange={(event) => {
          const next = event.target.value;

          if (/^\d*$/.test(next)) {
            setDraft(next);
          }
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        onFocus={(event) => {
          event.currentTarget.select();
        }}
        aria-label={`Cantidad de ${articleName}`}
        title={`Introduce una cantidad entre 1 y ${max}`}
        className="
          h-7 w-12 rounded-md
          bg-transparent px-1
          text-center text-[12px] font-semibold
          tabular-nums text-[#283F61]
          outline-none
        "
      />

      <button
        type="button"
        aria-label={`Sumar una unidad de ${articleName}`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className="
          flex h-7 w-7 items-center justify-center
          rounded-md text-[#617794]
          hover:bg-[#EDF5FF] hover:text-[#287FF0]
          disabled:cursor-not-allowed disabled:opacity-30
        "
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ========================================
// MODAL NUEVO PRÉSTAMO
// ========================================

export function LoanFormDialog({
  open,
  onClose,
}: LoanFormDialogProps) {
  const [studentQuery, setStudentQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] =
    useState<string | null>(null);
  const [studentSearchOpen, setStudentSearchOpen] =
    useState(false);

  const [articleQuery, setArticleQuery] = useState("");
  const [articleSearchOpen, setArticleSearchOpen] =
    useState(false);
  const [selectedArticles, setSelectedArticles] = useState<
    SelectedArticle[]
  >([]);

  const [deadline, setDeadline] = useState("");
  const [note, setNote] = useState("");

  const studentSearchRef = useRef<HTMLDivElement>(null);
  const articleSearchRef = useRef<HTMLDivElement>(null);
  const studentInputRef = useRef<HTMLInputElement>(null);

  // ========================================
  // REINICIAR AL ABRIR
  // ========================================

  useEffect(() => {
    if (!open) return;

    setStudentQuery("");
    setSelectedStudentId(null);
    setStudentSearchOpen(false);

    setArticleQuery("");
    setArticleSearchOpen(false);
    setSelectedArticles([]);

    setDeadline("");
    setNote("");
  }, [open]);

  // ========================================
  // CERRAR BUSCADORES AL HACER CLIC FUERA
  // ========================================

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      if (
        studentSearchRef.current &&
        !studentSearchRef.current.contains(target)
      ) {
        setStudentSearchOpen(false);
      }

      if (
        articleSearchRef.current &&
        !articleSearchRef.current.contains(target)
      ) {
        setArticleSearchOpen(false);
      }
    };

    document.addEventListener(
      "pointerdown",
      handlePointerDown
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDown
      );
    };
  }, [open]);

  // ========================================
  // ESTUDIANTE SELECCIONADO
  // ========================================

  const selectedStudent = useMemo(() => {
    return (
      studentsWithSummary.find(
        (student) =>
          String(student.id) === selectedStudentId
      ) ?? null
    );
  }, [selectedStudentId]);

  // ========================================
  // BUSCADOR DE ESTUDIANTES
  // ========================================

  const studentResults = useMemo(() => {
    const term = normalizeText(studentQuery);

    return studentsWithSummary
      .filter((student) => {
        if (!student.activo) return false;

        if (!term) return true;

        return (
          normalizeText(student.nombreCompleto).includes(
            term
          ) ||
          normalizeText(
            student.codigoUniversitario
          ).includes(term)
        );
      })
      .slice(0, 8);
  }, [studentQuery]);

  // ========================================
  // BUSCADOR DE ARTÍCULOS
  // ========================================

  const articleResults = useMemo(() => {
    const term = normalizeText(articleQuery);

    return inventoryArticles
      .filter((article) => {
        if (!article.prestable) return false;

        const alreadySelected = selectedArticles.some(
          (selected) => selected.id === article.id
        );

        if (alreadySelected) return false;

        if (!term) return true;

        return (
          normalizeText(article.nombre).includes(term) ||
          normalizeText(article.codigo ?? "").includes(
            term
          )
        );
      })
      .slice(0, 8);
  }, [articleQuery, selectedArticles]);

  // ========================================
  // ACCIONES DE ESTUDIANTES
  // ========================================

  const selectStudent = (id: string) => {
    setSelectedStudentId(id);
    setStudentQuery("");
    setStudentSearchOpen(false);
  };

  const clearStudent = () => {
    setSelectedStudentId(null);
    setStudentQuery("");
    setStudentSearchOpen(false);

    window.requestAnimationFrame(() => {
      studentInputRef.current?.focus();
    });
  };

  // ========================================
  // ACCIONES DE ARTÍCULOS
  // ========================================

  const addArticle = (id: InventoryArticle["id"]) => {
    const article = inventoryArticles.find(
      (item) => item.id === id
    );

    if (
      !article ||
      !article.prestable ||
      article.disponible <= 0
    ) {
      return;
    }

    setSelectedArticles((previous) => {
      if (previous.some((item) => item.id === id)) {
        return previous;
      }

      return [
        ...previous,
        {
          id,
          cantidad: 1,
        },
      ];
    });

    setArticleQuery("");
    setArticleSearchOpen(false);
  };

  const removeArticle = (id: InventoryArticle["id"]) => {
    setSelectedArticles((previous) =>
      previous.filter((item) => item.id !== id)
    );
  };

  const updateQuantity = (
    id: InventoryArticle["id"],
    quantity: number
  ) => {
    const article = inventoryArticles.find(
      (item) => item.id === id
    );

    if (!article) return;

    const max = Math.max(1, article.disponible);

    const next = Math.min(
      max,
      Math.max(1, Math.trunc(quantity))
    );

    setSelectedArticles((previous) =>
      previous.map((item) =>
        item.id === id
          ? { ...item, cantidad: next }
          : item
      )
    );
  };

  // ========================================
  // RESUMEN
  // ========================================

  const totalUnits = selectedArticles.reduce(
    (sum, item) => sum + item.cantidad,
    0
  );

  // ========================================
  // RENDER
  // ========================================

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nuevo préstamo"
      subtitle="Prepara una entrega de artículos a un estudiante."
      size="xl"
      initialFocusRef={studentInputRef}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>

          <span title="Vista de demostración: todavía no se guardan préstamos">
            <Button disabled>
              Registrar préstamo
            </Button>
          </span>
        </>
      }
    >
      <div className="space-y-4">
        {/* =====================================
            ESTUDIANTE RESPONSABLE
        ===================================== */}

        <section>
          <SectionTitle
            icon={
              <GraduationCap className="h-[17px] w-[17px]" />
            }
            title="Responsable del préstamo"
            description="Busca al estudiante que recibirá los artículos."
          />

          <div
            ref={studentSearchRef}
            className="relative mt-3"
          >
            <label
              htmlFor="loan-student-search"
              className="mb-1.5 block text-[11.5px] font-semibold text-[#455875]"
            >
              Estudiante responsable
              <span className="ml-1 text-[#E05B67]">
                *
              </span>
            </label>

            {selectedStudent ? (
              <div className="flex min-h-[54px] items-center gap-3 rounded-xl border border-[#CFE2FF] bg-[#F2F7FF] px-3 py-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#DFECFF] text-[12px] font-bold text-[#347AD7]">
                  {initials(
                    selectedStudent.nombres,
                    selectedStudent.apellidos
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-[#233A5D]">
                    {selectedStudent.nombreCompleto}
                  </p>

                  <p className="mt-0.5 font-mono text-[10.5px] text-[#6882A6]">
                    {selectedStudent.codigoUniversitario}
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
                    ref={studentInputRef}
                    id="loan-student-search"
                    type="search"
                    role="combobox"
                    aria-expanded={studentSearchOpen}
                    aria-controls="loan-student-results"
                    aria-autocomplete="list"
                    autoComplete="off"
                    value={studentQuery}
                    onChange={(event) => {
                      setStudentQuery(event.target.value);
                      setStudentSearchOpen(true);
                    }}
                    onFocus={() =>
                      setStudentSearchOpen(true)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setStudentSearchOpen(false);
                      }

                      if (
                        event.key === "Enter" &&
                        studentSearchOpen &&
                        studentResults.length > 0
                      ) {
                        event.preventDefault();

                        selectStudent(
                          String(studentResults[0].id)
                        );
                      }
                    }}
                    placeholder="Buscar por nombre, apellido o código..."
                    className={`${inputClass} pl-10`}
                  />
                </div>

                {studentSearchOpen && (
                  <div
                    id="loan-student-results"
                    role="listbox"
                    aria-label="Resultados de estudiantes"
                    className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[220px] overflow-y-auto rounded-xl border border-[#DCE7F5] bg-white p-1.5 shadow-[0_12px_30px_rgba(29,62,110,0.14)]"
                  >
                    {studentResults.length > 0 ? (
                      studentResults.map((student) => (
                        <button
                          key={student.id}
                          type="button"
                          role="option"
                          aria-selected={false}
                          onClick={() =>
                            selectStudent(String(student.id))
                          }
                          className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-[#F0F6FF] focus:bg-[#F0F6FF] focus:outline-none"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EDF4FF] text-[11px] font-bold text-[#4381D7]">
                            {initials(
                              student.nombres,
                              student.apellidos
                            )}
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

        <div className="h-px bg-[#E9EEF6]" />

        {/* =====================================
            ARTÍCULOS DEL PRÉSTAMO
        ===================================== */}

        <section>
          <SectionTitle
            icon={
              <PackagePlus className="h-[17px] w-[17px]" />
            }
            title="Artículos del préstamo"
            description="Busca y agrega los artículos necesarios."
          />

          <div
            ref={articleSearchRef}
            className="relative mt-3"
          >
            <label
              htmlFor="loan-article-search"
              className="mb-1.5 block text-[11.5px] font-semibold text-[#455875]"
            >
              Agregar artículo
            </label>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#8C9BB2]" />

              <input
                id="loan-article-search"
                type="search"
                role="combobox"
                aria-expanded={articleSearchOpen}
                aria-controls="loan-article-results"
                aria-autocomplete="list"
                autoComplete="off"
                value={articleQuery}
                onChange={(event) => {
                  setArticleQuery(event.target.value);
                  setArticleSearchOpen(true);
                }}
                onFocus={() =>
                  setArticleSearchOpen(true)
                }
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setArticleSearchOpen(false);
                  }

                  if (
                    event.key === "Enter" &&
                    articleSearchOpen
                  ) {
                    const firstAvailable =
                      articleResults.find(
                        (item) => item.disponible > 0
                      );

                    if (firstAvailable) {
                      event.preventDefault();

                      // Usamos ID en lugar de código.
                      addArticle(firstAvailable.id);
                    }
                  }
                }}
                placeholder="Buscar artículo por nombre o código..."
                className={`${inputClass} pl-10`}
              />
            </div>

            {articleSearchOpen && (
              <div
                id="loan-article-results"
                role="listbox"
                aria-label="Resultados de artículos"
                className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[245px] overflow-y-auto rounded-xl border border-[#DCE7F5] bg-white p-1.5 shadow-[0_12px_30px_rgba(29,62,110,0.14)]"
              >
                {articleResults.length > 0 ? (
                  articleResults.map((article) => {
                    const available =
                      article.disponible > 0;

                    return (
                      <button
                        key={article.id}
                        type="button"
                        role="option"
                        aria-selected={false}
                        disabled={!available}
                        onClick={() =>
                          addArticle(article.id)
                        }
                        className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-[#F0F6FF] focus:bg-[#F0F6FF] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E2EBF7] bg-[#F1F6FE] text-[#4D86D2]">
                          <Package className="h-[19px] w-[19px]" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-semibold text-[#283F61]">
                            {article.nombre}
                          </p>

                          <p className="mt-0.5 text-[10.5px] text-[#8797AE]">
                            {article.codigo ?? "Sin código"}
                            {" · "}
                            {article.categoria}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded-lg px-2.5 py-1 text-[10.5px] font-semibold ${
                            available
                              ? "bg-[#EDF8F1] text-[#1B8E57]"
                              : "bg-[#F3F5F8] text-[#9AA7B8]"
                          }`}
                        >
                          {article.disponible} disponibles
                        </span>

                        {available && (
                          <Plus className="h-4 w-4 shrink-0 text-[#398BFF]" />
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="px-3 py-5 text-center">
                    <Package className="mx-auto h-6 w-6 text-[#A8B8CC]" />

                    <p className="mt-2 text-[12px] text-[#7486A1]">
                      No hay artículos para mostrar.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* =====================================
              ARTÍCULOS SELECCIONADOS
          ===================================== */}

          <div className="mt-3 overflow-hidden rounded-xl border border-[#E4ECF7] bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-[#E9EEF6] bg-[#F8FAFE] px-3.5 py-2.5">
              <span className="text-[11.5px] font-semibold text-[#405676]">
                Artículos seleccionados
              </span>

              <span className="rounded-lg bg-[#EAF2FF] px-2.5 py-1 text-[10.5px] font-semibold tabular-nums text-[#3478D5]">
                {selectedArticles.length} tipos
              </span>
            </div>

            {selectedArticles.length === 0 ? (
              <div className="flex min-h-[105px] flex-col items-center justify-center gap-2 px-4 py-4 text-center">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F0F5FD] text-[#87A4CC]">
                  <PackagePlus className="h-5 w-5" />
                </div>

                <p className="text-[11.5px] text-[#8999B0]">
                  Busca un artículo para añadirlo al préstamo.
                </p>
              </div>
            ) : (
              <div className="max-h-[240px] divide-y divide-[#E9EEF6] overflow-y-auto">
                {selectedArticles.map((selected) => {
                  const article = inventoryArticles.find(
                    (item) => item.id === selected.id
                  );

                  if (!article) return null;

                  return (
                    <div
                      key={selected.id}
                      className="flex flex-wrap items-center gap-3 px-3.5 py-3 transition-colors hover:bg-[#FAFCFF]"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E2EBF7] bg-[#F1F6FE] text-[#4D86D2]">
                        <Package className="h-[19px] w-[19px]" />
                      </div>

                      <div className="min-w-[135px] flex-1">
                        <p className="truncate text-[12px] font-semibold text-[#253B5D]">
                          {article.nombre}
                        </p>

                        <p className="mt-0.5 text-[10.5px] text-[#8A9BB0]">
                          {article.codigo ?? "Sin código"}
                          {" · "}
                          {article.disponible} disponibles
                        </p>
                      </div>

                      <QuantityEditor
                        value={selected.cantidad}
                        max={article.disponible}
                        articleName={article.nombre}
                        onChange={(value) =>
                          updateQuantity(
                            selected.id,
                            value
                          )
                        }
                      />

                      <button
                        type="button"
                        aria-label={`Eliminar ${article.nombre} del préstamo`}
                        title="Eliminar artículo"
                        onClick={() =>
                          removeArticle(selected.id)
                        }
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#A0AEC0] hover:bg-[#FFF0F2] hover:text-[#D65367]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedArticles.length > 0 && (
              <div className="flex items-center justify-between border-t border-[#E9EEF6] bg-[#F8FAFE] px-3.5 py-3">
                <span className="text-[11.5px] font-semibold text-[#5B708E]">
                  Total de unidades
                </span>

                <span className="text-[15px] font-bold tabular-nums text-[#267BF0]">
                  {totalUnits}
                </span>
              </div>
            )}
          </div>
        </section>

        <div className="h-px bg-[#E9EEF6]" />

        {/* =====================================
            PLAZO Y OBSERVACIONES
        ===================================== */}

        <section>
          <SectionTitle
            icon={
              <CalendarDays className="h-[17px] w-[17px]" />
            }
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
              </label>

              <input
                id="loan-deadline"
                type="date"
                value={deadline}
                onChange={(event) =>
                  setDeadline(event.target.value)
                }
                className={inputClass}
              />
            </div>

            <div className="flex items-start gap-2.5 rounded-xl border border-[#E1EBFA] bg-[#F3F8FF] px-3 py-2.5">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#347CE6]" />

              <p className="text-[10.5px] leading-[17px] text-[#6881A4]">
                Vista de demostración. Las cantidades
                disponibles provienen del inventario demo.
                No se reservan ni descuentan existencias.
              </p>
            </div>
          </div>

          <div className="mt-3">
            <label
              htmlFor="loan-note"
              className="mb-1.5 block text-[11.5px] font-semibold text-[#455875]"
            >
              Observaciones
              <span className="ml-1 font-normal text-[#9AA8BC]">
                (opcional)
              </span>
            </label>

            <div className="relative">
              <textarea
                id="loan-note"
                rows={2}
                maxLength={NOTA_MAX}
                value={note}
                onChange={(event) =>
                  setNote(event.target.value)
                }
                placeholder="Indicaciones para la devolución..."
                className={`${inputClass} h-auto resize-none py-2.5 pb-6`}
              />

              <span className="pointer-events-none absolute bottom-2 right-3 text-[10px] tabular-nums text-[#9AA8BC]">
                {note.length}/{NOTA_MAX}
              </span>
            </div>
          </div>
        </section>
      </div>
    </Dialog>
  );
}
