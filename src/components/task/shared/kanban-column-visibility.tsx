"use client";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ListFilter } from "lucide-react";
import { STATUS_LABELS } from "@/lib/zodSchemas";

type TaskStatus = "TO_DO" | "IN_PROGRESS" | "CANCELLED" | "REVIEW" | "HOLD" | "COMPLETED";

export type KanbanColumnVisibility = Record<TaskStatus, boolean>;

interface KanbanColumnVisibilityProps {
    visibleColumns: KanbanColumnVisibility;
    setVisibleColumns: React.Dispatch<React.SetStateAction<KanbanColumnVisibility>>;
}

/**
 * Kanban Column Visibility Component
 * 
 * Allows users to toggle visibility of Kanban board columns.
 * Used in both project-level and workspace-level Kanban views.
 */
export function KanbanColumnVisibility({
    visibleColumns,
    setVisibleColumns,
}: KanbanColumnVisibilityProps) {
    const handleColumnToggle = (column: TaskStatus, checked: boolean) => {
        setVisibleColumns({
            ...visibleColumns,
            [column]: checked,
        });
    };

    const visibleColumnsCount = Object.values(visibleColumns).filter(Boolean).length;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <ListFilter className="h-4 w-4" />
                    Columns ({visibleColumnsCount}/6)
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
                <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((column) => (
                    <DropdownMenuCheckboxItem
                        key={column}
                        checked={visibleColumns[column]}
                        onCheckedChange={(checked) => handleColumnToggle(column, checked)}
                    >
                        {STATUS_LABELS[column]}
                    </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
