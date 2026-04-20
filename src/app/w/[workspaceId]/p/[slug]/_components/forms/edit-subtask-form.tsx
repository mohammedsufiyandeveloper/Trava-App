"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition, useEffect, useMemo } from "react";
import { Resolver, useForm, useWatch } from "react-hook-form";
import { Check, Loader2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { subTaskSchema, SubTaskSchemaType } from "@/lib/zodSchemas";
import { tryCatch } from "@/hooks/try-catch";
import { toast } from "sonner";
import type { ProjectMembersType } from "@/data/project/get-project-members";
import slugify from "slugify";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { editSubTask } from "@/actions/task/update-subTask";
import { getStatusColors, getStatusLabel } from "@/lib/colors/status-colors";
import { Badge } from "@/components/ui/badge";
import { useReloadView } from "@/hooks/use-reload-view";
import { parseIST } from "@/lib/utils";
import { ProjectReviewer } from "@/actions/project/get-project-reviewers";
import { DateTimePicker } from "@/components/ui/date-picker";

type SubTaskBase = {
    id: string;
    name: string;
    description: string | null;
    taskSlug: string;
    tag: { id: string } | null;
    status: string | null;
    startDate: Date | string | null;
    dueDate: Date | string | null;
    days: number | null;
    assignee?: {
        id: string;
        workspaceMember?: {
            userId: string;
        };
    } | null;
    reviewer?: {
        id: string;
        workspaceMember?: {
            userId: string;
        };
    } | null;
};

interface EditSubTaskFormProps<T extends SubTaskBase> {
    subTask: T;
    members?: ProjectMembersType;
    projectId?: string; // Optional for workspace level
    parentTaskId?: string; // Optional for workspace level
    onSubTaskUpdated?: (updatedData: Partial<T>) => void;
    level?: "workspace" | "project"; // Explicitly define the level
    tags?: { id: string; name: string; }[]; // Dynamic tags
    projects?: { id: string; name: string; }[]; // For workspace-level project selection
    parentTasks?: { id: string; name: string; projectId: string; }[]; // For workspace-level parent task selection
    reviewerId?: string | null;
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function EditSubTaskForm<T extends SubTaskBase>({
    subTask,
    members = [],
    projectId,
    parentTaskId,
    onSubTaskUpdated,
    level = "project", // Default to project level
    tags = [], // Default to empty array
    projects = [], // Default to empty array
    parentTasks = [], // Default to empty array
    trigger,
    open: controlledOpen,
    onOpenChange: controlledOnOpenChange,
}: EditSubTaskFormProps<T>) {
    const [pending, startTransition] = useTransition();
    const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : uncontrolledOpen;
    const setOpen = controlledOnOpenChange || setUncontrolledOpen;
    const [selectedProjectId, setSelectedProjectId] = useState<string>(projectId || "");
    const router = useRouter();
    const reloadView = useReloadView();
    const [reviewers, setReviewers] = useState<ProjectReviewer[]>([]);

    // Memoize filtered parent tasks to prevent infinite loops
    const filteredParentTasks = useMemo(() => {
        if (level === "workspace" && selectedProjectId) {
            return parentTasks.filter(task => task.projectId === selectedProjectId);
        }
        return parentTasks;
    }, [level, selectedProjectId, parentTasks]);

    const getFormattedDate = (date: Date | string | null | undefined) => {
        if (!date) return "";
        try {
            const d = new Date(date);
            if (isNaN(d.getTime())) return "";

            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        } catch (e) {
            return "";
        }
    };

    const form = useForm<SubTaskSchemaType>({
        resolver: zodResolver(subTaskSchema) as unknown as Resolver<SubTaskSchemaType>,
        defaultValues: {
            name: subTask.name || "",
            description: subTask.description || "",
            taskSlug: subTask.taskSlug || "",
            projectId: projectId || (subTask as any).projectId || "",
            parentTaskId: parentTaskId || (subTask as any).parentTaskId || "",
            assignee: (subTask.assignee as any)?.WorkspaceMember?.userId || (subTask.assignee as any)?.workspaceMember?.userId || (subTask.assignee as any)?.workspaceMember?.user?.id || (subTask.assignee as any)?.id || (subTask as any).assigneeId || "",
            tag: subTask.tag?.id || (subTask as any).tagId || "",
            status: (subTask.status || "TO_DO") as any,
            startDate: getFormattedDate(subTask.startDate),
            dueDate: getFormattedDate(subTask.dueDate),
            reviewerId: (subTask.reviewer as any)?.WorkspaceMember?.userId || (subTask.reviewer as any)?.workspaceMember?.userId || (subTask.reviewer as any)?.workspaceMember?.user?.id || (subTask.reviewer as any)?.id || (subTask as any).reviewerId || "",
            days: (subTask as any).days || 1,
        },
    });

    // CRITICAL: Reset the form when subTask changes or dialog opens
    useEffect(() => {
        if (open) {
            console.log("🛠️ [EditSubTaskForm] Initializing with subtask data:", subTask);
            form.reset({
                name: subTask.name || "",
                description: subTask.description || "",
                taskSlug: subTask.taskSlug || "",
                projectId: projectId || (subTask as any).projectId || "",
                parentTaskId: parentTaskId || (subTask as any).parentTaskId || "",
                assignee: (subTask.assignee as any)?.WorkspaceMember?.userId || (subTask.assignee as any)?.workspaceMember?.userId || (subTask.assignee as any)?.workspaceMember?.user?.id || (subTask.assignee as any)?.id || (subTask as any).assigneeId || "",
                tag: subTask.tag?.id || (subTask as any).tagId || "",
                status: (subTask.status || "TO_DO") as any,
                startDate: getFormattedDate(subTask.startDate),
                dueDate: getFormattedDate(subTask.dueDate),
                reviewerId: (subTask.reviewer as any)?.WorkspaceMember?.userId || (subTask.reviewer as any)?.workspaceMember?.userId || (subTask.reviewer as any)?.workspaceMember?.user?.id || (subTask.reviewer as any)?.id || (subTask as any).reviewerId || "",
                days: (subTask as any).days || 1,
            });
        }
    }, [subTask, open, form, projectId, parentTaskId]);

    const watchedStartDate = useWatch({ control: form.control, name: "startDate" });
    const watchedDueDate = useWatch({ control: form.control, name: "dueDate" });
    const watchedDays = useWatch({ control: form.control, name: "days" });

    // Fetch reviewers via API route to avoid the "Action Refresh" loop
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
        if (watchedName) {
            const newSlug = slugify(watchedName, { lower: true, strict: true });
            form.setValue('taskSlug', newSlug, { shouldDirty: true, shouldValidate: true });
        }
    }, [watchedName, form]);



    function onSubmit(values: SubTaskSchemaType) {
        // Check if there are any actual changes
        const hasChanges =
            values.status !== (subTask.status || "TO_DO") ||
            values.assignee !== ((subTask.assignee as any)?.WorkspaceMember?.userId || (subTask.assignee as any)?.workspaceMember?.userId || (subTask.assignee as any)?.id || "") ||
            values.tag !== (subTask.tag?.id || "") ||
            values.startDate !== (subTask.startDate ? (() => {
                const d = new Date(subTask.startDate);
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const hours = String(d.getHours()).padStart(2, '0');
                const minutes = String(d.getMinutes()).padStart(2, '0');
                return `${year}-${month}-${day}T${hours}:${minutes}`;
            })() : "") ||
            values.dueDate !== ((subTask as any).dueDate ? (() => {
                const d = new Date((subTask as any).dueDate);
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const hours = String(d.getHours()).padStart(2, '0');
                const minutes = String(d.getMinutes()).padStart(2, '0');
                return `${year}-${month}-${day}T${hours}:${minutes}`;
            })() : "") ||
            values.reviewerId !== ((subTask as any).reviewerId || "") ||
            values.days !== ((subTask as any).days || 1);

        if (!hasChanges) {
            toast.info("No changes detected");
            setOpen(false);
            return;
        }

        startTransition(async () => {
            const { data: result, error } = await tryCatch(editSubTask(values, subTask.id));

            if (error) {
                toast.error(error.message);
                console.error(error);
                return;
            }

            if (result.status === "success") {
                toast.success(result.message);

                if (onSubTaskUpdated) {
                    onSubTaskUpdated({
                        name: values.name,
                        description: values.description,
                        tag: values.tag ? { id: values.tag } : null,
                        startDate: values.startDate ? parseIST(values.startDate) : null,
                        dueDate: values.dueDate ? parseIST(values.dueDate) : null,
                    } as Partial<T>);
                }

                setOpen(false);

                // Reload all views to show the updated subtask
                reloadView();
            } else {
                toast.error(result.message);
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {!isControlled && (
                <DialogTrigger asChild>
                    {trigger || (
                        <Button variant="ghost" size="sm" className="w-full justify-start">
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit SubTask
                        </Button>
                    )}
                </DialogTrigger>
            )}
            <DialogContent className="max-h-[98vh] w-[min(900px,95vw)] overflow-hidden">
                <DialogHeader>
                    <DialogTitle>Edit SubTask</DialogTitle>
                </DialogHeader>

                <div className="mt-4 overflow-y-auto px-2 py-1 max-h-[70vh] thin-scrollbar">
                    <Form {...form}>
                        <form
                            onSubmit={form.handleSubmit(onSubmit, (error) => {
                                console.error(error);
                                toast.error("Failed to update subtask");
                            })}
                            className="space-y-5"
                        >
                            {/* SubTask Name */}
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>SubTask Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Enter subtask name" {...field} />
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
                                                Change the project for this subtask
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}

                            {/* Parent Task Selection - Only for workspace level */}
                            {level === "workspace" && filteredParentTasks.length > 0 && (
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
                                                    ? "Change the parent task for this subtask"
                                                    : "Please select a project first"}
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
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
                                                placeholder="SubTask description"
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

                            {/* Status */}
                            <FormField
                                control={form.control}
                                name="status"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Status</FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select status" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="TO_DO">To Do</SelectItem>
                                                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                                                <SelectItem value="REVIEW">Review</SelectItem>
                                                <SelectItem value="HOLD">Hold</SelectItem>
                                                <SelectItem value="COMPLETED">Completed</SelectItem>
                                                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Assignee */}
                            <FormField
                                control={form.control}
                                name="assignee"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Assignee</FormLabel>
                                        <FormDescription className="text-xs text-muted-foreground mb-2">
                                            Select the assignee (only one allowed).
                                        </FormDescription>
                                        <div className="space-y-2">
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className="w-full justify-between font-normal">
                                                        {field.value
                                                            ? (() => {
                                                                const m = members?.find((m) => m.userId === field.value || m.projectMemberId === field.value);
                                                                return m ? (m.user.surname || m.user.name || "Unknown") : "Unknown User";
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
                                                                    return role !== "VIEWER";
                                                                }).map((member) => {
                                                                    const user = member.user;
                                                                    const userName = `${user.surname}`;
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
                                                                // Use User.id or ProjectMember.id for lookup
                                                                const r = reviewers.find((r) => r.id === field.value);
                                                                if (r) return r.surname || "Unknown Reviewer";

                                                                // Fallback to members list if reviewer list lookup fails
                                                                const m = members?.find((m) => m.userId === field.value || m.projectMemberId === field.value);
                                                                return m ? (m.user.surname || "Unknown") : "Reviewer not found";
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

                            {/* Submit Button */}
                            <div className="flex justify-end items-center gap-4 pt-2 mb-2">
                                <Button type="submit" disabled={pending}>
                                    {pending ? (
                                        <>
                                            Updating...
                                            <Loader2 className="ml-1 h-4 w-4 animate-spin" />
                                        </>
                                    ) : (
                                        <>
                                            Update SubTask
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
