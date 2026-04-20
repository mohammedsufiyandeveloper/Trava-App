import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function GanttChartSkeleton() {
    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between gap-4 mb-4 px-1">
                <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-24" />
                </div>
                <Skeleton className="h-8 w-28" />
            </div>

            <div
                className={cn(
                    "flex-1 rounded-lg border border-neutral-200 dark:border-neutral-700",
                    "bg-white dark:bg-neutral-900",
                    "shadow-sm overflow-hidden"
                )}
            >
                <div className="flex border-b border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 h-8">
                    <div className="w-[200px] shrink-0 border-r border-neutral-200 dark:border-neutral-700" />
                    <div className="flex-1" />
                </div>

                <div className="flex border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 h-10">
                    <div className="w-[200px] shrink-0 px-3 py-2 border-r border-neutral-200 dark:border-neutral-700">
                        <Skeleton className="h-4 w-16" />
                    </div>
                    <div className="flex-1 flex items-center gap-1 px-2">
                        {Array.from({ length: 15 }).map((_, i) => (
                            <Skeleton key={i} className="h-4 w-8" />
                        ))}
                    </div>
                </div>

                {Array.from({ length: 5 }).map((_, i) => (
                    <div
                        key={i}
                        className="flex border-b border-neutral-200 dark:border-neutral-700 h-10"
                    >
                        <div className="w-[200px] shrink-0 px-3 py-2 border-r border-neutral-200 dark:border-neutral-700 flex items-center gap-2">
                            <Skeleton className="h-4 w-4" />
                            <Skeleton className="h-4 w-32" />
                        </div>
                        <div className="flex-1 flex items-center px-4">
                            <Skeleton
                                className="h-6 rounded-md"
                                style={{
                                    width: `${30 + (i * 7) % 40}%`,
                                    marginLeft: `${(i * 5) % 30}%`
                                }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex items-center gap-6 mt-4 px-1">
                <div className="flex items-center gap-2">
                    <Skeleton className="w-4 h-3" />
                    <Skeleton className="w-10 h-3" />
                </div>
                <div className="flex items-center gap-2">
                    <Skeleton className="w-4 h-2" />
                    <Skeleton className="w-14 h-3" />
                </div>
                <div className="flex items-center gap-2">
                    <Skeleton className="w-0.5 h-4" />
                    <Skeleton className="w-10 h-3" />
                </div>
            </div>
        </div>
    );
}
