import { type ReactNode } from "react";

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

export function DataTable<T extends Record<string, unknown>>({
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

  return (
    <div
      className={`overflow-hidden bg-surface ${
        flat ? "" : "rounded-lg border border-border-soft"
      }`}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={`px-4 py-2 text-[12px] font-semibold text-text-secondary ${
                    col.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={String(row[keyField])}
                onClick={
                  onRowClick
                    ? () => {
                        if (window.getSelection()?.toString()) return;
                        onRowClick(row);
                      }
                    : undefined
                }
                className={`border-b border-border-soft transition-colors duration-[120ms] ease-out last:border-0 hover:bg-[#F4F7FB] ${
                  onRowClick ? "cursor-pointer" : ""
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-2 text-text ${
                      col.mono ? "font-mono text-[13px]" : ""
                    } ${
                      col.align === "right"
                        ? "text-right tabular-nums"
                        : "text-left"
                    }`}
                  >
                    {col.render ? col.render(row) : String(row[col.key] ?? "")}
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
