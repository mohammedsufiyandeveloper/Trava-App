"use client";

import { useState, memo } from "react";
import { useRemainingDays } from "@/hooks/use-due-date";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CornerDownRight, GripVertical, Calendar, Tag, MoreHorizontal } from "lucide-react";
import type { SubTaskType } from "@/data/task";
import type { ProjectMembersType } from "@/data/project/get-project-members";
import { getStatusColors, getStatusLabel } from "@/lib/colors/status-colors";
import { Badge } from "@/components/ui/badge";
import { cn, formatDateUTC } from "@/lib/utils";
import { EditSubTaskForm } from "@/app/w/[workspaceId]/p/[slug]/_components/forms/edit-subtask-form";
import { DeleteSubTaskForm } from "@/app/w/[workspaceId]/p/[slug]/_components/forms/delete-subtask-form";
import { InlineSubTaskForm } from "./inline-subtask-form";
import { ColumnVisibility } from "../shared/column-visibility";
import { InlineAssigneePicker } from "../shared/inline-assignee-picker";
import type { UserPermissionsType } from "@/data/user/get-user-permissions";

interface SubTaskRowProps {
    subTask: SubTaskType;
    columnVisibility: ColumnVisibility;
    onClick?: (subTask: SubTaskType) => void;
    members: ProjectMembersType;
    projectId: string;
    parentTaskId: string;
    parentTaskProject?: { id: string; name: string; color?: string; } | null;
    onSubTaskUpdated?: (subTaskId: string, updatedData: Partial<SubTaskType>) => void;
    onSubTaskDeleted?: (subTaskId: string) => void;
    tags?: { id: string; name: string; }[];
    isSelected?: boolean;
    onSelectChange?: (checked: boolean) => void;
    permissions?: UserPermissionsType;
    userId?: string;
    isWorkspaceAdmin?: boolean;
    leadProjectIds?: string[];
    projects?: Array<{ id: string; canManageMembers?: boolean; memberIds?: string[] }>; // For workspace view
}

export const SubTaskRow = memo(function SubTaskRow({
    subTask,
    columnVisibility,
    onClick,
    members,
    projectId,
    parentTaskId,
    onSubTaskUpdated,
    onSubTaskDeleted,
    tags = [],
    permissions,
    userId,
    isWorkspaceAdmin,
    leadProjectIds,
    projects,
}: SubTaskRowProps) {
    const [isUpdating, setIsUpdating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);

    const canEditSubTask = () => {
        const subTaskCreatorId = subTask.createdBy?.workspaceMember?.user?.id || (subTask as any).createdById;

        if (permissions) {
            return permissions.isWorkspaceAdmin ||
                permissions.isProjectManager ||
                (permissions.isProjectLead && subTaskCreatorId === userId);
        }

        if (isWorkspaceAdmin) return true;

        const projectIdToCheck = (subTask as any).projectId || projectId;

        const taskProject = projects?.find(p => p.id === projectIdToCheck);
        if (taskProject?.canManageMembers) return true;

        // Check if user is LEAD in this project and created the task
        if (leadProjectIds?.includes(projectIdToCheck) && subTaskCreatorId === userId) {
            return true;
        }

        return false;
    };

    const handleSubTaskUpdated = (updatedData: Partial<SubTaskType>) => {
        if (onSubTaskUpdated) {
            onSubTaskUpdated(subTask.id, updatedData);
        }
    };

    const assigneeUser = (subTask.assignee as any)?.workspaceMember?.user;
    const reviewerUser = (subTask.reviewer as any)?.workspaceMember?.user;
    // Use custom hooks for date calculations
    // Use custom hook for remaining days calculation, passing persisted dueDate if available
    const { remainingDays, isOverdue, dueDate } = useRemainingDays(subTask.startDate, subTask.days, subTask.dueDate);

    const getProgressColor = () => {
        if (remainingDays === null) return "bg-gray-300";

        // Color based on absolute days remaining, not percentage
        if (isOverdue) return "bg-red-500";           // Overdue
        if (remainingDays <= 10) return "bg-red-500";  // 10 days or less - Critical
        if (remainingDays <= 20) return "bg-orange-500"; // 11-20 days - Warning
        if (remainingDays <= 30) return "bg-yellow-500"; // 21-30 days - Caution
        return "bg-green-500";                         // More than 30 days - Good
    };

    const progressColor = getProgressColor();

    if (isUpdating) {
        return (
            <TableRow className="bg-muted/10">
                <TableCell className="pl-4">
                    <Skeleton className="h-4 w-4" />
                </TableCell>
                <TableCell className="pl-4">
                    <Skeleton className="h-4 w-full max-w-xs" />
                </TableCell>
                {columnVisibility.project && (
                    <TableCell>
                        <Skeleton className="h-5 w-24" />
                    </TableCell>
                )}
                {columnVisibility.description && (
                    <TableCell>
                        <Skeleton className="h-4 w-full max-w-md" />
                    </TableCell>
                )}
                {columnVisibility.assignee && (
                    <TableCell>
                        <Skeleton className="h-8 w-8 rounded-full" />
                    </TableCell>
                )}
                {columnVisibility.status && (
                    <TableCell>
                        <Skeleton className="h-6 w-24" />
                    </TableCell>
                )}
                {columnVisibility.tag && (
                    <TableCell>
                        <Skeleton className="h-5 w-20" />
                    </TableCell>
                )}
                {columnVisibility.startDate && (
                    <TableCell>
                        <Skeleton className="h-4 w-24" />
                    </TableCell>
                )}
                {columnVisibility.dueDate && (
                    <TableCell>
                        <Skeleton className="h-4 w-24" />
                    </TableCell>
                )}
                {columnVisibility.progress && (
                    <TableCell>
                        <Skeleton className="h-2 w-full" />
                    </TableCell>
                )}
                <TableCell>
                    <Skeleton className="h-7 w-7" />
                </TableCell>
            </TableRow>
        );
    }

    // Show inline edit form when editing
    if (isEditing) {
        return (
            <InlineSubTaskForm
                mode="edit"
                subTask={subTask}
                workspaceId="" // Not needed for edit mode
                projectId={projectId}
                parentTaskId={parentTaskId}
                members={members}
                tags={tags}
                columnVisibility={columnVisibility}
                onCancel={() => setIsEditing(false)}
                onSubTaskUpdated={(subTaskId, updatedData) => {
                    handleSubTaskUpdated(updatedData);
                    setIsEditing(false);
                }}
            />
        );
    }

    return (
        <>
            <TableRow
                className={cn(
                    "h-8 [&_td]:py-2 transition-colors",
                    (!assigneeUser && subTask.status !== "COMPLETED" && subTask.status !== "CANCELLED") 
                        ? "bg-red-500/10 hover:bg-red-500/20 animate-[pulse_2s_infinite] border-y border-red-500/40" 
                        : "bg-muted/10 hover:bg-muted/20",
                    (subTask as any).isOptimistic && "opacity-60 grayscale-[0.5]"
                )}
            >
                <TableCell className="pl-4 sm:pl-4 w-[60px] md:w-[80px]">
                    <div className="flex items-center">
                        <div className="w-3 shrink-0" />
                        <div className="h-6 w-6 flex items-center justify-center shrink-0">
                            <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                        </div>
                    </div>
                </TableCell>

                <TableCell className="w-[180px] sm:w-[250px] md:w-[350px]">
                    <span
                        className="truncate text-muted-foreground text-sm block cursor-pointer hover:text-foreground transition-colors"
                        onMouseEnter={() => {
                            // 🚀 Cache check (No DB hit for prefetching)
                            if (subTask.id) {
                                import("@/app/w/[workspaceId]/p/[slug]/_components/shared/subtaskSheet/subtask-details-sheet").then(m => {
                                    if (m.commentCache.has(subTask.id)) {
                                        console.log(`✨ [CACHE-HIT] Subtask ${subTask.id} ready.`);
                                    }
                                });
                            }
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onClick) onClick(subTask);
                        }}
                    >
                        {subTask.name}
                    </span>
                </TableCell>

                {/* Project column removed */}

                {columnVisibility.description && (
                    <TableCell className="w-[150px] sm:w-[200px]">
                        <span
                            className="truncate text-muted-foreground text-sm block"
                            title={(subTask as any).description}
                        >
                            {(subTask as any).description || "-"}
                        </span>
                    </TableCell>
                )}

                {columnVisibility.assignee && (
                    <TableCell className="w-[80px] sm:w-[100px]">
                        {assigneeUser ? (
                            <div className="flex items-center gap-2 min-w-0">
                                <Avatar className="h-5 w-5 flex-shrink-0">
                                    <AvatarFallback className="text-[10px]">{assigneeUser.surname?.[0]}</AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-muted-foreground truncate">
                                    {assigneeUser.surname}
                                </span>
                            </div>
                        ) : (
                            <InlineAssigneePicker
                                subTask={subTask as any}
                                members={members}
                                allowedUserIds={projects?.find(p => p.id === ((subTask as any).projectId || projectId))?.memberIds}
                                projectId={(subTask as any).projectId || projectId}
                                parentTaskId={subTask.parentTaskId || parentTaskId}
                                canEdit={canEditSubTask()}
                                onAssigned={(_userId, member) => {
                                    handleSubTaskUpdated({
                                        assignee: {
                                            WorkspaceMember: {
                                                user: {
                                                    id: member.userId,
                                                    surname: member.user.surname,
                                                }
                                            }
                                        } as any,
                                    });
                                }}
                            />
                        )}
                    </TableCell>
                )}

                {columnVisibility.reviewer && (
                    <TableCell className="w-[80px] sm:w-[100px]">
                        {reviewerUser ? (
                            <div className="flex items-center gap-2 min-w-0">
                                <Avatar className="h-5 w-5 flex-shrink-0">
                                    <AvatarFallback className="text-[10px]">{reviewerUser.surname?.[0] || reviewerUser.name?.[0]}</AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-muted-foreground truncate">
                                    {reviewerUser.surname || reviewerUser.name}
                                </span>
                            </div>
                        ) : (
                            <span className="text-xs text-muted-foreground text-center block">-</span>
                        )}
                    </TableCell>
                )}

                {columnVisibility.status && (
                    <TableCell className="w-[90px] sm:w-[120px]">
                        {subTask.status ? (
                            <Badge
                                variant="outline"
                                className={cn(
                                    "text-[10px] sm:text-xs font-medium h-5 px-1.5 flex items-center justify-center whitespace-nowrap",
                                    getStatusColors(subTask.status).color,
                                    getStatusColors(subTask.status).bgColor,
                                    getStatusColors(subTask.status).borderColor
                                )}
                            >
                                {getStatusLabel(subTask.status)}
                            </Badge>
                        ) : (
                            <span className="text-muted-foreground text-xs text-center block">-</span>
                        )}
                    </TableCell>
                )}

                {columnVisibility.startDate && (
                    <TableCell className="w-[90px] sm:w-[120px]">
                        {subTask.startDate ? (
                            <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3 flex-shrink-0 hidden xs:block" />
                                <span className="truncate">{formatDateUTC(subTask.startDate)}</span>
                            </div>
                        ) : (
                            <span className="text-muted-foreground text-xs text-center block">-</span>
                        )}
                    </TableCell>
                )}

                {columnVisibility.dueDate && (
                    <TableCell className="w-[90px] sm:w-[120px]">
                        {dueDate ? (
                            <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs font-medium">
                                <Calendar className="h-3 w-3 flex-shrink-0 hidden xs:block" />
                                <span className="truncate">{formatDateUTC(dueDate)}</span>
                            </div>
                        ) : (
                            <span className="text-muted-foreground text-xs text-center block">-</span>
                        )}
                    </TableCell>
                )}

                {columnVisibility.progress && (
                    <TableCell className="w-[100px] sm:w-[150px]">
                        {remainingDays !== null ? (
                            <div className="flex items-center gap-2 min-w-0">
                                <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${progressColor}`} />
                                <span className="text-[10px] sm:text-xs text-muted-foreground truncate">
                                    {remainingDays > 0
                                        ? `${remainingDays}d left`
                                        : remainingDays === 0
                                            ? 'Due today'
                                            : `${Math.abs(remainingDays)}d late`
                                    }
                                </span>
                            </div>
                        ) : (
                            <span className="text-muted-foreground text-xs text-center block">-</span>
                        )}
                    </TableCell>
                )}

                {columnVisibility.tag && (
                    <TableCell className="w-[100px] sm:w-[120px]">
                        {subTask.tag ? (() => {
                            // 1. Try to use the pre-fetched name directly (Fast & Bandwidth-efficient)
                            const directName = typeof subTask.tag === 'object' ? (subTask.tag as any).name : null;

                            // 2. Fallback to lookup by ID if name is missing
                            const tagId = typeof subTask.tag === 'string' ? subTask.tag : (subTask.tag as any)?.id;
                            const tagFromLookup = tags.find(t => t.id === (tagId || subTask.tagId));

                            const tagName = directName || tagFromLookup?.name;

                            if (tagName) {
                                return (
                                    <div className="flex items-center gap-1 min-w-0">
                                        <Tag className="size-3 flex-shrink-0 hidden xs:block" />
                                        <span className="text-[10px] sm:text-xs text-muted-foreground truncate">{tagName}</span>
                                    </div>
                                );
                            }

                            return <span className="text-muted-foreground text-xs text-center block">-</span>;
                        })() : (
                            <span className="text-muted-foreground text-xs text-center block">-</span>
                        )}
                    </TableCell>
                )}

                <TableCell>
                    {canEditSubTask() && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                    <MoreHorizontal className="h-2 w-2" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                                    Edit SubTask
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onSelect={() => setDeleteOpen(true)}>
                                    Delete SubTask
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </TableCell>
            </TableRow>

            {/* Render Dialog components OUTSIDE of DropdownMenu completely! */}
            {editOpen && (
                <EditSubTaskForm
                    subTask={subTask as any}
                    tags={tags}
                    members={members}
                    projectId={(subTask as any).projectId || projectId}
                    parentTaskId={subTask.parentTaskId || parentTaskId}
                    onSubTaskUpdated={handleSubTaskUpdated}
                    open={editOpen}
                    onOpenChange={setEditOpen}
                />
            )}
            {deleteOpen && (
                <DeleteSubTaskForm
                    subTask={subTask}
                    onSubTaskDeleted={onSubTaskDeleted}
                    open={deleteOpen}
                    onOpenChange={setDeleteOpen}
                />
            )}
        </>
    );
});
