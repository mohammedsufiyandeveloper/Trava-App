"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition, useState, useEffect, useMemo } from "react";
import { Resolver, useForm, useWatch } from "react-hook-form";
import { Check, Loader2, PlusIcon, SparkleIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { subTaskSchema, SubTaskSchemaType } from "@/lib/zodSchemas";
import { tryCatch } from "@/hooks/try-catch";
import { useConfetti } from "@/hooks/use-confetti";
import { toast } from "sonner";
import type { ProjectMembersType } from "@/data/project/get-project-members";
import slugify from "slugify";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { createSubTask } from "@/actions/task/create-subTask";
import { useReloadView } from "@/hooks/use-reload-view";
import { ProjectReviewer } from "@/actions/project/get-project-reviewers";
import { parseIST } from "@/lib/utils";
import { DateTimePicker } from "@/components/ui/date-picker";

interface iAppProps {
    members: ProjectMembersType;
    workspaceId: string;
    projectId?: string;
    parentTaskId?: string;
    onSubTaskCreated?: (subTask: any) => void;
    level?: "workspace" | "project";
    tags?: { id: string; name: string; }[];
    parentTasks?: { id: string; name: string; projectId: string; }[];
    projects?: { id: string; name: string; }[];
    customTrigger?: React.ReactNode;
    /** When provided, the dialog is controlled externally (e.g. from QuickCreateSubTask) */
    dialogOpen?: boolean;
    onDialogOpenChange?: (open: boolean) => void;
}

export const CreateSubTaskForm = ({
    members,
    workspaceId,
    projectId,
    parentTaskId,
    onSubTaskCreated,
    level = "project",
    tags = [],
    parentTasks = [],
    projects = [],
    customTrigger,
    dialogOpen,
    onDialogOpenChange,
}: iAppProps) => {
    const [pending, startTransition] = useTransition();
    const { triggerConfetti } = useConfetti();
    const [internalOpen, setInternalOpen] = useState(false);

    // Support both controlled (from parent) and uncontrolled dialog
    const isExternalDialog = dialogOpen !== undefined;
    const open = isExternalDialog ? dialogOpen : internalOpen;
    const setOpen = isExternalDialog ? (onDialogOpenChange ?? setInternalOpen) : setInternalOpen;
    const [autoSlugEnabled, setAutoSlugEnabled] = useState(true);

    // Initialize selectedProjectId from projectId or first parent task's projectId
    const initialProjectId = projectId || (parentTasks.length > 0 ? parentTasks[0].projectId : "");
    const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId);

    // const router = useRouter();
    const reloadView = useReloadView();
    const [reviewers, setReviewers] = useState<ProjectReviewer[]>([]);

    // Memoize filtered parent tasks to prevent infinite loops
    const filteredParentTasks = useMemo(() => {
        if (level === "workspace" && selectedProjectId) {
            return parentTasks.filter(task => task.projectId === selectedProjectId);
        }
        return parentTasks;
    }, [level, selectedProjectId, parentTasks]);

    const form = useForm<SubTaskSchemaType>({
        resolver: zodResolver(subTaskSchema) as unknown as Resolver<SubTaskSchemaType>,
        defaultValues: {
            reviewerId: "",
            days: 1,
            name: "",
            description: "",
            taskSlug: "",
            startDate: (() => {
                const now = new Date(Date.now() + 10 * 60000); // 10 minutes in future
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                return `${year}-${month}-${day}T${hours}:${minutes}`;
            })(),
            dueDate: (() => {
                const now = new Date(Date.now() + 30 * 60000); // 30 minutes in future for due date
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                return `${year}-${month}-${day}T${hours}:${minutes}`;
            })(),
            assignee: "",
            status: "TO_DO",
            tag: tags[0]?.id || "", // Use first tag's ID or empty string
            projectId: projectId || (parentTasks.length > 0 ? parentTasks[0].projectId : "") || "",
            parentTaskId: parentTaskId || (parentTasks.length > 0 ? parentTasks[0].id : "") || "",
        },
    });

    const watchedStartDate = useWatch({ control: form.control, name: "startDate" });
    const watchedDueDate = useWatch({ control: form.control, name: "dueDate" });
    const watchedDays = useWatch({ control: form.control, name: "days" });

    // Fetch reviewers
    useEffect(() => {
        if (!open) return;
        const fetchReviewers = async () => {
            try {
                const targetId = selectedProjectId || projectId || "";
                if (!targetId) return;

                const response = await fetch(`/api/projects/${targetId}/reviewers`);
                if (response.ok) {
                    const fetched = await response.json();
                    setReviewers(fetched);
                }
            } catch (err) {
                console.error("Failed to fetch reviewers", err);
            }
        };
        fetchReviewers();
    }, [open, selectedProjectId, projectId]);

    const syncDueDate = (startDate: string, days: number) => {
        if (!startDate) return;
        const start = parseIST(startDate);
        if (start) {
            const due = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
            const year = due.getFullYear();
            const month = String(due.getMonth() + 1).padStart(2, '0');
            const day = String(due.getDate()).padStart(2, '0');
            const hours = String(due.getHours()).padStart(2, '0');
            const minutes = String(due.getMinutes()).padStart(2, '0');
            form.setValue("dueDate", `${year}-${month}-${day}T${hours}:${minutes}`, { shouldDirty: true, shouldValidate: true });
        }
    };

    const syncDays = (startDate: string, dueDate: string) => {
        if (!startDate || !dueDate) return;
        const start = parseIST(startDate);
        const due = parseIST(dueDate);
        if (start && due) {
            const diffTime = due.getTime() - start.getTime();
            const calculatedDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));
            form.setValue("days", calculatedDays, { shouldDirty: true, shouldValidate: true });
        }
    };


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
        if (watchedName) {
            const newSlug = slugify(watchedName, { lower: true, strict: true });
            form.setValue('taskSlug', newSlug, { shouldValidate: false });
        }
    }, [watchedName, autoSlugEnabled, open, form]);

    // Reset auto-slug when dialog opens
    useEffect(() => {
        if (open) {
            setAutoSlugEnabled(true);
            // Reset to initial project if at workspace level
            if (level === "workspace") {
                setSelectedProjectId(initialProjectId);
            }
        }
    }, [open, level, initialProjectId]);

    // Auto-select first parent task when project changes
    useEffect(() => {
        if (level === "workspace" && selectedProjectId && filteredParentTasks.length > 0) {
            const currentParentTaskId = form.getValues('parentTaskId');
            const isCurrentTaskInProject = filteredParentTasks.some(t => t.id === currentParentTaskId);

            // If current parent task is not in the filtered list, select the first one
            if (!isCurrentTaskInProject) {
                form.setValue('parentTaskId', filteredParentTasks[0].id);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedProjectId, filteredParentTasks, level]);

    function onSubmit(data: SubTaskSchemaType) {
        startTransition(async () => {
            const { data: result, error } = await tryCatch(createSubTask(data));
            console.log("results", { result });

            if (error) {
                toast.error(error.message);
                console.error(error);
                return;
            }

            if (result.status === "success") {
                toast.success(result.message);
                triggerConfetti();
                form.reset();
                setOpen(false);

                // Notify parent to add subtask to state immediately
                if (onSubTaskCreated && result.data) {
                    onSubTaskCreated(result.data);
                }

                // Reload all views to show the new subtask
                reloadView();
            } else (
                toast.error(result.message)
            )
        });
    }



    const formContent = (
        <>
            <DialogHeader>
                <DialogTitle>
                    {level === "workspace" ? "Create New Task" : "Create New SubTask"}
                </DialogTitle>
            </DialogHeader>

            <div className="mt-4 overflow-y-auto px-2 py-1 max-h-[70vh] thin-scrollbar">
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-5"
                    >
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{level === "workspace" ? "Task Name" : "SubTask Name"}</FormLabel>
                                    <FormControl>
                                        <Input placeholder={level === "workspace" ? "Enter task name" : "Enter subtask name"} {...field} />
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

                        {/* Project and Parent Task Selection - Side by side on desktop, stacked on mobile */}
                        {level === "workspace" && projects.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Project Selection */}
                                <FormField
                                    control={form.control}
                                    name="projectId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Project *</FormLabel>
                                            <Select
                                                onValueChange={(value) => {
                                                    field.onChange(value);
                                                    setSelectedProjectId(value);
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
                                                Select the project for this subtask
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Parent Task Selection */}
                                {filteredParentTasks.length > 0 && (
                                    <FormField
                                        control={form.control}
                                        name="parentTaskId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Parent Task *</FormLabel>
                                                <Select
                                                    onValueChange={field.onChange}
                                                    value={field.value}
                                                    disabled={!selectedProjectId}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder={selectedProjectId ? "Select a parent task" : "Select a project first"} />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {filteredParentTasks.map((task) => (
                                                            <SelectItem key={task.id} value={task.id}>
                                                                {task.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormDescription>
                                                    {selectedProjectId
                                                        ? "Select the parent task for this subtask"
                                                        : "Please select a project first"}
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}
                            </div>
                        )}

                        {/* Description */}
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            {...field}
                                            placeholder={level === "workspace" ? "Task description" : "SubTask description"}
                                            className="resize-none"
                                            rows={4}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Tag Selection */}
                        <FormField
                            control={form.control}
                            name="tag"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tag</FormLabel>
                                    {tags.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {tags.map((tag) => (
                                                <div
                                                    key={tag.id}
                                                    className={cn(
                                                        "flex flex-row items-center gap-2 cursor-pointer px-3 py-1.5 rounded-full border-2 transition-all",
                                                        field.value === tag.id
                                                            ? "border-primary bg-primary/10"
                                                            : "border-muted hover:border-primary/50"
                                                    )}
                                                    onClick={() => field.onChange(tag.id)}
                                                >
                                                    <span className="text-xs font-normal">{tag.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">No tags available. Create tags in workspace settings.</p>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Date and Duration */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField
                                control={form.control}
                                name="startDate"
                                render={({ field }) => (
                                    <FormItem >
                                        <FormLabel>Start Date</FormLabel>
                                        <FormControl>
                                            <DateTimePicker
                                                value={field.value}
                                                onChange={(value) => {
                                                    field.onChange(value);
                                                    syncDueDate(value, form.getValues("days") || 1);
                                                }}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="days"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Days</FormLabel>
                                        <FormControl>
                                            <Input 
                                                type="number" 
                                                min={1} 
                                                {...field} 
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value) || 1;
                                                    field.onChange(val);
                                                    syncDueDate(form.getValues("startDate") || "", val);
                                                }}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="dueDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Due Date</FormLabel>
                                        <FormControl>
                                            <DateTimePicker
                                                value={field.value}
                                                onChange={(value) => {
                                                    field.onChange(value);
                                                    syncDays(form.getValues("startDate") || "", value);
                                                }}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                                <FormItem >
                                    <FormLabel>Status</FormLabel>
                                    <FormControl>
                                        <Input
                                            value="TO DO"
                                            disabled
                                            className="bg-muted cursor-not-allowed"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="assignee"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Assignee *</FormLabel>
                                    <FormDescription className="text-xs text-muted-foreground mb-2">
                                        Select the assignee (only one allowed).
                                    </FormDescription>
                                    <div className="space-y-2">
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-full justify-between font-normal">
                                                    {field.value
                                                        ? (() => {
                                                            const m = members?.find((m) => m.userId === field.value);
                                                            return `${m?.user.surname || ''}`;
                                                        })()
                                                        : "Select assignee"}
                                                </Button>
                                            </PopoverTrigger>

                                            <PopoverContent className="p-0 w-64">
                                                <Command>
                                                    <CommandInput placeholder="Search members…" />
                                                    <CommandList>
                                                        <CommandEmpty>No members found.</CommandEmpty>
                                                        <CommandGroup>
                                                            {members?.filter((member) => {
                                                                const role = member.projectRole;
                                                                return role !== "VIEWER"; // Adjust logic if needed
                                                            }).map((member) => {
                                                                const user = member.user;
                                                                const userName = `${user.surname || ''}`;
                                                                const userId = user.id;
                                                                const isSelected = field.value === userId;

                                                                return (
                                                                    <CommandItem
                                                                        key={userId}
                                                                        value={userName}
                                                                        onSelect={() => {
                                                                            field.onChange(userId);
                                                                        }}
                                                                    >
                                                                        <Check
                                                                            className={cn(
                                                                                "mr-2 h-4 w-4",
                                                                                isSelected ? "opacity-100" : "opacity-0"
                                                                            )}
                                                                        />
                                                                        {userName}
                                                                    </CommandItem>
                                                                );
                                                            })}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Reviewer Field */}
                        <FormField
                            control={form.control}
                            name="reviewerId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Reviewer *</FormLabel>
                                    <FormDescription className="text-xs text-muted-foreground mb-2">
                                        Select the reviewer.
                                    </FormDescription>
                                    <div className="space-y-2">
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-full justify-between font-normal">
                                                    {field.value
                                                        ? (() => {
                                                            const r = reviewers.find((r) => r.id === field.value);
                                                            return `${r?.surname || ''}`;
                                                        })()
                                                        : "Select reviewer"}
                                                </Button>
                                            </PopoverTrigger>

                                            <PopoverContent className="p-0 w-64">
                                                <Command>
                                                    <CommandInput placeholder="Search reviewers…" />
                                                    <CommandList>
                                                        <CommandEmpty>No reviewers found.</CommandEmpty>
                                                        <CommandGroup>
                                                            {reviewers.map((reviewer) => {
                                                                const userName = `${reviewer.surname || ''}`;
                                                                const userId = reviewer.id;
                                                                const isSelected = field.value === userId;

                                                                return (
                                                                    <CommandItem
                                                                        key={userId}
                                                                        value={userName}
                                                                        onSelect={() => {
                                                                            field.onChange(userId);
                                                                        }}
                                                                    >
                                                                        <Check
                                                                            className={cn(
                                                                                "mr-2 h-4 w-4",
                                                                                isSelected ? "opacity-100" : "opacity-0"
                                                                            )}
                                                                        />
                                                                        {userName}
                                                                    </CommandItem>
                                                                );
                                                            })}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end items-center gap-4 pt-2 mb-2">
                            <Button type="submit" disabled={pending}>
                                {pending ? (
                                    <>
                                        Creating...
                                        <Loader2 className="ml-1 h-4 w-4 animate-spin" />
                                    </>
                                ) : (
                                    <>
                                        {level === "workspace" ? "Create Task" : "Create SubTask"}
                                        <PlusIcon className="ml-1" size={16} />
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </Form>
            </div>
        </>
    );

    // When dialog is externally controlled (QuickCreateSubTask), render just the form content
    if (isExternalDialog) {
        return formContent;
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {customTrigger || (
                    <Button size="sm">
                        <PlusIcon className="mr-2 size-4" />
                        {level === "workspace" ? "Create Task" : "Create Sub-Task"}
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-h-[98vh] w-[min(900px,95vw)] overflow-hidden">
                {formContent}
            </DialogContent>
        </Dialog>
    );
};

