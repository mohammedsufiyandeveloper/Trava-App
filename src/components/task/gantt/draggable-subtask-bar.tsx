"use client";

import { useState, useRef, useEffect, useTransition, useMemo } from "react";
import { AlertCircle, GripHorizontal } from "lucide-react";
import { parseDate, formatDate, getDaysBetween, formatDateForAPI } from "./utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { GanttSubtask } from "./types";
import { updateSubtaskDates } from "@/actions/task/gantt";

interface DraggableSubtaskBarProps {
    subtask: GanttSubtask;
    timelineStart: Date;
    totalDays: number;
    workspaceId?: string;
    projectId?: string;
    currentUser?: { id: string };
    permissions?: {
        isWorkspaceAdmin: boolean;
        leadProjectIds: string[];
        managedProjectIds: string[];
    };
    onUpdate?: (id: string, data: Partial<GanttSubtask>) => void;
}

export function DraggableSubtaskBar({
    subtask,
    timelineStart,
    totalDays,
    workspaceId,
    projectId,
    currentUser,
    permissions,
    onUpdate
}: DraggableSubtaskBarProps) {
    const [isPending, startTransition] = useTransition();
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [resizeEdge, setResizeEdge] = useState<'left' | 'right' | null>(null);
    const [dragStart, setDragStart] = useState({ x: 0, date: new Date() });

    // Live position state for visual feedback during drag
    const [livePosition, setLivePosition] = useState<{ left: number; width: number } | null>(null);

    // Optimistic subtask state - updates immediately on drag, syncs with server data
    const [optimisticSubtask, setOptimisticSubtask] = useState<GanttSubtask>(subtask);

    // Track if we're waiting for server update
    const [isPendingUpdate, setIsPendingUpdate] = useState(false);

    const barRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Sync optimistic state with incoming prop changes (from server)
    // Only sync if we're not waiting for an update, or if the server data matches our optimistic update
    // Sync optimistic state with incoming prop changes (from server)
    const [prevSubtask, setPrevSubtask] = useState(subtask);

    if (subtask !== prevSubtask) {
        setPrevSubtask(subtask);
        if (!isPendingUpdate) {
            setOptimisticSubtask(subtask);
        } else {
            // Check if server data matches our optimistic update
            if (subtask.start === optimisticSubtask.start && subtask.end === optimisticSubtask.end) {
                setOptimisticSubtask(subtask);
                setIsPendingUpdate(false);
            }
        }
    }

    const startDate = parseDate(optimisticSubtask.start);
    const endDate = parseDate(optimisticSubtask.end);

    // Normalize dates to midnight for accurate day-based positioning
    const normalizedStartDate = startDate ? new Date(startDate) : new Date();
    normalizedStartDate.setHours(0, 0, 0, 0);
    const normalizedEndDate = endDate ? new Date(endDate) : new Date();
    normalizedEndDate.setHours(0, 0, 0, 0);
    const normalizedTimelineStart = new Date(timelineStart);
    normalizedTimelineStart.setHours(0, 0, 0, 0);

    const startOffset = startDate ? getDaysBetween(normalizedTimelineStart, normalizedStartDate) : 0;
    const duration = (startDate && endDate) ? (getDaysBetween(normalizedStartDate, normalizedEndDate) + 1) : 1;

    // Use live position if dragging, otherwise calculate from dates
    const leftPercent = livePosition ? livePosition.left : (startOffset / totalDays) * 100;
    const widthPercent = livePosition ? livePosition.width : (duration / totalDays) * 100;

    const isCompleted = optimisticSubtask.status === 'COMPLETED';


    const canEdit = useMemo(() => {
        if (!currentUser || !permissions || !projectId) return false;

        const isWorkspaceAdmin = permissions.isWorkspaceAdmin;
        const isProjectManager = (permissions.managedProjectIds || []).includes(projectId);
        const isProjectLead = (permissions.leadProjectIds || []).includes(projectId);
        const isCreator = optimisticSubtask.createdById === currentUser.id;
        const isAssignee = optimisticSubtask.assignee?.id === currentUser.id;
        const assigneeRole = (optimisticSubtask as any).assigneeRole;

        // 1. Hierarchy Rules (Strict)
        // If task is assigned to a PM, only Workspace Admin can edit/move it
        if (assigneeRole === "PROJECT_MANAGER") {
            return isWorkspaceAdmin;
        }
        // If task is assigned to a Lead, only Admin or PM can edit/move it
        if (assigneeRole === "LEAD") {
            return isWorkspaceAdmin || isProjectManager;
        }

        if (isWorkspaceAdmin || isProjectManager) return true;

        if (isProjectLead && isCreator) return true;

        return false;
    }, [currentUser, permissions, projectId, optimisticSubtask.createdById, optimisticSubtask.assignee, (optimisticSubtask as any).assigneeRole]);

    const handleBarMouseDown = (e: React.MouseEvent) => {
        if (!canEdit || isResizing || !startDate) return;

        e.preventDefault();
        setIsDragging(true);
        setDragStart({ x: e.clientX, date: startDate });
    };

    const handleResizeRightMouseDown = (e: React.MouseEvent) => {
        if (!canEdit || !endDate) return;

        e.stopPropagation();
        e.preventDefault();
        setIsResizing(true);
        setResizeEdge('right');
        setDragStart({ x: e.clientX, date: endDate });
    };

    // Handle resize drag from left edge (change start date)
    const handleResizeLeftMouseDown = (e: React.MouseEvent) => {
        if (!canEdit || !startDate) return;

        e.stopPropagation();
        e.preventDefault();
        setIsResizing(true);
        setResizeEdge('left');
        setDragStart({ x: e.clientX, date: startDate });
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging && !isResizing) return;
            if (!containerRef.current) return;

            const container = containerRef.current.parentElement;
            if (!container) return;

            const containerRect = container.getBoundingClientRect();
            const deltaX = e.clientX - dragStart.x;
            const pixelsPerDay = containerRect.width / totalDays;
            const daysDelta = Math.round(deltaX / pixelsPerDay);

            if (isDragging) {
                // Calculate new position as percentage for live visual feedback
                const originalLeft = (startOffset / totalDays) * 100;
                const deltaPercent = (daysDelta / totalDays) * 100;
                const newLeft = Math.max(0, Math.min(100 - widthPercent, originalLeft + deltaPercent));

                // Update live position for immediate visual feedback
                setLivePosition({
                    left: newLeft,
                    width: widthPercent
                });
            } else if (isResizing) {
                if (resizeEdge === 'right') {
                    // Resizing from right edge - change width only
                    const originalWidth = (duration / totalDays) * 100;
                    const deltaPercent = (daysDelta / totalDays) * 100;
                    const newWidth = Math.max(2, originalWidth + deltaPercent); // Minimum 2% width

                    setLivePosition({
                        left: leftPercent,
                        width: newWidth
                    });
                } else if (resizeEdge === 'left') {
                    // Resizing from left edge - change both left position and width
                    const originalLeft = (startOffset / totalDays) * 100;
                    const originalWidth = (duration / totalDays) * 100;
                    const deltaPercent = (daysDelta / totalDays) * 100;

                    const newLeft = Math.max(0, originalLeft + deltaPercent);
                    const newWidth = Math.max(2, originalWidth - deltaPercent); // Width decreases when left moves right

                    setLivePosition({
                        left: newLeft,
                        width: newWidth
                    });
                }
            }
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (!isDragging && !isResizing) return;
            if (!containerRef.current || !workspaceId || !projectId) return;
            // Ensure end date exists for calculations
            if (!endDate) return;

            const container = containerRef.current.parentElement;
            if (!container) return;

            const containerRect = container.getBoundingClientRect();
            const deltaX = e.clientX - dragStart.x;
            const pixelsPerDay = containerRect.width / totalDays;
            const daysDelta = Math.round(deltaX / pixelsPerDay);

            if (isDragging && daysDelta !== 0) {
                const dragBaseDate = dragStart.date;
                if (!dragBaseDate || !endDate) return;

                const newStartDate = new Date(dragBaseDate);
                newStartDate.setDate(newStartDate.getDate() + daysDelta);

                const newEndDate = new Date(endDate);
                newEndDate.setDate(newEndDate.getDate() + daysDelta);

                const startStr = formatDateForAPI(newStartDate, 'start');
                const endStr = formatDateForAPI(newEndDate, 'end');

                setOptimisticSubtask(prev => ({
                    ...prev,
                    start: startStr,
                    end: endStr
                }));

                // Inform parent about the update for sidebar sync
                onUpdate?.(subtask.id, {
                    start: startStr,
                    end: endStr
                });

                setIsPendingUpdate(true);
                const toastId = toast.loading("Updating task dates...");
                startTransition(async () => {
                    const result = await updateSubtaskDates(
                        subtask.id,
                        startStr,
                        endStr,
                        projectId,
                        workspaceId
                    );

                    if (result.status !== "success") {
                        toast.error(result.message, { id: toastId });
                        setOptimisticSubtask(subtask);
                        setIsPendingUpdate(false);
                        setLivePosition(null);
                    } else {
                        toast.success("Task dates updated", { id: toastId });
                    }
                });
            } else if (isResizing && daysDelta !== 0) {
                if (resizeEdge === 'right') {
                    if (!startDate || !dragStart.date) return;

                    const newEndDate = new Date(dragStart.date);
                    newEndDate.setDate(newEndDate.getDate() + daysDelta);

                    const endStr = formatDateForAPI(newEndDate, 'end');
                    const startStr = formatDateForAPI(startDate, 'start');

                    if (newEndDate > startDate) {
                        setOptimisticSubtask(prev => ({
                            ...prev,
                            end: endStr
                        }));

                        // Inform parent for sidebar sync
                        onUpdate?.(subtask.id, {
                            end: endStr
                        });

                        setIsPendingUpdate(true);
                        const toastId = toast.loading("Updating task duration...");
                        startTransition(async () => {
                            const result = await updateSubtaskDates(
                                subtask.id,
                                startStr,
                                endStr,
                                projectId,
                                workspaceId
                            );

                            if (result.status !== "success") {
                                toast.error(result.message, { id: toastId });
                                setOptimisticSubtask(subtask);
                                setIsPendingUpdate(false);
                                setLivePosition(null);
                            } else {
                                toast.success("Task duration updated", { id: toastId });
                            }
                        });
                    }
                } else if (resizeEdge === 'left') {
                    if (!endDate || !dragStart.date) return;

                    const newStartDate = new Date(dragStart.date);
                    newStartDate.setDate(newStartDate.getDate() + daysDelta);

                    const startStr = formatDateForAPI(newStartDate, 'start');
                    const endStr = formatDateForAPI(endDate, 'end');

                    if (newStartDate < endDate) {
                        setOptimisticSubtask(prev => ({
                            ...prev,
                            start: startStr
                        }));

                        // Inform parent for sidebar sync
                        onUpdate?.(subtask.id, {
                            start: startStr
                        });

                        setIsPendingUpdate(true);
                        const toastId = toast.loading("Updating task start date...");
                        startTransition(async () => {
                            const result = await updateSubtaskDates(
                                subtask.id,
                                startStr,
                                endStr,
                                projectId,
                                workspaceId
                            );

                            if (result.status !== "success") {
                                toast.error(result.message, { id: toastId });
                                setOptimisticSubtask(subtask);
                                setIsPendingUpdate(false);
                                setLivePosition(null);
                            } else {
                                toast.success("Task start date updated", { id: toastId });
                            }
                        });
                    }
                }
            } else {
                setLivePosition(null);
            }

            setIsDragging(false);
            setIsResizing(false);
            setResizeEdge(null);
        };

        if (isDragging || isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = isDragging ? 'grabbing' : 'ew-resize';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
        };
    }, [isDragging, isResizing, resizeEdge, dragStart, subtask.id, startDate, endDate, totalDays, workspaceId, projectId, startOffset, duration, widthPercent, leftPercent]);

    // Reset live position when subtask data changes (after server update)
    // Adjusting state during rendering to avoid useEffect cascading updates
    const [prevDates, setPrevDates] = useState({ start: optimisticSubtask.start, end: optimisticSubtask.end });

    if (!isDragging && !isResizing) {
        const datesChanged =
            prevDates.start !== optimisticSubtask.start ||
            prevDates.end !== optimisticSubtask.end;

        if (datesChanged) {
            setPrevDates({ start: optimisticSubtask.start, end: optimisticSubtask.end });
            setLivePosition(null);
        }
    }

    return (
        <div ref={containerRef} className="h-6 relative w-full group/bar">
            <TooltipProvider delayDuration={100}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div
                            ref={barRef}
                            className={cn(
                                "absolute top-1 h-3 rounded-md transition-all duration-200 ease-out",
                                "shadow-sm hover:shadow-md",
                                "focus:outline-none focus:ring-2 focus:ring-offset-1",
                                (!optimisticSubtask.assignee?.id && optimisticSubtask.status !== "COMPLETED" && optimisticSubtask.status !== "CANCELLED") && "animate-[pulse_2s_infinite] ring-2 ring-red-500/50 shadow-[0_0_8px_rgba(239,68,68,0.4)]",
                                canEdit && "cursor-grab active:cursor-grabbing",
                                isDragging && "opacity-70 scale-105",
                                // Status-based colors
                                ({
                                    'TO_DO': "bg-slate-400 dark:bg-slate-500 hover:bg-slate-500 dark:hover:bg-slate-600 focus:ring-slate-500",
                                    'IN_PROGRESS': "bg-blue-400 dark:bg-blue-500 hover:bg-blue-500 dark:hover:bg-blue-600 focus:ring-blue-500",
                                    'CANCELLED': "bg-red-400 dark:bg-red-500 hover:bg-red-500 dark:hover:bg-red-600 focus:ring-red-500",
                                    'REVIEW': "bg-amber-400 dark:bg-amber-500 hover:bg-amber-500 dark:hover:bg-amber-600 focus:ring-amber-500",
                                    'HOLD': "bg-purple-400 dark:bg-purple-500 hover:bg-purple-500 dark:hover:bg-purple-600 focus:ring-purple-500",
                                    'COMPLETED': "bg-green-400 dark:bg-green-500 hover:bg-green-500 dark:hover:bg-green-600 focus:ring-green-500"
                                }[optimisticSubtask.status || 'TO_DO'] || "bg-slate-400 dark:bg-slate-500 hover:bg-slate-500 dark:hover:bg-slate-600 focus:ring-slate-500"
                                )
                            )}
                            style={{
                                left: `${leftPercent}%`,
                                width: `${widthPercent}%`,
                                minWidth: '20px'
                            }}
                            onMouseDown={handleBarMouseDown}
                            tabIndex={0}
                            role="button"
                            aria-label={`${optimisticSubtask.name}: ${startDate ? formatDate(startDate) : 'N/A'} to ${endDate ? formatDate(endDate) : 'N/A'}`}
                        >
                            {/* Resize handles */}
                            {canEdit && (
                                <>
                                    {/* Left resize handle */}
                                    <div
                                        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover/bar:opacity-100 hover:bg-white/30 rounded-l-md"
                                        onMouseDown={handleResizeLeftMouseDown}
                                        title="Drag to change start date"
                                    >
                                        <GripHorizontal className="h-full w-full text-white/50" />
                                    </div>

                                    {/* Right resize handle */}
                                    <div
                                        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover/bar:opacity-100 hover:bg-white/30 rounded-r-md"
                                        onMouseDown={handleResizeRightMouseDown}
                                        title="Drag to change end date"
                                    >
                                        <GripHorizontal className="h-full w-full text-white/50" />
                                    </div>
                                </>
                            )}
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-popover text-popover-foreground border shadow-lg max-w-xs">
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                                <p className="font-medium text-sm">{optimisticSubtask.name}</p>
                                {isCompleted && (
                                    <span className="px-1.5 py-0.5 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
                                        DONE
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {startDate ? formatDate(startDate) : 'N/A'} — {endDate ? formatDate(endDate) : 'N/A'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {duration} days
                            </p>
                            {canEdit && (
                                <p className="text-xs text-blue-600 dark:text-blue-400 pt-1 border-t">
                                    💡 Drag to move • Drag edge to resize
                                </p>
                            )}


                        </div>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div >
    );
}
