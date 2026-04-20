"use client";

import { Loader2 } from "lucide-react";
import { useState, useMemo, useTransition, useEffect } from "react";
import { GanttTask } from "@/components/task/gantt/types";
import { GanttChart } from "@/components/task/gantt/gantt-chart";
import { transformToGanttTasks } from "@/components/task/gantt/transform-tasks";
import { GlobalFilterToolbar } from "@/components/task/shared/global-filter-toolbar";
import {
  ProjectOption,
  MemberOption,
  TaskFilters,
  TagOption,
} from "@/components/task/shared/types";
import { useTaskCacheStore } from "@/lib/store/task-cache-store";
import { useSubTaskSheetActions } from "@/contexts/subtask-sheet-context";
import type { ProjectMembersType } from "@/data/project/get-project-members";

interface WorkspaceGanttClientProps {
  workspaceId: string;
  initialTasks: GanttTask[];
  allTasks: any[];
  subtaskDataMap: Record<string, any>;
  projects: ProjectOption[];
  members: ProjectMembersType;
  tags: TagOption[];
  projectCounts?: Record<string, number>;
  currentUser: { id: string };
  permissions?: {
    isWorkspaceAdmin: boolean;
    leadProjectIds: string[];
    managedProjectIds: string[];
  };
}

export function WorkspaceGanttClient({
  workspaceId,
  initialTasks,
  allTasks,
  subtaskDataMap,
  projects,
  members,
  tags,
  projectCounts,
  currentUser,
  permissions,
}: WorkspaceGanttClientProps) {
  const [filters, setFilters] = useState<TaskFilters>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  const filteredProjects = useMemo(
    () =>
      projects.filter(
        (p: any) =>
          !filters.assigneeId ||
          (p.memberIds && p.memberIds.includes(filters.assigneeId)),
      ),
    [projects, filters.assigneeId],
  );

  // Convert full ProjectMembersType to flat MemberOption[] only for the toolbar
  const toolbarMembers = useMemo<MemberOption[]>(
    () => members.map(m => ({
      id: m.userId,
      name: m.user.name || "",
      surname: m.user.surname || "",
      email: m.user.email || "",
    })),
    [members]
  );

  const filteredMembers = useMemo(
    () =>
      toolbarMembers.filter((m) => {
        if (!filters.projectId) return true;
        const project = projects.find((p) => p.id === filters.projectId);
        return (project as any)?.memberIds?.includes(m.id);
      }),
    [toolbarMembers, filters.projectId, projects],
  );

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
      if (filters.projectId) params.append("p", filters.projectId);
      if (filters.status) params.append("s", filters.status);
      if (filters.assigneeId) params.append("a", filters.assigneeId);
      if (filters.tagId) params.append("t", filters.tagId);
      if (filters.startDate)
        params.append(
          "da",
          filters.startDate instanceof Date
            ? filters.startDate.toISOString()
            : filters.startDate,
        );
      if (filters.endDate)
        params.append(
          "db",
          filters.endDate instanceof Date
            ? filters.endDate.toISOString()
            : filters.endDate,
        );
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
            console.log(
              "🟦 [GANTT CLIENT] Workspace fetched tasks (flattened):",
              allFetchedTasks.length,
            );
            setTasks(transformToGanttTasks(allFetchedTasks));
          }
        } catch (err) {
          console.error("Failed to fetch gantt tasks:", err);
        }
      });
    };

    const timer = setTimeout(fetchTasks, 300);
    return () => clearTimeout(timer);
  }, [workspaceId, filters, searchQuery]);

  const ganttTasks = tasks;

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

  const setProjectTasksCache = useTaskCacheStore(
    (state) => state.setProjectTasksCache,
  );
  const { openSubTaskSheet } = useSubTaskSheetActions();

  useMemo(() => {
    if (allTasks && allTasks.length > 0) {
      const tasksByProject: Record<string, any[]> = {};
      allTasks.forEach((t) => {
        const pid = t.projectId || "unknown";
        if (!tasksByProject[pid]) tasksByProject[pid] = [];
        tasksByProject[pid].push(t);
      });

      Object.entries(tasksByProject).forEach(([pid, tasks]) => {});
    }
  }, [allTasks]);

  useEffect(() => {
    if (allTasks && allTasks.length > 0) {
      const tasksByProject: Record<string, any[]> = {};
      allTasks.forEach((t) => {
        const pid = t.projectId || "unknown";
        if (!tasksByProject[pid]) tasksByProject[pid] = [];
        tasksByProject[pid].push(t);
      });

      Object.entries(tasksByProject).forEach(([pid, tasks]) => {
        setProjectTasksCache(pid, {
          tasks: tasks,
          hasMore: false,
          page: 1,
          totalCount: tasks.length,
        });
      });
    }
  }, [allTasks, setProjectTasksCache]);

  const handleSubtaskClick = (subtaskId: string) => {
    let subtaskData = subtaskDataMap[subtaskId];
    if (!subtaskData) {
      // Read directly from store state WITHOUT subscribing the component
      subtaskData = useTaskCacheStore.getState().entities[subtaskId];
    }

    if (subtaskData) {
      openSubTaskSheet(subtaskData);
    }
  };

  return (
    <div className="space-y-4">
      <GlobalFilterToolbar
        level="workspace"
        view="gantt"
        filters={filters}
        searchQuery={searchQuery}
        members={filteredMembers}
        projects={filteredProjects}
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
              <span className="text-sm font-medium text-muted-foreground">
                Filtering...
              </span>
            </div>
          </div>
        )}
        <GanttChart
          workspaceId={workspaceId}
          tasks={ganttTasks}
          showProjectFilter={true}
          projects={filteredProjects}
          selectedProjectId={filters.projectId}
          onProjectChange={(projectId) => {
            handleFilterChange({
              ...filters,
              projectId: projectId || undefined,
            });
          }}
          groupByProject={true}
          onSubtaskClick={handleSubtaskClick}
          onSubTaskUpdate={(subTaskId, data) => {
            setTasks(prev =>
              prev.map(t =>
                t.id === subTaskId
                  ? { ...t, ...data }
                  : {
                      ...t,
                      subtasks: t.subtasks?.map(s =>
                        s.id === subTaskId ? { ...s, ...data } : s
                      )
                    }
              )
            );
          }}
          projectCounts={projectCounts}
          members={members}
          currentUser={currentUser}
          permissions={permissions}
        />
      </div>
    </div>
  );
}
