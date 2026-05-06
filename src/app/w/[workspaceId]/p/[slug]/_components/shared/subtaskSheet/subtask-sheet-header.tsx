"use client";

import { TaskByIdType } from "@/data/task/get-task-by-id";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Calendar, Tag, User, FileCheck, Edit } from "lucide-react";
import { cn, formatIST } from "@/lib/utils";
import { getStatusColors, getStatusLabel } from "@/lib/colors/status-colors";
import { memo } from "react";
import { EditSubTaskForm } from "@/app/w/[workspaceId]/p/[slug]/_components/forms/edit-subtask-form";
import { InlineAssigneePicker } from "@/components/task/shared/inline-assignee-picker";

interface SubtaskSheetHeaderProps {
    subTask: TaskByIdType;
    currentUserId?: string | null;
    members?: any[];
    /** Called when the assignee is updated inline from the sheet */
    onSubTaskAssigned?: (memberObj: { id: string; name: string | null; surname: string | null }) => void;
    isAdmin?: boolean;
    isProjectManager?: boolean;
}

/**
 * Subtask Sheet Header Component
 * 
 * Displays:
 * - Task title and description
 * - Assignee information
 * - Due date
 * - Tag
 * - Status badge
 */
export const SubtaskSheetHeader = memo(function SubtaskSheetHeader({ subTask, currentUserId, members = [], onSubTaskAssigned, isAdmin, isProjectManager }: SubtaskSheetHeaderProps) {
    // Assignee is mapped from the backend relation for UI compatibility
    const assignee = (subTask as any).assignee?.WorkspaceMember?.user || (subTask as any).assignee;

    return (
        <div className="px-4 sm:px-6 pt-6 pb-4 border-b flex-shrink-0">
            <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60 uppercase tracking-widest mb-1.5 truncate">
                        <span className="truncate">{(subTask as any).project?.name}</span>
                        {(subTask as any).parentTask && (
                            <>
                                <span className="text-muted-foreground/30">/</span>
                                <span className="truncate">{(subTask as any).parentTask.name}</span>
                            </>
                        )}
                        <span className="text-muted-foreground/30">/</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold break-words leading-tight text-foreground">
                        {subTask.name}
                    </h2>
                </div>

                {/* Edit Button for authorized users */}
                {subTask && ((subTask as any).createdBy?.WorkspaceMember?.user?.id === currentUserId || (subTask as any).createdById === currentUserId) && (
                    <div className="ml-4 flex-shrink-0">
                        <EditSubTaskForm
                            subTask={subTask as any}
                            projectId={subTask.projectId}
                            parentTaskId={subTask.parentTaskId!}
                            members={members}
                            trigger={
                                <Button variant="outline" size="sm" className="h-8 gap-2">
                                    <Edit className="h-4 w-4" />
                                    <span>Edit</span>
                                </Button>
                            }
                        />
                    </div>
                )}
            </div>

            {/* Details Section */}
            <ScrollArea className="mt-6 max-h-[200px]">
                <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Details
                    </h3>

                    {/* Assignee */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-xs sm:text-sm font-medium w-20 sm:w-24 shrink-0">Assignee</span>
                        {assignee ? (
                            <div className="flex items-center gap-2 min-w-0">
                                <Avatar className="h-6 w-6 shrink-0">
                                    <AvatarImage src={assignee.image || ""} />
                                    <AvatarFallback>{assignee.name?.[0]}</AvatarFallback>
                                </Avatar>
                                <span className="text-xs sm:text-sm truncate">{assignee.surname || ""}</span>
                            </div>
                        ) : (
                            <InlineAssigneePicker
                                subTask={subTask as any}
                                members={members}
                                projectId={subTask.projectId || ""}
                                parentTaskId={subTask.parentTaskId || ""}
                                canEdit={!!(isAdmin || isProjectManager || (subTask as any).createdBy?.WorkspaceMember?.user?.id === currentUserId || (subTask as any).createdById === currentUserId)}
                                onAssigned={(_userId, member) => {
                                    onSubTaskAssigned?.({
                                        id: member.userId,
                                        name: member.user.name,
                                        surname: member.user.surname,
                                    });
                                }}
                            />
                        )}
                    </div>

                    {/* Due Date */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-xs sm:text-sm font-medium w-20 sm:w-24 shrink-0">Due Date</span>
                        {subTask.startDate ? (
                            <span className="text-xs sm:text-sm">
                                {formatIST(subTask.startDate, "dd/MM/yyyy")}
                            </span>
                        ) : (
                            <span className="text-xs sm:text-sm text-muted-foreground">No due date</span>
                        )}
                    </div>

                    {/* Tag */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-xs sm:text-sm font-medium w-20 sm:w-24 shrink-0">Tag</span>
                        {(subTask as any).tag || (subTask as any).Tag ? (
                            <Badge variant="secondary" className="rounded-md text-[10px] sm:text-xs">
                                {typeof ((subTask as any).tag || (subTask as any).Tag) === 'string' ? ((subTask as any).tag || (subTask as any).Tag) : ((subTask as any).tag || (subTask as any).Tag)[0]?.name || ((subTask as any).tag || (subTask as any).Tag).name}
                            </Badge>
                        ) : (
                            <span className="text-xs sm:text-sm text-muted-foreground">No tag</span>
                        )}
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        <FileCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-xs sm:text-sm font-medium w-20 sm:w-24 shrink-0">Status</span>
                        {subTask.status ? (
                            (() => {
                                // Defensive check for corrupted status data (e.g., DateRange object)
                                if (typeof subTask.status !== 'string') {
                                    console.warn("⚠️ [SubtaskSheetHeader] Corrupted status data detected:", subTask.status, "for subtask:", subTask.id);
                                    return <span className="text-xs text-red-500 font-mono">[Invalid Status]</span>;
                                }

                                return (
                                    <Badge
                                        variant="outline"
                                        className={cn(
                                            "text-[10px] sm:text-xs font-medium",
                                            getStatusColors(subTask.status).color,
                                            getStatusColors(subTask.status).bgColor,
                                            getStatusColors(subTask.status).borderColor
                                        )}
                                    >
                                        {getStatusLabel(subTask.status)}
                                    </Badge>
                                );
                            })()
                        ) : (
                            <span className="text-xs sm:text-sm text-muted-foreground">No status</span>
                        )}
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
});
