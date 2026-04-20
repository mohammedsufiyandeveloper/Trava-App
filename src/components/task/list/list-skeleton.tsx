import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import { ColumnVisibility } from "../shared/column-visibility";

interface SubTaskSkeletonProps {
    columnVisibility: ColumnVisibility;
    count?: number;
}

export function TaskHeaderSkeleton() {
    return (
        <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-10 w-36" />
        </div>
    );
}

export function TaskTableSkeleton() {
    return (
        <div className="space-y-4">
            {/* Filters and controls */}
            <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-80" />
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-28" />
            </div>

            {/* Table skeleton */}
            <div className="rounded-md border mt-4">
                <div className="p-4 space-y-3">
                    {/* Table header */}
                    <div className="flex items-center gap-4 pb-3 border-b">
                        <Skeleton className="h-4 w-12" />
                        <Skeleton className="h-4 w-64" />
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-24" />
                    </div>

                    {/* Table rows */}
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex items-center gap-4 py-3">
                            <Skeleton className="h-8 w-8" />
                            <Skeleton className="h-6 w-64" />
                            <Skeleton className="h-6 w-40" />
                            <Skeleton className="h-6 w-32" />
                            <Skeleton className="h-6 w-28" />
                            <Skeleton className="h-6 w-28" />
                            <Skeleton className="h-6 w-24" />
                            <Skeleton className="h-6 w-24" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function SubTaskSkeleton({ columnVisibility, count = 1 }: SubTaskSkeletonProps) {
    // Calculate total columns
    let colSpan = 2; // drag handle + task name
    if (columnVisibility.description) colSpan++;
    if (columnVisibility.assignee) colSpan++;
    if (columnVisibility.reviewer) colSpan++;
    if (columnVisibility.status) colSpan++;
    if (columnVisibility.startDate) colSpan++;
    if (columnVisibility.dueDate) colSpan++;
    if (columnVisibility.progress) colSpan++;
    if (columnVisibility.tag) colSpan++;
    colSpan++; // actions column

    return (
        <>
            {Array.from({ length: count }).map((_, index) => (
                <TableRow key={index} className="bg-muted/10 animate-pulse">
                    <TableCell colSpan={colSpan} className="h-12 pl-12">
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-4 w-full animate-pulse" />
                        </div>
                    </TableCell>
                </TableRow>
            ))}
        </>
    );
}
