"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronRight, CornerDownRight } from "lucide-react";
import { computeTaskDates, calculateBarPosition, formatDateRange, getDaysBetween } from "./utils";
import { SortableSubtaskList } from "./sortable-subtask-list";
import { ProjectMembersType } from "@/data/project/get-project-members";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { GanttSubtask, GanttTask } from "./types";
import { InlineAssigneePicker } from "../shared/inline-assignee-picker";

// ...
// ... (imports)

const SUBTASKS_PER_PAGE = 50;

interface TaskRowProps {
    task: GanttTask;
    timelineStart: Date;
    totalDays: number;
    isExpanded: boolean;
    onToggle: () => void;
    onSubtaskClick?: (subtaskId: string) => void;
    onSubTaskUpdate?: (subTaskId: string, data: Partial<any>) => void;
    allTasks?: GanttTask[]; // All tasks for dependency picker
    workspaceId?: string;
    projectId?: string;
    members?: ProjectMembersType;
    isNestedInProject?: boolean;
    currentUser?: { id: string };
    permissions?: {
        isWorkspaceAdmin: boolean;
        leadProjectIds: string[];
        managedProjectIds: string[];
    };
    showDetails: boolean;
    projects?: { id: string; memberIds?: string[] }[];
    granularity: 'days' | 'weeks' | 'months';
}

export function TaskRow({
    task,
    timelineStart,
    totalDays,
    isExpanded,
    onToggle,
    onSubtaskClick,
    onSubTaskUpdate,
    allTasks,
    workspaceId,
    projectId,
    members,
    isNestedInProject = false,
    currentUser,
    permissions,
    showDetails,
    projects,
    granularity
}: TaskRowProps) {

    const [visibleSubtaskCount, setVisibleSubtaskCount] = useState(SUBTASKS_PER_PAGE);

    const { start, end } = useMemo(() => computeTaskDates(task), [task]);

    const position = useMemo(() => {
        if (!start || !end) return null;
        return calculateBarPosition(start, end, timelineStart, totalDays);
    }, [start, end, timelineStart, totalDays]);

    const hasSubtasks = task.subtasks && task.subtasks.length > 0;



    // Handle load more subtasks
    const handleLoadMoreSubtasks = () => {
        setVisibleSubtaskCount(prev => Math.min(prev + SUBTASKS_PER_PAGE, task.subtasks.length));
    };

    // Get visible subtasks
    const visibleSubtasks = task.subtasks.slice(0, visibleSubtaskCount);
    const hasMoreSubtasks = visibleSubtaskCount < task.subtasks.length;

    // Auto-scroll trigger for subtasks
    const subtaskLoaderRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!subtaskLoaderRef.current) return;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && hasMoreSubtasks) {
                handleLoadMoreSubtasks();
            }
        }, { threshold: 0.1 });
        observer.observe(subtaskLoaderRef.current);
        return () => observer.disconnect();
    }, [hasMoreSubtasks]);

    const currentProject = projects?.find(p => p.id === (task.projectId || projectId));
    const allowedUserIds = currentProject?.memberIds;

    return (
        <div className="flex flex-col">
            {/* Task Row Header */}
            <div
                className="grid"
                style={{ gridTemplateColumns: 'var(--gantt-sidebar-width) var(--gantt-total-width)' }}
            >
                {/* Left Panel - Task Name (Aligns with columns but hides details for parent) */}
                {/* 1-2. Sidebar + Metadata (Transitioned width) */}
                <div
                    className="sticky left-0 z-30 flex items-center bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-700 h-full w-[var(--gantt-sidebar-width)] min-w-[var(--gantt-sidebar-width)] shrink-0 transition-[width] duration-300 ease-in-out overflow-hidden"
                >
                    {/* 1. Task Name Column */}
                    <div className={cn(
                        "w-[var(--col-name)] flex items-center gap-1 px-3 py-2 min-h-[36px] shrink-0 border-r border-neutral-200 dark:border-neutral-700 h-full",
                        isNestedInProject && "pl-6"
                    )}>
                        <button
                            onClick={onToggle}
                            className={cn(
                                "p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700",
                                "transition-colors duration-150",
                                !hasSubtasks && "invisible"
                            )}
                            aria-expanded={isExpanded}
                            aria-label={isExpanded ? "Collapse" : "Expand"}
                        >
                            {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                        </button>
                        <span className="font-semibold text-sm text-foreground truncate">
                            {task.name}
                        </span>
                        {hasSubtasks && (
                            <span className="text-xs text-muted-foreground ml-auto bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded-full">
                                {task.subtasks.length}
                            </span>
                        )}
                    </div>

                    {/* 2-5. Detail Columns for Parent Task */}
                    {showDetails && (
                        <>
                            {/* 2. Assignee Column */}
                            <div className="w-[var(--col-assignee)] shrink-0 border-r border-neutral-200 dark:border-neutral-700 h-full px-2" />
                            <div className="w-[var(--col-status)] shrink-0 border-r border-neutral-200 dark:border-neutral-700 h-full px-2 bg-neutral-50/10 dark:bg-neutral-800/5" />
                            <div className="w-[var(--col-days)] shrink-0 border-r border-neutral-200 dark:border-neutral-700 h-full px-2 bg-neutral-50/10 dark:bg-neutral-800/5" />
                            <div className="w-[var(--col-dates)] shrink-0 h-full px-2 bg-neutral-50/10 dark:bg-neutral-800/5" />
                        </>
                    )}
                </div>

                {/* Right Panel - Task Bar */}
                <div
                    className={cn(
                        "relative min-h-[36px] flex items-center w-full",
                        "border-b border-neutral-200 dark:border-neutral-700",
                        "hover:bg-neutral-50 dark:hover:bg-neutral-800/50",
                        "transition-colors duration-150"
                    )}
                >
                    {position ? (
                        <TooltipProvider delayDuration={100}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div
                                        className={cn(
                                            "absolute h-4 rounded-full cursor-pointer",
                                            "hover:brightness-110",
                                            "transition-all duration-200 ease-out",
                                            "shadow-md hover:shadow-lg",
                                            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                                        )}
                                        style={{
                                            left: `${position.left}%`,
                                            width: `${position.width}%`,
                                            minWidth: '12px',
                                            backgroundColor: task.projectColor,
                                            opacity: 0.5
                                        }}
                                        tabIndex={0}
                                        role="button"
                                        aria-label={`${task.name}: ${formatDateRange(start, end)}`}
                                    />
                                </TooltipTrigger>
                                <TooltipContent
                                    side="top"
                                    className="bg-popover text-popover-foreground border shadow-lg"
                                >
                                    <div className="space-y-1">
                                        <p className="font-semibold text-sm">{task.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {formatDateRange(start, end)}
                                        </p>
                                        {start && end && (
                                            <p className="text-xs text-muted-foreground">
                                                {getDaysBetween(start, end) + 1} days
                                            </p>
                                        )}
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ) : (
                        <span className="text-xs text-muted-foreground px-2">
                            No subtasks
                        </span>
                    )}
                </div>
            </div>

            {/* Subtask Rows - Sortable */}
            {isExpanded && hasSubtasks && (
                <div className="flex flex-col">
                    <SortableSubtaskList
                        subtasks={visibleSubtasks}
                        timelineStart={timelineStart}
                        totalDays={totalDays}
                        showDetails={showDetails}
                        onSubtaskClick={onSubtaskClick}
                        onSubTaskUpdate={onSubTaskUpdate}
                        workspaceId={workspaceId || ""}
                        projectId={projectId || task.projectId}
                        members={members}
                        currentUser={currentUser}
                        permissions={permissions}
                        allowedUserIds={allowedUserIds}
                        allTasks={allTasks}
                        granularity={granularity}
                    />

                    {hasMoreSubtasks && (
                        <div
                            className="grid"
                            style={{ gridTemplateColumns: 'var(--gantt-sidebar-width) var(--gantt-total-width)' }}
                        >
                            {/* Left Panel - Auto Load Trigger */}
                            <div ref={subtaskLoaderRef} className="sticky left-0 z-30 shrink-0 bg-neutral-50 dark:bg-neutral-800/30 border-b border-r border-neutral-200 dark:border-neutral-700 flex items-center px-2 py-1.5 pl-8">
                                <span className="text-xs text-muted-foreground ml-6">Loading more subtasks...</span>
                            </div>

                            {/* Right Panel - Spacer */}
                            <div
                                className="relative min-h-[32px] w-full bg-neutral-50/50 dark:bg-neutral-800/10 border-b border-neutral-200 dark:border-neutral-700"
                            />
                        </div>
                    )}
                </div>
            )}


        </div>
    );
}
