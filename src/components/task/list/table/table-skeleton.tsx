import React from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface TableLoadingSkeletonProps {
    visibleColumnsCount: number;
}

export function TableLoadingSkeleton({ visibleColumnsCount }: TableLoadingSkeletonProps) {
    return (
        <>
            {Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                    <TableCell colSpan={visibleColumnsCount} className="p-4">
                        <div className="flex items-center gap-4">
                            <Skeleton className="h-4 w-4 rounded" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-[200px]" />
                            </div>
                            <Skeleton className="h-4 w-[100px]" />
                            <Skeleton className="h-4 w-[80px]" />
                            <Skeleton className="h-4 w-[80px]" />
                        </div>
                    </TableCell>
                </TableRow>
            ))}
        </>
    );
}

export function SingleTableSkeleton({ visibleColumnsCount }: TableLoadingSkeletonProps) {
    return (
        <TableRow>
            <TableCell colSpan={visibleColumnsCount} className="h-12">
                <div className="flex items-center gap-2 px-2">
                    <Skeleton className="h-4 w-full" />
                </div>
            </TableCell>
        </TableRow>
    );
}
