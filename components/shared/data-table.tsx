"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Inbox,
  RotateCcw,
  Search,
  TriangleAlert,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type ColumnAlign = "left" | "center" | "right";

export interface ColumnDef<TData> {
  id: string;
  header: React.ReactNode;
  accessorKey?: keyof TData & string;
  cell?: (row: TData, index: number) => React.ReactNode;
  sortable?: boolean;
  sortValue?: (row: TData) => string | number;
  align?: ColumnAlign;
  className?: string;
  headerClassName?: string;
}

export interface DataTableEmptyState {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData>[];
  getRowId?: (row: TData, index: number) => string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  pageSize?: number;
  pageSizeOptions?: number[];
  selectable?: boolean;
  onSelectionChange?: (rows: TData[]) => void;
  emptyState?: DataTableEmptyState;
  className?: string;
}

type SortDirection = "asc" | "desc";

interface SortingState {
  id: string;
  dir: SortDirection;
}

const alignClasses: Record<ColumnAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

const checkboxClasses =
  "h-4 w-4 shrink-0 cursor-pointer rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const navButtonClasses =
  "inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50";

export function DataTable<TData>({
  data,
  columns,
  getRowId = (_row, index) => String(index),
  isLoading = false,
  error = null,
  onRetry,
  searchable = false,
  searchPlaceholder = "بحث...",
  pageSize = 10,
  pageSizeOptions = [5, 10, 20, 50],
  selectable = false,
  onSelectionChange,
  emptyState,
  className,
}: DataTableProps<TData>) {
  const [query, setQuery] = React.useState("");
  const deferredQuery = React.useDeferredValue(query);
  const [sorting, setSorting] = React.useState<SortingState | null>(null);
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSizeState, setPageSizeState] = React.useState(pageSize);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const filteredData = React.useMemo(() => {
    if (!searchable || deferredQuery.trim() === "") {
      return data;
    }
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    return data.filter((row) =>
      columns.some((column) => {
        if (!column.accessorKey) return false;
        const value = row[column.accessorKey];
        return value != null && String(value).toLowerCase().includes(normalizedQuery);
      })
    );
  }, [data, columns, searchable, deferredQuery]);

  const sortedData = React.useMemo(() => {
    if (!sorting) return filteredData;
    const column = columns.find((c) => c.id === sorting.id);
    if (!column) return filteredData;

    const getSortValue = (row: TData): string | number => {
      if (column.sortValue) return column.sortValue(row);
      if (column.accessorKey) {
        const value = row[column.accessorKey];
        return typeof value === "number" ? value : String(value ?? "").toLowerCase();
      }
      return "";
    };

    return [...filteredData].sort((a, b) => {
      const valueA = getSortValue(a);
      const valueB = getSortValue(b);
      if (valueA === valueB) return 0;
      const comparison = valueA < valueB ? -1 : 1;
      return sorting.dir === "asc" ? comparison : -comparison;
    });
  }, [filteredData, sorting, columns]);

  const pageCount = Math.max(1, Math.ceil(sortedData.length / pageSizeState));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);

  const pageRows = React.useMemo(
    () =>
      sortedData.slice(
        safePageIndex * pageSizeState,
        (safePageIndex + 1) * pageSizeState
      ),
    [sortedData, safePageIndex, pageSizeState]
  );

  const pageRowIds = pageRows.map((row, index) =>
    getRowId(row, safePageIndex * pageSizeState + index)
  );
  const allPageSelected =
    pageRowIds.length > 0 && pageRowIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageRowIds.some((id) => selectedIds.has(id));

  const toggleSorting = (column: ColumnDef<TData>) => {
    if (!column.sortable || isLoading) return;
    setPageIndex(0);
    setSorting((current) => {
      if (!current || current.id !== column.id) return { id: column.id, dir: "asc" };
      if (current.dir === "asc") return { id: column.id, dir: "desc" };
      return null;
    });
  };

  const toggleAllPageRows = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allPageSelected) {
        pageRowIds.forEach((id) => next.delete(id));
      } else {
        pageRowIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleRow = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  React.useEffect(() => {
    if (!selectable || !onSelectionChange) return;
    const selectedRows = data.filter((row, index) =>
      selectedIds.has(getRowId(row, index))
    );
    onSelectionChange(selectedRows);
  }, [selectedIds, data, getRowId, onSelectionChange, selectable]);

  const startRow = sortedData.length === 0 ? 0 : safePageIndex * pageSizeState + 1;
  const endRow = Math.min(sortedData.length, (safePageIndex + 1) * pageSizeState);
  const totalColumns = columns.length + (selectable ? 1 : 0);

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm",
        className
      )}
    >
      {(searchable || selectable) && (
        <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="order-2 flex items-center sm:order-1">
            {selectable && selectedIds.size > 0 && (
              <span className="text-sm text-muted-foreground">
                تم تحديد {selectedIds.size}
              </span>
            )}
          </div>
          {searchable && (
            <div className="relative order-1 w-full sm:order-2 sm:w-72">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPageIndex(0);
                }}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="h-9 w-full rounded-md border border-input bg-background ps-9 pe-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background"
              />
            </div>
          )}
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {selectable && (
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  className={checkboxClasses}
                  checked={allPageSelected}
                  ref={(node) => {
                    if (node) node.indeterminate = !allPageSelected && somePageSelected;
                  }}
                  onChange={toggleAllPageRows}
                  aria-label="تحديد جميع الصفوف"
                />
              </TableHead>
            )}
            {columns.map((column) => {
              const isSorted = sorting?.id === column.id;
              return (
                <TableHead
                  key={column.id}
                  className={cn(
                    alignClasses[column.align ?? "left"],
                    column.headerClassName
                  )}
                  aria-sort={
                    column.sortable
                      ? isSorted
                        ? sorting?.dir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                      : undefined
                  }
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSorting(column)}
                      className={cn(
                        "-ms-1 inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-xs font-medium uppercase tracking-wide transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isSorted ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {column.header}
                      {isSorted ? (
                        sorting?.dir === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {error ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={totalColumns}>
                <div
                  className="flex flex-col items-center justify-center gap-3 py-12 text-center"
                  role="alert"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                    <TriangleAlert className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      تعذر تحميل البيانات
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{error}</p>
                  </div>
                  {onRetry && (
                    <button
                      type="button"
                      onClick={onRetry}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <RotateCcw className="h-4 w-4" />
                      إعادة المحاولة
                    </button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ) : isLoading ? (
            Array.from({ length: 6 }).map((_, rowIndex) => (
              <TableRow key={`loading-${rowIndex}`} className="hover:bg-transparent">
                {selectable && (
                  <TableCell className="w-10">
                    <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                  </TableCell>
                )}
                {columns.map((column) => (
                  <TableCell key={column.id}>
                    <div
                      className="h-4 animate-pulse rounded bg-muted"
                      style={{
                        width: `${55 + ((rowIndex * 17 + column.id.length * 13) % 40)}%`,
                      }}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : pageRows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={totalColumns}>
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Inbox className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {emptyState?.title ?? "لا توجد نتائج"}
                    </p>
                    {emptyState?.description && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {emptyState.description}
                      </p>
                    )}
                  </div>
                  {emptyState?.actionLabel && (
                    <button
                      type="button"
                      onClick={emptyState.onAction}
                      className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      {emptyState.actionLabel}
                    </button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ) : (
            pageRows.map((row, rowIndex) => {
              const globalIndex = safePageIndex * pageSizeState + rowIndex;
              const rowId = getRowId(row, globalIndex);
              const isSelected = selectedIds.has(rowId);
              return (
                <TableRow
                  key={rowId}
                  data-state={isSelected ? "selected" : undefined}
                >
                  {selectable && (
                    <TableCell className="w-10">
                      <input
                        type="checkbox"
                        className={checkboxClasses}
                        checked={isSelected}
                        onChange={() => toggleRow(rowId)}
                        aria-label={`تحديد الصف ${globalIndex + 1}`}
                      />
                    </TableCell>
                  )}
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      className={cn(
                        alignClasses[column.align ?? "left"],
                        column.className
                      )}
                    >
                      {column.cell
                        ? column.cell(row, globalIndex)
                        : column.accessorKey
                          ? String(row[column.accessorKey] ?? "")
                          : null}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {!isLoading && (
        <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div>
            عرض{" "}
            <span className="font-medium text-foreground">
              {startRow}–{endRow}
            </span>{" "}
            من أصل{" "}
            <span className="font-medium text-foreground">
              {sortedData.length}
            </span>{" "}
            نتيجة
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              الصفوف
              <select
                value={pageSizeState}
                onChange={(event) => {
                  setPageSizeState(Number(event.target.value));
                  setPageIndex(0);
                }}
                aria-label="عدد الصفوف"
                className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <span>
              صفحة{" "}
              <span className="font-medium text-foreground">
                {safePageIndex + 1}
              </span>{" "}
              من{" "}
              <span className="font-medium text-foreground">{pageCount}</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={navButtonClasses}
                onClick={() => setPageIndex(0)}
                disabled={safePageIndex === 0}
                aria-label="الصفحة الأولى"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={navButtonClasses}
                onClick={() => setPageIndex((current) => current - 1)}
                disabled={safePageIndex === 0}
                aria-label="الصفحة السابقة"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={navButtonClasses}
                onClick={() => setPageIndex((current) => current + 1)}
                disabled={safePageIndex >= pageCount - 1}
                aria-label="الصفحة التالية"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={navButtonClasses}
                onClick={() => setPageIndex(pageCount - 1)}
                disabled={safePageIndex >= pageCount - 1}
                aria-label="الصفحة الأخيرة"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
