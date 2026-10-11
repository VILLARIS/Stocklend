
import {
  type ReactNode,
  type KeyboardEvent,
} from "react";

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  align?: "left" | "right";
  mono?: boolean;
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
  empty?: ReactNode;
  flat?: boolean;
  onRowClick?: (row: T) => void;
}

export function DataTable<
  T extends Record<string, unknown>
>({
  columns,
  data,
  keyField,
  empty,
  flat = false,
  onRowClick,
}: DataTableProps<T>) {
  if (data.length === 0 && empty) {
    return <>{empty}</>;
  }

  const handleKeyDown = (
    event: KeyboardEvent<HTMLTableRowElement>,
    row: T
  ) => {
    if (!onRowClick) return;

    if (
      event.key === "Enter" ||
      (event.key === " " && event.target === event.currentTarget)
    ) {
      event.preventDefault();
      onRowClick(row);
    }
  };

  return (
    <div
      className={`
        min-w-0 overflow-hidden
        bg-white

        ${
          flat
            ? ""
            : "rounded-xl border border-[#E5ECF5]"
        }
      `}
    >
      <div className="w-full overflow-x-auto">
        <table
          className="
            w-full border-collapse
            text-left text-[13px]
          "
        >
          {/* =====================================
              ENCABEZADO
          ===================================== */}

          <thead className="bg-[#FAFCFF]">
            <tr className="border-b border-[#E4EBF5]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  style={
                    col.width
                      ? { width: col.width }
                      : undefined
                  }
                  className={`
                    whitespace-nowrap
                    px-4 py-3

                    text-[11.5px]
                    font-semibold
                    tracking-[0.01em]
                    text-[#61728C]

                    ${
                      col.align === "right"
                        ? "text-right"
                        : "text-left"
                    }
                  `}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          {/* =====================================
              CUERPO
          ===================================== */}

          <tbody className="bg-white">
            {data.map((row, rowIndex) => (
              <tr
                key={String(row[keyField])}
                tabIndex={
                  onRowClick ? 0 : undefined
                }
                onClick={
                  onRowClick
                    ? (event) => {
                        // No abrir el detalle al pulsar
                        // un botón dentro de la fila.
                        const target =
                          event.target as HTMLElement;

                        if (
                          target.closest(
                            "button, a, input, select, textarea, [role='button']"
                          )
                        ) {
                          return;
                        }

                        if (
                          window
                            .getSelection()
                            ?.toString()
                        ) {
                          return;
                        }

                        onRowClick(row);
                      }
                    : undefined
                }
                onKeyDown={(event) =>
                  handleKeyDown(event, row)
                }
                className={`
                  group relative
                  border-b border-[#E9EEF6]

                  transition-colors
                  duration-200 ease-out

                  last:border-b-0

                  hover:bg-[#F0F6FF]

                  ${
                    onRowClick
                      ? `
                        cursor-pointer
                        focus-visible:bg-[#F0F6FF]
                        focus-visible:outline
                        focus-visible:outline-2
                        focus-visible:-outline-offset-2
                        focus-visible:outline-[#448FFF]
                      `
                      : ""
                  }

                  ${
                    rowIndex % 2 === 0
                      ? "bg-white"
                      : "bg-[#FCFDFF]"
                  }
                `}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`
                      px-4 py-2.5

                      align-middle
                      text-[13px]
                      text-[#263A59]

                      ${
                        col.mono
                          ? "font-mono text-[12px]"
                          : ""
                      }

                      ${
                        col.align === "right"
                          ? "text-right tabular-nums"
                          : "text-left"
                      }
                    `}
                  >
                    {col.render
                      ? col.render(row)
                      : String(
                          row[col.key] ?? ""
                        )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
