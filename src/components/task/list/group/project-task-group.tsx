"use client";

import React, { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { TableRow, TableCell } from "@/components/ui/table";
import { ProjectRow } from "../project-row";
import { TaskRow } from "../task-row";
import { SubTaskList } from "../subtask-list";
import { InlineTaskForm } from "../inline-task-form";
import { TableLoadingSkeleton } from "../table/table-skeleton";
import { LoadMoreSentinel } from "../table/load-more-sentinel";
import { EmptyState } from "../table/empty-state";
import type { TaskWithSubTasks } from "../../shared/types";
import type { ColumnVisibility } from "../../shared/column-visibility";
import type { UserPermissionsType } from "@/data/user/get-user-permissions";

interface ProjectTaskGroupProps {
    projectId: string;
    project: any;
    initialTasks: TaskWithSubTasks[];
    totalTasksCount: number;
    isExpanded: boolean;
    onToggle: () => void;
    visibleColumnsCount: number;
    columnVisibility: ColumnVisibility;
    expandedTasks: Record<string, boolean>;
    onToggleExpandTask: (taskId: string) => void;
    updatingTaskId: string | null;
    setUpdatingTaskId: (id: string | null) => void;
    permissions?: UserPermissionsType;
    userId?: string;
    isWorkspaceAdmin?: boolean;
    leadProjectIds?: string[];
    projects?: any[];
    onRequestSubtasks: (taskId: string) => void;
    getCachedSubTasks: (taskId: string) => any;
    tags: any[];
    members: any[];
    workspaceId: string;
    canCreateSubTask: boolean;
    loadingSubTasks: Record<string, boolean>;
    loadingMoreSubTasks: Record<string, boolean>;
    onLoadMoreSubTasks: (taskId: string) => void;
    handleSubTaskClick: (subTask: any) => void;
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
    level: "workspace" | "project";
    paginationState?: { isLoading: boolean; hasMore: boolean; nextCursor?: any };
    getObserver: () => IntersectionObserver | null;
    filtersActive: boolean;
    activeInlineProjectId: string | null;
    setActiveInlineProjectId: (id: string | null) => void;
    onUpdateParentTaskLists: (updatedList: TaskWithSubTasks[]) => void;
}

export function ProjectTaskGroup({
    projectId,
    project,
    initialTasks,
    totalTasksCount,
    isExpanded,
    onToggle,
    visibleColumnsCount,
    columnVisibility,
    expandedTasks,
    onToggleExpandTask,
    updatingTaskId,
    setUpdatingTaskId,
    permissions,
    userId,
    isWorkspaceAdmin,
    leadProjectIds,
    projects,
    onRequestSubtasks,
    getCachedSubTasks,
    tags,
    members,
    workspaceId,
    canCreateSubTask,
    loadingSubTasks,
    loadingMoreSubTasks,
    onLoadMoreSubTasks,
    handleSubTaskClick,
    scrollContainerRef,
    level,
    paginationState = { isLoading: false, hasMore: false },
    getObserver,
    filtersActive,
    activeInlineProjectId,
    setActiveInlineProjectId,
    onUpdateParentTaskLists
}: ProjectTaskGroupProps) {
    // 1. Maintain a local, optimistic mirror of the tasks for this project
    const [localTasks, setLocalTasks] = useState<TaskWithSubTasks[]>(initialTasks);

    // Sync upstream on updates (like filters altering the list)
    useEffect(() => {
        setLocalTasks(initialTasks);
    }, [initialTasks]);

    // Trigger parent sync for caching/other UI updates, using local state as truth
    const flushToParent = (newList: TaskWithSubTasks[]) => {
        onUpdateParentTaskLists(newList);
    };

    const handleTaskUpdated = (taskId: string, updatedTask: { name: string; taskSlug: string }) => {
        setLocalTasks(prev => {
            const next = prev.map(t =>
                t.id === taskId
                    ? { ...t, name: updatedTask.name, taskSlug: updatedTask.taskSlug }
                    : t
            );
            flushToParent(next);
            return next;
        });
    };

    const handleTaskDeleted = (taskId: string) => {
        setLocalTasks(prev => {
            const next = prev.filter(t => t.id !== taskId);
            flushToParent(next);
            return next;
        });
    };

    const handleTaskCreated = (task: TaskWithSubTasks, tempId?: string) => {
        setLocalTasks(prev => {
            let next;
            if (tempId) {
                next = prev.map(t => t.id === tempId ? task : t);
            } else {
                next = [task, ...prev];
            }
            flushToParent(next);
            return next;
        });
        setActiveInlineProjectId(null);
    };

    return (
        <ProjectRow
            project={project}
            totalTasksCount={totalTasksCount}
            isExpanded={isExpanded}
            onToggle={onToggle}
            colSpan={visibleColumnsCount}
        >
            {isExpanded && localTasks.map((task) => (
                <React.Fragment key={task.id}>
                    <TaskRow
                        task={task}
                        isExpanded={!!expandedTasks[task.id]}
                        onToggleExpand={() => onToggleExpandTask(task.id)}
                        columnVisibility={columnVisibility}
                        isUpdating={updatingTaskId === task.id}
                        onUpdateStart={() => setUpdatingTaskId(task.id)}
                        onUpdateEnd={() => setUpdatingTaskId(null)}
                        onTaskUpdated={(updatedTask) => handleTaskUpdated(task.id, updatedTask)}
                        onTaskDeleted={handleTaskDeleted}
                        permissions={permissions}
                        userId={userId}
                        isWorkspaceAdmin={isWorkspaceAdmin}
                        leadProjectIds={leadProjectIds}
                        projects={projects}
                        onRequestSubtasks={onRequestSubtasks}
                        isCached={!!getCachedSubTasks(task.id)}
                    >
                        <SubTaskList
                            task={task}
                            tags={tags}
                            members={members}
                            workspaceId={workspaceId}
                            projectId={task.projectId || projectId}
                            canCreateSubTask={
                                level === 'project'
                                    ? canCreateSubTask
                                    : (canCreateSubTask && task.projectId ? (
                                        leadProjectIds?.includes(task.projectId) ||
                                        !!isWorkspaceAdmin ||
                                        !!projects?.find(p => p.id === task.projectId)?.canManageMembers
                                    ) : false)
                            }
                            columnVisibility={columnVisibility}
                            isLoading={!!loadingSubTasks[task.id]}
                            isLoadingMore={!!loadingMoreSubTasks[task.id]}
                            onLoadMore={() => onLoadMoreSubTasks(task.id)}
                            onSubTaskClick={handleSubTaskClick}
                            permissions={permissions}
                            userId={userId}
                            isWorkspaceAdmin={isWorkspaceAdmin}
                            leadProjectIds={leadProjectIds}
                            projects={projects}
                            scrollContainerRef={scrollContainerRef}
                            level={level}
                        />
                    </TaskRow>
                </React.Fragment>
            ))}

            {isExpanded && paginationState.isLoading && localTasks.length === 0 && (
                <TableLoadingSkeleton visibleColumnsCount={visibleColumnsCount} />
            )}

            {isExpanded && paginationState.hasMore && (
                paginationState.isLoading ? (
                    <LoadMoreSentinel visibleColumnsCount={visibleColumnsCount} />
                ) : (
                    <TableRow
                        ref={(node) => {
                            if (node) getObserver()?.observe(node);
                        }}
                        data-project-id={projectId}
                    >
                        <TableCell colSpan={visibleColumnsCount} className="py-2 h-1"></TableCell>
                    </TableRow>
                )
            )}

            {isExpanded && !paginationState.isLoading && localTasks.length === 0 && totalTasksCount === 0 && (
                (filtersActive || !canCreateSubTask) ? (
                    <EmptyState visibleColumnsCount={visibleColumnsCount} />
                ) : null
            )}

            {isExpanded && canCreateSubTask && !filtersActive && (
                activeInlineProjectId === projectId ? (
                    <InlineTaskForm
                        workspaceId={workspaceId}
                        projectId={projectId}
                        projects={projects}
                        level={level}
                        leadProjectIds={leadProjectIds || []}
                        isWorkspaceAdmin={isWorkspaceAdmin}
                        onCancel={() => setActiveInlineProjectId(null)}
                        onTaskDeleted={handleTaskDeleted}
                        onTaskCreated={handleTaskCreated}
                    />
                ) : (
                    <TableRow
                        className="hover:bg-muted/20 cursor-pointer h-8"
                        onClick={(e) => { e.stopPropagation(); setActiveInlineProjectId(projectId); }}
                    >
                        <TableCell colSpan={visibleColumnsCount} className="py-2 px-2 pl-8">
                            <div className="flex items-center gap-2 text-primary font-medium hover:text-primary/80 transition-colors">
                                <Plus className="h-4 w-4" />
                                <span>Add Task</span>
                            </div>
                        </TableCell>
                    </TableRow>
                )
            )}
        </ProjectRow>
    );
}
