"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronsUpDown, ArrowUp, ArrowDown, MoreVertical } from "lucide-react";
import { cn, formatIST } from "@/lib/utils";
import { useMounted } from "@/hooks/use-mounted";

/**
 * Creates a sortable header component
 */
export function createSortableHeader<T>(
    column: any,
    title: string
) {
    return (
        <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4 h-8"
        >
            {title}
            {column.getIsSorted() === "asc" ? (
                <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
                <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
                <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
            )}
        </Button>
    );
}

/**
 * Creates a checkbox column for row selection
 */
export function createSelectColumn<T>(): ColumnDef<T> {
    return {
        id: "select",
        header: ({ table }) => (
            <Checkbox
                checked={
                    table.getIsAllPageRowsSelected() ||
                    (table.getIsSomePageRowsSelected() && "indeterminate")
                }
                onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                aria-label="Select all"
            />
        ),
        cell: ({ row }) => (
            <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                aria-label="Select row"
                onClick={(e) => e.stopPropagation()}
            />
        ),
        enableSorting: false,
        enableHiding: false,
    };
}

/**
 * Row actions component to handle hydration
 */
function RowActions<T>({
    row,
    actions
}: {
    row: any;
    actions: {
        label: string;
        onClick: (row: T) => void;
        icon?: React.ReactNode;
        variant?: "default" | "destructive";
    }[]
}) {
    const mounted = useMounted();

    if (!mounted) {
        return (
            <div className="flex w-full justify-center">
                <Button variant="ghost" className="h-8 w-8 p-0" disabled>
                    <MoreVertical className="h-4 w-4 opacity-50" />
                </Button>
            </div>
        );
    }

    return (
        <div className="flex w-full justify-center">
            <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {actions.map((action, index) => (
                        <DropdownMenuItem
                            key={index}
                            onClick={(e) => {
                                e.stopPropagation();
                                action.onClick(row.original);
                            }}
                            className={cn(
                                action.variant === "destructive" && "text-destructive focus:text-destructive"
                            )}
                        >
                            {action.icon && <span className="mr-0">{action.icon}</span>}
                            {action.label}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

/**
 * Creates an actions column with dropdown menu
 */
export function createActionsColumn<T>(
    actions: {
        label: string;
        onClick: (row: T) => void;
        icon?: React.ReactNode;
        variant?: "default" | "destructive";
    }[]
): ColumnDef<T> {
    return {
        id: "actions",
        header: " ",
        cell: ({ row }) => <RowActions row={row} actions={actions} />,
        enableSorting: false,
        enableHiding: false,
    };
}

/**
 * Creates a badge column for status/category fields
 */
export function createBadgeColumn<T>(
    accessorKey: string,
    header: string,
    variantMap?: Record<string, "default" | "secondary" | "destructive" | "outline">
): ColumnDef<T> {
    return {
        accessorKey,
        header: ({ column }) => createSortableHeader(column, header),
        cell: ({ row }) => {
            const value = row.getValue(accessorKey) as string;
            const variant = variantMap?.[value] || "default";
            return (
                <Badge variant={variant} className="capitalize">
                    {value?.replace(/_/g, " ").toLowerCase()}
                </Badge>
            );
        },
    };
}

/**
 * Creates a date column with formatting
 */
export function createDateColumn<T>(
    accessorKey: string,
    header: string,
    format: "date" | "datetime" | "relative" = "date"
): ColumnDef<T> {
    return {
        accessorKey,
        header: ({ column }) => createSortableHeader(column, header),
        cell: ({ row }) => {
            const date = row.getValue(accessorKey) as Date | string;
            if (!date) return <span className="text-muted-foreground">—</span>;

            const dateObj = typeof date === "string" ? new Date(date) : date;

            if (format === "datetime") {
                return formatIST(dateObj, "dd/MM/yyyy HH:mm");
            } else if (format === "relative") {
                const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
                const diff = dateObj.getTime() - Date.now();
                const days = Math.round(diff / (1000 * 60 * 60 * 24));
                return rtf.format(days, "day");
            }

            return formatIST(dateObj);
        },
    };
}

/**
 * Creates a text column with optional truncation
 */
export function createTextColumn<T>(
    accessorKey: string,
    header: string,
    options?: {
        truncate?: number;
        className?: string;
    }
): ColumnDef<T> {
    return {
        accessorKey,
        header: ({ column }) => createSortableHeader(column, header),
        cell: ({ row }) => {
            const value = row.getValue(accessorKey) as string;
            if (!value) return <span className="text-muted-foreground">—</span>;

            const displayValue = options?.truncate && value.length > options.truncate
                ? `${value.substring(0, options.truncate)}...`
                : value;

            return (
                <div className={cn("font-medium", options?.className)} title={value}>
                    {displayValue}
                </div>
            );
        },
    };
}

/**
 * Creates a number column with optional formatting
 */
export function createNumberColumn<T>(
    accessorKey: string,
    header: string,
    options?: {
        prefix?: string;
        suffix?: string;
        decimals?: number;
    }
): ColumnDef<T> {
    return {
        accessorKey,
        header: ({ column }) => createSortableHeader(column, header),
        cell: ({ row }) => {
            const value = row.getValue(accessorKey) as number;
            if (value === null || value === undefined) {
                return <span className="text-muted-foreground">—</span>;
            }

            const formatted = options?.decimals !== undefined
                ? value.toFixed(options.decimals)
                : value.toString();

            return (
                <div className="font-medium">
                    {options?.prefix}
                    {formatted}
                    {options?.suffix}
                </div>
            );
        },
    };
}
