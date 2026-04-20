"use client";

import React, { useState, useEffect, useCallback } from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { SortedTaskRow } from "./sorted-task-row";
import { SingleTableSkeleton } from "../table/table-skeleton";
import { EmptyState } from "../table/empty-state";
import { ColumnVisibility } from "../../shared/column-visibility";

interface SortedTaskListProps {
    sortedTasks: any[];
    isLoading: boolean;
    hasMore: boolean;
    isLoadingMore: boolean;
    columnVisibility: ColumnVisibility;
    visibleColumnsCount: number;
    sortedSentinelRef: React.RefObject<HTMLTableRowElement | null>;
    handleSubTaskClick: (task: any) => void;
}

export function SortedTaskList({
    sortedTasks,
    isLoading,
    hasMore,
    isLoadingMore,
    columnVisibility,
    visibleColumnsCount,
    sortedSentinelRef,
    handleSubTaskClick,
}: SortedTaskListProps) {
    // 1. Local optimistic state for instant UI deletion (without waiting for TaskTable re-render)
    const [localTasks, setLocalTasks] = useState(sortedTasks);

    // Sync upstream on actual updates
    useEffect(() => {
        setLocalTasks(sortedTasks);
    }, [sortedTasks]);

    if (isLoading) {
        return <SingleTableSkeleton visibleColumnsCount={visibleColumnsCount} />;
    }

    if (localTasks.length === 0) {
        return <EmptyState visibleColumnsCount={visibleColumnsCount} />;
    }

    return (
        <>
            {localTasks.map((task: any) => (
                <SortedTaskRow
                    key={task.id}
                    task={task}
                    columnVisibility={columnVisibility}
                    onClick={() => handleSubTaskClick(task)}
                />
            ))}

            {/* Sentinel is mounted so the IntersectionObserver ref stays valid across hasMore transitions. */}
            <TableRow
                className="hover:bg-transparent border-0"
                ref={sortedSentinelRef as React.LegacyRef<HTMLTableRowElement>}
            >
                <TableCell colSpan={visibleColumnsCount} className="py-3">
                    {isLoadingMore && (
                        <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Loading more...</span>
                        </div>
                    )}
                </TableCell>
            </TableRow>
        </>
    );
}
