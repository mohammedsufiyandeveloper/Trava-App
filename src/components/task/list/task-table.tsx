"use client";

import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  memo,
} from "react";
import { Loader2, ChevronsUpDown, Maximize2, Minimize2 } from "lucide-react";
import { loadTasksAction } from "@/actions/task/list-actions";
import { useSubTaskSheetActions } from "@/contexts/subtask-sheet-context";
// Simple debounce implementation
const debounce = (func: Function, wait: number) => {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};
import type { ProjectMembersType } from "@/data/project/get-project-members";
import type { SubTaskType } from "@/data/task";
import {
  type TaskWithSubTasks,
  type SortConfig,
  type SortField,
  hasActiveFilters,
} from "@/components/task/shared/types";
import type { TaskFilters } from "../shared/types";
import { GlobalFilterToolbar } from "../shared/global-filter-toolbar";
import { ColumnVisibility } from "../shared/column-visibility";
import { extractAllFilterOptions } from "@/lib/utils/extract-filter-options";
import { SortableHeader } from "./sort/sortable-header";
import type { UserPermissionsType } from "@/data/user/get-user-permissions";
import { useTaskCacheStore } from "@/lib/store/task-cache-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { TableLoading } from "./table/table-loading";
import { LoadMoreSentinel } from "./table/load-more-sentinel";
import { ProjectTaskGroup } from "./group/project-task-group";
import { FlatTaskList } from "./group/flat-task-list";
import { EmptyState } from "./table/empty-state";
import { SortedTaskList } from "./sort/sorted-task-list";
import { TableCell, TableRow } from "@/components/ui/table";

interface TaskTableProps {
  initialTasks: TaskWithSubTasks[];
  initialHasMore: boolean;
  initialNextCursor?: any;
  initialTotalCount?: number;
  members: ProjectMembersType;
  assignees?: Array<{ id: string; name: string; surname?: string }>;
  workspaceId: string;
  projectId: string;
  canCreateSubTask: boolean;
  showAdvancedFilters?: boolean;
  tags?: { id: string; name: string }[];
  projects?: {
    id: string;
    name: string;
    canManageMembers?: boolean;
    color?: string;
  }[];
  leadProjectIds?: string[];
  isWorkspaceAdmin?: boolean;
  level?: "workspace" | "project";
  permissions?: UserPermissionsType;
  userId?: string;
  projectCounts?: Record<string, number>;
}

const DEFAULT_TAGS: { id: string; name: string }[] = [];
const DEFAULT_PROJECTS: { id: string; name: string }[] = [];

function TaskTable({
  initialTasks,
  members,
  assignees,
  workspaceId,
  projectId,
  canCreateSubTask,
  showAdvancedFilters = false,
  tags = DEFAULT_TAGS,
  projects = DEFAULT_PROJECTS,
  leadProjectIds = [],
  isWorkspaceAdmin = false,
  level = "project",
  permissions,
  userId,
  initialHasMore,
  initialNextCursor,
  initialTotalCount,
  projectCounts,
}: TaskTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<TaskFilters>({});
  const debouncedSetFilters = useCallback(debounce(setFilters, 200), [
    setFilters,
  ]);
  const [isLoadingFilters, setIsLoadingFilters] = useState(false);
  const [isCurrentlyFiltered, setIsCurrentlyFiltered] = useState(false);
  const filtersActive = hasActiveFilters(filters) || !!searchQuery;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loadingSubTasks, setLoadingSubTasks] = useState<
    Record<string, boolean>
  >({});
  const [loadingMoreSubTasks, setLoadingMoreSubTasks] = useState<
    Record<string, boolean>
  >({});
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<
    Record<string, boolean>
  >({});
  const [sorts, setSorts] = useState<SortConfig[]>([]);
  const [sortedTasks, setSortedTasks] = useState<any[]>([]);
  const [sortedHasMore, setSortedHasMore] = useState(false);
  const [sortedNextCursor, setSortedNextCursor] = useState<any>(null);
  const [isLoadingMoreSorted, setIsLoadingMoreSorted] = useState(false);
  const [isSortedViewLoading, setIsSortedViewLoading] = useState(false);
  const [currentProjectCounts, setCurrentProjectCounts] = useState<
    Record<string, number> | undefined
  >(projectCounts);
  const setCachedSubTasks = useTaskCacheStore(
    (state) => state.setCachedSubTasks,
  );
  const getCachedSubTasks = useTaskCacheStore(
    (state) => state.getCachedSubTasks,
  );
  const setProjectTasksCache = useTaskCacheStore(
    (state) => state.setProjectTasksCache,
  );
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadProjectTasksRef = useRef<((id: string) => Promise<void>) | null>(
    null,
  );
  const loadMoreSortedRef = useRef<(() => Promise<void>) | null>(null);
  const sortedSentinelRef = useRef<HTMLTableRowElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const autoExpandRef = useRef(false);
  const tasksRef = useRef<TaskWithSubTasks[]>([]);
  const processedSubTasksRef = useRef<Set<string>>(new Set());
  const fetchingSubTasksRef = useRef<Set<string>>(new Set());
  const mode = useMemo(() => {
    return sorts.length > 0 ? "sorted" : "hierarchy";
  }, [sorts]);

  const sortsKey = sorts.map((s) => `${s.field}:${s.direction}`).join(",");

  const hydrateTasks = useCallback(
    (taskList: TaskWithSubTasks[]) => {
      if (filtersActive) return taskList;

      const getCache = useTaskCacheStore.getState().getCachedSubTasks;
      return taskList.map((t) => {
        if (t.subTasks !== undefined) return t;
        const cached = getCache(t.id);
        if (cached) {
          return {
            ...t,
            subTasks: cached.subTasks,
            subTasksHasMore: cached.hasMore,
            subTasksNextCursor: cached.nextCursor,
          };
        }
        return t;
      });
    },
    [filtersActive],
  );

  const [tasks, setTasks] = useState<TaskWithSubTasks[]>(() =>
    hydrateTasks(initialTasks),
  );

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  tasksRef.current = tasks;

  useEffect(() => {
    if (!initialTasks || initialTasks.length === 0) return;

    const state = useTaskCacheStore.getState();
    const tasksByProject: Record<string, TaskWithSubTasks[]> = {};

    initialTasks.forEach((t) => {
      const pId = t.projectId || "unknown";
      if (!tasksByProject[pId]) tasksByProject[pId] = [];
      tasksByProject[pId].push(t);
    });

    Object.entries(tasksByProject).forEach(([pId, newTasks]) => {
      const currentCache = state.getProjectTasksCache(pId);

      if (currentCache) {
        const mergedMap = new Map();
        currentCache.tasks.forEach((t) => mergedMap.set(t.id, t));
        newTasks.forEach((t) => mergedMap.set(t.id, t));

        state.setProjectTasksCache(pId, {
          ...currentCache,
          tasks: Array.from(mergedMap.values()) as TaskWithSubTasks[],
        });
      } else {
        state.setProjectTasksCache(pId, {
          tasks: newTasks,
          hasMore: initialHasMore,
          page: 1,
          totalCount: initialTotalCount || newTasks.length,
        });
      }
    });
  }, [initialTasks, initialHasMore, initialTotalCount, setProjectTasksCache]);

  const [projectPagination, setProjectPagination] = useState<
    Record<
      string,
      { page: number; nextCursor: any; hasMore: boolean; isLoading: boolean }
    >
  >(() => {
    if (level === "project" && projectId && initialTasks.length > 0) {
      return {
        [projectId]: {
          page: 1,
          nextCursor: initialNextCursor,
          hasMore: initialHasMore,
          isLoading: false,
        },
      };
    }
    return {};
  });

  // Hydration-safe Cache Merge
  useEffect(() => {
    if (filtersActive) return;

    const state = useTaskCacheStore.getState();
    const getProjCache = state.getProjectTasksCache;
    const getSubCache = state.getCachedSubTasks;

    const relevantProjectIds =
      level === "project" && projectId
        ? [projectId]
        : projects.map((p) => p.id);

    // 1. Resolve Pagination from Cache
    setProjectPagination((prev) => {
      const next = { ...prev };
      let changed = false;

      relevantProjectIds.forEach((pId) => {
        const cached = getProjCache(pId);
        if (cached && !next[pId]) {
          next[pId] = {
            page: cached.page,
            nextCursor: cached.nextCursor,
            hasMore: cached.hasMore,
            isLoading: false,
          };
          changed = true;
        }
      });
      return changed ? next : prev;
    });

    // 2. Resolve Tasks from Cache
    const cachedTasks = relevantProjectIds.flatMap((pId) => {
      const cache = getProjCache(pId);
      return cache
        ? cache.tasks.filter((t) => !t.parentTaskId).slice(0, 100)
        : [];
    });

    if (cachedTasks.length > 0) {
      setTasks((prev) => {
        const taskMap = new Map<string, TaskWithSubTasks>();
        // Keep existing tasks (server truth) as priority
        prev.forEach((t) => taskMap.set(t.id, t));
        // Add cached tasks if not already present
        cachedTasks.forEach((t) => {
          if (!taskMap.has(t.id)) {
            taskMap.set(t.id, t);
          }
        });

        let mergedList = Array.from(taskMap.values());
        if (level === "project" && projectId) {
          mergedList = mergedList.filter((t) => t.projectId === projectId);
        }

        // Hydrate subtasks from cache
        return mergedList.map((t) => {
          if (t.subTasks !== undefined) return t;
          const cached = getSubCache(t.id);
          if (cached) {
            return {
              ...t,
              subTasks: cached.subTasks,
              subTasksHasMore: cached.hasMore,
              subTasksNextCursor: cached.nextCursor,
            };
          }
          return t;
        });
      });
    }
  }, [level, projectId, projects, filtersActive]);

  useEffect(() => {
    if (!filtersActive) return;

    setExpandedProjects((prev) => {
      const next = { ...prev };
      let changed = false;
      tasks.forEach((t) => {
        const pId = t.projectId || "unknown";
        if (next[pId] === undefined) {
          next[pId] = true;
          changed = true;
        }
      });
      return changed ? next : prev;
    });

    setExpanded((prev) => {
      const next = { ...prev };
      let changed = false;
      const visit = (t: TaskWithSubTasks) => {
        if (t.id && next[t.id] === undefined) {
          next[t.id] = true;
          changed = true;
        }
        if (t.subTasks) t.subTasks.forEach(visit);
      };
      tasks.forEach(visit);
      return changed ? next : prev;
    });
  }, [filtersActive, tasks]);

  useEffect(() => {
    return () => observerRef.current?.disconnect();
  }, []);

  const getObserver = () => {
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const projectId = (entry.target as HTMLElement).dataset.projectId;

              if (projectId === "sorted") {
                loadMoreSortedRef.current?.();
              } else if (projectId) {
                loadProjectTasksRef.current?.(projectId);
              }
            }
          });
        },
        { rootMargin: "200px" },
      );
    }
    return observerRef.current;
  };

  useEffect(() => {
    if (mode !== "hierarchy") return;

    setExpanded({});
    setProjectPagination({});
    processedSubTasksRef.current.clear();
    fetchingSubTasksRef.current.clear();

    setTasks(hydrateTasks(initialTasks));

    if (level === "project" && projectId) {
      setProjectPagination({
        [projectId]: {
          page: 1,
          nextCursor: initialNextCursor,
          hasMore: initialHasMore,
          isLoading: false,
        },
      });
    }
  }, [mode, initialTasks]);

  useEffect(() => {
    let isAborted = false;

    const fetchFiltered = async () => {
      setIsLoadingFilters(true);
      setIsCurrentlyFiltered(true);

      try {
        const response = await loadTasksAction({
          workspaceId: workspaceId,
          ...(level === "project" && projectId ? { projectId } : {}),
          status: filters.status as any,
          assigneeId: filters.assigneeId as any,
          tagId: filters.tagId as any,
          search: searchQuery,
          dueAfter: filters.startDate ? new Date(filters.startDate) : undefined,
          dueBefore: filters.endDate ? new Date(filters.endDate) : undefined,
          hierarchyMode: "parents",
          includeSubTasks: true,
          includeFacets: true,
          limit: 50,
          sorts,
          view_mode: "list",
        });

        if (isAborted) return;

        if (response.success && response.data) {
          const result = response.data as any;
          setTasks(hydrateTasks(result.tasks));

          if (result.facets?.projects) {
            const facetProjects = result.facets.projects as Record<
              string,
              number
            >;
            setCurrentProjectCounts(facetProjects);

            setProjectPagination((prev) => {
              const next = { ...prev };
              let changed = false;
              Object.entries(facetProjects).forEach(([pId, count]) => {
                if (count > 0 && !next[pId]) {
                  next[pId] = {
                    page: 1,
                    nextCursor: undefined,
                    hasMore: true,
                    isLoading: false,
                  };
                  changed = true;
                }
              });
              return changed ? next : prev;
            });
          }

          if (result.facets?.projects) {
            setExpandedProjects((prev) => {
              const next = { ...prev };
              let changed = false;
              const facetProjects = result.facets.projects as Record<
                string,
                number
              >;
              Object.keys(facetProjects).forEach((pId) => {
                if (facetProjects[pId] > 0 && next[pId] === undefined) {
                  next[pId] = true;
                  changed = true;
                }
              });
              return changed ? next : prev;
            });
          }

          if (level === "workspace" && result.tasks.length > 0) {
            // Set global pagination state for workspace filter
            setProjectPagination((prev) => ({
              ...prev,
              ["__global_filter__"]: {
                page: 1,
                nextCursor: result.nextCursor,
                hasMore: result.hasMore,
                isLoading: false,
              },
            }));
          }

          if (level === "project" && projectId) {
            setProjectPagination({
              [projectId]: {
                page: 1,
                nextCursor: result.nextCursor,
                hasMore: result.hasMore,
                isLoading: false,
              },
            });
          }
        }
      } catch (err) {
        console.error("Filter error:", err);
        if (!isAborted) toast.error("Failed to apply filters");
      } finally {
        if (!isAborted) setIsLoadingFilters(false);
      }
    };

    if (mode === "hierarchy") {
      if (filtersActive) {
        fetchFiltered();
      } else if (isCurrentlyFiltered) {
        // RESET LOGIC — Restore from cache if possible
        const relevantProjectIds =
          level === "project" && projectId
            ? [projectId]
            : projects.map((p) => p.id);
        const getCache = useTaskCacheStore.getState().getProjectTasksCache;
        const taskMap = new Map<string, TaskWithSubTasks>();
        const newPagination: Record<string, any> = {};

        relevantProjectIds.forEach((pId) => {
          const cache = getCache(pId);
          if (cache && cache.tasks.length > 0) {
            // Filter out subtasks from root list
            cache.tasks
              .filter((t) => !t.parentTaskId)
              .forEach((t) => taskMap.set(t.id, t));
            newPagination[pId] = {
              page: cache.page,
              nextCursor: cache.nextCursor,
              hasMore: cache.hasMore,
              isLoading: false,
            };
          } else {
            // Fallback to initialData for this specific project
            const projectInitialTasks = initialTasks.filter(
              (t) => t.projectId === pId,
            );
            if (projectInitialTasks.length > 0) {
              projectInitialTasks.forEach((t) => taskMap.set(t.id, t));
              newPagination[pId] = {
                page: 1,
                nextCursor: initialNextCursor,
                hasMore: initialHasMore,
                isLoading: false,
              };
            }
          }
        });

        if (!isAborted) {
          const resetList = Array.from(taskMap.values());
          setTasks(hydrateTasks(resetList));
          setProjectPagination(newPagination);
          setExpanded({});
          processedSubTasksRef.current.clear();
          fetchingSubTasksRef.current.clear();
          setIsCurrentlyFiltered(false);
          setIsLoadingFilters(false);
        }
      }
    }

    return () => {
      isAborted = true;
    };
  }, [
    mode,
    JSON.stringify(filters),
    searchQuery,
    sortsKey,
    workspaceId,
    projectId,
    level,
    initialTasks,
  ]);

  // Effect to load sorted/filtered tasks when flat mode is active
  useEffect(() => {
    if (mode !== "sorted") {
      setSortedTasks([]);
      setSortedHasMore(false);
      return;
    }

    let isMounted = true;

    const fetchSorted = async () => {
      setIsSortedViewLoading(true);

      const startTime = performance.now();
      console.time("Filter Flat List Load");

      const res = await loadTasksAction({
        workspaceId,
        ...(level === "project" && projectId ? { projectId } : {}),
        status: filters.status,
        assigneeId: filters.assigneeId,
        tagId: filters.tagId,
        search: searchQuery,
        dueAfter: filters.startDate ? new Date(filters.startDate) : undefined,
        dueBefore: filters.endDate ? new Date(filters.endDate) : undefined,
        onlySubtasks: true,
        sorts,
        limit: 50, // Increased limit for faster "Load More" feel
        view_mode: "list",
      });

      if (!isMounted) return;

      if (res.success && res.data) {
        setSortedTasks(res.data.tasks || []);
        setSortedHasMore(res.data.hasMore);
        setSortedNextCursor(res.data.nextCursor);
      }

      setIsSortedViewLoading(false);
    };

    // Reset pagination before fresh fetch — do NOT clear tasks here to avoid flicker
    setSortedHasMore(false);
    setSortedNextCursor(null);

    fetchSorted();

    return () => {
      isMounted = false;
    };
  }, [sortsKey, workspaceId, projectId, JSON.stringify(filters), searchQuery]);

  const loadMoreSorted = async () => {
    if (!sortedHasMore || isLoadingMoreSorted) {
      // console.log("[LoadMoreSorted] Skip:", { sortedHasMore, isLoadingMoreSorted });
      return;
    }

    if (isLoadingMoreSorted || !sortedHasMore) return;
    setIsLoadingMoreSorted(true);

    try {
      const res = await loadTasksAction({
        workspaceId,
        ...(level === "project" && projectId ? { projectId } : {}),
        status: filters.status,
        assigneeId: filters.assigneeId,
        tagId: filters.tagId,
        search: searchQuery,
        dueAfter: filters.startDate ? new Date(filters.startDate) : undefined,
        dueBefore: filters.endDate ? new Date(filters.endDate) : undefined,
        onlySubtasks: true,
        sorts,
        cursor: sortedNextCursor,
        limit: 50,
        view_mode: "list",
      });

      if (res.success && res.data) {
        const newTasks = res.data.tasks || [];
        // console.log(`[LoadMoreSorted] Success: ${newTasks.length} tasks, hasMore: ${res.data.hasMore}`);

        setSortedTasks((prev) => [...prev, ...newTasks]);
        setSortedHasMore(res.data.hasMore);
        setSortedNextCursor(res.data.nextCursor);
      } else {
        console.error("[LoadMoreSorted] Server error:", res.error);
        toast.error("Failed to load more sorted tasks");
        setSortedHasMore(false);
      }
    } catch (err) {
      console.error("[LoadMoreSorted] Runtime error:", err);
      toast.error("An error occurred while loading more tasks");
    } finally {
      setIsLoadingMoreSorted(false);
    }
  };

  useEffect(() => {
    loadMoreSortedRef.current = loadMoreSorted;
  }, [loadMoreSorted]);

  // Dedicated IntersectionObserver for sorted scroll pagination.
  // Re-creates on every tasks-length change AND whenever hasMore flips,
  // so the observer fires even when the sentinel stays in the viewport.
  useEffect(() => {
    const sentinel = sortedSentinelRef.current;
    if (!sentinel) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && sortedHasMore) {
          loadMoreSortedRef.current?.();
        }
      },
      { rootMargin: "300px", threshold: 0 },
    );

    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [sortedTasks.length, sortedHasMore]);

  const [activeInlineProjectId, setActiveInlineProjectId] = useState<
    string | null
  >(null);

  const loadProjectTasks = async (targetProjectId: string) => {
    const currentPagination = projectPagination[targetProjectId] || {
      page: 0,
      nextCursor: undefined,
      hasMore: true,
      isLoading: false,
    };

    if (currentPagination.isLoading || !currentPagination.hasMore) return;

    setProjectPagination((prev) => ({
      ...prev,
      [targetProjectId]: { ...currentPagination, isLoading: true },
    }));

    const isGlobal = targetProjectId === "__global_filter__";

    try {
      const response = await loadTasksAction({
        workspaceId,
        ...(isGlobal ? {} : { projectId: targetProjectId }),
        status: filters.status as any,
        assigneeId: filters.assigneeId as any,
        tagId: filters.tagId as any,
        search: searchQuery,
        dueAfter: filters.startDate
          ? (new Date(filters.startDate) as any)
          : undefined,
        dueBefore: filters.endDate
          ? (new Date(filters.endDate) as any)
          : undefined,
        hierarchyMode: "parents",
        includeSubTasks: isGlobal, // Bulk load subtasks if global search
        cursor: currentPagination.nextCursor,
        limit: 50,
        sorts,
        view_mode: "list",
      });

      if (response.success && response.data) {
        const resultData = response.data as any;
        const newTasksFromServer =
          resultData.tasks as unknown as TaskWithSubTasks[];

        let nextTasks: TaskWithSubTasks[] = [];
        let addedRoots: TaskWithSubTasks[] = [];

        if (!isGlobal) {
          // Standard project-specific append logic (Flat/Grouped)
          const currentTasks = tasksRef.current;
          const existingIds = new Set(currentTasks.map((t) => t.id));
          addedRoots = newTasksFromServer.filter(
            (task) => !existingIds.has(task.id),
          );
          nextTasks = hydrateTasks([...currentTasks, ...addedRoots]);
        } else {
          // Deep Merge Logic for Recursive Filtered Hierarchies
          const taskMap = new Map<string, TaskWithSubTasks>();
          tasksRef.current.forEach((t) => taskMap.set(t.id, { ...t }));

          newTasksFromServer.forEach((task) => {
            if (taskMap.has(task.id)) {
              const existing = taskMap.get(task.id)!;
              if (task.subTasks && task.subTasks.length > 0) {
                const subTaskMap = new Map(
                  (existing.subTasks || []).map((st) => [st.id, st]),
                );
                task.subTasks.forEach((st) => subTaskMap.set(st.id, st));
                existing.subTasks = Array.from(subTaskMap.values());
              }
            } else {
              const newTask = { ...task };
              taskMap.set(newTask.id, newTask);
              addedRoots.push(newTask);
            }
          });

          nextTasks = hydrateTasks(Array.from(taskMap.values()));
        }

        setTasks(nextTasks);

        // Cache Logic - Only update if NOT filtered
        if (!filtersActive && !isGlobal) {
          setProjectTasksCache(targetProjectId, {
            tasks: nextTasks.filter((t) => t.projectId === targetProjectId),
            hasMore: resultData.hasMore ?? false,
            page: currentPagination.page + 1,
            nextCursor: resultData.nextCursor,
            totalCount: resultData.totalCount ?? undefined,
          });
        }

        if (autoExpandRef.current && addedRoots.length > 0) {
          setTimeout(() => {
            setExpanded((prevExpanded) => {
              const newExpanded = { ...prevExpanded };
              addedRoots.forEach((t) => {
                newExpanded[t.id] = true;
              });
              return newExpanded;
            });
          }, 0);
        }

        setProjectPagination((prev) => ({
          ...prev,
          [targetProjectId]: {
            page: currentPagination.page + 1,
            nextCursor: resultData.nextCursor,
            hasMore: resultData.hasMore ?? false,
            isLoading: false,
          },
        }));
      } else {
        toast.error(response.error || "Failed to load tasks");
        setProjectPagination((prev) => ({
          ...prev,
          [targetProjectId]: { ...currentPagination, isLoading: false },
        }));
      }
    } catch (error) {
      console.error("Error loading project tasks:", error);
      toast.error("Failed to load project tasks");
      setProjectPagination((prev) => ({
        ...prev,
        [targetProjectId]: { ...currentPagination, isLoading: false },
      }));
    }
  };

  useEffect(() => {
    loadProjectTasksRef.current = loadProjectTasks;
  }, [loadProjectTasks]);

  const toggleProjectExpand = (targetProjectId: string) => {
    setExpandedProjects((prev) => {
      const isExpanding = !prev[targetProjectId];
      return {
        ...prev,
        [targetProjectId]: isExpanding,
      };
    });
    const isCurrentlyExpanded = expandedProjects[targetProjectId];
    if (!isCurrentlyExpanded) {
      // Check if we need to load tasks for this project
      const projectTasks = tasks.filter((t) => t.projectId === targetProjectId);
      const hasNoTasksLoaded = projectTasks.length === 0;
      const pagination = projectPagination[targetProjectId];

      // Trigger load if:
      // 1. Pagination hasn't been initialized yet (Standard view)
      // 2. OR it's a filtered view, we have no tasks for this project yet, but pagination says there are more
      if (
        !pagination ||
        (filtersActive && hasNoTasksLoaded && pagination.hasMore)
      ) {
        loadProjectTasks(targetProjectId);
      }
    }
  };

  const handleSubTaskClick = (subTask: SubTaskType) => {
    openSubTaskSheet(subTask);
  };

  useEffect(() => {
    if (
      level === "project" &&
      projectId &&
      !projectPagination[projectId] &&
      !filtersActive
    ) {
      loadProjectTasks(projectId);
    }
  }, [level, projectId, filters, searchQuery]);

  const { openSubTaskSheet } = useSubTaskSheetActions();

  const filterOptions = React.useMemo(() => {
    const options = extractAllFilterOptions(
      tasks as any,
      showAdvancedFilters ? "workspace" : "project",
    );

    const assigneesForFilter =
      assignees ||
      members
        .filter((member) => member.user)
        .map((member) => ({
          id: member.user!.id,
          // name: member.user!.name,
          surname: member.user!.surname || undefined,
        }))
        .sort((a, b) => {
          const nameA = `${a.surname || ""}`.trim();
          const nameB = `${b.surname || ""}`.trim();
          return nameA.localeCompare(nameB);
        });

    return {
      ...options,
      assignees: assigneesForFilter,
      tags: tags,
      projects: projects,
    };
  }, [tasks, showAdvancedFilters, members, assignees, tags, projects]);

  // Calculate project task counts
  const projectTaskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach((task) => {
      const pId = task.projectId || "unknown";
      counts[pId] = (counts[pId] || 0) + 1;
    });
    return counts;
  }, [tasks]);

  // Calculate grouped tasks - MOVED UP before use
  const groupedTasks = useMemo(() => {
    if (level !== "workspace") return null;
    const groups: Record<string, TaskWithSubTasks[]> = {};

    // Ensure all projects that have tasks (discovered via facets or current tasks)
    // are initialized so the project loop maintains consistent ordering.
    if (!filtersActive) {
      projects.forEach((project) => {
        groups[project.id] = [];
      });
    } else if (currentProjectCounts) {
      projects.forEach((project) => {
        if ((currentProjectCounts[project.id] || 0) > 0) {
          groups[project.id] = [];
        }
      });
    }

    tasks.forEach((task) => {
      const pId = task.projectId || "unknown";
      if (!groups[pId]) {
        groups[pId] = [];
      }
      groups[pId].push(task);
    });
    return groups;
  }, [tasks, level, projects, filtersActive, currentProjectCounts]);

  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({
    assignee: true,
    reviewer: true,
    startDate: true,
    dueDate: true,
    progress: true,
    status: true,
    tag: true,
    description: true,
    project: level === "workspace",
  });

  const visibleColumnsCount =
    2 +
    Object.entries(columnVisibility).filter(([k, v]) => k !== "project" && v)
      .length +
    1;

  // 🔥 MASTER SUBTASK LOADER: The Single Source of Truth

  // 1. Lazy Subtask Loader Callback (Passed to TaskRow)
  const handleRequestSubtasks = useCallback(
    async (taskId: string) => {
      if (
        processedSubTasksRef.current.has(taskId) ||
        fetchingSubTasksRef.current.has(taskId)
      )
        return;

      // Note: references active 'tasks' state via closure or ref would be better,
      // but for now we look up in current render scope tasks.
      const task = tasksRef.current.find((t) => t.id === taskId);
      if (!task) return;

      // Double check checks
      if (task.subTasks !== undefined) {
        processedSubTasksRef.current.add(taskId);
        return;
      }

      // Cache Hit
      const cached = getCachedSubTasks(taskId);
      if (cached) {
        setTasks((prev) =>
          prev.map((t) => {
            if (t.id === taskId) {
              return {
                ...t,
                subTasks: cached.subTasks,
                subTasksHasMore: cached.hasMore,
                subTasksNextCursor: cached.nextCursor,
              };
            }
            return t;
          }),
        );
        processedSubTasksRef.current.add(taskId);
        return;
      }

      // Fetch
      fetchingSubTasksRef.current.add(taskId);
      setLoadingSubTasks((prev) => ({ ...prev, [taskId]: true }));

      const taskProjectId = task.projectId || projectId || "";

      try {
        // Include current filters so expanded subtasks match the filtered dataset
        const activeFilters = {
          ...filters,
          search: searchQuery || filters.search,
          workspaceId,
        };

        const queryParams = new URLSearchParams();
        queryParams.set("w", workspaceId);
        if (taskProjectId) queryParams.set("p", taskProjectId);
        queryParams.set("ps", "30");
        queryParams.set("vm", "subtask");

        if (activeFilters.status)
          queryParams.set("s", JSON.stringify(activeFilters.status));
        if (activeFilters.assigneeId)
          queryParams.set("a", JSON.stringify(activeFilters.assigneeId));
        if (activeFilters.tagId)
          queryParams.set("t", JSON.stringify(activeFilters.tagId));
        if (activeFilters.search) queryParams.set("q", activeFilters.search);
        if (filters.startDate)
          queryParams.set("da", new Date(filters.startDate).toISOString());
        if (filters.endDate)
          queryParams.set("db", new Date(filters.endDate).toISOString());

        const res = await fetch(
          `/api/expand/${taskId}?${queryParams.toString()}`,
        );
        if (!res.ok) throw new Error("Failed to fetch subtasks");
        const response = await res.json();

        if (response.success && response.subTasks) {
          const subTasks = response.subTasks;
          processedSubTasksRef.current.add(taskId);

          // Dedup
          const uniqueSubTasks = subTasks.filter(
            (st: any, index: number, self: any[]) =>
              index === self.findIndex((t: any) => t.id === st.id),
          );

          if (!filtersActive) {
            setCachedSubTasks(taskId, {
              subTasks: uniqueSubTasks,
              hasMore: response.hasMore,
              nextCursor: response.nextCursor,
            });
          }

          setTasks((prev) =>
            prev.map((t) => {
              if (t.id === taskId) {
                return {
                  ...t,
                  subTasks: uniqueSubTasks,
                  subTasksHasMore: response.hasMore,
                  subTasksNextCursor: response.nextCursor,
                };
              }
              return t;
            }),
          );
        }
      } catch (err) {
        console.error(`Failed to load subtasks for ${taskId}`, err);
      } finally {
        fetchingSubTasksRef.current.delete(taskId);
        setLoadingSubTasks((prev) => {
          const next = { ...prev };
          delete next[taskId];
          return next;
        });
      }
    },
    [
      projectId,
      workspaceId,
      filters,
      searchQuery,
      getCachedSubTasks,
      setCachedSubTasks,
    ],
  );

  // 3. UI-ONLY Toggle
  const toggleExpand = (taskId: string) => {
    setExpanded((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  // 4. UI-ONLY Expand All
  // 4. UI-ONLY Expand All + Cached Load
  const handleExpandAll = () => {
    autoExpandRef.current = true;

    // 1. Expand all projects (Existing ones will show, others will load on scroll)
    const allProjectIds = projects.map((p) => p.id);
    const allProjects = allProjectIds.reduce(
      (acc, pId) => ({ ...acc, [pId]: true }),
      {},
    );
    setExpandedProjects(allProjects);

    // 🚀 Optimization: Remove the manual loadProjectTasks(id) loop.
    // Sentinels will handle loading as the user scrolls down naturally.

    // 2. Bulk Apply Cache for Immediate Display
    setTasks((prev) => hydrateTasks(prev));

    // 3. Expand all tasks (This will trigger lazy loaders for items that hit the viewport)
    const allTasksMap: Record<string, boolean> = {};
    tasks.forEach((t) => {
      allTasksMap[t.id] = true;
    });
    setExpanded(allTasksMap);
  };

  const handleCollapseAll = () => {
    autoExpandRef.current = false;
    // Collapse all tasks
    setExpanded({});
    // Collapse all projects
    setExpandedProjects({});
  };

  const loadMoreSubTasks = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !task.subTasks) return;

    if (loadingMoreSubTasks[taskId]) return;
    setLoadingMoreSubTasks((prev) => ({ ...prev, [taskId]: true }));

    try {
      const cleanFilters: any = {};
      const rawFilters = {
        ...filters,
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        search: searchQuery || undefined,
      };
      Object.keys(rawFilters).forEach((key) => {
        // @ts-ignore
        const value = rawFilters[key];
        if (value !== undefined && value !== null && value !== "") {
          cleanFilters[key] = value;
        }
      });

      const response = await loadTasksAction({
        workspaceId,
        projectId: task.projectId || projectId,
        filterParentTaskId: taskId,
        status: cleanFilters.status,
        assigneeId: cleanFilters.assigneeId,
        tagId: cleanFilters.tagId,
        search: cleanFilters.search,
        dueAfter: cleanFilters.startDate,
        dueBefore: cleanFilters.endDate,
        cursor: task.subTasksNextCursor,
        limit: 30,
        sorts,
      });

      if (response.success && response.data) {
        const resultData = response.data as any;
        console.log(
          `[CLIENT] Loaded more subtasks for parent ${taskId}:`,
          resultData.tasks,
        );
        // Deduplicate: combine existing + new subtasks, remove duplicates
        const existingSubTasks = task.subTasks || [];
        const existingIds = new Set(existingSubTasks.map((st) => st.id));
        const newSubTasks = (resultData.tasks as any[]).filter(
          (st: any) => st.id && !existingIds.has(st.id),
        );
        const combinedSubTasks = [...existingSubTasks, ...newSubTasks];

        if (!filtersActive) {
          setCachedSubTasks(taskId, {
            subTasks: combinedSubTasks,
            hasMore: resultData.hasMore,
            nextCursor: resultData.nextCursor,
          });
        }

        setTasks((prevTasks) =>
          prevTasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  subTasks: combinedSubTasks,
                  subTasksHasMore: resultData.hasMore,
                  subTasksNextCursor: resultData.nextCursor,
                }
              : t,
          ),
        );
      } else {
        toast.error(response.error || "Failed to load more subtasks");
      }
    } catch (error) {
      console.error("Error loading more subtasks:", error);
      toast.error("Failed to load more subtasks");
    } finally {
      setLoadingMoreSubTasks((prev) => ({ ...prev, [taskId]: false }));
    }
  };
  const handleSort = (field: SortField) => {
    setSorts((prev) => {
      const existing = prev.find((s) => s.field === field);

      // If no sort active → start ASC
      if (!existing) {
        return [{ field, direction: "asc" as const }];
      }

      // If ASC → switch to DESC
      if (existing.direction === "asc") {
        return [{ field, direction: "desc" as const }];
      }

      // If DESC → remove sort
      return [];
    });
  };

  return (
    <div className="space-y-4 mt-0">
      <div className="flex items-center gap-2">
        <GlobalFilterToolbar
          className="flex-1"
          level={showAdvancedFilters ? "workspace" : "project"}
          view="list"
          filters={filters}
          searchQuery={searchQuery}
          projects={projects}
          members={filterOptions.assignees}
          tags={filterOptions.tags}
          onFilterChange={debouncedSetFilters}
          onSearchChange={setSearchQuery}
          onClearAll={() => {
            setFilters({});
            setSearchQuery("");
            setSorts([]); // Also clear sorts when clearing all filters
          }}
          columnVisibility={columnVisibility}
          setColumnVisibility={setColumnVisibility}
        />
      </div>

      <div className="rounded-md border overflow-hidden relative">
        {isLoadingFilters && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm transition-all duration-300">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm font-medium text-muted-foreground">
                Filtering...
              </span>
            </div>
          </div>
        )}
        <div
          ref={scrollContainerRef}
          className={cn(
            "overflow-auto",
            level === "workspace" ? "max-h-[70vh]" : "max-h-[65vh]",
            "mt-0",
            "[&::-webkit-scrollbar]:w-0.5",
            "[&::-webkit-scrollbar]:h-1",
            "[&::-webkit-scrollbar-track]:bg-transparent",
            "[&::-webkit-scrollbar-thumb]:bg-slate-300",
            "[&::-webkit-scrollbar-thumb]:rounded-full",
            "[&::-webkit-scrollbar-thumb]:hover:bg-slate-400",
          )}
        >
          <table className="w-full caption-bottom text-sm table-fixed">
              <thead className="[&_tr]:border-b">
                <tr className="sticky top-0 z-10 bg-background border-b shadow-sm hover:bg-muted/50">
                  <th className="text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap w-[40px] md:w-[50px] bg-background">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-muted"
                        >
                          <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={handleExpandAll}>
                          <Maximize2 className="mr-2 h-4 w-4" />
                          Expand All
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleCollapseAll}>
                          <Minimize2 className="mr-2 h-4 w-4" />
                          Collapse All
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </th>
                  <SortableHeader
                    field="name"
                    label="Task Name"
                    sorts={sorts}
                    onSortChange={handleSort}
                    className="w-[180px] sm:w-[250px] md:w-[350px]"
                  />
                  {/* Project column removed (using grouping instead) */}
                  {columnVisibility.description && (
                    <th className="text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap w-[150px] sm:w-[200px] bg-background">
                      Description
                    </th>
                  )}
                  {columnVisibility.assignee && (
                    <th className="text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap w-[80px] sm:w-[100px] bg-background">
                      {/* ⚠️ Not sortable — sorting by FK id is meaningless.
                                                Re-enable once assigneeDisplayName is denormalized onto Task. */}
                      Assignee
                    </th>
                  )}
                  {columnVisibility.reviewer && (
                    <th className="text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap w-[80px] sm:w-[100px] bg-background">
                      Reviewer
                    </th>
                  )}
                  {columnVisibility.status && (
                    <SortableHeader
                      field="status"
                      label="Status"
                      sorts={sorts}
                      onSortChange={handleSort}
                      className="w-[90px] sm:w-[120px]"
                    />
                  )}
                  {columnVisibility.startDate && (
                    <th className="text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap w-[90px] sm:w-[120px] bg-background">
                      Start Date
                    </th>
                  )}
                  {columnVisibility.dueDate && (
                    <SortableHeader
                      field="dueDate"
                      label="Due Date"
                      sorts={sorts}
                      onSortChange={handleSort}
                      className="w-[90px] sm:w-[120px]"
                    />
                  )}
                  {columnVisibility.progress && (
                    <th className="text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap w-[100px] sm:w-[150px] bg-background">
                      Deadline
                    </th>
                  )}
                  {columnVisibility.tag && (
                    <th className="text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap w-[100px] sm:w-[120px] bg-background">
                      Tag
                    </th>
                  )}
                  <th className="text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap w-[40px] bg-background"></th>
                </tr>
              </thead>
              <tbody>
                {/* SORTED VIEW: Flat task rows grouped by project */}
                {mode === "sorted" ? (
                  <SortedTaskList
                    sortedTasks={sortedTasks}
                    isLoading={isSortedViewLoading}
                    hasMore={sortedHasMore}
                    isLoadingMore={isLoadingMoreSorted}
                    columnVisibility={columnVisibility}
                    visibleColumnsCount={visibleColumnsCount}
                    sortedSentinelRef={sortedSentinelRef}
                    handleSubTaskClick={handleSubTaskClick}
                  />
                ) : groupedTasks ? (
                  // Sort project IDs to match the order in the 'projects' array (which is server-sorted newest-first)
                  projects
                    .filter((p) => groupedTasks[p.id])
                    .map((project) => {
                      const currentProjectId = project.id;
                      const projectTasks = groupedTasks[currentProjectId];

                      return (
                        <ProjectTaskGroup
                          key={currentProjectId}
                          projectId={currentProjectId}
                          project={project}
                          initialTasks={projectTasks}
                          totalTasksCount={
                            projectCounts
                              ? projectCounts[currentProjectId] || 0
                              : projectTaskCounts[currentProjectId]
                          }
                          isExpanded={
                            expandedProjects[currentProjectId] === true
                          }
                          onToggle={() => toggleProjectExpand(currentProjectId)}
                          visibleColumnsCount={visibleColumnsCount}
                          columnVisibility={columnVisibility}
                          expandedTasks={expanded}
                          onToggleExpandTask={toggleExpand}
                          updatingTaskId={updatingTaskId}
                          setUpdatingTaskId={setUpdatingTaskId}
                          permissions={permissions}
                          userId={userId}
                          isWorkspaceAdmin={isWorkspaceAdmin}
                          leadProjectIds={leadProjectIds}
                          projects={projects}
                          onRequestSubtasks={handleRequestSubtasks}
                          getCachedSubTasks={getCachedSubTasks}
                          tags={tags}
                          scrollContainerRef={scrollContainerRef}
                          members={members}
                          workspaceId={workspaceId}
                          canCreateSubTask={canCreateSubTask}
                          loadingSubTasks={loadingSubTasks}
                          loadingMoreSubTasks={loadingMoreSubTasks}
                          onLoadMoreSubTasks={loadMoreSubTasks}
                          handleSubTaskClick={handleSubTaskClick}
                          level={level}
                          paginationState={projectPagination[currentProjectId]}
                          getObserver={getObserver}
                          filtersActive={filtersActive}
                          activeInlineProjectId={activeInlineProjectId}
                          setActiveInlineProjectId={setActiveInlineProjectId}
                          onUpdateParentTaskLists={(updatedProjectTasks) => {
                            // Maintain newest-first: updated tasks should stay in their relative created order.
                            // For simplicity in a flat array, we just update the specific matching tasks in the main list.
                            setTasks((prev) => {
                              const taskMap = new Map(
                                prev.map((t) => [t.id, t]),
                              );
                              updatedProjectTasks.forEach((t) =>
                                taskMap.set(t.id, t),
                              );
                              return Array.from(taskMap.values());
                            });
                          }}
                        />
                      );
                    })
                ) : (
                  <FlatTaskList
                    initialTasks={tasks}
                    columnVisibility={columnVisibility}
                    visibleColumnsCount={visibleColumnsCount}
                    expandedTasks={expanded}
                    onToggleExpandTask={toggleExpand}
                    updatingTaskId={updatingTaskId}
                    setUpdatingTaskId={setUpdatingTaskId}
                    permissions={permissions}
                    userId={userId}
                    isWorkspaceAdmin={isWorkspaceAdmin}
                    leadProjectIds={leadProjectIds}
                    projects={projects}
                    onRequestSubtasks={handleRequestSubtasks}
                    getCachedSubTasks={getCachedSubTasks}
                    tags={tags}
                    scrollContainerRef={scrollContainerRef}
                    members={members}
                    workspaceId={workspaceId}
                    projectId={projectId}
                    canCreateSubTask={canCreateSubTask}
                    loadingSubTasks={loadingSubTasks}
                    loadingMoreSubTasks={loadingMoreSubTasks}
                    onLoadMoreSubTasks={loadMoreSubTasks}
                    handleSubTaskClick={handleSubTaskClick}
                    level={level}
                    filtersActive={filtersActive}
                    activeInlineProjectId={activeInlineProjectId}
                    setActiveInlineProjectId={setActiveInlineProjectId}
                    onUpdateParentTaskLists={(updatedTasks) => {
                      setTasks(updatedTasks);
                    }}
                  />
                )}
                {!groupedTasks && projectPagination[projectId]?.hasMore && (
                  <LoadMoreSentinel
                    visibleColumnsCount={visibleColumnsCount}
                    projectId={projectId}
                    observer={getObserver()}
                  />
                )}

                {isLoadingFilters && tasks.length === 0 && (
                  <TableLoading visibleColumnsCount={visibleColumnsCount} />
                )}

                {mode !== "sorted" &&
                  tasks.length === 0 &&
                  !isLoadingFilters &&
                  !groupedTasks && (
                    <EmptyState
                      message="No tasks found"
                      visibleColumnsCount={visibleColumnsCount}
                    />
                  )}

                {/* Global Pagination for Workspace Filtered View */}
                {level === "workspace" &&
                  filtersActive &&
                  projectPagination["__global_filter__"]?.hasMore && (
                    <LoadMoreSentinel
                      visibleColumnsCount={visibleColumnsCount}
                      projectId="__global_filter__"
                      observer={getObserver()}
                    />
                  )}

                {/* Global "No more tasks" marker */}
                {!isLoadingFilters &&
                  ((mode === "sorted" &&
                    !sortedHasMore &&
                    sortedTasks.length > 0) ||
                    (level === "project" &&
                      mode !== "sorted" &&
                      !projectPagination[projectId]?.hasMore &&
                      tasks.length > 0) ||
                    (level === "workspace" &&
                      groupedTasks &&
                      Object.keys(groupedTasks).length > 0 &&
                      (filtersActive
                        ? !projectPagination["__global_filter__"]?.hasMore
                        : !Object.values(projectPagination).some(
                            (p) => p.hasMore,
                          )))) && (
                    <TableRow className="hover:bg-transparent border-0">
                      <TableCell
                        colSpan={visibleColumnsCount}
                        className="py-12 text-center text-muted-foreground/30 text-[10px] font-bold uppercase tracking-[0.4em] pointer-events-none select-none"
                      >
                        no more tasks found
                      </TableCell>
                    </TableRow>
                  )}
              </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}

export default memo(TaskTable);
