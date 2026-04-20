"use client";

import React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getStatusColors, getStatusLabel } from "@/lib/colors/status-colors";
import { formatDate } from "@/components/task/gantt/utils";
import { ColumnVisibility } from "../../shared/column-visibility";
import { cn } from "@/lib/utils";
import { useRemainingDays } from "@/hooks/use-due-date";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface SortedTaskRowProps {
    task: any;
    columnVisibility: ColumnVisibility;
    onClick?: () => void;
}

/**
 * SortedTaskRow - Renders a flat task row for sorted view
 * 
 * This component displays a single task in the sorted view with:
 * - Task name
 * - Parent task context (if available)
 * - All standard columns (assignee, reviewer, status, dates, etc.)
 * 
 * NO nesting, NO indentation, NO expand/collapse
 */
export const SortedTaskRow = React.memo(function SortedTaskRow({ task, columnVisibility, onClick }: SortedTaskRowProps) {
    const statusColors = getStatusColors(task.status);
    const { remainingDays, isOverdue, dueDate } = useRemainingDays(task.startDate, task.days);

    const getProgressColor = () => {
        if (remainingDays === null) return "bg-gray-300";

        if (isOverdue) return "bg-red-500";
        if (remainingDays <= 10) return "bg-red-500";
        if (remainingDays <= 20) return "bg-orange-500";
        if (remainingDays <= 30) return "bg-yellow-500";
        return "bg-green-500";
    };

    const progressColor = getProgressColor();

    const assigneeUser = (task.assignee as any)?.workspaceMember?.user;
    const reviewerUser = (task.reviewer as any)?.workspaceMember?.user;

    return (
        <TableRow
            className="hover:bg-muted/50 cursor-pointer transition-colors"
            onClick={onClick}
        >
            {/* Empty cell for expand/collapse column */}
            <TableCell className="w-[40px] md:w-[50px]" />

            {/* Task Name with Parent Context */}
            <TableCell className="w-[180px] sm:w-[250px] md:w-[350px]">
                <div className="space-y-1 max-w-[230px]">
                    <div
                        className="font-medium text-foreground truncate hover:underline"
                        title={task.name}
                        onMouseEnter={() => {
                            import("@/app/w/[workspaceId]/p/[slug]/_components/shared/subtaskSheet/subtask-details-sheet").then(m => {
                                m.prefetchSubTask(task.id);
                            });
                        }}
                    >
                        {task.name}
                    </div>
                    {task.parentTask && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <span className="flex-shrink-0">↳ Parent:</span>
                            <span className="font-medium truncate" title={task.parentTask.name}>
                                {task.parentTask.name}
                            </span>
                        </div>
                    )}
                </div>
            </TableCell>

            {/* Description */}
            {columnVisibility.description && (
                <TableCell className="w-[150px] sm:w-[200px]">
                    <div className="text-sm text-muted-foreground truncate max-w-[180px]">
                        {task.description || "-"}
                    </div>
                </TableCell>
            )}

            {/* Assignee */}
            {columnVisibility.assignee && (
                <TableCell className="w-[80px] sm:w-[100px]">
                    {assigneeUser ? (
                        <div className="flex items-center gap-2 min-w-0">
                            <Avatar className="h-5 w-5 flex-shrink-0">
                                <AvatarFallback className="text-[10px]">{assigneeUser.surname?.[0] || assigneeUser.name?.[0]}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm truncate">
                                {assigneeUser.surname || assigneeUser.name}
                            </span>
                        </div>
                    ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                    )}
                </TableCell>
            )}

            {/* Reviewer */}
            {columnVisibility.reviewer && (
                <TableCell className="w-[80px] sm:w-[100px]">
                    {reviewerUser ? (
                        <div className="flex items-center gap-2 min-w-0">
                            <Avatar className="h-5 w-5 flex-shrink-0">
                                <AvatarFallback className="text-[10px]">{reviewerUser.surname?.[0] || reviewerUser.name?.[0]}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm truncate">
                                {reviewerUser.surname || reviewerUser.name}
                            </span>
                        </div>
                    ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                    )}
                </TableCell>
            )}

            {/* Status */}
            {columnVisibility.status && (
                <TableCell className="w-[90px] sm:w-[120px]">
                    <Badge
                        variant="outline"
                        className={cn(
                            "text-xs font-medium border",
                            statusColors.color,
                            statusColors.bgColor,
                            statusColors.borderColor
                        )}
                    >
                        {getStatusLabel(task.status)}
                    </Badge>
                </TableCell>
            )}

            {/* Start Date */}
            {columnVisibility.startDate && (
                <TableCell className="w-[90px] sm:w-[120px]">
                    <div className="text-sm">
                        {task.startDate ? formatDate(new Date(task.startDate)) : "-"}
                    </div>
                </TableCell>
            )}

            {/* Due Date */}
            {columnVisibility.dueDate && (
                <TableCell className="w-[90px] sm:w-[120px]">
                    <div className="text-sm">
                        {task.startDate && task.days
                            ? formatDate(
                                new Date(
                                    new Date(task.startDate).getTime() + task.days * 24 * 60 * 60 * 1000
                                )
                            )
                            : "-"}
                    </div>
                </TableCell>
            )}

            {/* Progress */}
            {columnVisibility.progress && (
                <TableCell className="w-[100px] sm:w-[150px]">
                    {remainingDays !== null ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex items-center gap-2 min-w-0 cursor-help">
                                    <div className={cn("h-3 w-3 rounded-full flex-shrink-0", progressColor)} />
                                    <div className="text-sm truncate">
                                        {remainingDays > 0
                                            ? `${remainingDays} day${remainingDays !== 1 ? 's' : ''} left`
                                            : remainingDays === 0
                                                ? 'Due today'
                                                : `${Math.abs(remainingDays)} day${Math.abs(remainingDays) !== 1 ? 's' : ''} delayed`
                                        }
                                    </div>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <div className="space-y-1 text-xs">
                                    <div className="font-semibold">Deadline Details</div>
                                    <div>Start: {task.startDate ? formatDate(new Date(task.startDate)) : "N/A"}</div>
                                    <div>Duration: {task.days || 0} days</div>
                                    <div>Due: {dueDate ? formatDate(dueDate) : "N/A"}</div>
                                    <div>Status: {getStatusLabel(task.status)}</div>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    ) : (
                        <div className="text-sm">
                            {task.days ? `${task.days} days` : "-"}
                        </div>
                    )}
                </TableCell>
            )}

            {/* Tag */}
            {columnVisibility.tag && (
                <TableCell className="w-[100px] sm:w-[120px]">
                    {task.tag ? (
                        <Badge variant="secondary" className="text-xs">
                            {task.tag.name}
                        </Badge>
                    ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                    )}
                </TableCell>
            )}

            {/* Actions column (empty for now) */}
            <TableCell className="w-[40px]" />
        </TableRow>
    );
});
