"use client";

import React, { useState, useEffect, memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Folder,
  Crown,
  MoreHorizontal,
  Edit,
  Trash2,
  MessageSquare,
  Calendar,
  AlertCircle,
  Tag,
} from "lucide-react";
import type { KanbanSubTaskType } from "@/data/task";
import { cn } from "@/lib/utils";
import { getColorFromString } from "@/lib/colors/project-colors";
import {
  commentCache,
  activityCache,
  pendingPrefetches,
} from "@/app/w/[workspaceId]/p/[slug]/_components/shared/subtaskSheet/subtask-details-sheet";
import { UserPermissionsType } from "@/data/user/get-user-permissions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { EditSubTaskForm } from "@/app/w/[workspaceId]/p/[slug]/_components/forms/edit-subtask-form";
import { DeleteSubTaskForm } from "@/app/w/[workspaceId]/p/[slug]/_components/forms/delete-subtask-form";
import { InlineAssigneePicker } from "@/components/task/shared/inline-assignee-picker";
import { ProjectOption } from "../shared/types";

interface KanbanCardProps {
  subTask: KanbanSubTaskType;
  columnColor: string;
  isDragging?: boolean;
  onSubTaskClick?: (subTask: KanbanSubTaskType) => void;
  projectManagers?: Record<string, any>;
  isUpdating?: boolean;
  permissions?: UserPermissionsType;
  userId?: string;
  onUpdateInPlace?: (subTaskId: string, data: any) => void;
  projectMembers?: any[];
  projects?: ProjectOption[];
}

export const KanbanCard = React.memo(function KanbanCard({
  subTask,
  columnColor,
  isDragging = false,
  onSubTaskClick,
  projectManagers,
  isUpdating,
  permissions,
  userId,
  onUpdateInPlace,
  projectMembers = [],
  projects,
}: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: subTask.id,
    disabled: isDragging, // Disable sortable logic when rendered in DragOverlay
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const assigneeUser = (subTask.assignee as any)?.workspaceMember?.user;
  const activityCount = (subTask as any)._count?.activities || 0;
  const project = subTask.project;

  // Get Project Managers from the hoisted map (effective way)
  const assignedManagers = (
    projectManagers && subTask.projectId
      ? projectManagers[subTask.projectId] || []
      : []
  ) as any[];
  const firstManager = assignedManagers?.[0] || null;

  // 🚀 Speculative Pre-fetching for "Instant" feel
  const handlePrefetch = () => {
    if (!subTask?.id) return;
  };

  const canEdit = () => {
    const creatorId =
      subTask.createdBy?.workspaceMember?.user?.id ||
      (subTask as any).createdById;

    if (permissions) {
      return (
        permissions.isWorkspaceAdmin ||
        permissions.isProjectManager ||
        (permissions.isProjectLead && creatorId === userId)
      );
    }
    return false;
  };

  const dueDate = subTask.dueDate
    ? new Date(subTask.dueDate)
    : (() => {
        if (!subTask.startDate || !subTask.days) return null;
        const start = new Date(subTask.startDate);
        const due = new Date(start);
        due.setDate(due.getDate() + subTask.days);
        return due;
      })();

  const isOverdue = dueDate && new Date() > dueDate;

  const handleNameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSubTaskClick?.(subTask);
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "h-auto py-0 transition-shadow duration-200 hover:shadow-lg dark:hover:shadow-primary/20",
        (isDragging || isSortableDragging) && "opacity-50 shadow-xl",
        "border-l-4 overflow-hidden",
        (!assigneeUser && subTask.status !== "COMPLETED" && subTask.status !== "CANCELLED") && "bg-red-50 dark:bg-red-950/20 shadow-[0_0_8px_rgba(239,68,68,0.2)] animate-[pulse_2s_infinite] border-red-400 dark:border-red-600",
        columnColor === "text-slate-700" &&
          "border-l-slate-500 dark:border-l-slate-400",
        columnColor === "text-blue-700" &&
          "border-l-blue-500 dark:border-l-blue-400",
        columnColor === "text-red-700" &&
          "border-l-red-500 dark:border-l-red-400",
        columnColor === "text-amber-700" &&
          "border-l-amber-500 dark:border-l-amber-400",
        columnColor === "text-purple-700" &&
          "border-l-purple-500 dark:border-l-purple-400",
        columnColor === "text-green-700" &&
          "border-l-green-500 dark:border-l-green-400",
      )}
      onMouseEnter={handlePrefetch}
      onClick={(e) => {
        e.stopPropagation();
        onSubTaskClick?.(subTask);
      }}
    >
      <CardContent className="p-3 space-y-3">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none flex items-center justify-between text-[10px] text-muted-foreground pb-2 border-b border-border/50"
        >
          <div className="flex flex-1 items-center gap-1 min-w-0 mr-2">
            <div
              className="flex items-center gap-1.5 shrink-0 max-w-[45%]"
              title={`Project: ${project?.name}`}
            >
              <div
                className="h-2 w-2 rounded-full border shadow-sm shrink-0"
                style={{
                  backgroundColor:
                    project?.color || getColorFromString(project?.name || ""),
                }}
              />
              <span className="truncate font-medium">{project?.name}</span>
            </div>

            {subTask.parentTask && (
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-muted-foreground/40 shrink-0">/</span>
                <span
                  className="truncate text-[10px] font-medium text-muted-foreground/80"
                  title={`Parent: ${subTask.parentTask.name}`}
                >
                  {subTask.parentTask.name}
                </span>
              </div>
            )}
          </div>

          {(assignedManagers.length > 0 || subTask.parentTask?.reviewer) && (
            <div className="flex items-center gap-1.5 ml-auto">
              {subTask.parentTask?.reviewer && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center rounded-full bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100/50 dark:border-blue-900/50 hover:bg-blue-100 transition-colors cursor-default">
                        <Avatar className="h-4 w-4 border border-blue-200 dark:border-blue-800 shadow-sm">
                          <AvatarFallback className="text-[8px] bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                            {subTask.parentTask.reviewer.surname?.[0] ||
                              subTask.parentTask.reviewer.name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent
                      side="left"
                      className="text-xs p-2 space-y-0.5"
                    >
                      <div>
                        <p className="font-semibold text-[10px] uppercase tracking-wider">
                          Parent Reviewer
                        </p>
                        <p className="font-medium text-[11px] text-primary">
                          {subTask.parentTask.reviewer.surname ||
                            subTask.parentTask.reviewer.name}
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {assignedManagers.length > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center rounded-full bg-amber-50/50 dark:bg-amber-950/30 border border-amber-100/50 dark:border-amber-900/50 hover:bg-amber-100 transition-colors cursor-default">
                        <Avatar className="h-4 w-4 border border-amber-200 dark:border-amber-800 shadow-sm">
                          <AvatarFallback className="text-[8px] bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                            {firstManager?.surname?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        {assignedManagers.length > 1 && (
                          <span className="text-[8px] pr-1.5 font-bold">
                            +{assignedManagers.length - 1}
                          </span>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent
                      side="left"
                      className="text-xs p-2 space-y-0.5"
                    >
                      <div className="pb-1.5 border-b">
                        <p className="font-semibold text-[10px] uppercase tracking-wider">
                          Project
                        </p>
                        <p className="font-medium text-[11px] text-primary">
                          {project?.name}
                        </p>
                      </div>
                      {subTask.parentTask && (
                        <div className="pb-1.5 border-b">
                          <p className="font-semibold text-[10px] uppercase tracking-wider">
                            Parent Task
                          </p>
                          <p className="font-medium text-[11px] text-primary">
                            {subTask.parentTask.name}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-[10px] uppercase tracking-wider">
                          {assignedManagers.length > 1
                            ? "Project Managers"
                            : "Project Manager"}
                        </p>
                        {assignedManagers.map((pm, idx) => (
                          <p
                            key={idx}
                            className="font-medium text-[11px] text-primary"
                          >
                            {pm.surname}
                          </p>
                        ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          )}
        </div>

        <div className="space-y-0">
          <div className="flex items-start justify-between gap-2 z-30">
            <h5
              className="font-semibold text-[13px] leading-snug flex-1 cursor-pointer hover:text-primary transition-colors line-clamp-1"
              onClick={handleNameClick}
              onMouseEnter={() => {
                import(
                  "@/app/w/[workspaceId]/p/[slug]/_components/shared/subtaskSheet/subtask-details-sheet"
                ).then((m) => {
                  m.prefetchSubTask(subTask.id);
                });
              }}
              title={subTask.name}
            >
              {subTask.name}
            </h5>

            {canEdit() && (
              <div onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 -mr-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem
                      asChild
                      onSelect={(e) => e.preventDefault()}
                    >
                      <EditSubTaskForm
                        subTask={subTask as any}
                        projectId={subTask.projectId}
                        parentTaskId={subTask.parentTaskId!}
                        members={projectMembers}
                        onSubTaskUpdated={(data) =>
                          onUpdateInPlace?.(subTask.id, data)
                        }
                        trigger={
                          <div className="flex items-center gap-2 w-full px-2 py-1.5 cursor-pointer hover:bg-accent rounded-sm transition-colors text-xs">
                            <Edit className="h-3.5 w-3.5" />
                            <span>Edit</span>
                          </div>
                        }
                      />
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      asChild
                      onSelect={(e) => e.preventDefault()}
                    >
                      <DeleteSubTaskForm
                        subTask={subTask as any}
                        onSubTaskDeleted={() => {
                          // In Kanban, board state usually handles this via cache invalidation
                          // but we might want a local filter if we're feeling optimistic
                          window.location.reload();
                        }}
                        trigger={
                          <div className="flex items-center gap-2 w-full px-2 py-1.5 cursor-pointer hover:bg-destructive/10 text-destructive rounded-sm transition-colors text-xs">
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Delete</span>
                          </div>
                        }
                      />
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t mt-auto">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-1.5 text-muted-foreground"
              title="Reviews"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">{activityCount}</span>
            </div>

            {dueDate && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "flex items-center gap-1 text-[10px] font-medium cursor-help",
                        isOverdue
                          ? "text-destructive dark:text-red-400"
                          : "text-muted-foreground",
                      )}
                    >
                      <Calendar className="h-3 w-3" />
                      <span>
                        {new Date(dueDate).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                      {isOverdue && <AlertCircle className="h-3 w-3" />}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs font-medium">Due Date</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {subTask.tag && (
              <div className="flex items-center gap-1">
                <Tag className="h-2.5 w-2.5 text-muted-foreground" />
                <span
                  className={cn(
                    "text-[10px] font-medium text-muted-foreground",
                  )}
                >
                  {subTask.tag.name}
                </span>
              </div>
            )}
          </div>

          {assigneeUser ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="h-6 w-6 cursor-pointer border-2 border-background">
                    <AvatarFallback className="text-[10px]">
                      {assigneeUser.surname?.[0] || assigneeUser.name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Assignee: {assigneeUser.surname || assigneeUser.name}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <div onClick={(e) => e.stopPropagation()}>
              <InlineAssigneePicker
                subTask={subTask as any}
                members={projectMembers}
                allowedUserIds={projects?.find(p => p.id === subTask.projectId)?.memberIds}
                projectId={subTask.projectId}
                parentTaskId={subTask.parentTaskId!}
                canEdit={canEdit()}
                onAssigned={(_userId, member) => {
                  onUpdateInPlace?.(subTask.id, {
                    assignee: {
                      WorkspaceMember: {
                        user: {
                          id: member.userId,
                          name: member.user.name,
                          surname: member.user.surname,
                        },
                      },
                    },
                  });
                }}
                className="whitespace-nowrap"
              />
            </div>
          )}
        </div>
      </CardContent>
      {isUpdating && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-[1px] animate-pulse">
          <div className="h-1 w-full bg-primary/30 absolute bottom-0 overflow-hidden">
            <div
              className="h-full w-1/2 bg-primary animate-[shimmer_1.5s_infinite_linear]"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, transparent, currentColor, transparent)",
              }}
            />
          </div>
        </div>
      )}
    </Card>
  );
});
