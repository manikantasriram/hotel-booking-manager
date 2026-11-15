// A sortable, searchable table built on TanStack Table (v9).
//
// TanStack Table is "headless": it does the logic (sorting, filtering, which rows to show) and
// we write the HTML and styles. Features are opted into one by one, so only what we use is
// shipped to the browser.

import { useTable, type ColumnDef, type RowData, type SortingState } from "@tanstack/react-table";
import { useState, type ReactNode } from "react";
import { tableFeatureSet, type Features } from "./tableFeatures";
import { Input } from "./ui";

interface Props<T extends RowData> {
  data: T[];
  // each column has its own value type, so the column list is typed loosely here
  columns: ColumnDef<Features, T, any>[];
  searchPlaceholder?: string;
  initialSorting?: SortingState;
  emptyMessage?: string;
  toolbar?: ReactNode;
}

export function DataTable<T extends RowData>({
  data,
  columns,
  searchPlaceholder = "Search…",
  initialSorting = [],
  emptyMessage = "Nothing here yet.",
  toolbar,
}: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useTable({
    features: tableFeatureSet,
    columns,
    data,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
  });

  const rows = table.getRowModel().rows;

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-3">
        <Input
          type="search"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label="Search the table"
          className="w-full sm:w-72"
        />
        {toolbar}
        <span className="ml-auto text-sm text-mute" aria-live="polite">
          {rows.length} {rows.length === 1 ? "row" : "rows"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-mute">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                      className="whitespace-nowrap px-4 py-3 font-medium"
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 uppercase hover:text-ink"
                        >
                          <table.FlexRender header={header} />
                          <span aria-hidden="true" className="w-3">
                            {sorted === "asc" ? "▲" : sorted === "desc" ? "▼" : ""}
                          </span>
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                {row.getAllCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 align-middle">
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-mute">
                  {globalFilter ? `No rows match "${globalFilter}".` : emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
