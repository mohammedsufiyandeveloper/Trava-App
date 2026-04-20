"use client";

import { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Check, Loader2 } from "lucide-react";
import { createSubTask } from "@/actions/task/create-subTask";
import { editSubTask } from "@/actions/task/update-subTask";
import { tryCatch } from "@/hooks/try-catch";
import { toast } from "sonner";
import slugify from "slugify";
import { TableCell, TableRow } from "@/components/ui/table";
import { ProjectMembersType, getProjectMembers } from "@/data/project/get-project-members";
import { SubTaskStatus, STATUS_OPTIONS, subTaskSchema } from "@/lib/zodSchemas";
import { ColumnVisibility } from "../shared/column-visibility";
import { SubTaskType } from "@/data/task";
import { ApiResponse } from "@/lib/types";
import { ProjectReviewer } from "@/actions/project/get-project-reviewers";
import { cn, parseIST } from "@/lib/utils";
import { DateTimePicker } from "@/components/ui/date-picker";

interface InlineSubTaskFormProps {
    workspaceId: string;
    projectId: string;
    parentTaskId: string;
    members: ProjectMembersType;
    tags?: { id: string; name: string; }[];
    columnVisibility: ColumnVisibility;
    onCancel: () => void;
    onSubTaskCreated?: (subTask: any, tempId?: string) => void;
    onSubTaskUpdated?: (subTaskId: string, updatedData: Partial<SubTaskType>) => void;
    onSubTaskDeleted?: (subTaskId: string) => void;
    // Edit mode props
    mode?: "create" | "edit";
    subTask?: SubTaskType; // Required when mode is "edit"
    userId?: string; // Current user ID for default reviewer
}

/**
 * Unified inline subtask form for both create and edit modes
 * Similar to ClickUp's inline editing experience
 */
export function InlineSubTaskForm({
    workspaceId,
    projectId,
    parentTaskId,
    members,
    tags = [],
    columnVisibility,
    onCancel,
    onSubTaskCreated,
    onSubTaskUpdated,
    onSubTaskDeleted,
    mode = "create",
    subTask,
    userId,
}: InlineSubTaskFormProps) {
    const [pending, startTransition] = useTransition();
    const [subTaskName, setSubTaskName] = useState(subTask?.name || "");
    const [description, setDescription] = useState(subTask?.description || "");
    const [assignee, setAssignee] = useState(subTask?.assignee?.WorkspaceMember?.user?.id || "");
    const [reviewer, setReviewer] = useState(subTask?.reviewer?.WorkspaceMember?.user?.id || "");
    const [reviewers, setReviewers] = useState<ProjectReviewer[]>([]);
    const [status, setStatus] = useState<typeof SubTaskStatus[number]>(
        (subTask?.status as typeof SubTaskStatus[number]) || "TO_DO"
    );
    const [startDate, setStartDate] = useState(
        subTask?.startDate ? (() => {
            const d = new Date(subTask.startDate);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        })() : (() => {
            const now = new Date(Date.now() + 10 * 60000);
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        })()
    );
    const [dueDate, setDueDate] = useState(
        (subTask as any)?.dueDate ? (() => {
            const d = new Date((subTask as any).dueDate);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        })() : (() => {
            const now = new Date(Date.now() + 30 * 60000);
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        })()
    );
    const [tag, setTag] = useState(subTask?.tag?.id || "");
    const [days, setDays] = useState<number>(subTask?.days || 1);

    const handleStartDateChange = (val: string) => {
        setStartDate(val);
        if (val && days) {
            const start = parseIST(val);
            if (start) {
                const due = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
                const year = due.getFullYear();
                const month = String(due.getMonth() + 1).padStart(2, '0');
                const day = String(due.getDate()).padStart(2, '0');
                const hours = String(due.getHours()).padStart(2, '0');
                const minutes = String(due.getMinutes()).padStart(2, '0');
                setDueDate(`${year}-${month}-${day}T${hours}:${minutes}`);
            }
        }
    };

    const handleDueDateChange = (val: string) => {
        setDueDate(val);
        if (startDate && val) {
            const start = parseIST(startDate);
            const due = parseIST(val);
            if (start && due) {
                const diffTime = due.getTime() - start.getTime();
                const calculatedDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));
                setDays(calculatedDays);
            }
        }
    };

    const handleDaysChange = (val: number) => {
        setDays(val);
        if (startDate && val) {
            const start = parseIST(startDate);
            if (start) {
                const due = new Date(start.getTime() + val * 24 * 60 * 60 * 1000);
                const year = due.getFullYear();
                const month = String(due.getMonth() + 1).padStart(2, '0');
                const day = String(due.getDate()).padStart(2, '0');
                const hours = String(due.getHours()).padStart(2, '0');
                const minutes = String(due.getMinutes()).padStart(2, '0');
                setDueDate(`${year}-${month}-${day}T${hours}:${minutes}`);
            }
        }
    };

    const [availableMembers, setAvailableMembers] = useState<ProjectMembersType>(members);

    // Fetch project members for this specific project (to fix global view scope)
    useEffect(() => {
        const fetchMembers = async () => {
            if (projectId) {
                try {
                    // Start with passed members as fallback or loading state
                    // Fetch real project members
                    const pMembers = await getProjectMembers(projectId);
                    if (pMembers && pMembers.length > 0) {
                        setAvailableMembers(pMembers);
                    }
                } catch (error) {
                    console.error("Failed to fetch project members", error);
                }
            }
        };
        fetchMembers();
    }, [projectId]);

    // Fetch reviewers and set default reviewer to current user when component mounts
    useEffect(() => {
        const fetchData = async () => {
            try {
                if (!projectId) return;
                const response = await fetch(`/api/projects/${projectId}/reviewers`);
                if (!response.ok) throw new Error("Failed to fetch");

                const fetchedReviewers = await response.json();
                setReviewers(fetchedReviewers);

                // For create mode, set current user as default reviewer if they're eligible
                if (mode === "create" && !reviewer && userId) {
                    const isReviewerEligible = (fetchedReviewers as ProjectReviewer[]).some(r => r.id === userId);
                    if (isReviewerEligible) {
                        setReviewer(userId);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch reviewers", err);
            }
        };

        fetchData();
    }, [projectId, mode, reviewer, userId]);


    // Helper function to get role shortcuts
    const getRoleShortcut = (role: string): string => {
        const shortcuts: Record<string, string> = {
            'PROJECT_MANAGER': 'PM',
            'LEAD': 'Lead',
            'OWNER': 'Owner',
            'ADMIN': 'Admin',
        };
        return shortcuts[role] || role;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (pending) return;

        const taskSlug = mode === "create"
            ? slugify(subTaskName.trim(), { lower: true, strict: true })
            : (subTask?.taskSlug || "");

        // Collect form data for validation
        const formData = {
            name: subTaskName.trim(),
            description: description.trim() || undefined,
            taskSlug,
            status,
            projectId,
            parentTaskId,
            assignee: assignee,
            reviewerId: reviewer || undefined,
            tag: tag,
            startDate: startDate || undefined,
            dueDate: dueDate,
            days: days,
        };

        // Use zod for robust validation
        const validation = subTaskSchema.safeParse(formData);

        if (!validation.success) {
            // Display only the first validation error message
            const errorMessage = validation.error.issues[0]?.message || "Validation failed";
            toast.error(errorMessage);
            return;
        }

        const validData = validation.data;

        // Helper to get full objects for optimistic UI
        const selectedMember = members.find(m => m.userId === assignee);
        const selectedTag = tags.find(t => t.id === tag);

        if (mode === "create") {
            // CREATE MODE
            // LEVEL 1: Optimistic UI Update for Creation
            const tempId = `temp-${Date.now()}`;
            const optimisticSubTask = {
                id: tempId,
                name: validData.name,
                description: validData.description,
                status: validData.status,
                startDate: validData.startDate ? parseIST(validData.startDate) : null,
                dueDate: validData.dueDate ? parseIST(validData.dueDate) : null,
                days: validData.days,
                projectId,
                parentTaskId,
                createdAt: new Date(),
                updatedAt: new Date(),
                isOptimistic: true,
                subtaskCount: 0,
                completedSubtaskCount: 0,
                _count: { activities: 0 },
                // Include full objects for UI
                assignee: selectedMember ? {
                    id: selectedMember.userId,
                    surname: selectedMember.user.surname,
                    WorkspaceMember: { user: { id: selectedMember.userId, surname: selectedMember.user.surname } }
                } : null,
                tag: selectedTag ? { id: selectedTag.id, name: selectedTag.name } : null
            };

            onSubTaskCreated?.(optimisticSubTask, tempId);
            setSubTaskName("");
            onCancel();

            startTransition(async () => {
                const { data: result, error } = await tryCatch(
                    createSubTask(validData)
                );

                if (error || (result as ApiResponse).status !== "success") {
                    toast.error(error?.message || (result as ApiResponse).message || "Failed to create subtask");
                    if (onSubTaskDeleted) {
                        onSubTaskDeleted(tempId);
                    }
                    return;
                }

                const apiResult = result as ApiResponse;
                toast.success("Subtask created");

                // Replace the optimistic subtask with the real one
                onSubTaskCreated?.(apiResult.data, tempId);
            });
        } else {
            // EDIT MODE
            if (!subTask) {
                toast.error("SubTask data is missing");
                return;
            }

            // LEVEL 1: Optimistic UI Update
            const updatedData: Partial<SubTaskType> = {
                name: validData.name,
                description: validData.description,
                status: validData.status,
                startDate: validData.startDate ? parseIST(validData.startDate) : null,
                dueDate: validData.dueDate ? parseIST(validData.dueDate) : null,
                days: validData.days,
                // Include full objects for UI
                assignee: selectedMember ? {
                    id: selectedMember.userId,
                    surname: selectedMember.user.surname,
                } as any : null,
                tag: selectedTag ? { id: selectedTag.id, name: selectedTag.name } as any : null
            };

            if (onSubTaskUpdated) {
                onSubTaskUpdated(subTask.id, updatedData);
            }
            onCancel();

            startTransition(async () => {
                const { data: result, error } = await tryCatch(
                    editSubTask(validData, subTask.id)
                );

                if (error || result.status !== "success") {
                    toast.error(error?.message || result?.message || "Failed to update subtask");
                    return;
                }

                toast.success("Subtask saved");
            });
        }
    };

    return (
        <TableRow className={cn(
            mode === "edit" ? "bg-primary/5 hover:bg-primary/10" : "bg-muted/20 hover:bg-muted/30",
            "h-8 [&_td]:p-0"
        )}>
            {/* Drag Handle - Empty with hierarchy gap */}
            <TableCell className="w-[60px] md:w-[80px]">
                <div className="flex items-center">
                    <div className="w-8 shrink-0" />
                </div>
            </TableCell>

            {/* SubTask Name Input */}
            <TableCell className="w-[250px] pl-0">
                <div className="flex flex-col">
                    <Input
                        placeholder="SubTask name..."
                        value={subTaskName}
                        onChange={(e) => setSubTaskName(e.target.value)}
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
                    {subTaskName.trim().length > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 px-1">
                            Slug: <span className="font-mono">{slugify(subTaskName.trim(), { lower: true, strict: true })}</span>
                        </p>
                    )}
                </div>
            </TableCell>

            {/* Description - Popover with Textarea */}
            {columnVisibility.description && (
                <TableCell className="w-[200px]">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className="h-8 w-full justify-start text-left font-normal"
                                disabled={pending}
                            >
                                <span className={cn(
                                    "truncate block",
                                    description ? "text-foreground" : "text-muted-foreground"
                                )}>
                                    {description || "Add description..."}
                                </span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80" align="start">
                            <div className="space-y-2">
                                <h4 className="font-medium text-sm">Description</h4>
                                <Textarea
                                    placeholder="Enter description..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    disabled={pending}
                                    className="min-h-[100px] resize-none"
                                    autoFocus
                                />
                            </div>
                        </PopoverContent>
                    </Popover>
                </TableCell>
            )}

            {/* Assignee */}
            {columnVisibility.assignee && (
                <TableCell className="w-[100px] max-w-[100px]">
                    <Select value={assignee} onValueChange={setAssignee} disabled={pending}>
                        <SelectTrigger className="h-8 w-full">
                            <SelectValue placeholder="Select assignee..." className="truncate" />
                        </SelectTrigger>
                        <SelectContent>
                            {availableMembers.map((member) => (
                                <SelectItem key={member.userId} value={member.userId}>
                                    <span className="truncate block">
                                        {member.user.surname}
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </TableCell>
            )}

            {/* Reviewer */}
            {columnVisibility.reviewer && (
                <TableCell className="w-[100px] max-w-[100px]">
                    <Select value={reviewer} onValueChange={setReviewer} disabled={pending}>
                        <SelectTrigger className="h-8 w-full">
                            <SelectValue placeholder="Select reviewer..." className="truncate" />
                        </SelectTrigger>
                        <SelectContent>
                            {reviewers.map((rev) => (
                                <SelectItem key={rev.id} value={rev.id}>
                                    <span className="truncate block">
                                        {rev.surname} ({getRoleShortcut(rev.role)})
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </TableCell>
            )}

            {/* Status */}
            {columnVisibility.status && (
                <TableCell className="w-[120px] max-w-[120px]">
                    <Select value={status} onValueChange={(value) => setStatus(value as typeof SubTaskStatus[number])} disabled={pending}>
                        <SelectTrigger className="h-8 w-full">
                            <SelectValue className="truncate" />
                        </SelectTrigger>
                        <SelectContent>
                            {STATUS_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </TableCell>
            )}

            {/* Start Date */}
            {columnVisibility.startDate && (
                <TableCell className="w-[120px]">
                    <DateTimePicker
                        value={startDate}
                        onChange={handleStartDateChange}
                        disabled={pending}
                    />
                </TableCell>
            )}

            {/* Due Date */}
            {columnVisibility.dueDate && (
                <TableCell className="w-[120px]">
                    <DateTimePicker
                        value={dueDate}
                        onChange={handleDueDateChange}
                        disabled={pending}
                    />
                </TableCell>
            )}

            {/* Days Column (Replaces Progress for better UX) */}
            {columnVisibility.progress && (
                <TableCell className="w-[80px] px-2">
                    <Input
                        type="number"
                        min={1}
                        max={365}
                        value={days}
                        onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val)) {
                                handleDaysChange(Math.max(1, Math.min(365, val)));
                            }
                        }}
                        disabled={pending}
                        className="h-8 border-primary/30"
                        placeholder="Days"
                    />
                </TableCell>
            )}

            {/* Tag */}
            {columnVisibility.tag && (
                <TableCell className="w-[120px] max-w-[120px]">
                    <Select value={tag} onValueChange={setTag} disabled={pending}>
                        <SelectTrigger className="h-8 w-full">
                            <SelectValue placeholder="Select tag..." className="truncate" />
                        </SelectTrigger>
                        <SelectContent>
                            {tags.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                    <span className="truncate block">{t.name}</span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </TableCell>
            )}

            <TableCell className="w-[50px] px-0">
                <div className="flex items-center justify-center gap-0.5">
                    {subTaskName.trim().length >= 3 && (
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 hover:bg-green-100 hover:text-green-600"
                            onClick={handleSubmit}
                            disabled={pending}
                            title="Save (Enter)"
                        >
                            {pending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                                <Check className="h-3.5 w-3.5" />
                            )}
                        </Button>
                    )}
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 hover:bg-red-100 hover:text-red-600"
                        onClick={onCancel}
                        disabled={pending}
                        title="Cancel (Esc)"
                    >
                        <X className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    );
}
