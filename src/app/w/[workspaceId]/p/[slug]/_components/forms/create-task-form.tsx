"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition, useEffect } from "react";
import { Resolver, useForm, useWatch } from "react-hook-form";
import { Loader2, Plus, PlusIcon, SparkleIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { taskSchema, TaskSchemaType } from "@/lib/zodSchemas";
import { tryCatch } from "@/hooks/try-catch";
import { useConfetti } from "@/hooks/use-confetti";
import { toast } from "sonner";
import slugify from "slugify";
import { useRouter } from "next/navigation";
import { useTaskContext } from "@/app/w/[workspaceId]/_components/shared/task-context";
import { createTask } from "@/actions/task/create-task";
import { useReloadView } from "@/hooks/use-reload-view";
import { getColorFromString } from "@/lib/colors/project-colors";

interface iAppProps {
    workspaceId: string;
    projectId?: string; // Optional for workspace-level
    level?: "workspace" | "project"; // Explicitly define the level
    projects?: { id: string; name: string; color?: string; }[]; // For workspace-level project selection
}

export const CreateTaskForm = ({
    workspaceId,
    projectId,
    level = "project", // Default to project level for backward compatibility
    projects = [], // Default to empty array
}: iAppProps) => {
    const [Pending, startTransition] = useTransition();
    const { triggerConfetti } = useConfetti();
    const [open, setOpen] = useState(false);
    const [autoSlugEnabled, setAutoSlugEnabled] = useState(true);
    const router = useRouter();
    const { addNewTask, updateTask, removeTask, setIsAddingTask } = useTaskContext();
    const reloadView = useReloadView();

    const form = useForm<TaskSchemaType>({
        resolver: zodResolver(taskSchema) as unknown as Resolver<TaskSchemaType>,
        defaultValues: {
            name: "",
            taskSlug: "",
            projectId: projectId || (projects.length > 0 ? projects[0].id : ""),
        },
    })

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

    useEffect(() => {
        if (open) {
            setAutoSlugEnabled(true);
        }
    }, [open]);

    function onSubmit(values: TaskSchemaType) {
        const tempId = `temp-${crypto.randomUUID()}`;
        const optimisticTask = {
            id: tempId,
            name: values.name,
            taskSlug: values.taskSlug,
            projectId: values.projectId,
            createdAt: new Date(),
            updatedAt: new Date(),
            status: "TO_DO", // Default status
            _count: { subTasks: 0 },
            isOptimistic: true,
            // Add other required fields with defaults
            assignee: null,
            tag: null,
            priority: null,
        };

        addNewTask(optimisticTask as any);
        setOpen(false);
        form.reset();
        triggerConfetti();

        startTransition(async () => {
            // setIsAddingTask(true); // Maybe not needed if we are optimistic?
            const { data: result, error } = await tryCatch(createTask(values));

            if (error) {
                toast.error(error.message);
                console.error(error);
                removeTask(tempId); // Rollback
                return;
            }

            if (result.status === "success" && result.data) {
                toast.success(result.message);

                // Replace optimistic task with real task
                updateTask(tempId, result.data as any);

                // Reload all views to ensure consistency
                reloadView();
            } else {
                toast.error(result.message);
                removeTask(tempId); // Rollback
            }
        });
    }




    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button
                        className="cursor-pointer">
                        Create Task
                    </Button>
                </DialogTrigger>
                <DialogContent >
                    <DialogHeader>
                        <DialogTitle>Create New Task</DialogTitle>
                    </DialogHeader>
                    <div className="mt-4">
                        <Form {...form}>
                            <form
                                onSubmit={form.handleSubmit(onSubmit, (errors) => console.log("Validation Errors:", errors))}
                                className="space-y-5"
                            >
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Task Title</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Enter task title" {...field} />
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

                                {/* Project Selection - Only for workspace level */}
                                {level === "workspace" && projects.length > 0 && (
                                    <FormField
                                        control={form.control}
                                        name="projectId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Project</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select a project" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {projects.map((project) => (
                                                            <SelectItem key={project.id} value={project.id}>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="h-2 w-2 rounded-full border shadow-sm" style={{ backgroundColor: project.color || getColorFromString(project.name) }} />
                                                                    {project.name}
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}

                                <div className="flex flex-row items-center gap-4">
                                    <Button type="submit" disabled={Pending} className="cursor-pointer">
                                        {
                                            Pending ? (
                                                <>
                                                    Creating...
                                                    <Loader2 className="ml-1 h-4 w-4 animate-spin" />
                                                </>
                                            ) : (
                                                <>
                                                    Create Task
                                                    <PlusIcon className="ml-1" size={16} />
                                                </>
                                            )
                                        }
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};
