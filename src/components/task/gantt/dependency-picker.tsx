"use client";

import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Link2, X, Check, Loader2, Search } from "lucide-react";
import { useState, useTransition, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { GanttSubtask, GanttTask } from "./types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { addSubtaskDependency, removeSubtaskDependency } from "@/actions/task/gantt";

interface DependencyPickerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    subtask: GanttSubtask;
    allTasks: GanttTask[];
    workspaceId: string;
    projectId: string;
    onUpdate?: (subtaskId: string, data: Partial<GanttSubtask>) => void;
}

export function DependencyPicker({
    open,
    onOpenChange,
    subtask,
    allTasks,
    workspaceId,
    projectId,
    onUpdate
}: DependencyPickerProps) {
    const [isPending, startTransition] = useTransition();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedDependencies, setSelectedDependencies] = useState<Set<string>>(
        new Set(subtask.dependsOnIds || [])
    );

    // Sync from props when modal opens
    useEffect(() => {
        if (open) {
            setSelectedDependencies(new Set(subtask.dependsOnIds || []));
            setSearchQuery("");
        }
    }, [open, subtask.dependsOnIds]);

    // Helper: Find all tasks that depend on THIS task (to avoid circularity)
    const descendantIds = useMemo(() => {
        const findDescendants = (id: string, visited = new Set<string>()): Set<string> => {
            visited.add(id);
            const children = allTasks.flatMap(t => 
                t.subtasks.filter(st => st.dependsOnIds?.includes(id))
            );
            children.forEach(child => {
                if (!visited.has(child.id)) {
                    findDescendants(child.id, visited);
                }
            });
            return visited;
        };
        const descendants = findDescendants(subtask.id);
        descendants.delete(subtask.id); // Remove self
        return descendants;
    }, [allTasks, subtask.id]);

    // Filter available tasks based on search, circularity, same parent, AND START DATE VALIDATION
    const filteredTasks = useMemo(() => {
        return allTasks
            .filter(task => task.id === subtask.parentTaskId) // Restrict to same parent
            .map(task => {
                const visibleSubtasks = task.subtasks.filter(st => {
                    const matchesSearch = st.name.toLowerCase().includes(searchQuery.toLowerCase());
                    const isNotSelf = st.id !== subtask.id;
                    const isNotDescendant = !descendantIds.has(st.id);
                    
                    // Date Validation: Don't allow selecting a dependency that starts AFTER the current task
                    // Simplified: Pred Start <= Succ Start
                    const isNotFuture = st.start <= subtask.start;

                    return matchesSearch && isNotSelf && isNotDescendant && isNotFuture;
                });

                return {
                    ...task,
                    subtasks: visibleSubtasks
                };
            }).filter(task => task.subtasks.length > 0);
    }, [allTasks, searchQuery, subtask.id, subtask.parentTaskId, subtask.start, descendantIds]);

    // Get currently selected subtasks for the "Current Dependencies" section
    const activeDependencies = useMemo(() => {
        const deps: Array<{ id: string; name: string; start: string; end: string }> = [];
        allTasks.forEach(task => {
            task.subtasks.forEach(st => {
                if (selectedDependencies.has(st.id)) {
                    deps.push({ id: st.id, name: st.name, start: st.start, end: st.end });
                }
            });
        });
        return deps;
    }, [allTasks, selectedDependencies]);

    const handleToggleDependency = (dependencyId: string) => {
        setSelectedDependencies(prev => {
            const next = new Set(prev);
            if (next.has(dependencyId)) {
                next.delete(dependencyId);
            } else {
                next.add(dependencyId);
            }
            return next;
        });
    };

    const handleSave = () => {
        const currentDeps = new Set(subtask.dependsOnIds || []);
        const toAdd = [...selectedDependencies].filter(id => !currentDeps.has(id));
        const toRemove = [...currentDeps].filter(id => !selectedDependencies.has(id));

        if (toAdd.length === 0 && toRemove.length === 0) {
            onOpenChange(false);
            return;
        }

        // Live/Optimistic Update: Push to local Gantt state immediately
        onUpdate?.(subtask.id, { dependsOnIds: Array.from(selectedDependencies) });

        startTransition(async () => {
            let hasError = false;

            // Add new dependencies
            for (const depId of toAdd) {
                const result = await addSubtaskDependency(
                    subtask.id,
                    depId,
                    projectId,
                    workspaceId
                );
                if (result.status === "error") {
                    toast.error(result.message);
                    hasError = true;
                }
            }

            // Remove old dependencies
            for (const depId of toRemove) {
                const result = await removeSubtaskDependency(
                    subtask.id,
                    depId,
                    projectId,
                    workspaceId
                );
                if (result.status === "error") {
                    toast.error(result.message);
                    hasError = true;
                }
            }

            if (!hasError) {
                toast.success("Dependencies updated successfully");
                onOpenChange(false);
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 p-0 overflow-hidden gap-0">
                <div className="p-6 pb-4 border-b border-neutral-100 dark:border-neutral-800">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-foreground">
                            <Link2 className="h-5 w-5 text-blue-500" />
                            Manage Dependencies for "{subtask.name}"
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Select which tasks must be completed before this task can start.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Search Field */}
                    <div className="relative mt-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Find a task to add as a dependency..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-9 bg-neutral-50 dark:bg-neutral-800/50"
                        />
                    </div>
                </div>

                <div className="p-0">
                    <ScrollArea className="h-[450px]">
                        <div className="p-6 pt-4 space-y-6">
                            
                            {/* NEW: Current Dependencies Section */}
                            {activeDependencies.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest px-2 flex items-center gap-2">
                                        <Check className="h-3 w-3" />
                                        Current Dependencies
                                    </h3>
                                    <div className="grid grid-cols-1 gap-2">
                                        {activeDependencies.map(dep => (
                                            <div 
                                                key={dep.id}
                                                className="flex items-center justify-between p-3 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-900/30 rounded-lg group"
                                            >
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold truncate text-foreground">{dep.name}</p>
                                                    <p className="text-[10px] text-muted-foreground">{dep.start} → {dep.end}</p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleToggleDependency(dep.id);
                                                    }}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Search Results / Tasks List */}
                            <div className="space-y-4">
                                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2">
                                    Available Tasks
                                </h3>
                                {filteredTasks.length > 0 ? (
                                    filteredTasks.map(task => (
                                        <div key={task.id} className="space-y-1">
                                            {task.subtasks.map(st => {
                                                const isSelected = selectedDependencies.has(st.id);
                                                if (isSelected) return null; // Already shown in top section

                                                return (
                                                    <div
                                                        key={st.id}
                                                        className={cn(
                                                            "group flex items-center gap-3 px-3 py-2 rounded-md transition-all cursor-pointer",
                                                            "hover:bg-neutral-100 dark:hover:bg-neutral-800/50",
                                                            isSelected && "bg-blue-50/50 dark:bg-blue-900/10"
                                                        )}
                                                        onClick={() => handleToggleDependency(st.id)}
                                                    >
                                                        <Checkbox
                                                            id={`dep-${st.id}`}
                                                            checked={isSelected}
                                                            onCheckedChange={() => handleToggleDependency(st.id)}
                                                            className="pointer-events-none"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <label
                                                                htmlFor={`dep-${st.id}`}
                                                                className="text-sm font-medium text-foreground cursor-pointer block"
                                                            >
                                                                {st.name}
                                                            </label>
                                                            <p className="text-[10px] text-muted-foreground">
                                                                {st.start} → {st.end}
                                                            </p>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="opacity-0 group-hover:opacity-100 h-7 text-[10px] px-2"
                                                        >
                                                            Add
                                                        </Button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground bg-neutral-50/50 dark:bg-neutral-800/20 rounded-lg border border-dashed">
                                        <Search className="h-6 w-6 mb-2 opacity-10" />
                                        <p className="text-[11px]">No eligible tasks found.</p>
                                        <p className="text-[9px] mt-1 opacity-60 px-10 text-center">
                                            (Note: Tasks must start on or before {subtask.start} to be a dependency)
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </ScrollArea>
                </div>

                <div className="p-6 bg-neutral-50 dark:bg-neutral-800/30 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                        {selectedDependencies.size} {selectedDependencies.size === 1 ? 'dependency' : 'dependencies'} selected
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            disabled={isPending}
                            size="sm"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isPending}
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white min-w-[100px]"
                        >
                            {isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : "Save Changes"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
