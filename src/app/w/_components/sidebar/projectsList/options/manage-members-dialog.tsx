"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Plus, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { tryCatch } from "@/hooks/try-catch";
import { addProjectMembers, removeProjectMembers, updateProjectMemberRole } from "@/actions/project/manage-members";
import type { ProjectRole } from"@prisma/client";
import { WorkspaceMembersResult } from "@/data/workspace";

interface ProjectMember {
    id: string;
    userId: string;
    userName: string;
    projectRole: ProjectRole;
}

interface ManageProjectMembersDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    projectName: string;
    currentMembers: ProjectMember[];
    workspaceMembers: WorkspaceMembersResult["workspaceMembers"];
}

export const ManageProjectMembersDialog = ({
    open,
    onOpenChange,
    projectId,
    projectName,
    currentMembers: initialMembers,
    workspaceMembers,
}: ManageProjectMembersDialogProps) => {
    const [pending, startTransition] = useTransition();
    const [selectedMembersToAdd, setSelectedMembersToAdd] = useState<string[]>([]);
    const [memberToRemove, setMemberToRemove] = useState<{ userId: string; name: string } | null>(null);
    // Local members state — seeded from props, updated immediately on action success
    const [members, setMembers] = useState<ProjectMember[]>(initialMembers);
    const router = useRouter();

    // Sync local state when server data (props) change or dialog opens
    // We use a JSON string of IDs as a stable dependency to avoid the 'size change' error
    // and prevent infinite loops from array reference changes
    const memberIdsHash = JSON.stringify(initialMembers.map(m => m.userId));
    useEffect(() => {
        setMembers(initialMembers);
    }, [memberIdsHash, open]);

    // Derived: which workspace members are not yet in the project (excluding OWNER/ADMIN)
    const currentMemberUserIds = new Set(members.map((m) => m.userId));
    const availableMembers = workspaceMembers.filter(
        (wm) => !currentMemberUserIds.has(wm.userId) && wm.workspaceRole !== "OWNER" && wm.workspaceRole !== "ADMIN"
    );

    const handleAddMembers = () => {
        if (selectedMembersToAdd.length === 0) {
            toast.error("Please select at least one member to add.");
            return;
        }

        startTransition(async () => {
            const { data: result, error } = await tryCatch(
                addProjectMembers(projectId, selectedMembersToAdd)
            );

            if (error) {
                toast.error(error.message);
                console.error(error);
                return;
            }

            if (result.status === "success") {
                toast.success(result.message);
                // Optimistic update — add newly selected members immediately
                const newEntries: ProjectMember[] = selectedMembersToAdd
                    .map((userId) => {
                        const wm = workspaceMembers.find((m) => m.userId === userId);
                        if (!wm) return null;
                        return {
                            id: `temp-${userId}`,
                            userId,
                            userName: wm.user?.name || wm.user?.surname || "Unknown",
                            projectRole: "MEMBER" as ProjectRole,
                        };
                    })
                    .filter(Boolean) as ProjectMember[];
                setMembers((prev) => [...prev, ...newEntries]);
                setSelectedMembersToAdd([]);
                router.refresh();
            } else {
                toast.error(result.message);
            }
        });
    };

    const handleRemoveMember = (memberUserId: string) => {
        startTransition(async () => {
            const { data: result, error } = await tryCatch(
                removeProjectMembers(projectId, [memberUserId])
            );

            if (error) {
                toast.error(error.message);
                console.error(error);
                return;
            }

            if (result.status === "success") {
                toast.success(result.message);
                // Optimistic update — remove immediately from local list
                setMembers((prev) => prev.filter((m) => m.userId !== memberUserId));
                router.refresh();
            } else {
                toast.error(result.message);
            }
        });
    };

    const handleUpdateRole = (memberUserId: string, newRole: ProjectRole) => {
        startTransition(async () => {
            const { data: result, error } = await tryCatch(
                updateProjectMemberRole(projectId, memberUserId, newRole)
            );

            if (error) {
                toast.error(error.message);
                console.error(error);
                return;
            }

            if (result.status === "success") {
                toast.success(result.message);
                // Optimistic update — update role immediately in local list
                setMembers((prev) =>
                    prev.map((m) =>
                        m.userId === memberUserId ? { ...m, projectRole: newRole } : m
                    )
                );
                router.refresh();
            } else {
                toast.error(result.message);
            }
        });
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-h-[90vh] w-[min(700px,95vw)] overflow-hidden">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Manage Project Members
                        </DialogTitle>
                        <DialogDescription>
                            Manage members for <strong>{projectName}</strong>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 overflow-y-auto max-h-[60vh] thin-scrollbar px-2">
                        {/* Add Members Section */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold">Add Members</h3>
                            <div className="flex gap-2">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="flex-1 justify-between font-normal"
                                            disabled={pending || availableMembers.length === 0}
                                        >
                                            {selectedMembersToAdd.length > 0 ? (
                                                <span className="truncate">
                                                    {selectedMembersToAdd.length} member(s) selected
                                                </span>
                                            ) : availableMembers.length === 0 ? (
                                                "No available members"
                                            ) : (
                                                "Select members to add"
                                            )}
                                        </Button>
                                    </PopoverTrigger>

                                    <PopoverContent className="p-0 w-64">
                                        <Command>
                                            <CommandInput placeholder="Search members…" />
                                            <CommandEmpty>No members found.</CommandEmpty>
                                            <CommandGroup className="max-h-64 overflow-auto">
                                                {availableMembers.map((member) => {
                                                    const userName = member.user?.surname || "Unknown";
                                                    const isSelected = selectedMembersToAdd.includes(
                                                        member.userId
                                                    );

                                                    return (
                                                        <CommandItem
                                                            key={member.userId}
                                                            value={userName}
                                                            onSelect={() => {
                                                                if (isSelected) {
                                                                    setSelectedMembersToAdd(
                                                                        selectedMembersToAdd.filter(
                                                                            (id) => id !== member.userId
                                                                        )
                                                                    );
                                                                } else {
                                                                    setSelectedMembersToAdd([
                                                                        ...selectedMembersToAdd,
                                                                        member.userId,
                                                                    ]);
                                                                }
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    isSelected
                                                                        ? "opacity-100"
                                                                        : "opacity-0"
                                                                )}
                                                            />
                                                            {userName}
                                                            <Badge
                                                                variant="outline"
                                                                className="ml-auto text-xs"
                                                            >
                                                                {member.workspaceRole}
                                                            </Badge>
                                                        </CommandItem>
                                                    );
                                                })}
                                            </CommandGroup>
                                        </Command>
                                    </PopoverContent>
                                </Popover>

                                <Button
                                    onClick={handleAddMembers}
                                    disabled={pending || selectedMembersToAdd.length === 0}
                                    size="default"
                                >
                                    {pending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Plus className="h-4 w-4 mr-1" />
                                            Add
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* Current Members Section */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold">
                                Current Members ({members.filter((member: ProjectMember) => {
                                    const workspaceMember = workspaceMembers.find(wm => wm.userId === member.userId);
                                    return workspaceMember?.workspaceRole !== "ADMIN";
                                }).length})
                            </h3>
                            <div className="space-y-2">
                                {members.filter((member: ProjectMember) => {
                                    // Filter out workspace admins from display
                                    const workspaceMember = workspaceMembers.find(wm => wm.userId === member.userId);
                                    return workspaceMember?.workspaceRole !== "ADMIN";
                                }).length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        No members in this project yet.
                                    </p>
                                ) : (
                                    members
                                        .filter((member: ProjectMember) => {
                                            // Filter out workspace admins from display
                                            const workspaceMember = workspaceMembers.find(wm => wm.userId === member.userId);
                                            return workspaceMember?.workspaceRole !== "ADMIN";
                                        })
                                        .map((member: ProjectMember) => (
                                            <div
                                                key={member.id}
                                                className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                                            >
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium truncate">
                                                            {member.userName}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <Badge
                                                                variant={
                                                                    member.projectRole === "PROJECT_MANAGER"
                                                                        ? "default"
                                                                        : member.projectRole === "LEAD"
                                                                            ? "secondary"
                                                                            : "outline"
                                                                }
                                                                className={cn(
                                                                    "text-xs",
                                                                    member.projectRole === "PROJECT_MANAGER" && "bg-amber-500 hover:bg-amber-600"
                                                                )}
                                                            >
                                                                {member.projectRole === "PROJECT_MANAGER" ? "Manager" : member.projectRole}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {/* Role Selector - Only show for non-PROJECT_MANAGER roles */}
                                                    {member.projectRole !== "PROJECT_MANAGER" ? (
                                                        <Select
                                                            value={member.projectRole}
                                                            onValueChange={(value) =>
                                                                handleUpdateRole(member.userId, value as ProjectRole)
                                                            }
                                                            disabled={pending}
                                                        >
                                                            <SelectTrigger className="w-28 h-8 text-xs">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="LEAD">Lead</SelectItem>
                                                                <SelectItem value="MEMBER">Member</SelectItem>
                                                                <SelectItem value="VIEWER">Viewer</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    ) : (
                                                        <div className="w-28 h-8 flex items-center justify-center text-xs text-muted-foreground">
                                                            Fixed Role
                                                        </div>
                                                    )}

                                                    {/* Remove Button - Disabled for PROJECT_MANAGER */}
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => setMemberToRemove({ userId: member.userId, name: member.userName })}
                                                        disabled={pending || member.projectRole === "PROJECT_MANAGER"}
                                                        className="h-8"
                                                        title={member.projectRole === "PROJECT_MANAGER" ? "Cannot remove project manager" : "Remove member"}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={pending}
                        >
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Remove Member Confirmation — only mounted when needed to avoid Radix ID hydration shift */}
            {memberToRemove && (
                <AlertDialog open={true} onOpenChange={(open) => { if (!open) setMemberToRemove(null); }}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Remove Member</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to remove{" "}
                                <span className="font-semibold">{memberToRemove.name}</span>{" "}
                                from <span className="font-semibold">{projectName}</span>? They will lose
                                access to all tasks in this project.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                disabled={pending}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => {
                                    handleRemoveMember(memberToRemove.userId);
                                    setMemberToRemove(null);
                                }}
                            >
                                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove Member"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </>
    );
};
