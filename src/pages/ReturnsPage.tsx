import { useEffect, useMemo, useState } from "react";

import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Plus,
} from "lucide-react";

import background from "../assets/background/background.png";

import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";

import { ReturnsStats } from "../components/returns/ReturnsStats";
import {
  ReturnsToolbar,
  type ReturnFilter,
} from "../components/returns/ReturnsToolbar";
import { ReturnsTable } from "../components/returns/ReturnsTable";
import { ReturnDetailsDialog } from "../components/returns/ReturnDetailsDialog";
import { ReturnFormDialog } from "../components/returns/ReturnFormDialog";
import {
  ResourceError,
  ResourceLoading,
} from "../components/students/StudentsResourceState";

import { useLoansDirectory } from "../hooks/useLoans";
import {
  usePendingReturns,
  useReturnHistory,
  useReturnMutations,
  useReturnStats,
} from "../hooks/useReturns";

import {
  adaptCompletedLoan,
  adaptReturns,
  adaptReturnStats,
  agruparDevolucionesPorPrestamo,
} from "../services/returnsAdapters";

import type { ReturnRecord } from "../types/returns";
import type { RegistrarDevolucionInput } from "../types/returnsApi";
import { normalizeText } from "../utils/normalize";

const PAGE_SIZE = 8;

export function ReturnsPage() {
  // ----------------------------------------
  // BÚSQUEDA Y FILTROS
  // ----------------------------------------

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ReturnFilter>("todos");
  const [page, setPage] = useState(1);

  // ----------------------------------------
  // MODALES
  // ----------------------------------------

  const [formOpen, setFormOpen] = useState(false);
  const [formLoan, setFormLoan] = useState<ReturnRecord | null>(null);
  const [detailLoan, setDetailLoan] = useState<ReturnRecord | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // ----------------------------------------
  // DATOS REALES
  // ----------------------------------------

  // Devoluciones: préstamos activos con unidades pendientes.
  const pending = usePendingReturns();

  // Préstamos: para incorporar al listado los préstamos ya cerrados
  // (completados), que `listar_devoluciones_pendientes` no devuelve.
  const loans = useLoansDirectory();

  // Historial: cantidades devueltas reales de los préstamos cerrados.
  const history = useReturnHistory();

  // Estadísticas de Devoluciones para las tarjetas resumen.
  const stats = useReturnStats();

  // Registro real de devoluciones (escritura sobre SQLite).
  const mutations = useReturnMutations();

  // ----------------------------------------
  // LISTADO COMBINADO
  // ----------------------------------------

  // Las filas se construyen con datos reales: pendientes (Devoluciones) y
  // cerradas (Préstamos) enriquecidas con el historial. No se usa demostración.
  const records = useMemo(() => {
    const rows: ReturnRecord[] = [];

    if (pending.data) {
      rows.push(...adaptReturns(pending.data));
    }

    if (loans.data) {
      const devoluciones = agruparDevolucionesPorPrestamo(
        history.data ?? [],
      );

      for (const loan of loans.data) {
        if (loan.estado !== "cerrado") continue;
        rows.push(adaptCompletedLoan(loan, devoluciones.get(loan.id)));
      }
    }

    // Entregas más recientes primero; el id real desempata.
    rows.sort((a, b) => {
      if (a.fechaEntrega !== b.fechaEntrega) {
        return a.fechaEntrega < b.fechaEntrega ? 1 : -1;
      }
      return Number(b.id) - Number(a.id);
    });

    return rows;
  }, [pending.data, loans.data, history.data]);

  // ----------------------------------------
  // RESUMEN
  // ----------------------------------------

  const summary = useMemo(
    () => (stats.data ? adaptReturnStats(stats.data) : null),
    [stats.data],
  );

  // ----------------------------------------
  // FILTROS
  // ----------------------------------------

  const hasActiveFilters =
    query.trim() !== "" || filter !== "todos";

  const filtered = useMemo(() => {
    const term = normalizeText(query);

    return records.filter((loan) => {
      const matchesQuery =
        term === "" ||
        [
          loan.folio,
          loan.estudiante,
          loan.codigoUniversitario,
        ].some((value) =>
          normalizeText(value ?? "").includes(term)
        );

      const matchesFilter =
        filter === "todos" ||
        loan.estadoDevolucion === filter;

      return matchesQuery && matchesFilter;
    });
  }, [records, query, filter]);

  // ----------------------------------------
  // REINICIAR PAGINACIÓN AL FILTRAR
  // ----------------------------------------

  useEffect(() => {
    setPage(1);
  }, [query, filter]);

  // ----------------------------------------
  // PAGINACIÓN
  // ----------------------------------------

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / PAGE_SIZE)
  );

  const safePage = Math.min(page, totalPages);

  const pageItems = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const from =
    filtered.length === 0
      ? 0
      : (safePage - 1) * PAGE_SIZE + 1;

  const to = Math.min(
    safePage * PAGE_SIZE,
    filtered.length
  );

  const resultLabel =
    filtered.length === 0
      ? "Sin resultados"
      : `Mostrando ${from}–${to} de ${
          filtered.length
        } ${
          filtered.length === 1
            ? "devolución"
            : "devoluciones"
        }`;

  // ----------------------------------------
  // ESTADO DE LA CONSULTA
  // ----------------------------------------

  // El listado depende de tres fuentes reales: pendientes, préstamos e
  // historial. Un error en cualquiera se muestra con reintento; mientras falte
  // alguna y no haya filas, se mantiene el indicador de carga.
  const listError =
    pending.status === "error"
      ? pending.error
      : loans.status === "error"
        ? loans.error
        : history.status === "error"
          ? history.error
          : null;

  const listLoading =
    listError === null &&
    records.length === 0 &&
    (pending.status === "loading" ||
      loans.status === "loading" ||
      history.status === "loading");

  const retryAll = () => {
    pending.refetch();
    loans.refetch();
    history.refetch();
    stats.refetch();
  };

  // ----------------------------------------
  // LIMPIAR FILTROS
  // ----------------------------------------

  const clearFilters = () => {
    setQuery("");
    setFilter("todos");
    setPage(1);
  };

  // ----------------------------------------
  // AVISO DE ÉXITO
  // ----------------------------------------

  // El aviso del registro se descarta solo.
  useEffect(() => {
    if (notice === null) return;

    const timer = window.setTimeout(() => setNotice(null), 6000);

    return () => window.clearTimeout(timer);
  }, [notice]);

  // ----------------------------------------
  // ACCIONES: MODAL DE DEVOLUCIÓN
  // ----------------------------------------

  const openReturnForm = (
    loan: ReturnRecord | null = null
  ) => {
    // Evita tener dos modales abiertos a la vez.
    setDetailLoan(null);

    // El formulario parte de datos reales: se refrescan los préstamos
    // pendientes para ofrecer el listado vigente al abrir.
    mutations.clearError();
    setNotice(null);
    pending.refetch();

    setFormLoan(loan);
    setFormOpen(true);
  };

  const closeReturnForm = () => {
    setFormOpen(false);
    setFormLoan(null);
  };

  // ----------------------------------------
  // REGISTRAR DEVOLUCIÓN (ESCRITURA REAL)
  // ----------------------------------------

  const handleRegister = async (datos: RegistrarDevolucionInput) => {
    const registrada = await mutations.registrar(datos);

    // Si falló, el formulario permanece abierto y conserva las selecciones:
    // solo se muestra el error real devuelto por el backend.
    if (registrada === null) return;

    setFormOpen(false);
    setFormLoan(null);

    // Se recargan las fuentes reales para reflejar el nuevo estado del
    // préstamo, el inventario y las estadísticas.
    pending.refetch();
    loans.refetch();
    history.refetch();
    stats.refetch();

    const partes: string[] = [];
    if (registrada.cantidad_devuelta > 0) {
      partes.push(`${registrada.cantidad_devuelta} en buen estado`);
    }
    if (registrada.cantidad_daniada > 0) {
      partes.push(`${registrada.cantidad_daniada} dañadas`);
    }
    if (registrada.cantidad_perdida > 0) {
      partes.push(`${registrada.cantidad_perdida} perdidas`);
    }

    const procesadas = partes.length > 0 ? partes.join(", ") : "sin unidades";

    const estado =
      registrada.prestamo_estado === "cerrado"
        ? "préstamo cerrado"
        : `préstamo activo con ${registrada.prestamo_unidades_pendientes} pendientes`;

    setNotice(
      `Devolución #${registrada.id} registrada para ${registrada.folio}: ${procesadas}; ${estado}.`
    );
  };

  // ----------------------------------------
  // ACCIONES: DETALLES
  // ----------------------------------------

  const openDetails = (loan: ReturnRecord) => {
    setFormOpen(false);
    setDetailLoan(loan);
  };

  const closeDetails = () => {
    setDetailLoan(null);
  };

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <div
      className="
        flex min-h-0 min-w-0
        flex-1 flex-col
        overflow-hidden
        bg-cover bg-center bg-no-repeat
      "
      style={{
        backgroundImage: `url(${background})`,
      }}
    >
      {/* ENCABEZADO */}

      <div className="shrink-0">
        <PageHeader
          title="Devoluciones"
          subtitle="Controla los artículos devueltos y los pendientes por recibir."
          meta={
            <span
              className="
                inline-flex h-8 items-center gap-2
                rounded-full
                border border-white/80
                bg-white/90 px-3
                text-[11px] font-medium
                text-[#405783]
                shadow-sm
              "
            >
              <span
                className="
                  h-1.5 w-1.5
                  rounded-full
                  bg-[#267BFA]
                "
              />
              Datos de la base local
            </span>
          }
          action={
            <Button
              variant="sidebar"
              onClick={() => openReturnForm()}
            >
              <Plus className="h-4 w-4" />
              Nueva devolución
            </Button>
          }
        />
      </div>

      {/* CONTENIDO PRINCIPAL */}

      <main
        className="
          min-h-0 min-w-0 flex-1
          overflow-x-hidden overflow-y-auto
          px-4 pb-4 pt-3
          @[1100px]:px-5
        "
      >
        <div
          className="
            mx-auto flex w-full
            max-w-[1800px]
            flex-col gap-3
          "
        >
          {/* TARJETAS ESTADÍSTICAS */}

          <ReturnsStats summary={summary} />

          {stats.status === "error" && (
            <div
              role="alert"
              className="
                flex flex-wrap items-center gap-2.5
                rounded-[16px]
                border border-[#F3C9CC]
                bg-[#FDECEE]
                px-4 py-2.5
                text-[12px] font-medium
                text-[#B23540]
              "
            >
              <AlertCircle className="h-4 w-4 shrink-0" />

              <span className="min-w-0 flex-1">
                {stats.error ??
                  "No se pudieron cargar las estadísticas de devoluciones."}
              </span>

              <Button variant="secondary" onClick={stats.refetch}>
                Reintentar
              </Button>
            </div>
          )}

          {/* PANEL PRINCIPAL */}

          <section
            aria-label="Listado de devoluciones"
            className="
              min-w-0 overflow-hidden
              rounded-[20px]
              border border-white/80
              bg-white/95

              shadow-[0_6px_24px_rgba(31,65,122,0.06)]
              backdrop-blur-md
            "
          >
            {/* BUSCADOR Y FILTROS */}
            <ReturnsToolbar
              query={query}
              onQuery={setQuery}
              filter={filter}
              onFilter={setFilter}
              hasActiveFilters={hasActiveFilters}
              onClear={clearFilters}
            />

            {notice !== null && (
              <div
                role="status"
                className="flex items-center gap-2 border-b border-[#CDEBDD] bg-[#EAF9F2] px-4 py-2 text-[12px] font-medium text-[#0F7B54]"
              >
                <CircleCheck className="h-4 w-4 shrink-0" />
                {notice}
              </div>
            )}

            {listError !== null ? (
              <ResourceError
                message={listError}
                onRetry={retryAll}
              />
            ) : listLoading ? (
              <ResourceLoading />
            ) : (
              <>
                <ReturnsTable
                  items={pageItems}
                  totalCount={records.length}
                  filtered={hasActiveFilters}
                  onClear={clearFilters}
                  onDetails={openDetails}
                  onReturn={(loan) => openReturnForm(loan)}
                />

                {/* PAGINACIÓN */}

                <div
                  className="
                    flex flex-wrap items-center
                    justify-between gap-3
                    border-t border-[#E9EEF6]
                    bg-white/70
                    px-4 py-3
                    text-[12px] text-[#7385A4]
                  "
                >
                  <span className="tabular-nums">
                    {resultLabel}
                  </span>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="icon"
                      aria-label="Página anterior de devoluciones"
                      title="Página anterior"
                      disabled={safePage <= 1}
                      onClick={() =>
                        setPage((previous) =>
                          Math.max(1, previous - 1)
                        )
                      }
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <span
                      className="
                        min-w-[100px]
                        text-center font-medium
                        tabular-nums
                        text-[#647794]
                      "
                    >
                      Página {safePage} de {totalPages}
                    </span>

                    <Button
                      variant="icon"
                      aria-label="Página siguiente de devoluciones"
                      title="Página siguiente"
                      disabled={safePage >= totalPages}
                      onClick={() =>
                        setPage((previous) =>
                          Math.min(
                            totalPages,
                            previous + 1
                          )
                        )
                      }
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      {/* MODAL DE DETALLES */}

      <ReturnDetailsDialog
        open={detailLoan !== null}
        loan={detailLoan}
        onClose={closeDetails}
        onReturn={(loan) => openReturnForm(loan)}
      />

      {/* MODAL NUEVA DEVOLUCIÓN */}

      {formOpen && (
        <ReturnFormDialog
          open={formOpen}
          loan={formLoan}
          saving={mutations.saving}
          serverError={mutations.error}
          onClose={closeReturnForm}
          onSubmit={handleRegister}
        />
      )}
    </div>
  );
}
