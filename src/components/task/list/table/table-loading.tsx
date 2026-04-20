import React from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface TableLoadingProps {
    visibleColumnsCount: number;
}

export function TableLoading({ visibleColumnsCount }: TableLoadingProps) {
    return (
        <TableRow>
            <TableCell colSpan={visibleColumnsCount} className="h-32 text-center">
                <div className="flex flex-col items-center justify-center gap-2">
                    <div className="h-8 w-8 animate-spin text-muted-foreground border-4 border-current border-t-transparent rounded-full" />
                    <span className="text-sm text-muted-foreground">Loading tasks...</span>
                </div>
            </TableCell>
        </TableRow>
    );
}
