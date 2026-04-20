"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Check, Loader2 } from "lucide-react";
import { createTask } from "@/actions/task/create-task";
import { tryCatch } from "@/hooks/try-catch";
import { toast } from "sonner";
import slugify from "slugify";
import { TableCell, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface InlineTaskFormProps {
    workspaceId: string;
    projectId: string;
    onCancel: () => void;
    onTaskCreated?: (task: any, tempId?: string) => void;
    onTaskDeleted?: (taskId: string) => void;
    projects?: { id: string; name: string; canManageMembers?: boolean; }[];
    level?: "workspace" | "project";
    leadProjectIds?: string[];
    isWorkspaceAdmin?: boolean;
}

/**
 * Inline task creation form that appears as a table row
 * Similar to ClickUp's inline editing experience
 */
export function InlineTaskForm({
    workspaceId,
    projectId: initialProjectId,
    onCancel,
    onTaskCreated,
    onTaskDeleted,
    projects = [],
    level = "project",
    leadProjectIds = [],
    isWorkspaceAdmin = false,
}: InlineTaskFormProps) {
    const [pending, startTransition] = useTransition();
    const [taskName, setTaskName] = useState("");

    // Filter projects where the user is a lead if viewing at workspace level
    // Logic:
    // 1. If NOT workspace level (e.g. project view), show all (usually scoped by parent)
    // 2. If Admin, show all
    // 3. Otherwise, strictly show ONLY projects where user is Lead OR Project Manager
    const availableProjects = level === "workspace"
        ? (isWorkspaceAdmin ? projects : projects.filter(p => leadProjectIds.includes(p.id) || p.canManageMembers))
        : projects;

    const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId || (availableProjects[0]?.id || ""));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (pending) return;

        if (!taskName.trim()) {
            toast.error("Task name is required");
            return;
        }

        if (taskName.trim().length < 3) {
            toast.error("Task name must be at least 3 characters long");
            return;
        }

        // Auto-generate slug from task name
        const taskSlug = slugify(taskName.trim(), { lower: true, strict: true });

        if (taskSlug.length < 3) {
            toast.error("Task name must generate a valid slug (at least 3 characters)");
            return;
        }

        // LEVEL 1: Optimistic UI Update for Creation
        const tempId = `temp-${Date.now()}`;
        const optimisticTask = {
            id: tempId,
            name: taskName.trim(),
            taskSlug: taskSlug,
            projectId: level === "workspace" ? selectedProjectId : initialProjectId,
            createdAt: new Date(),
            updatedAt: new Date(),
            subtaskCount: 0,
            completedSubtaskCount: 0,
            isOptimistic: true,
        };

        onTaskCreated?.(optimisticTask);
        setTaskName("");
        onCancel();

        startTransition(async () => {
            const { data: result, error } = await tryCatch(
                createTask({
                    name: taskName.trim(),
                    taskSlug: taskSlug,
                    projectId: level === "workspace" ? selectedProjectId : initialProjectId,
                })
            );

            if (error || result.status !== "success") {
                toast.error(error?.message || result?.message || "Failed to create task");
                // ROLLBACK: Remove the optimistic item from TaskTable
                if (onTaskDeleted) {
                    onTaskDeleted(tempId);
                }
                return;
            }

            toast.success("Task created");
            onTaskCreated?.(result.data, tempId);
        });
    };

    return (
        <TableRow className="bg-muted/20 hover:bg-muted/30 h-8 [&_td]:p-0">
            <TableCell className="w-[50px]"></TableCell>

            {/* Task Name Input */}
            <TableCell className="min-w-[250px]">
                <div className="flex flex-col">
                    <Input
                        placeholder="Task name..."
                        value={taskName}
                        onChange={(e) => setTaskName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit(e);
                            }
                            if (e.key === "Escape") {
                                onCancel();
                            }
                        }}
                        autoFocus
                        disabled={pending}
                        className="h-8 border-primary/50 focus-visible:ring-primary"
                    />
                    {taskName.trim().length > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 px-1">
                            Slug: <span className="font-mono">{slugify(taskName.trim(), { lower: true, strict: true })}</span>
                        </p>
                    )}
                </div>
            </TableCell>

            {/* Project Selection (Workspace Level) or Description placeholder */}
            <TableCell className="w-[200px]">
                {level === "workspace" ? (
                    <Select
                        value={selectedProjectId}
                        onValueChange={setSelectedProjectId}
                        disabled={pending}
                    >
                        <SelectTrigger className="h-8">
                            <SelectValue placeholder="Select project" />
                        </SelectTrigger>
                        <SelectContent>
                            {availableProjects.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                ) : (
                    <Input
                        placeholder="Description (optional)..."
                        disabled={pending}
                        className="h-8 text-muted-foreground"
                    />
                )}
            </TableCell>

            {/* Other columns - Empty placeholders */}
            <TableCell className="w-[200px]"></TableCell>
            <TableCell className="w-[120px]"></TableCell>
            <TableCell className="w-[150px]"></TableCell>
            <TableCell className="w-[150px]"></TableCell>
            <TableCell className="w-[120px]"></TableCell>
            <TableCell className="w-[150px]"></TableCell>

            {/* Action Buttons */}
            <TableCell className="w-[50px]">
                <div className="flex items-center gap-1">
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 hover:bg-green-100 hover:text-green-600"
                        onClick={handleSubmit}
                        disabled={pending || taskName.trim().length < 3}
                    >
                        {pending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Check className="h-4 w-4" />
                        )}
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 hover:bg-red-100 hover:text-red-600"
                        onClick={onCancel}
                        disabled={pending}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    );
}
