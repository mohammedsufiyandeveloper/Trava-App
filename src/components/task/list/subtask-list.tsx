"use client";

import { useState, useRef, useEffect } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProjectMembersType } from "@/data/project/get-project-members";
import type { SubTaskType } from "@/data/task";
import { ColumnVisibility } from "../shared/column-visibility";
import { SubTaskSkeleton } from "@/components/task/list/list-skeleton";
import { InlineSubTaskForm } from "./inline-subtask-form";
import { SubTaskRow } from "./subtask-row";
import type { TaskWithSubTasks } from "@/components/task/shared/types";
import type { UserPermissionsType } from "@/data/user/get-user-permissions";

interface SubTaskListProps {
    task: TaskWithSubTasks;
    members: ProjectMembersType;
    workspaceId: string;
    projectId: string;
    canCreateSubTask: boolean;
    columnVisibility: ColumnVisibility;
    isLoading: boolean;
    isLoadingMore: boolean;
    onLoadMore: () => void;
    onSubTaskClick?: (subTask: SubTaskType) => void;
    onSubTaskUpdated?: (subTaskId: string, updatedData: Partial<SubTaskType>) => void;
    onSubTaskDeleted?: (subTaskId: string) => void;
    onSubTaskCreated?: (subTask: any, tempId?: string) => void;
    selectedSubTasks?: Set<string>;
    onSelectSubTask?: (subTaskId: string, checked: boolean) => void;
    level?: "workspace" | "project";
    tags?: { id: string; name: string; }[];
    // Permission props
    permissions?: UserPermissionsType; // For project view
    userId?: string;
    isWorkspaceAdmin?: boolean; // For workspace view
    leadProjectIds?: string[]; // For workspace view
    projects?: Array<{ id: string; canManageMembers?: boolean; memberIds?: string[] }>; // For workspace view
    scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

export function SubTaskList({
    task,
    members,
    workspaceId,
    projectId,
    canCreateSubTask,
    columnVisibility,
    isLoading,
    isLoadingMore,
    onLoadMore,
    onSubTaskClick,
    onSubTaskUpdated,
    onSubTaskDeleted,
    onSubTaskCreated,
    selectedSubTasks = new Set(),
    onSelectSubTask,
    level = "project",
    tags = [],
    permissions,
    userId,
    isWorkspaceAdmin,
    leadProjectIds,
    projects,
    scrollContainerRef,
}: SubTaskListProps) {
    const [showInlineSubTaskForm, setShowInlineSubTaskForm] = useState(false);
    const bottomRef = useRef<HTMLTableRowElement>(null);
    useEffect(() => {
        if (!task.subTasksHasMore || isLoadingMore) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    onLoadMore();
                }
            },
            {
                root: scrollContainerRef?.current || null,
                rootMargin: "20px"
            }
        );

        const currentRef = bottomRef.current;
        if (currentRef) {
            observer.observe(currentRef);
        }

        return () => {
            if (currentRef) {
                observer.unobserve(currentRef);
            }
        };
    }, [task.subTasksHasMore, isLoadingMore, onLoadMore]);

    const visibleColumnsCount = 2 + Object.values(columnVisibility).filter(Boolean).length + 1;

    if (isLoading) {
        return (
            <SubTaskSkeleton columnVisibility={columnVisibility} />
        );
    }

    if (!task.subTasks || task.subTasks.length === 0) {
        return (
            <>
                {canCreateSubTask && (
                    showInlineSubTaskForm ? (
                        <InlineSubTaskForm
                            workspaceId={workspaceId}
                            projectId={projectId}
                            parentTaskId={task.id}
                            members={members}
                            tags={tags}
                            columnVisibility={columnVisibility}
                            userId={userId}
                            onCancel={() => setShowInlineSubTaskForm(false)}
                            onSubTaskCreated={(subTask, tempId) => {
                                onSubTaskCreated?.(subTask, tempId);
                                setShowInlineSubTaskForm(false);
                            }}
                            onSubTaskDeleted={onSubTaskDeleted}
                        />
                    ) : (
                        <TableRow className="bg-muted/30 hover:bg-muted/20 cursor-pointer" onClick={() => setShowInlineSubTaskForm(true)}>
                            <TableCell colSpan={visibleColumnsCount} className="p-3 pl-12 text-primary">
                                <div className="flex items-center gap-2">
                                    <Plus className="h-4 w-4" />
                                    <span>Add SubTask</span>
                                </div>
                            </TableCell>
                        </TableRow>
                    )
                )}
            </>
        );
    }

    // Sort subtasks by position for correct display order
    const sortedSubTasks = [...task.subTasks].sort((a, b) => {
        const posA = a.position ?? Number.MAX_SAFE_INTEGER;
        const posB = b.position ?? Number.MAX_SAFE_INTEGER;
        return posA - posB;
    });

    return (
        <>
            {sortedSubTasks.map((subTask) => (
                <SubTaskRow
                    key={subTask.id}
                    subTask={subTask as any}
                    columnVisibility={columnVisibility}
                    onClick={onSubTaskClick}
                    members={members}
                    projectId={projectId}
                    parentTaskId={task.id}
                    parentTaskProject={task.project}
                    isSelected={selectedSubTasks.has(subTask.id)}
                    onSelectChange={(checked: boolean) => onSelectSubTask?.(subTask.id, checked)}
                    onSubTaskUpdated={onSubTaskUpdated}
                    onSubTaskDeleted={onSubTaskDeleted}
                    tags={tags}
                    permissions={permissions}
                    userId={userId}
                    isWorkspaceAdmin={isWorkspaceAdmin}
                    leadProjectIds={leadProjectIds}
                    projects={projects}
                />
            ))}

            {task.subTasksHasMore && (
                <TableRow ref={bottomRef} className="bg-muted/10 animate-pulse">
                    <TableCell colSpan={visibleColumnsCount} className="py-2 h-10 pl-12">
                        {isLoadingMore && (
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-4 w-full animate-pulse" />
                            </div>
                        )}
                    </TableCell>
                </TableRow>
            )}
            {canCreateSubTask && (
                showInlineSubTaskForm ? (
                    <InlineSubTaskForm
                        workspaceId={workspaceId}
                        projectId={projectId}
                        parentTaskId={task.id}
                        members={members}
                        tags={tags}
                        columnVisibility={columnVisibility}
                        userId={userId}
                        onCancel={() => setShowInlineSubTaskForm(false)}
                        onSubTaskCreated={(subTask, tempId) => {
                            onSubTaskCreated?.(subTask, tempId);
                            setShowInlineSubTaskForm(false);
                        }}
                        onSubTaskDeleted={onSubTaskDeleted}
                    />
                ) : (
                    <TableRow className="bg-muted/30 hover:bg-muted/20 cursor-pointer" onClick={() => setShowInlineSubTaskForm(true)}>
                        <TableCell colSpan={visibleColumnsCount} className="p-3 pl-12 text-primary">
                            <div className="flex items-center gap-2">
                                <Plus className="h-4 w-4" />
                                <span>Add SubTask</span>
                            </div>
                        </TableCell>
                    </TableRow>
                )
            )}
        </>
    );
}
