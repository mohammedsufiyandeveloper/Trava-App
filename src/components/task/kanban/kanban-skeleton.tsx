import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export function KanbanCardSkeleton() {
    return (
        <Card className="border-l-4">
            <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-1.5">
                    <Skeleton className="h-3 w-3" />
                    <Skeleton className="h-5 w-24 rounded-full" />
                </div>
                <div className="flex items-start justify-between gap-2">
                    <Skeleton className="h-5 w-full flex-1" />
                    <Skeleton className="h-4 w-4 flex-shrink-0 mt-0.5" />
                </div>
                <Skeleton className="h-3 w-3/4" />
                <div className="flex items-center gap-1.5">
                    <Skeleton className="h-3 w-3" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <div className="flex items-center gap-1.5">
                    <Skeleton className="h-3 w-3" />
                    <Skeleton className="h-3 w-24" />
                </div>
                <div className="flex items-center gap-2 pt-2 border-t">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-3 w-20" />
                </div>
            </CardContent>
        </Card>
    );
}

export function KanbanColumnSkeleton({ title }: { title: string }) {
    return (
        <div className="flex-shrink-0 w-80 flex flex-col h-full">
            <div className="border-2 border-b p-4 bg-muted/50">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-foreground">
                        {title}
                    </h3>
                    <Skeleton className="h-5 w-8 rounded-full" />
                </div>
            </div>

            <div
                className={cn(
                    "flex-1 border-2 border-t-0 p-3 overflow-y-auto",
                    "[&::-webkit-scrollbar]:w-0.5",
                    "[&::-webkit-scrollbar-track]:bg-transparent",
                    "[&::-webkit-scrollbar-thumb]:bg-muted-foreground/20",
                    "[&::-webkit-scrollbar-thumb]:rounded-full",
                    "[&::-webkit-scrollbar-thumb]:hover:bg-muted-foreground/30"
                )}
            >
                <div className="space-y-3 min-h-[200px]">
                    <KanbanCardSkeleton />
                    <KanbanCardSkeleton />
                    <KanbanCardSkeleton />
                </div>
            </div>
        </div>
    );
}

export function KanbanToolbarSkeleton() {
    return (
        <div className="flex items-center justify-between gap-4 p-1 rounded-lg">
            <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="w-[200px] h-9 rounded-md" />
                </div>
                <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="w-[200px] h-9 rounded-md" />
                </div>
            </div>
            <Skeleton className="h-9 w-32 rounded-md" />
        </div>
    );
}

export function KanbanBoardSkeleton() {
    const columns = [
        { title: "To Do" },
        { title: "In Progress" },
        { title: "Review" },
    ];

    return (
        <div className="space-y-4">
            <KanbanToolbarSkeleton />
            <div
                className={cn(
                    "flex gap-4 h-[calc(100vh-280px)] overflow-x-auto pb-2",
                    "[&::-webkit-scrollbar]:h-2",
                    "[&::-webkit-scrollbar-track]:rounded-full",
                    "[&::-webkit-scrollbar-thumb]:bg-muted-foreground/20",
                    "[&::-webkit-scrollbar-thumb]:rounded-full",
                    "[&::-webkit-scrollbar-thumb]:hover:bg-muted-foreground/30"
                )}
            >
                {columns.map((column, index) => (
                    <KanbanColumnSkeleton
                        key={index}
                        title={column.title}
                    />
                ))}
            </div>
        </div>
    );
}
