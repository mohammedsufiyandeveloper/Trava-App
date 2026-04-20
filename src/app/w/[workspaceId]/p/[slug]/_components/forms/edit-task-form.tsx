"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition, useEffect } from "react";
import { Resolver, useForm, useWatch } from "react-hook-form";
import { Loader2, Pencil, SparkleIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { taskSchema, TaskSchemaType } from "@/lib/zodSchemas";
import { tryCatch } from "@/hooks/try-catch";
import { toast } from "sonner";
import slugify from "slugify";
import { editTask } from "@/actions/task/update-task";
import { ProjectReviewer } from "@/actions/project/get-project-reviewers";
import { TaskWithSubTasks } from "../list/types";
import { useReloadView } from "@/hooks/use-reload-view";

interface EditTaskDialogProps {
    task: TaskWithSubTasks;
    projectId?: string;
    onTaskUpdated?: (updatedTask: { name: string; taskSlug: string }) => void;
    onUpdateStart?: () => void;
    onUpdateEnd?: () => void;
    level?: "workspace" | "project";
    projects?: { id: string; name: string; }[];
}

/**
 * Dialog component for editing a main task
 * - Only updates if there are actual changes
 * - Auto-generates slug when task name changes
 * - Shows skeleton for specific task during update
 * - Auto-refreshes task list after update
 */
export function EditTaskDialog({
    task,
    projectId,
    onTaskUpdated,
    onUpdateStart,
    onUpdateEnd,
    level = "project", // Default to project level
    projects = [], // Default to empty array
}: EditTaskDialogProps) {
    const [pending, startTransition] = useTransition();
    const [open, setOpen] = useState(false);
    const [autoSlugEnabled, setAutoSlugEnabled] = useState(true);
    const reloadView = useReloadView();

    const form = useForm<TaskSchemaType>({
        resolver: zodResolver(taskSchema) as unknown as Resolver<TaskSchemaType>,
        defaultValues: {
            name: task.name,
            taskSlug: task.taskSlug,
            projectId: task.projectId,
        },
    });

    useEffect(() => {
        if (open) {
            fetch(`/api/projects/${task.projectId}/reviewers`)
                .then(res => res.json())
                .then((fetchedReviewers: ProjectReviewer[]) => {

                    // Default to Task Creator if no reviewer set
                    if (!form.getValues("reviewerId")) {
                        const creatorId = (task as any).createdById || (task as any).createdBy?.userId;
                        const creator = fetchedReviewers.find(r => r.id === creatorId);

                        if (creator) {
                            form.setValue("reviewerId", creator.id);
                        }
                    }
                })
                .catch(err => console.error("Failed to fetch reviewers", err));
        }
    }, [open, form, task]);

    const watchedName = useWatch({
        control: form.control,
        name: "name",
    });

    const watchedTaskSlug = useWatch({
        control: form.control,
        name: "taskSlug",
    });

    useEffect(() => {
        if (!autoSlugEnabled || !open) return;
        if (!watchedName) return;

        const newSlug = slugify(watchedName, { lower: true, strict: true });
        form.setValue("taskSlug", newSlug, { shouldValidate: false });
    }, [watchedName, autoSlugEnabled, open, form]);

    function onSubmit(values: TaskSchemaType) {
        if (pending) return;
        // Check if there are any actual changes
        const hasChanges =
            values.name !== task.name ||
            values.taskSlug !== task.taskSlug;

        if (!hasChanges) {
            toast.info("No changes detected");
            setOpen(false);
            return;
        }

        startTransition(async () => {
            if (onUpdateStart) onUpdateStart();
            const { data: result, error } = await tryCatch(editTask(values, task.id));
            if (onUpdateEnd) onUpdateEnd();

            if (error) {
                toast.error(error.message);
                console.error(error);
                return;
            }

            if (result.status === "success") {
                toast.success(result.message);
                setOpen(false);

                // Pass the updated data to the callback
                // This allows immediate UI update without waiting for router.refresh()
                if (onTaskUpdated) {
                    onTaskUpdated({
                        name: values.name,
                        taskSlug: values.taskSlug,
                    });
                }

                // Reload all views to show the updated task
                reloadView();
            } else {
                toast.error(result.message);
            }
        });
    }



    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen);

                if (nextOpen) {
                    setAutoSlugEnabled(true);
                }
            }}
        >
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-start">
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit Task
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Edit Task</DialogTitle>
                </DialogHeader>
                <div className="mt-4">
                    <Form {...form}>
                        <form
                            onSubmit={form.handleSubmit(onSubmit, (errors) => console.log("Validation Errors:", errors))}
                            className="space-y-5"
                        >
                            {/* Project Selection - Only for workspace level */}
                            {level === "workspace" && projects.length > 0 && (
                                <FormField
                                    control={form.control}
                                    name="projectId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Project *</FormLabel>
                                            <Select
                                                onValueChange={(value) => {
                                                    field.onChange(value);
                                                }}
                                                value={field.value}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select a project" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {projects.map((project) => (
                                                        <SelectItem key={project.id} value={project.id}>
                                                            {project.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormDescription>
                                                Change the project for this task
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}

                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Task Title</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Enter task title"
                                                {...field}
                                            />
                                        </FormControl>
                                        <input type="hidden" {...form.register("taskSlug")} />
                                        {watchedTaskSlug && (
                                            <p className="text-[10px] text-muted-foreground mt-1 px-1">
                                                Slug: <span className="font-mono">{watchedTaskSlug}</span>
                                            </p>
                                        )}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="flex flex-row items-center gap-4 pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setOpen(false);
                                        form.reset();
                                        setAutoSlugEnabled(true);
                                    }}
                                    disabled={pending}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={pending} className="cursor-pointer">
                                    {pending ? (
                                        <>
                                            Updating...
                                            <Loader2 className="ml-1 h-4 w-4 animate-spin" />
                                        </>
                                    ) : (
                                        <>
                                            Update Task
                                            <Pencil className="ml-1" size={16} />
                                        </>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </div>
            </DialogContent>
        </Dialog>
    );
}
