"use client";

import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatIST } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState, useTransition } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { DailyReportFormType } from "@/lib/zodSchemas";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getDailyReportFormData, submitDailyReport } from "@/actions/daily-report-actions";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

interface Props {
    workspaceId: string;
    isOpen: boolean;
    onClose: () => void;
    onSubmitted?: () => void;
}

export function DailyReportModal({ workspaceId, isOpen, onClose, onSubmitted }: Props) {
    const [isPending, startTransition] = useTransition();

    const [entries, setEntries] = useState<DailyReportFormType["entries"]>([{ taskId: "", description: "" }]);
    const [suggestedTasks, setSuggestedTasks] = useState<any[]>([]);
    const [openPopoverIndex, setOpenPopoverIndex] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen, workspaceId]);

    const fetchData = async () => {
        try {
            const data = await getDailyReportFormData(workspaceId);
            setSuggestedTasks(data.suggestedTasks || []);
        } catch (error) {
            console.error("Failed to load suggested tasks", error);
        }
    };

    const updateEntry = (index: number, field: keyof DailyReportFormType["entries"][0], value: any) => {
        setEntries((prev) => {
            const newEntries = [...prev];
            newEntries[index] = { ...newEntries[index], [field]: value };
            return newEntries;
        });
    };

    const handleSubmit = () => {
        for (const entry of entries) {
            if (!entry.taskId) {
                toast.error("Please select a task (or 'Other Work') for all entries.");
                return;
            }
            if (!entry.description || entry.description.trim().length < 15) {
                toast.error("Descriptions must be at least 15 characters long.");
                return;
            }
        }

        startTransition(async () => {
            try {
                await submitDailyReport({
                    workspaceId,
                    entries,
                    date: formatIST(new Date(), "yyyy-MM-dd")
                });
                toast.success("Daily report submitted successfully!");
                onSubmitted?.();
                onClose();
            } catch (error: any) {
                toast.error(error.message || "Failed to submit report");
            }
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Daily Work Report</DialogTitle>
                    <DialogDescription>
                        Log the tasks you worked on today. Submitting is required to avoid being marked absent.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {entries.map((entry, index) => {
                        const isOther = entry.taskId === "other";

                        return (
                            <div key={index} className="flex gap-4 p-4 border rounded-xl bg-card shadow-sm border-border/50 relative">
                                <div className="flex-1 space-y-4 pt-2">
                                    <div className="space-y-2 max-w-[calc(100%-2rem)]">
                                        <Label>Task / Work Type <span className="text-destructive">*</span></Label>
                                        <Popover
                                            open={openPopoverIndex === index}
                                            onOpenChange={(open) => setOpenPopoverIndex(open ? index : null)}
                                        >
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    aria-expanded={openPopoverIndex === index}
                                                    className="w-full justify-between"
                                                >
                                                    {entry.taskId
                                                        ? entry.taskId === "other"
                                                            ? "Other Work (No explicit task)"
                                                            : (() => {
                                                                const t = suggestedTasks.find((t) => t.id === entry.taskId);
                                                                if (!t) return "Select a task or 'Other Work'...";
                                                                const taskLabel = t.parentTask ? `${t.parentTask.name} / ${t.name}` : t.name;
                                                                return (
                                                                    <div className="flex items-center gap-2 truncate">
                                                                        <div
                                                                            className="w-2 h-2 rounded-full shrink-0"
                                                                            style={{ backgroundColor: t.project?.color || "#ccc" }}
                                                                        />
                                                                        <span className="truncate">{taskLabel}</span>
                                                                    </div>
                                                                );
                                                            })()
                                                        : "Select a task or 'Other Work'..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                                <Command filter={(value, search) => {
                                                    if (value === "other_work_no_explicit_task") return 1;
                                                    return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
                                                }}>
                                                    <CommandInput placeholder="Search tasks and subtasks..." />
                                                    <CommandList>
                                                        <CommandEmpty className="p-2 text-center text-sm text-muted-foreground">
                                                            No matching tasks. Try "Other Work".
                                                        </CommandEmpty>
                                                        <CommandGroup>
                                                            {suggestedTasks.map((t) => (
                                                                <CommandItem
                                                                    key={t.id}
                                                                    value={`${t.project?.name || ""} ${t.parentTask?.name || ""} ${t.name}`}
                                                                    onSelect={() => {
                                                                        updateEntry(index, "taskId", t.id);
                                                                        setOpenPopoverIndex(null);
                                                                    }}
                                                                >
                                                                    <Check
                                                                        className={cn(
                                                                            "mr-3 h-4 w-4 flex-shrink-0",
                                                                            entry.taskId === t.id ? "opacity-100" : "opacity-0"
                                                                        )}
                                                                    />
                                                                    <div className="flex flex-col truncate">
                                                                        <div className="flex items-center gap-2">
                                                                            <div
                                                                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                                                                style={{ backgroundColor: t.project?.color || "#ccc" }}
                                                                            />
                                                                            <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-tight">
                                                                                {t.project?.name}
                                                                            </span>
                                                                        </div>
                                                                        <span className="truncate">{t.name}</span>
                                                                        {t.parentTask && (
                                                                            <span className="text-[10px] text-muted-foreground truncate italic">
                                                                                {t.parentTask.name}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                        <CommandGroup>
                                                            <CommandItem
                                                                value="other_work_no_explicit_task"
                                                                onSelect={() => {
                                                                    updateEntry(index, "taskId", "other");
                                                                    setOpenPopoverIndex(null);
                                                                }}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-3 h-4 w-4 flex-shrink-0",
                                                                        entry.taskId === "other" ? "opacity-100" : "opacity-0"
                                                                    )}
                                                                />
                                                                <span className="font-semibold text-primary">Other Work</span>
                                                            </CommandItem>
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Description <span className="text-destructive">*</span></Label>
                                        <Textarea
                                            placeholder="What did you achieve today? (min 15 chars)"
                                            value={entry.description || ""}
                                            onChange={(e) => updateEntry(index, "description", e.target.value)}
                                            className="resize-none"
                                            rows={2}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <DialogFooter className="mt-6 border-t pt-4">
                    <Button variant="outline" onClick={onClose} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isPending || entries.length === 0}
                    >
                        {isPending ? "Submitting..." : "Submit Report"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog >
    );
}
