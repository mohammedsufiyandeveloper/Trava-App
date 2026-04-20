import React from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface LoadMoreSentinelProps {
    visibleColumnsCount: number;
    projectId?: string;
    observer?: IntersectionObserver | null;
}

export const LoadMoreSentinel = React.forwardRef<HTMLTableRowElement, LoadMoreSentinelProps>(
    ({ visibleColumnsCount, projectId, observer }, ref) => {
        return (
            <TableRow
                ref={(node) => {
                    if (typeof ref === 'function') ref(node);
                    else if (ref) ref.current = node;

                    // Support custom observer if passed
                    if (node && observer) {
                        observer.observe(node);
                    }
                }}
                data-project-id={projectId}
                className="hover:bg-transparent border-0"
            >
                <TableCell colSpan={visibleColumnsCount} className="py-2 h-10">
                    <div className="flex items-center gap-4 px-2 opacity-60">
                        <Skeleton className="h-4 w-4 rounded" />
                        <div className="flex-1">
                            <Skeleton className="h-4 w-[150px]" />
                        </div>
                        <Skeleton className="h-4 w-[100px]" />
                    </div>
                </TableCell>
            </TableRow>
        );
    }
);
LoadMoreSentinel.displayName = "LoadMoreSentinel";
