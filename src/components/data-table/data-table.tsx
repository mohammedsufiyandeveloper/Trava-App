"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTableFacetedFilter } from "./data-table-faceted-filter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Columns, Search, Plus, X, Filter } from "lucide-react";
import { ColumnDef, ColumnFiltersState, SortingState, VisibilityState, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, getFacetedRowModel, getFacetedUniqueValues, useReactTable } from "@tanstack/react-table";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuSeparator, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useMounted } from "@/hooks/use-mounted";

export interface DataTableFilterField<TData> {
    label: string;
    value: string;
    options?: {
        label: string;
        value: string;
        icon?: React.ComponentType<{ className?: string }>;
    }[];
}

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    searchKey?: string;
    searchPlaceholder?: string;
    isLoading?: boolean;
    onRowClick?: (row: TData) => void;
    showPagination?: boolean;
    showColumnToggle?: boolean;
    pageSize?: number;
    onAdd?: () => void;
    addButtonLabel?: string;
    filterFields?: DataTableFilterField<TData>[];
    rowSelection?: Record<string, boolean>;
    onRowSelectionChange?: (value: any) => void;
    filterDisplay?: "default" | "menu";
    enableRowSelection?: (row: any) => boolean;
    getRowClassName?: (row: any) => string;
    extraToolbarContent?: React.ReactNode;
}

export function DataTable<TData, TValue>({
    columns,
    data,
    searchKey,
    searchPlaceholder = "Search...",
    isLoading = false,
    onRowClick,
    showPagination = true,
    showColumnToggle = true,
    pageSize = 10,
    onAdd,
    addButtonLabel = "Add New",
    filterDisplay = "default",
    filterFields = [],
    rowSelection: controlledRowSelection,
    onRowSelectionChange: controlledOnRowSelectionChange,
    getRowId,
    enableRowSelection,
    getRowClassName,
    extraToolbarContent,
}: DataTableProps<TData, TValue> & { getRowId?: (row: TData) => string }) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
    const [internalRowSelection, setInternalRowSelection] = React.useState({});
    const mounted = useMounted();

    const rowSelection = controlledRowSelection ?? internalRowSelection;
    const setRowSelection = controlledOnRowSelectionChange ?? setInternalRowSelection;

    // eslint-disable-next-line react-hooks/incompatible-library
    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: showPagination ? getPaginationRowModel() : undefined,
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        getFacetedRowModel: getFacetedRowModel(),
        getFacetedUniqueValues: getFacetedUniqueValues(),
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        getRowId,
        enableRowSelection,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
        },
        initialState: {
            pagination: {
                pageSize: pageSize,
            },
        },
    });

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            {(searchKey || (filterFields && filterFields.length > 0) || extraToolbarContent || showColumnToggle) && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
                    {/* Search */}
                    {searchKey && (
                        <div className="flex items-center flex-1 max-w-sm w-full">
                            <div className="relative w-full">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder={searchPlaceholder}
                                    value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ""}
                                    onChange={(event) =>
                                        table.getColumn(searchKey)?.setFilterValue(event.target.value)
                                    }
                                    className="pl-9 w-full"
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">

                        {filterDisplay === "menu" && mounted ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 border-dashed">
                                        <Filter className="mr-2 h-4 w-4" />
                                        Filters
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-[200px]">
                                    {filterFields.map((field) => {
                                        const column = table.getColumn(field.value);
                                        if (!column) return null;
                                        return (
                                            <DropdownMenuSub key={field.value}>
                                                <DropdownMenuSubTrigger>
                                                    {field.label}
                                                </DropdownMenuSubTrigger>
                                                <DropdownMenuSubContent className="w-[200px]">
                                                    {field.options?.map((option) => {
                                                        const filterValue = column.getFilterValue();
                                                        const isSelected = Array.isArray(filterValue)
                                                            ? filterValue.includes(option.value)
                                                            : filterValue === option.value;

                                                        return (
                                                            <DropdownMenuCheckboxItem
                                                                key={option.value}
                                                                checked={isSelected}
                                                                onCheckedChange={(checked) => {
                                                                    const current = (column.getFilterValue() as string[]) || [];
                                                                    if (checked) {
                                                                        column.setFilterValue([...current, option.value]);
                                                                    } else {
                                                                        column.setFilterValue(current.filter((v) => v !== option.value));
                                                                    }
                                                                }}
                                                            >
                                                                {option.label}
                                                            </DropdownMenuCheckboxItem>
                                                        );
                                                    })}
                                                    {(column.getFilterValue() as string[])?.length > 0 && (
                                                        <>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                onSelect={() => column.setFilterValue(undefined)}
                                                                className="justify-center text-center text-xs"
                                                            >
                                                                Clear
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}
                                                </DropdownMenuSubContent>
                                            </DropdownMenuSub>
                                        );
                                    })}
                                    {(table.getState().columnFilters.length > 0) && (
                                        <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                onSelect={() => table.resetColumnFilters()}
                                                className="justify-center text-center"
                                            >
                                                Reset all
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <>
                                {mounted && filterFields.map((field) => {
                                    const column = table.getColumn(field.value);
                                    return (
                                        column && (
                                            <DataTableFacetedFilter
                                                key={field.value}
                                                column={column}
                                                title={field.label}
                                                options={field.options || []}
                                            />
                                        )
                                    );
                                })}
                                {(table.getState().columnFilters.length > 0 || !!table.getState().globalFilter) && (
                                    <Button
                                        variant="ghost"
                                        onClick={() => table.resetColumnFilters()}
                                        className="h-8 px-2 lg:px-3"
                                    >
                                        Reset
                                        <X className="ml-2 h-4 w-4" />
                                    </Button>
                                )}
                            </>
                        )}

                        {extraToolbarContent}

                        {/* Column Toggle */}
                        {showColumnToggle && mounted && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="ml-auto">
                                        <Columns className="mr-2 h-4 w-4" />
                                        Columns
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[200px]">
                                    {table
                                        .getAllColumns()
                                        .filter((column) => column.getCanHide())
                                        .map((column) => {
                                            return (
                                                <DropdownMenuCheckboxItem
                                                    key={column.id}
                                                    className="capitalize"
                                                    checked={column.getIsVisible()}
                                                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                                                >
                                                    {column.id}
                                                </DropdownMenuCheckboxItem>
                                            );
                                        })}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </div>
            )}

            {/* Active Filters Display for Menu Mode */}
            {filterDisplay === "menu" && table.getState().columnFilters.length > 0 && (
                <div className="flex flex-wrap gap-2 pb-2">
                    {filterFields.map((field) => {
                        const column = table.getColumn(field.value);
                        const filterValue = column?.getFilterValue() as string[] | undefined;

                        if (!filterValue || filterValue.length === 0) return null;

                        return filterValue.map((val) => {
                            const option = field.options?.find((o) => o.value === val);
                            return (
                                <Badge
                                    key={`${field.value}-${val}`}
                                    variant="secondary"
                                    className="rounded-sm px-1 font-normal"
                                >
                                    <span className="font-semibold mr-1">{field.label}:</span>
                                    {option?.label || val}
                                    <button
                                        className="ml-1 ring-offset-background focus:ring-ring rounded-full outline-none focus:ring-2 focus:ring-offset-2"
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                        }}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            const newValues = filterValue.filter((v) => v !== val);
                                            column?.setFilterValue(
                                                newValues.length ? newValues : undefined
                                            );
                                        }}
                                    >
                                        <X className="h-3 w-3 hover:text-destructive" />
                                    </button>
                                </Badge>
                            );
                        });
                    })}
                    <Button
                        variant="ghost"
                        onClick={() => table.resetColumnFilters()}
                        className="h-6 px-2 text-xs"
                    >
                        Reset
                        <X className="ml-2 h-3 w-3" />
                    </Button>
                </div>
            )}


            {/* Table */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead
                                            key={header.id}
                                            className={(header.column.columnDef.meta as { className?: string })?.className}
                                        >
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: pageSize }).map((_, index) => (
                                <TableRow key={index}>
                                    {columns.map((_, cellIndex) => (
                                        <TableCell key={cellIndex}>
                                            <Skeleton className="h-6 w-full" />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                    onClick={() => onRowClick?.(row.original)}
                                    className={`
                                        ${onRowClick ? "cursor-pointer" : ""}
                                        ${getRowClassName?.(row) || ""}
                                    `.trim()}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell
                                            key={cell.id}
                                            className={(cell.column.columnDef.meta as { className?: string })?.className}
                                        >
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            !onAdd && (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-24 text-center">
                                        No results found.
                                    </TableCell>
                                </TableRow>
                            )
                        )}
                        {/* Inline Add Button Row */}
                        {onAdd && !isLoading && (
                            <TableRow
                                className="cursor-pointer hover:bg-muted/50 border-dashed border-b-0 group"
                                onClick={onAdd}
                            >
                                <TableCell colSpan={columns.length} className="p-2">
                                    <div className="flex items-center justify-center gap-2 h-9 text-primary font-medium transition-colors border-dashed border border-primary/50 bg-primary/5 rounded-md hover:bg-primary/10">
                                        <Plus className="h-4 w-4" />
                                        <span className="text-sm">{addButtonLabel}</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {
                showPagination && (
                    <div className="flex flex-col sm:flex-row items-center justify-start gap-4 mt-2">
                        {/* Pagination Controls - Moved to Left */}
                        <div className="flex items-center gap-4 sm:gap-6 order-1 w-full sm:w-auto justify-between sm:justify-start">
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => table.previousPage()}
                                    disabled={!table.getCanPreviousPage()}
                                    className="h-8"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    <span className="sr-only sm:not-sr-only sm:ml-2">Previous</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => table.nextPage()}
                                    disabled={!table.getCanNextPage()}
                                    className="h-8"
                                >
                                    <span className="sr-only sm:not-sr-only sm:mr-2">Next</span>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="text-sm text-muted-foreground whitespace-nowrap">
                                Page {table.getState().pagination.pageIndex + 1} of{" "}
                                {table.getPageCount()}
                            </div>
                        </div>

                        {/* Row Selection Info - Moved to Right */}
                        <div className="text-sm text-muted-foreground order-2 ml-auto">
                            {table.getFilteredSelectedRowModel().rows.length > 0 && (
                                <span>
                                    {table.getFilteredSelectedRowModel().rows.length} of{" "}
                                    {table.getFilteredRowModel().rows.length} row(s) selected.
                                </span>
                            )}
                        </div>
                    </div>
                )
            }
        </div>
    );
}
