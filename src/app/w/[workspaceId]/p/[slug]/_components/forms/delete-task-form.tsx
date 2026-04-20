"use client";

import { useState, useTransition } from "react";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { tryCatch } from "@/hooks/try-catch";
import { deleteTask } from "@/actions/task/delete-task";
import { TaskWithSubTasks } from "../list/types";
import { useReloadView } from "@/hooks/use-reload-view";

interface DeleteTaskDialogProps {
    task: TaskWithSubTasks;
    onTaskDeleted?: (taskId: string) => void;
}

/**
 * Alert dialog for deleting a task
 * - Shows confirmation message
 * - Warns about cascade deletion of subtasks
 * - Handles deletion and UI updates
 */
export function DeleteTaskDialog({ task, onTaskDeleted }: DeleteTaskDialogProps) {
    const [open, setOpen] = useState(false);
    const [pending, startTransition] = useTransition();
    const subtaskCount = task._count?.subTasks || 0;
    const reloadView = useReloadView();

    const handleDelete = () => {
        if (pending) return;
        startTransition(async () => {
            const { data: result, error } = await tryCatch(deleteTask(task.id));

            if (error) {
                toast.error(error.message);
                console.error(error);
                return;
            }

            if (result.status === "success") {
                toast.success(result.message);
                setOpen(false);

                // Call the callback to remove task from UI
                if (onTaskDeleted) {
                    onTaskDeleted(task.id);
                }

                // Reload all views to reflect deletion
                reloadView();
            } else {
                toast.error(result.message);
            }
        });
    };

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Task
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <div className="flex items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                        </div>
                        <AlertDialogTitle>Delete Task</AlertDialogTitle>
                    </div>
                    <AlertDialogDescription className="space-y-2 pt-3">
                        <p>
                            Are you sure you want to delete <span className="font-semibold text-foreground">"{task.name}"</span>?
                        </p>
                        {subtaskCount > 0 && (
                            <div className="rounded-md bg-destructive/10 p-3 text-sm border border-destructive/20">
                                <p className="font-medium text-destructive flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4" />
                                    Warning: This task has {subtaskCount} subtask{subtaskCount > 1 ? 's' : ''}
                                </p>
                                <p className="mt-2 text-destructive/90">
                                    All {subtaskCount} subtask{subtaskCount > 1 ? 's' : ''} will be <span className="font-semibold">automatically deleted</span> when you delete this task.
                                </p>
                                <p className="mt-1 text-destructive/80 text-xs">
                                    This is a cascade deletion and cannot be undone.
                                </p>
                            </div>
                        )}
                        <p className="text-sm">
                            This action cannot be undone. This will permanently delete the task and all its data.
                        </p>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault();
                            handleDelete();
                        }}
                        disabled={pending}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {pending ? (
                            <>
                                Deleting...
                                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                            </>
                        ) : (
                            <>
                                Delete Task
                                <Trash2 className="ml-2 h-4 w-4" />
                            </>
                        )}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
