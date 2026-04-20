import * as React from "react";
import { Table, TableProps, Pagination } from "../ui/Table";
import { Skeleton } from "../ui/Skeleton";
import { cn } from "@/lib/utils";

// ============================================
// Data Table - Domain Component
// ============================================

export interface DataTableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  keyField: keyof T;
  loading?: boolean;
  // Sorting
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  // Pagination
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  // Empty state
  emptyMessage?: string;
  onEmptyAction?: () => void;
  emptyActionLabel?: string;
  // ClassName
  className?: string;
}

function DataTable<T>({
  columns,
  data,
  keyField,
  loading = false,
  sortKey,
  sortDirection,
  onSort,
  page = 1,
  pageSize = 10,
  total = 0,
  onPageChange,
  emptyMessage = 'No hay datos disponibles.',
  onEmptyAction,
  emptyActionLabel,
  className,
}: DataTableProps<T>) {
  const mapColumns = (cols: DataTableColumn<T>[]): TableProps<T>['columns'] => {
    return cols.map(col => ({
      key: col.key,
      header: col.header,
      sortable: col.sortable,
      render: col.render,
      className: col.className,
      headerClassName: col.headerClassName,
    }));
  };
  
  if (loading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="rounded-md border">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                {columns.map((col) => (
                  <th key={col.key} className="h-12 px-4 text-left font-medium">
                    <Skeleton className="h-4 w-20" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-t">
                  {columns.map((col) => (
                    <td key={col.key} className="p-4">
                      <Skeleton className="h-4 w-full" />
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
  
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground mb-4">{emptyMessage}</p>
        {onEmptyAction && emptyActionLabel && (
          <button
            onClick={onEmptyAction}
            className="text-sm text-primary hover:underline"
          >
            {emptyActionLabel}
          </button>
        )}
      </div>
    );
  }
  
  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-md border">
        <Table
          columns={mapColumns(columns)}
          data={data}
          keyField={keyField}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={onSort}
        />
      </div>
      
      {total > pageSize && onPageChange && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}

export { DataTable };