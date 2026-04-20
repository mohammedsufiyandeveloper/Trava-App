"use client";

import { useState, useTransition, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { GanttTask } from "../../../../../../../components/task/gantt/types";
import { useSubTaskSheet } from "@/contexts/subtask-sheet-context";
import type { WorkspaceTaskType } from "@/data/task";
import { GanttChart } from "@/components/task/gantt/gantt-chart";
import { GlobalFilterToolbar } from "@/components/task/shared/global-filter-toolbar";
import { MemberOption, TagOption, TaskFilters } from "@/components/task/shared/types";
import { transformToGanttTasks } from "@/components/task/gantt/transform-tasks";
import { ProjectMembersType } from "@/data/project/get-project-members";

interface ProjectGanttClientProps {
    workspaceId: string;
    projectId: string;
    initialTasks: GanttTask[];
    allTasks: any[];
    subtaskDataMap: Record<string, WorkspaceTaskType>;
    members: ProjectMembersType;
    tags: TagOption[];
    projectCounts?: Record<string, number>;
    currentUser?: { id: string };
    permissions?: {
        isWorkspaceAdmin: boolean;
        leadProjectIds: string[];
        managedProjectIds: string[];
    };
}

export function ProjectGanttClient({
    workspaceId,
    projectId,
    initialTasks,
    allTasks,
    subtaskDataMap,
    members,
    tags,
    projectCounts,
    currentUser,
    permissions
}: ProjectGanttClientProps) {
    const [filters, setFilters] = useState<TaskFilters>({});
    const [searchQuery, setSearchQuery] = useState("");
    const [isPending, startTransition] = useTransition();

    // Use global subtask sheet context
    const { openSubTaskSheet } = useSubTaskSheet();

    // Handle subtask click
    const handleSubtaskClick = (subtaskId: string) => {
        const subtaskData = subtaskDataMap[subtaskId];
        if (subtaskData) {
            openSubTaskSheet(subtaskData);
        }
    };

    const handleFilterChange = (newFilters: TaskFilters) => {
        startTransition(() => {
            setFilters(newFilters);
        });
    };

    const handleSearchChange = (query: string) => {
        startTransition(() => {
            setSearchQuery(query);
        });
    };

    const [tasks, setTasks] = useState<GanttTask[]>(initialTasks);
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    useEffect(() => {
        if (isInitialLoad) {
            setIsInitialLoad(false);
            return;
        }

        const fetchTasks = async () => {
            const params = new URLSearchParams();
            params.append("w", workspaceId);
            params.append("p", projectId);
            if (filters.status) params.append("s", filters.status);
            if (filters.assigneeId) params.append("a", filters.assigneeId);
            if (filters.tagId) params.append("t", filters.tagId);
            if (filters.startDate) params.append("da", filters.startDate instanceof Date ? filters.startDate.toISOString() : filters.startDate);
            if (filters.endDate) params.append("db", filters.endDate instanceof Date ? filters.endDate.toISOString() : filters.endDate);
            if (searchQuery) params.append("q", searchQuery);

            startTransition(async () => {
                try {
                    const res = await fetch(`/api/gt?${params.toString()}`);
                    const json = await res.json();
                    if (json.success) {
                        const allFetchedTasks: any[] = [];
                        json.data.tasks.forEach((t: any) => {
                            allFetchedTasks.push(t);
                            if (t.subTasks) allFetchedTasks.push(...t.subTasks);
                        });
                        console.log("🟦 [GANTT CLIENT] Project fetched tasks (flattened):", allFetchedTasks.length);
                        setTasks(transformToGanttTasks(allFetchedTasks));
                    }
                } catch (err) {
                    console.error("Failed to fetch gantt tasks:", err);
                }
            });
        };

        const timer = setTimeout(fetchTasks, 300);
        return () => clearTimeout(timer);
    }, [workspaceId, projectId, filters, searchQuery]);

    // Surgical update for subtasks (e.g. assignee change)
    const handleSubTaskUpdate = (subTaskId: string, updatedData: Partial<any>) => {
        setTasks(prevTasks => {
            return prevTasks.map(task => {
                // If the updated task is a parent task
                if (task.id === subTaskId) {
                    return { ...task, ...updatedData };
                }
                
                // If it's a subtask within a parent task
                if (task.subtasks) {
                    const hasSubtask = task.subtasks.find(s => s.id === subTaskId);
                    if (hasSubtask) {
                        return {
                            ...task,
                            subtasks: task.subtasks.map(s => 
                                s.id === subTaskId ? { ...s, ...updatedData } : s
                            )
                        };
                    }
                }
                return task;
            });
        });
    };

    const ganttTasks = tasks;

    // Transform full member objects for the toolbar dropdowns
    const toolbarMembers = members.map(m => ({
        id: m.userId,
        name: m.user.name || '',
        surname: m.user.surname || '',
        email: m.user.email || '',
        image: m.user.image || ''
    }));

    return (
        <div className="space-y-4">
            <GlobalFilterToolbar
                level="project"
                view="gantt"
                filters={filters}
                searchQuery={searchQuery}
                members={toolbarMembers as any}
                tags={tags}
                onFilterChange={handleFilterChange}
                onSearchChange={handleSearchChange}
                onClearAll={() => {
                    startTransition(() => {
                        setFilters({});
                        setSearchQuery("");
                    });
                }}
            />
            <div className="relative min-h-[400px]">
                {isPending && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm transition-all duration-300">
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <span className="text-sm font-medium text-muted-foreground">Filtering...</span>
                        </div>
                    </div>
                )}
                <GanttChart
                    key={JSON.stringify(filters) + searchQuery}
                    tasks={ganttTasks}
                    workspaceId={workspaceId}
                    projectId={projectId}
                    onSubtaskClick={handleSubtaskClick}
                    onSubTaskUpdate={handleSubTaskUpdate}
                    projectCounts={projectCounts}
                    members={members}
                    currentUser={currentUser}
                    permissions={permissions}
                />
            </div>
        </div>
    );
}
