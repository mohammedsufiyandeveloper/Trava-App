"use client";

import { useDroppable, useDndContext } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

import type { KanbanSubTaskType } from "@/data/task";
import { cn } from "@/lib/utils";
import { KanbanCard } from "./kanban-card";
import { KanbanCardSkeleton } from "./kanban-skeleton";
import { useInView } from "react-intersection-observer";
import React, { useEffect } from "react";
import { Plus } from "lucide-react";
import { UserPermissionsType } from "@/data/user/get-user-permissions";
import { ProjectOption } from "../shared/types";


type TaskStatus = "TO_DO" | "IN_PROGRESS" | "REVIEW" | "HOLD" | "COMPLETED" | "CANCELLED";

interface KanbanColumnProps {
    column: {
        id: TaskStatus;
        title: string;
        color: string;
        bgColor: string;
        borderColor: string;
    };
    subTaskIds: string[];
    totalCount: number;
    hasMore: boolean;
    isLoadingMore: boolean;
    onSubTaskClick: (subTask: KanbanSubTaskType) => void;
    onLoadMore: () => void;
    projectManagers?: Record<string, any>;
    updatingTaskIds?: Set<string>;
    /** The id of the card currently being dragged */
    activeTaskId?: string | null;
    /** The id of the card the dragged item is hovering over (null = column itself is hovered, empty) */
    overCardId?: string | null;
    /** Whether the dragged item is over this column at all */
    isOverColumn?: boolean;
    permissions?: UserPermissionsType;
    userId?: string;
    projectMembers?: any[];
    projects?: ProjectOption[];
}

/**
 * Kanban Column Component
 * Optimized with virtualization and normalized data flow.
 * Includes ClickUp-style drop indicator showing where the card will land.
 */
export const KanbanColumn = React.memo(function KanbanColumn({
    column,
    subTaskIds,
    totalCount,
    hasMore,
    isLoadingMore,
    onSubTaskClick,
    onLoadMore,
    projectManagers,
    updatingTaskIds = new Set(),
    activeTaskId,
    overCardId,
    isOverColumn = false,
    permissions,
    userId,
    projectMembers = [],
    projects,
}: KanbanColumnProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: column.id,
    });

    const { active } = useDndContext();
    const isDragging = !!active;

    const { ref: loadMoreRef, inView } = useInView({
        threshold: 0,
        rootMargin: '100px',
    });


    useEffect(() => {
        if (inView && hasMore && !isLoadingMore) {
            onLoadMore();
        }
    }, [inView, hasMore, isLoadingMore, onLoadMore]);

    /**
     * Compute where the drop indicator should appear.
     * - dropIndicatorIndex = the index BEFORE which the card will be inserted.
     * - If overCardId is null but isOverColumn → dropped on empty column or below all cards → index = subTaskIds.length
     * - If overCardId is a card id → indicator appears BEFORE that card's index.
     */
    const getDropIndicatorIndex = (): number | null => {
        if (!isDragging || !isOverColumn) return null;
        if (!overCardId) {
            // Hovering the column itself (no card below cursor) → insert at bottom
            return subTaskIds.length;
        }
        const idx = subTaskIds.indexOf(overCardId);
        if (idx === -1) return null;
        return idx;
    };

    const dropIndicatorIndex = getDropIndicatorIndex();

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "flex-shrink-0 w-[calc(100vw-4rem)] sm:w-80 flex flex-col h-full transition-all duration-200 rounded-lg overflow-hidden border-2",
                isOver ? "bg-primary/5 ring-2 ring-primary/20 scale-[1.01] border-primary/50" : "bg-transparent border-transparent"
            )}
        >
            {/* Column Header */}
            <div
                className={cn(
                    "border-b p-4",
                    column.borderColor,
                    column.bgColor
                )}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                        <h3 className={cn("font-semibold text-sm truncate", column.color)}>
                            {column.title}
                        </h3>
                        {isDragging && (
                            <div className={cn(
                                "border-2 border-dashed rounded-full px-2 py-0.5 flex items-center gap-1 transition-all duration-300 animate-in fade-in zoom-in-95 shrink-0",
                                isOver
                                    ? "border-primary/50 bg-primary/20 scale-105 shadow-sm"
                                    : "border-muted-foreground/20 bg-muted/10 opacity-70"
                            )}>
                                <Plus className={cn(
                                    "h-2.5 w-2.5 transition-colors",
                                    isOver ? "text-primary" : "text-muted-foreground/60"
                                )} />
                                <span className={cn(
                                    "text-[8px] font-bold uppercase tracking-tight transition-colors",
                                    isOver ? "text-primary" : "text-muted-foreground/60"
                                )}>
                                    {isOver ? "Release" : "Drop Here"}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Column Content with individual scroll */}
            <div
                className={cn(
                    "flex-1 p-3 overflow-y-auto",
                    !isOver && "border-t-0",
                    column.borderColor,
                    // Custom ultra-thin scrollbar
                    "[&::-webkit-scrollbar]:w-0.5",
                    "[&::-webkit-scrollbar-track]:bg-transparent",
                    "[&::-webkit-scrollbar-thumb]:bg-slate-300",
                    "[&::-webkit-scrollbar-thumb]:rounded-full",
                    "[&::-webkit-scrollbar-thumb]:hover:bg-slate-400"
                )}
            >
                <SortableContext
                    items={subTaskIds}
                    strategy={verticalListSortingStrategy}
                >
                    {/* Non-virtualized rendering with drop indicators */}
                    <div className="relative space-y-0">
                        {subTaskIds.map((subTaskId, index) => {
                            const showIndicatorBefore = dropIndicatorIndex === index && subTaskId !== activeTaskId;
                            return (
                                <React.Fragment key={subTaskId}>
                                    {/* Drop Indicator BEFORE this card */}
                                    {showIndicatorBefore && (
                                        <DropIndicator />
                                    )}
                                    <div className="pb-3">
                                        <KanbanCardWrapper
                                            id={subTaskId}
                                            columnColor={column.color}
                                            onSubTaskClick={onSubTaskClick}
                                            projectManagers={projectManagers}
                                            isUpdating={updatingTaskIds.has(subTaskId)}
                                            isDimmed={isDragging && subTaskId === activeTaskId}
                                            permissions={permissions}
                                            userId={userId}
                                            projectMembers={projectMembers}
                                            projects={projects}
                                        />
                                    </div>
                                </React.Fragment>
                            );
                        })}

                        {/* Drop indicator at bottom of list */}
                        {dropIndicatorIndex === subTaskIds.length && (
                            <DropIndicator />
                        )}

                        {/* Load more / skeleton */}
                        {(hasMore || isLoadingMore) ? (
                            <div ref={loadMoreRef} className="py-2 w-full">
                                {isLoadingMore ? (
                                    <div className="space-y-3">
                                        <KanbanCardSkeleton />
                                    </div>
                                ) : (
                                    <div className="h-4 w-full" />
                                )}
                            </div>
                        ) : (
                            subTaskIds.length > 0 && (
                                <div className="py-6 flex flex-col items-center justify-center gap-2 opacity-40 group/nomore select-none">
                                    <div className="h-px w-8 bg-muted-foreground/30 group-hover/nomore:w-12 transition-all duration-500" />
                                    <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-muted-foreground whitespace-nowrap">
                                        No more tasks
                                    </span>
                                    <div className="h-px w-8 bg-muted-foreground/30 group-hover/nomore:w-12 transition-all duration-500" />
                                </div>
                            )
                        )}
                    </div>

                    {subTaskIds.length === 0 && !isLoadingMore && (
                        <div className={cn(
                            "flex items-center justify-center h-24 text-muted-foreground text-xs uppercase font-medium tracking-wider border-2 border-dashed rounded-lg transition-all duration-200",
                            isOver
                                ? "bg-primary/10 border-primary/40 text-primary scale-[1.02]"
                                : "bg-muted/20"
                        )}>
                            {isOver ? "Drop here" : "No tasks found"}
                        </div>
                    )}
                </SortableContext>
            </div>
        </div>
    );
});

/**
 * A ClickUp-style animated drop indicator line shown between cards during drag.
 */
function DropIndicator() {
    return (
        <div className="relative py-1 mb-1 pointer-events-none select-none">
            {/* Outer glow bar */}
            <div className="relative flex items-center gap-1.5">
                {/* Circle handle */}
                <div className="h-2.5 w-2.5 rounded-full bg-primary border-2 border-background shadow-md shadow-primary/40 shrink-0 animate-pulse" />
                {/* Line */}
                <div
                    className="flex-1 h-0.5 rounded-full bg-primary shadow-[0_0_6px_2px_hsl(var(--primary)/0.4)]"
                    style={{
                        animation: "dropIndicatorPulse 1.2s ease-in-out infinite",
                    }}
                />
            </div>
        </div>
    );
}

// Inline keyframe for the indicator glow pulse
// We inject it once via a style tag approach in CSS-in-JS fashion
if (typeof document !== "undefined") {
    const styleId = "__kanban_drop_indicator_style";
    if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
            @keyframes dropIndicatorPulse {
                0%, 100% { opacity: 1; box-shadow: 0 0 6px 2px hsl(var(--primary) / 0.4); }
                50% { opacity: 0.75; box-shadow: 0 0 10px 4px hsl(var(--primary) / 0.6); }
            }
        `;
        document.head.appendChild(style);
    }
}

import { useTaskCacheStore } from "@/lib/store/task-cache-store";

const KanbanCardWrapper = React.memo(function KanbanCardWrapper({
    id,
    isDimmed,
    ...props
}: {
    id: string;
    columnColor: string;
    onSubTaskClick: (subTask: KanbanSubTaskType) => void;
    projectManagers?: Record<string, any>;
    isUpdating: boolean;
    isDimmed?: boolean;
    permissions?: UserPermissionsType;
    userId?: string;
    projectMembers?: any[];
    projects?: ProjectOption[];
}) {
    const subTask = useTaskCacheStore(state => state.entities[id]);
    if (!subTask) return null;

    return (
        <div className={cn("transition-opacity duration-150", isDimmed && "opacity-30")}>
            <KanbanCard
                subTask={subTask as KanbanSubTaskType}
                {...props}
            />
        </div>
    );
});
