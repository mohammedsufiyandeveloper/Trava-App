"use client";

import { useState, useTransition } from "react";
import { Loader2, UserPlus, Check } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useTaskCacheStore } from "@/lib/store/task-cache-store";
import type { ProjectMembersType } from "@/data/project/get-project-members";

// ─────────────────────────────────────────────────────────────────
// Minimal shape of a subtask that the picker needs.
// All three contexts (SubTaskType, KanbanSubTaskType, TaskByIdType)
// satisfy this shape.
// ─────────────────────────────────────────────────────────────────
export interface AssignableSubTask {
    id: string;
    name: string;
    description?: string | null;
    taskSlug: string;
    status?: string | null;
    startDate?: Date | string | null;
    dueDate?: Date | string | null;
    days?: number | null;
    projectId?: string;
    parentTaskId?: string | null;
    tag?: { id: string } | null;
    assigneeId?: string | null;
    assignee?: {
        id?: string;
        name?: string;
        image?: string | null;
        WorkspaceMember?: { user?: { id?: string, name?: string, surname?: string, image?: string | null } | null } | null;
    } | null;
    reviewer?: {
        id?: string;
        WorkspaceMember?: { user?: { id?: string, name?: string, surname?: string, image?: string | null } | null } | null;
    } | null;
}

interface InlineAssigneePickerProps {
    subTask: AssignableSubTask;
    members: ProjectMembersType;
    /** Optional: filter members by these IDs (e.g. only members of the current project) */
    allowedUserIds?: string[];
    projectId: string;
    parentTaskId?: string | null;
    /** Whether the current user has permission to assign */
    canEdit: boolean;
    /** Fired on successful assignment: (userId, memberObj) */
    onAssigned: (userId: string, member: ProjectMembersType[number]) => void;
    /** Optional extra class for the trigger badge */
    className?: string;
}

/**
 * InlineAssigneePicker
 *
 * Renders a clickable "Unassigned" badge that opens a searchable member list
 * when canEdit=true, or a plain muted span when canEdit=false.
 *
 * Uses the existing `editSubTask` server action — only swaps the assignee
 * while preserving all other subtask fields.
 */
export function InlineAssigneePicker({
    subTask,
    members: allMembers,
    allowedUserIds,
    projectId,
    parentTaskId,
    canEdit,
    onAssigned,
    className,
}: InlineAssigneePickerProps) {
    const [open, setOpen] = useState(false);
    const [explanationDialogOpen, setExplanationDialogOpen] = useState(false);
    const [pendingMember, setPendingMember] = useState<ProjectMembersType[number] | null>(null);
    const [explanation, setExplanation] = useState("");
    const [pending, startTransition] = useTransition();
    const upsertTasks = useTaskCacheStore(state => state.upsertTasks);

    // 1. Filter by project membership if allowedUserIds is provided
    const members = allowedUserIds
        ? allMembers.filter(m => allowedUserIds.includes(m.userId))
        : allMembers;

    // 2. Filter to non-VIEWER project members only
    const assignableMembers = members.filter(
        (m) => m.projectRole !== "VIEWER"
    );

    // 3. Resolve current attendee display info
    // We try to find the member in the provided list using assigneeId (ProjectMember.id) 
    // or by userId as a fallback.
    const currentMember = allMembers.find(m =>
        (subTask.assigneeId && m.id === subTask.assigneeId) ||
        (subTask.assignee?.id && m.userId === subTask.assignee.id) ||
        (subTask.assignee?.WorkspaceMember?.user?.id && m.userId === subTask.assignee.WorkspaceMember.user.id)
    );

    const displayInfo = {
        name: currentMember
            ? (currentMember.user.surname || currentMember.user.name)
            : (subTask.assignee?.name || "Unassigned"),
        isAssigned: !!currentMember || !!(subTask.assignee && (subTask.assignee.name || subTask.assignee.id))
    };

    const handleSelect = (member: ProjectMembersType[number]) => {
        setOpen(false);
        setPendingMember(member);
        setExplanationDialogOpen(true);
    };

    const handleConfirmAssign = () => {
        if (!pendingMember) return;
        const member = pendingMember;
        setExplanationDialogOpen(false);

        startTransition(async () => {
            // 1. SURGICAL REST API UPDATE (no RSC re-render triggered)
            const res = await fetch(`/api/v1/tasks/${subTask.id}/assignee`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assigneeUserId: member.userId, explanation }),
            });

            if (res.ok) {
                toast.success(`Assigned to ${member.user.surname || member.user.name}`);

                // 2. IN-MEMORY GLOBAL SYNC (fully optimistic — no data needed from server)
                const updatedTaskData = {
                    ...subTask,
                    assigneeId: member.projectMemberId,
                    assignee: {
                        id: member.userId, // Keep userId as ID for flattened views
                        name: member.user.surname,
                        WorkspaceMember: {
                            userId: member.userId,
                            user: {
                                id: member.userId,
                                name: member.user.name,
                                surname: member.user.surname,
                            }
                        }
                    },
                    updatedAt: new Date().toISOString()
                };
                upsertTasks([updatedTaskData as any]);

                // 3. VIEW-SPECIFIC CALLBACK
                onAssigned(member.userId, member);
                
                // Reset state
                setExplanation("");
                setPendingMember(null);
            } else {
                const err = await res.json().catch(() => ({}));
                toast.error(err?.error || "Failed to update assignee");
                setExplanation("");
                setPendingMember(null);
            }
        });
    };

    // ── Non-editable: plain muted label ──────────────────────────
    if (!canEdit) {
        return (
            <span
                className={cn(
                    "inline-flex items-center gap-1 text-[10px] sm:text-xs px-2 py-0.5 rounded-md",
                    displayInfo.isAssigned
                        ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 font-medium"
                        : "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 font-bold",
                    className
                )}
            >
                {!displayInfo.isAssigned && <UserPlus className="h-3 w-3 shrink-0" />}
                {displayInfo.isAssigned && displayInfo.name}
            </span>
        );
    }

    // ── Editable: clickable popover ───────────────────────────────
    return (
        <>
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    disabled={pending}
                    className={cn(
                        "inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium",
                        displayInfo.isAssigned
                            ? "text-blue-600 dark:text-blue-400 bg-blue-100/50 dark:bg-blue-900/30 hover:bg-blue-200/50 dark:hover:bg-blue-900/50"
                            : "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 font-bold animate-pulse",
                        "px-2 py-0.5 rounded-md",
                        "transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                        className
                    )}
                    title={displayInfo.isAssigned ? `Assigned to ${displayInfo.name}` : "Click to assign a member"}
                >
                    {pending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                        <UserPlus className="h-3 w-3 shrink-0" />
                    )}
                    {(pending || displayInfo.isAssigned) && (
                        <span className="truncate max-w-[80px] sm:max-w-[120px]">
                            {pending ? "Saving…" : displayInfo.name}
                        </span>
                    )}
                </button>
            </PopoverTrigger>

            <PopoverContent
                className="p-0 w-56"
                align="start"
                side="bottom"
                onClick={(e) => e.stopPropagation()}
            >
                <Command>
                    <CommandInput placeholder="Search member…" className="h-8 text-xs" />
                    <CommandList>
                        <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                            No members found.
                        </CommandEmpty>
                        <CommandGroup>
                            {assignableMembers.map((member) => {
                                const displayName =
                                    member.user.surname || member.user.name || "Unknown";
                                const roleLabel =
                                    member.projectRole === "PROJECT_MANAGER"
                                        ? "PM"
                                        : member.projectRole === "LEAD"
                                            ? "Lead"
                                            : member.projectRole || "";

                                return (
                                    <CommandItem
                                        key={member.userId}
                                        value={displayName}
                                        onSelect={() => handleSelect(member)}
                                        className="flex items-center gap-2 cursor-pointer text-xs"
                                    >
                                        <Check className="h-3.5 w-3.5 opacity-0" />
                                        <span className="flex-1 truncate">{displayName}</span>
                                        {roleLabel && (
                                            <span className="text-[10px] text-muted-foreground shrink-0">
                                                {roleLabel}
                                            </span>
                                        )}
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>

        <Dialog open={explanationDialogOpen} onOpenChange={setExplanationDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Assignment Explanation</DialogTitle>
                    <DialogDescription>
                        Please provide a reason or note for this assignment change. This will be logged as an activity.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Textarea
                        placeholder="Enter your explanation here..."
                        value={explanation}
                        onChange={(e) => setExplanation(e.target.value)}
                        className="w-full text-sm"
                        autoFocus
                    />
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => {
                            setExplanationDialogOpen(false);
                            setPendingMember(null);
                            setExplanation("");
                        }}
                        disabled={pending}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirmAssign}
                        disabled={pending}
                    >
                        Confirm Assignment
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
}
