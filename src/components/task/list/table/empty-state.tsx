import React from "react";
import { TableRow, TableCell } from "@/components/ui/table";

interface EmptyStateProps {
    visibleColumnsCount: number;
    message?: string;
}

export function EmptyState({ visibleColumnsCount, message = "No tasks found." }: EmptyStateProps) {
    return (
        <TableRow>
            <TableCell colSpan={visibleColumnsCount} className="h-24 text-center text-muted-foreground">
                {message}
            </TableCell>
        </TableRow>
    );
}
