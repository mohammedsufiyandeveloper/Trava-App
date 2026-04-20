"use client";

import { useRef, useState, useEffect, memo, useCallback } from "react";
import type { SubTasksByStatusResponse, KanbanSubTaskType } from "@/data/task";
import type { ProjectMembersType } from "@/data/project/get-project-members";
import { cn } from "@/lib/utils";
import { useSubTaskSheetActions } from "@/contexts/subtask-sheet-context";
import { toast } from "sonner";
import { KanbanCard } from "./kanban-card";
import { KanbanColumn } from "./kanban-column";
import type { TaskFilters, ProjectOption, TagOption } from "../shared/types";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/colors/status-colors";
import { updateSubTaskStatus } from "@/actions/task/kanban/update-subtask-status";
import { loadTasksAction } from "@/actions/task/list-actions";
import {
  GlobalFilterToolbar,
  ParentTaskOption,
} from "../shared/global-filter-toolbar";
import { ActivityDialog } from "@/app/w/[workspaceId]/p/[slug]/_components/forms/activity-form";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  closestCorners,
  pointerWithin,
  PointerSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useTaskCacheStore } from "@/lib/store/task-cache-store";
import { Loader2, MoreHorizontal } from "lucide-react";
import { logger } from "@/lib/logger";
import { UserPermissionsType } from "@/data/user/get-user-permissions";
// Simple debounce implementation
const debounce = (func: Function, wait: number) => {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

type TaskStatus =
  | "TO_DO"
  | "IN_PROGRESS"
  | "CANCELLED"
  | "REVIEW"
  | "HOLD"
  | "COMPLETED";

interface KanbanBoardProps {
  initialData: Record<TaskStatus, SubTasksByStatusResponse>;
  projectMembers: ProjectMembersType;
  workspaceId: string;
  projectId: string;
  projects?: ProjectOption[]; // Optional for workspace-level
  tags?: TagOption[];
  level?: "project" | "workspace"; // Optional, defaults to "project"
  projectManagers?: Record<string, any>;
  permissions?: UserPermissionsType;
  userId?: string;
}

const COLUMNS: {
  id: TaskStatus;
  title: string;
  color: string;
  bgColor: string;
  borderColor: string;
}[] = [
    {
      id: "TO_DO",
      title: STATUS_LABELS.TO_DO,
      ...STATUS_COLORS.TO_DO,
    },
    {
      id: "IN_PROGRESS",
      title: STATUS_LABELS.IN_PROGRESS,
      ...STATUS_COLORS.IN_PROGRESS,
    },
    {
      id: "REVIEW",
      title: STATUS_LABELS.REVIEW,
      ...STATUS_COLORS.REVIEW,
    },
    {
      id: "COMPLETED",
      title: STATUS_LABELS.COMPLETED,
      ...STATUS_COLORS.COMPLETED,
    },
    {
      id: "HOLD",
      title: STATUS_LABELS.HOLD,
      ...STATUS_COLORS.HOLD,
    },
    {
      id: "CANCELLED",
      title: STATUS_LABELS.CANCELLED,
      ...STATUS_COLORS.CANCELLED,
    },
  ];

export function KanbanBoard({
  initialData,
  projectMembers,
  workspaceId,
  projectId,
  projects,
  tags,
  level = "project",
  projectManagers,
  permissions,
  userId,
}: KanbanBoardProps) {
  const setKanbanTasksCache = useTaskCacheStore(
    (state) => state.setKanbanTasksCache,
  );
  const invalidateSubTaskCache = useTaskCacheStore(
    (state) => state.invalidateSubTaskCache,
  );
  const invalidateProjectCache = useTaskCacheStore(
    (state) => state.invalidateProjectCache,
  );
  const kanbanLists = useTaskCacheStore((state) => state.kanbanLists);
  const lastSyncRef = useRef<Record<string, number>>({});

  const renderCount = useRef(0);
  renderCount.current++;
  logger.perf("KANBAN_RENDER", 0, { count: renderCount.current });

  // State for each column's data - INITIALIZE WITH PROPS ONLY FOR HYDRATION SAFETY
  const [columnData, setColumnData] = useState<
    Record<
      TaskStatus,
      {
        subTaskIds: string[];
        totalCount: number;
        hasMore: boolean;
        nextCursor: any;
      }
    >
  >(() => {
    const map: any = {};
    COLUMNS.forEach((col) => {
      const serverCol = initialData[col.id];
      map[col.id] = {
        subTaskIds: serverCol.subTasks.map((t) => t.id),
        totalCount: serverCol.totalCount,
        hasMore: serverCol.hasMore,
        nextCursor: serverCol.nextCursor,
      };
    });
    return map;
  });

  // -------------------------------------------------------------------------
  // 🚀 SURGICAL SYNC: Listen for store updates (moves/surgical sync)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const contextId = projectId || "";
    let hasChanges = false;
    const nextState = { ...columnData };

    COLUMNS.forEach((col) => {
      const cacheKey = `${workspaceId}-${contextId}-${col.id}`;
      const cachedList = kanbanLists[cacheKey];

      if (
        cachedList &&
        cachedList.timestamp > (lastSyncRef.current[cacheKey] || 0)
      ) {
        // Determine if the ID set actually changed or if it just arrived
        const currentIds = columnData[col.id].subTaskIds;
        const matches =
          cachedList.ids.length === currentIds.length &&
          cachedList.ids.every((id, i) => id === currentIds[i]);

        if (!matches) {
          nextState[col.id] = {
            ...nextState[col.id],
            subTaskIds: cachedList.ids,
            totalCount: cachedList.totalCount ?? nextState[col.id].totalCount,
          };
          hasChanges = true;
        }
        lastSyncRef.current[cacheKey] = cachedList.timestamp;
      }
    });

    if (hasChanges) {
      setColumnData(nextState);
    }
  }, [kanbanLists, workspaceId, projectId]);

  // Hydrate state from cache after mount
  useEffect(() => {
    const startTime = performance.now();
    const upsertTasks = useTaskCacheStore.getState().upsertTasks;

    // 0. IMMEDIATE SYNC: Upsert all initial server data into global entities
    // ensure we have the freshest versions available for relations and metadata
    const allInitialTasks = Object.values(initialData).flatMap(
      (d) => d.subTasks,
    );
    if (allInitialTasks.length > 0) {
      upsertTasks(allInitialTasks);
    }

    const contextId = projectId || "";
    const hydratedData: any = { ...columnData };
    let hasChanges = false;

    COLUMNS.forEach((col) => {
      const cacheKey = `${workspaceId}-${contextId}-${col.id}`;
      const cached = useTaskCacheStore.getState().getKanbanTasksCache(cacheKey);

      // 1. Base Data Strategy:
      // ALWAYS prefer the list structure from the server (initialData) if it just arrived.
      // Use cache only for "nextCursor" or if we are navigating back without new props.
      let tasks = initialData[col.id].subTasks;

      if (cached && cached.tasks.length > 0) {
        if (initialData[col.id].totalCount === 0) {
          // Server explicitly says there are 0 tasks. DO NOT fallback to stale cache.
          tasks = [];
        } else if (tasks.length > 0 && cached.tasks.length > tasks.length) {
          // Cache has MORE items than the server provided page 1.
          // Verify if it's the SAME data set by checking if the base IDs match.
          const baseIdsMatch = tasks.every(
            (t, i) => cached.tasks[i]?.id === t.id,
          );
          if (baseIdsMatch) {
            tasks = cached.tasks;
          }
        } else if (tasks.length === 0 && initialData[col.id].totalCount > 0) {
          // Edge case: SSR provided 0 tasks but totalCount > 0? Trust the cache.
          tasks = cached.tasks;
        }
      }

      // Sync these IDs into the global store immediately so the listener can find them
      setKanbanTasksCache(cacheKey, {
        tasks: tasks,
        hasMore: initialData[col.id].hasMore,
        nextCursor: cached?.nextCursor || initialData[col.id].nextCursor,
        totalCount: initialData[col.id].totalCount,
      });
      // Mark as synced so the surgical effect doesn't immediately overwrite with itself
      lastSyncRef.current[cacheKey] = Date.now();

      let totalCount = initialData[col.id].totalCount;
      let hasMore = initialData[col.id].hasMore;
      let nextCursor = cached
        ? cached.nextCursor
        : initialData[col.id].nextCursor;

      // 2. Workspace Aggregation: Merge cached tasks from OTHER projects
      if (level === "workspace" && projects) {
        const projectTasks = projects.flatMap((p) => {
          const pKey = `${workspaceId}-${p.id}-${col.id}`;
          const pCached = useTaskCacheStore
            .getState()
            .getKanbanTasksCache(pKey);
          // Filter by status to prevent ghosting
          return pCached && pCached.tasks
            ? pCached.tasks.filter((t: any) => t.status === col.id)
            : [];
        });

        if (projectTasks.length > 0) {
          const taskMap = new Map();
          // Seed with current tasks (server matches)
          tasks.forEach((t: any) => taskMap.set(t.id, t));

          // Merge project-specific tasks not already in the list
          projectTasks.forEach((t: any) => {
            if (!taskMap.has(t.id)) {
              taskMap.set(t.id, t);
            }
          });

          tasks = Array.from(taskMap.values());
          hasChanges = true;
        }
      }

      hydratedData[col.id] = {
        subTaskIds: tasks.map((t) => t.id),
        totalCount: totalCount || (cached ? cached.totalCount : 0),
        hasMore: hasMore,
        nextCursor: nextCursor,
      };

      // Re-sync this column's cache to match the server/merged reality
      setKanbanTasksCache(cacheKey, {
        tasks: tasks,
        hasMore,
        page: 1,
        totalCount: hydratedData[col.id].totalCount,
      });
    });

    setColumnData(hydratedData);

    const duration = performance.now() - startTime;
    logger.perf("KANBAN_HYDRATION", duration, {
      workspaceId,
      projectId,
      level,
    });
  }, [projectId, workspaceId, level, projects, initialData]); // initialData as dependency ensures we respond to fresh props

  const [visibleColumns, setVisibleColumns] = useState<
    Record<TaskStatus, boolean>
  >(
    COLUMNS.reduce(
      (acc, col) => ({ ...acc, [col.id]: true }),
      {} as Record<TaskStatus, boolean>,
    ),
  );
  const [updatingTaskIds, setUpdatingTaskIds] = useState<Set<string>>(
    new Set(),
  );
  const [loadingColumns, setLoadingColumns] = useState<
    Record<TaskStatus, boolean>
  >(
    Object.fromEntries(COLUMNS.map((col) => [col.id, false])) as Record<
      TaskStatus,
      boolean
    >,
  );

  const [activeSubTask, setActiveSubTask] = useState<KanbanSubTaskType | null>(
    null,
  );
  const [overInfo, setOverInfo] = useState<{
    overId: string | null;
    columnId: TaskStatus | null;
  }>({ overId: null, columnId: null });

  const { openSubTaskSheet } = useSubTaskSheetActions();
  // const reloadView = useReloadView();

  const [isActivityDialogOpen, setIsActivityDialogOpen] = useState(false);
  const [pendingReviewMove, setPendingReviewMove] = useState<{
    subTaskId: string;
    previousStatus: TaskStatus;
    targetStatus: TaskStatus;
  } | null>(null);

  const [filters, setFilters] = useState<TaskFilters>({});
  const [searchQuery, setSearchQuery] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    }),
  );

  const [isFiltering, setIsFiltering] = useState(false);
  const [isCurrentlyFiltered, setIsCurrentlyFiltered] = useState(false);

  // Server-side filtering effect
  useEffect(() => {
    let isAborted = false;

    const timer = setTimeout(async () => {
      // Check if there are truly any filters active that should bypass the local cache
      const activeFilterCount = Object.values(filters).filter(
        (v) => v !== undefined && v !== "",
      ).length;
      const isBaseProjectView =
        !searchQuery &&
        (activeFilterCount === 0 ||
          (activeFilterCount === 1 && filters.projectId === projectId));
      const hasFilters = !isBaseProjectView;

      if (!hasFilters) {
        // Reset to initial unfiltered data ONLY if we were previously filtering
        if (isCurrentlyFiltered) {
          const contextId = projectId || "";
          const resetData: any = {};

          COLUMNS.forEach((col) => {
            const cacheKey = `${workspaceId}-${contextId}-${col.id}`;
            const cached = useTaskCacheStore
              .getState()
              .getKanbanTasksCache(cacheKey);

            // Use Cache > InitialData
            resetData[col.id] = {
              subTaskIds: (cached && cached.tasks.length > 0
                ? cached.tasks
                : initialData[col.id].subTasks
              ).map((t) => t.id),
              totalCount: cached
                ? (cached.totalCount ?? 0)
                : initialData[col.id].totalCount,
              hasMore: cached ? cached.hasMore : initialData[col.id].hasMore,
              nextCursor: cached ? cached.nextCursor : undefined,
            };
          });

          if (!isAborted) {
            setColumnData(resetData);
            setIsCurrentlyFiltered(false);
            setLoadingColumns(
              Object.fromEntries(COLUMNS.map((col) => [col.id, false])) as any,
            );
            setIsFiltering(false);
          }
        } else {
          if (!isAborted) setIsFiltering(false);
        }
        return;
      }

      if (isAborted) return;
      setIsCurrentlyFiltered(true);

      // Performance Tracking for Filtering
      const startTime = performance.now();

      // Set loading state
      setLoadingColumns(
        Object.fromEntries(COLUMNS.map((col) => [col.id, true])) as Record<
          TaskStatus,
          boolean
        >,
      );

      try {
        const targetProjectId = filters.projectId || projectId;

        const response = await loadTasksAction({
          workspaceId,
          projectId: targetProjectId,
          groupBy: "status",
          includeSubTasks: true,
          excludeParents: true, // ONLY CARDS
          limit: 100,
          sorts: [{ field: "createdAt", direction: "desc" }],
          includeFacets: true,
          status: undefined,
          startDate: filters.startDate
            ? new Date(filters.startDate).toISOString()
            : undefined,
          endDate: filters.endDate
            ? new Date(filters.endDate).toISOString()
            : undefined,
          search: searchQuery,
          assigneeId: filters.assigneeId,
          tagId: filters.tagId,
          filterParentTaskId: filters.parentTaskId,
          view_mode: "kanban",
        });

        if (isAborted) return;

        if (response.success && response.data) {
          const counts = (response.data.facets as any)?.statusCounts || {};
          const groupedData: any = {};

          COLUMNS.forEach((col) => {
            const allColTasks = response.data.tasksByStatus[col.id] || [];
            // Don't display parent as a card
            const colTasks = allColTasks.filter((t: any) => !t.isParent);

            // Sync entities to global store for updated review counts/metadata
            if (colTasks.length > 0) {
              useTaskCacheStore.getState().upsertTasks(colTasks);
            }

            // Use the statusCounts to compute if this SPECIFIC column has more items
            // since this specific query fetches everything generically
            const totalForCol = counts[col.id] || colTasks.length;
            const hasMoreLocal = totalForCol > colTasks.length;

            // Extract a custom cursor specifically for this column if needed
            const lastTask = colTasks[colTasks.length - 1];
            const nextCursor =
              hasMoreLocal && lastTask
                ? { id: lastTask.id, createdAt: lastTask.createdAt }
                : null;

            groupedData[col.id] = {
              subTaskIds: colTasks.map((t: any) => t.id),
              totalCount: totalForCol,
              hasMore: hasMoreLocal,
              nextCursor: nextCursor,
            };
          });
          setColumnData(groupedData);

          const duration = performance.now() - startTime;
          logger.perf("KANBAN_FILTER_APPLIED", duration, {
            workspaceId,
            projectId,
            search: searchQuery,
          });
        } else {
          toast.error("Failed to apply filters");
        }
      } catch (err) {
        console.error("Error filtering subtasks", err);
        if (!isAborted) toast.error("Failed to apply filters");
      } finally {
        if (!isAborted) {
          setLoadingColumns(
            Object.fromEntries(COLUMNS.map((col) => [col.id, false])) as Record<
              TaskStatus,
              boolean
            >,
          );
          setIsFiltering(false);
        }
      }
    }, 300); // Debounce

    return () => {
      isAborted = true;
      clearTimeout(timer);
    };
  }, [filters, searchQuery, workspaceId, projectId, initialData]);

  const handleFilterChange = useCallback(
    debounce((val: TaskFilters) => {
      setIsFiltering(true);
      setFilters(val);
    }, 200) as (val: TaskFilters) => void,
    [setFilters],
  );

  const handleSearchChange = (val: string) => {
    setIsFiltering(true);
    setSearchQuery(val);
  };

  const handleLoadMore = async (status: TaskStatus) => {
    if (loadingColumns[status] || !columnData[status].hasMore) return;
    setLoadingColumns((prev) => ({ ...prev, [status]: true }));

    try {
      const currentCursor = columnData[status].nextCursor;
      const activeFilters =
        searchQuery || Object.keys(filters).length > 0
          ? {
            ...filters,
            startDate: filters.startDate
              ? new Date(filters.startDate).toISOString()
              : undefined,
            endDate: filters.endDate
              ? new Date(filters.endDate).toISOString()
              : undefined,
            search: searchQuery,
          }
          : undefined;

      const targetProjectId = filters.projectId || projectId;

      // Build the URL with short parameters (w, s, l, vm, p, c, q)
      const params = new URLSearchParams();
      params.set("w", workspaceId);
      params.set("s", status);
      params.set("l", "30");
      params.set("vm", "kanban");

      if (targetProjectId) params.set("p", targetProjectId);
      if (currentCursor) params.set("c", JSON.stringify(currentCursor));
      if (searchQuery) params.set("q", searchQuery);

      // Filters
      if (filters.assigneeId) params.append("a", filters.assigneeId);
      if (filters.tagId) params.append("t", filters.tagId);

      const apiRes = await fetch(`/api/kt?${params.toString()}`);
      const response = await apiRes.json();

      if (!response.success) {
        toast.error(response.error || "Failed to load more subtasks");
        return;
      }

      setColumnData((prev) => {
        const counts = (response.data.facets as any)?.statusCounts || {};
        const existingIds = prev[status].subTaskIds;
        const allNewTasks = response.data.tasks || [];

        // STRICT: Only tasks whose status matches AND are not parents
        const newTasks = allNewTasks.filter(
          (t: any) => !t.isParent && t.status === status,
        );

        // Sync to global store
        useTaskCacheStore.getState().upsertTasks(newTasks);

        // Deduplicate using a Set
        const idSet = new Set([
          ...existingIds,
          ...newTasks.map((t: any) => t.id),
        ]);
        const deduplicatedIds = Array.from(idSet);
        const totalForCol = counts[status] || (prev[status].totalCount ?? 0);

        // Trust the server's pagination state directly to avoid infinite loops
        const serverHasMore = response.data.hasMore || false;
        const serverNextCursor = response.data.nextCursor || null;

        const newData = {
          ...prev,
          [status]: {
            subTaskIds: deduplicatedIds,
            totalCount: totalForCol,
            hasMore: serverHasMore,
            nextCursor: serverNextCursor,
          },
        };

        // Update Cache (only if no filters)
        const isFiltered = searchQuery || Object.keys(filters).length > 0;
        if (!isFiltered) {
          const contextId = projectId || "";
          const cacheKey = `${workspaceId}-${contextId}-${status}`;
          // We need all tasks for this column to update cache correctly
          const entities = useTaskCacheStore.getState().entities;
          const allTasksForCol = deduplicatedIds
            .map((id) => entities[id])
            .filter(Boolean);

          setKanbanTasksCache(cacheKey, {
            tasks: allTasksForCol,
            hasMore: response.data.hasMore,
            nextCursor: response.data.nextCursor,
            totalCount: response.data.totalCount ?? undefined,
          });
        }

        return newData;
      });
    } catch (error) {
      console.error(`Error loading more subtasks for ${status}:`, error);
      toast.error("Failed to load more subtasks");
    } finally {
      setLoadingColumns((prev) => ({ ...prev, [status]: false }));
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const subTask = useTaskCacheStore.getState().entities[active.id as string];
    if (subTask) {
      setActiveSubTask(subTask as KanbanSubTaskType);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over) {
      setOverInfo({ overId: null, columnId: null });
      return;
    }
    const overId = over.id as string;
    const validStatuses: TaskStatus[] = [
      "TO_DO",
      "IN_PROGRESS",
      "CANCELLED",
      "REVIEW",
      "HOLD",
      "COMPLETED",
    ];
    // If dropped directly onto a column, overId is the column status
    if (validStatuses.includes(overId as TaskStatus)) {
      setOverInfo({ overId: null, columnId: overId as TaskStatus });
    } else {
      // overId is a card id — find which column it belongs to
      for (const col of COLUMNS) {
        if (columnData[col.id].subTaskIds.includes(overId)) {
          setOverInfo({ overId, columnId: col.id });
          return;
        }
      }
      setOverInfo({ overId: null, columnId: null });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveSubTask(null);
    setOverInfo({ overId: null, columnId: null });

    if (!over) {
      return;
    }

    const subTaskId = active.id as string;
    const overId = over.id as string;

    const validStatuses: TaskStatus[] = [
      "TO_DO",
      "IN_PROGRESS",
      "CANCELLED",
      "REVIEW",
      "HOLD",
      "COMPLETED",
    ];

    // Resolve the target column:
    // 1. If the pointer is directly over a column drop zone, over.id IS the status.
    // 2. If the pointer is over another card, find which column that card belongs to.
    let newStatus: TaskStatus | null = null;
    if (validStatuses.includes(overId as TaskStatus)) {
      newStatus = overId as TaskStatus;
    } else {
      // over.id is a card id — find its column
      for (const col of COLUMNS) {
        if (columnData[col.id].subTaskIds.includes(overId)) {
          newStatus = col.id;
          break;
        }
      }
    }

    if (!newStatus) {
      return;
    }

    let currentStatus: TaskStatus | null = null;
    for (const status of COLUMNS.map((c) => c.id)) {
      if (columnData[status].subTaskIds.includes(subTaskId)) {
        currentStatus = status;
        break;
      }
    }

    const subTask = useTaskCacheStore.getState().entities[subTaskId];

    if (!subTask || !currentStatus || currentStatus === newStatus) {
      return;
    }

    const previousStatus = currentStatus;

    if (
      newStatus === "REVIEW" ||
      (previousStatus === "REVIEW" && newStatus !== "COMPLETED")
    ) {
      moveSubTaskBetweenColumns(subTaskId, previousStatus, newStatus);

      setPendingReviewMove({
        subTaskId,
        previousStatus,
        targetStatus: newStatus,
      });
      setIsActivityDialogOpen(true);
      return;
    }

    await performStatusUpdate(subTaskId, newStatus, previousStatus);
  };

  const moveSubTaskBetweenColumns = (
    subTaskId: string,
    fromStatus: TaskStatus,
    toStatus: TaskStatus,
  ) => {
    const fromIds = columnData[fromStatus].subTaskIds;
    const hasTask = fromIds.includes(subTaskId);

    if (!hasTask) return;

    const toIds = columnData[toStatus].subTaskIds;
    const alreadyInTarget = toIds.includes(subTaskId);

    const newFromIds = fromIds.filter((id) => id !== subTaskId);
    const newToIds = alreadyInTarget ? toIds : [subTaskId, ...toIds];

    const newFromCount = columnData[fromStatus].totalCount - 1;
    const newToCount = alreadyInTarget
      ? columnData[toStatus].totalCount
      : columnData[toStatus].totalCount + 1;

    setColumnData((prev) => ({
      ...prev,
      [fromStatus]: {
        ...prev[fromStatus],
        subTaskIds: newFromIds,
        totalCount: newFromCount,
      },
      [toStatus]: {
        ...prev[toStatus],
        subTaskIds: newToIds,
        totalCount: newToCount,
      },
    }));

    // Fetch task object for cache sync
    const task = useTaskCacheStore.getState().entities[subTaskId];
    if (!task) return;

    const updatedTask = { ...task, status: toStatus };

    // Update Cache (only if no filters) to maintain consistency across re-renders/syncs
    const isFiltered = searchQuery || Object.keys(filters).length > 0;
    if (!isFiltered) {
      const contextId = projectId || "";
      const fromCacheKey = `${workspaceId}-${contextId}-${fromStatus}`;
      const toCacheKey = `${workspaceId}-${contextId}-${toStatus}`;
      const entities = useTaskCacheStore.getState().entities;

      setKanbanTasksCache(fromCacheKey, {
        tasks: newFromIds.map((id) => entities[id]).filter(Boolean),
        hasMore: columnData[fromStatus].hasMore,
        nextCursor: columnData[fromStatus].nextCursor,
        totalCount: newFromCount,
      });

      setKanbanTasksCache(toCacheKey, {
        tasks: newToIds.map((id) => entities[id]).filter(Boolean),
        hasMore: columnData[toStatus].hasMore,
        nextCursor: columnData[toStatus].nextCursor,
        totalCount: newToCount,
      });

      // CROSS-CONTEXT SYNC: Bidirectional sync between workspace and project caches
      const taskProjectId =
        (task as any).projectId || getTaskProjectId(subTaskId);

      if (!contextId && taskProjectId) {
        // We are in Workspace view -> Update Project caches
        const pFromKey = `${workspaceId}-${taskProjectId}-${fromStatus}`;
        const pToKey = `${workspaceId}-${taskProjectId}-${toStatus}`;

        // Update Project "From" Column
        const pFromCached = useTaskCacheStore
          .getState()
          .getKanbanTasksCache(pFromKey);
        if (pFromCached) {
          setKanbanTasksCache(pFromKey, {
            ...pFromCached,
            tasks: pFromCached.tasks.filter((t) => t.id !== subTaskId),
            totalCount: Math.max(0, (pFromCached.totalCount || 1) - 1),
          });
        }

        // Update Project "To" Column
        const pToCached = useTaskCacheStore
          .getState()
          .getKanbanTasksCache(pToKey);
        if (pToCached) {
          setKanbanTasksCache(pToKey, {
            ...pToCached,
            tasks: [
              updatedTask,
              ...pToCached.tasks.filter((t) => t.id !== subTaskId),
            ],
            totalCount: (pToCached.totalCount || 0) + 1,
          });
        }
      } else if (contextId) {
        // We are in Project view -> Update Workspace caches
        const wFromKey = `${workspaceId}--${fromStatus}`;
        const wToKey = `${workspaceId}--${toStatus}`;

        // Update Workspace "From" Column
        const wFromCached = useTaskCacheStore
          .getState()
          .getKanbanTasksCache(wFromKey);
        if (wFromCached) {
          setKanbanTasksCache(wFromKey, {
            ...wFromCached,
            tasks: wFromCached.tasks.filter((t) => t.id !== subTaskId),
            totalCount: Math.max(0, (wFromCached.totalCount || 1) - 1),
          });
        }

        // Update Workspace "To" Column
        const wToCached = useTaskCacheStore
          .getState()
          .getKanbanTasksCache(wToKey);
        if (wToCached) {
          setKanbanTasksCache(wToKey, {
            ...wToCached,
            tasks: [
              updatedTask,
              ...wToCached.tasks.filter((t) => t.id !== subTaskId),
            ],
            totalCount: (wToCached.totalCount || 0) + 1,
          });
        }
      }
    }

    // CRITICAL: Invalidate the subtask list cache for the parent task
    // and the project list cache to ensure List view sync
    if (task.parentTaskId) {
      invalidateSubTaskCache(task.parentTaskId);
    }
    if ("projectId" in task && (task as any).projectId) {
      invalidateProjectCache((task as any).projectId);
    } else if (projectId) {
      invalidateProjectCache(projectId);
    }
  };

  const getTaskProjectId = (subTaskId: string) => {
    const task = useTaskCacheStore.getState().entities[subTaskId];
    if (task && "projectId" in task) {
      return (task as any).projectId as string;
    }
    return projectId;
  };

  const updateSubTaskInPlace = (subTaskId: string, data: any) => {
    // We just need to update the global store, the individual cards or columns
    // will pick it up if they are subscribed (handled in Phase 3.2 logic)
    useTaskCacheStore.getState().upsertTasks([{ id: subTaskId, ...data }]);
  };

  const performStatusUpdate = async (
    subTaskId: string,
    newStatus: TaskStatus,
    previousStatus: TaskStatus,
    activityId?: string,
    comment?: string,
    attachmentData?: any,
  ) => {
    if (updatingTaskIds.has(subTaskId)) return;
    // Optimistic move
    moveSubTaskBetweenColumns(subTaskId, previousStatus, newStatus);
    setUpdatingTaskIds((prev) => new Set(prev).add(subTaskId));

    const toastId = toast.loading("Updating subtask status...");

    try {
      const targetProjectId = getTaskProjectId(subTaskId) || projectId;

      const result = await updateSubTaskStatus(
        subTaskId,
        newStatus,
        workspaceId,
        targetProjectId,
        activityId,
        comment,
        attachmentData,
      );

      if (result.success) {
        if (result.subTask) {
          updateSubTaskInPlace(subTaskId, result.subTask);
        }
        toast.success("Subtask status updated successfully", {
          id: toastId,
        });
      } else {
        moveSubTaskBetweenColumns(subTaskId, newStatus, previousStatus);
        toast.error(result.error || "Failed to update subtask status", {
          id: toastId,
        });
      }
    } catch (error) {
      moveSubTaskBetweenColumns(subTaskId, newStatus, previousStatus);
      toast.error("Failed to add activity. Let's try again.", {
        id: "activity_error",
      });
      console.error("Error updating subtask status:", error);
    } finally {
      setUpdatingTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(subTaskId);
        return next;
      });
    }
  };

  const handleDragCancel = () => {
    setActiveSubTask(null);
    setOverInfo({ overId: null, columnId: null });
  };

  const handleSubTaskClick = (subTask: KanbanSubTaskType) => {
    openSubTaskSheet(subTask);
  };

  const handleActivitySubmit = async (
    commentStr: string,
    attachment?: File,
  ) => {
    if (!pendingReviewMove) return;

    try {
      let attachmentData:
        | {
          fileName: string;
          fileType: string;
          fileSize: number;
          base64Data: string;
        }
        | undefined;

      if (attachment) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64Data = result.split(",")[1];
            resolve(base64Data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(attachment);
        });

        attachmentData = {
          fileName: attachment.name,
          fileType: attachment.type,
          fileSize: attachment.size,
          base64Data: base64,
        };
      }

      const targetProjectId =
        getTaskProjectId(pendingReviewMove.subTaskId) || projectId;

      // ATOMIC: Do both in ONE server action call to prevent double UI refreshes
      await performStatusUpdate(
        pendingReviewMove.subTaskId,
        pendingReviewMove.targetStatus,
        pendingReviewMove.previousStatus,
        undefined, // activityId not needed if we pass comment text
        commentStr,
        attachmentData,
      );

      setPendingReviewMove(null);
      setIsActivityDialogOpen(false);
    } catch (error) {
      console.error("Error submitting activity:", error);
      if (pendingReviewMove) {
        moveSubTaskBetweenColumns(
          pendingReviewMove.subTaskId,
          pendingReviewMove.targetStatus,
          pendingReviewMove.previousStatus,
        );
      }
      toast.error("Failed to submit activity");
      setPendingReviewMove(null);
      setIsActivityDialogOpen(false);
    }
  };

  const getFilteredSubTaskIds = (status: TaskStatus) => {
    return columnData[status].subTaskIds;
  };

  const uniqueParentTasks: ParentTaskOption[] = Array.from(
    new Map(
      COLUMNS.flatMap((col) => {
        const entities = useTaskCacheStore.getState().entities;
        const allTasks = columnData[col.id].subTaskIds.map(
          (id) => entities[id],
        );
        return allTasks
          .filter((st) => st && (st as any).parentTask)
          .map((st: any) => [
            st.parentTask!.id,
            {
              id: st.parentTask!.id,
              name: st.parentTask!.name,
              taskSlug: st.parentTask!.taskSlug,
            },
          ]);
      }),
    ).values(),
  ) as ParentTaskOption[];

  const memberOptions = Array.from(
    new Map(
      projectMembers.map((member) => [
        member.userId,
        {
          id: member.userId,
          surname: member.user?.surname || undefined,
        },
      ]),
    ).values(),
  );

  // Bi-directional filtering logic
  const filteredProjects = projects?.filter(
    (p) =>
      !filters.assigneeId ||
      (p.memberIds && p.memberIds.includes(filters.assigneeId)),
  );

  const filteredMembers = memberOptions.filter((m) => {
    if (!filters.projectId) return true;
    const project = projects?.find((p) => p.id === filters.projectId);
    return project?.memberIds?.includes(m.id);
  });

  return (
    <div className="space-y-4">
      <GlobalFilterToolbar
        level={level}
        view="kanban"
        filters={filters}
        searchQuery={searchQuery}
        members={filteredMembers}
        projects={filteredProjects}
        tags={tags}
        parentTasks={uniqueParentTasks}
        kanbanColumnVisibility={visibleColumns}
        setKanbanColumnVisibility={setVisibleColumns}
        onFilterChange={handleFilterChange}
        onSearchChange={handleSearchChange}
        onClearAll={() => {
          setIsFiltering(true);
          setFilters({});
          setSearchQuery("");
        }}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        autoScroll={true}
      >
        <div className="relative">
          {/* Loading Overlay */}
          {isFiltering && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm transition-all duration-300 rounded-md">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm font-medium text-muted-foreground">
                  Filtering...
                </span>
              </div>
            </div>
          )}
          <div
            className={cn(
              "flex gap-4 overflow-x-auto pb-2",
              level === "workspace" ? "h-[70vh] mt-0" : "h-[65vh]",
              // Custom horizontal scrollbar
              "[&::-webkit-scrollbar]:h-2",
              "[&::-webkit-scrollbar-track]:rounded-full",
              "[&::-webkit-scrollbar-thumb]:bg-accent",
              "[&::-webkit-scrollbar-thumb]:rounded-full",
              "[&::-webkit-scrollbar-thumb]:hover:bg-accent/50",
            )}
          >
            {COLUMNS.filter((col) => visibleColumns[col.id]).map((column) => {
              const subTaskIds = getFilteredSubTaskIds(column.id);
              return (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  subTaskIds={subTaskIds}
                  totalCount={columnData[column.id].totalCount}
                  hasMore={columnData[column.id].hasMore}
                  isLoadingMore={loadingColumns[column.id]}
                  onSubTaskClick={handleSubTaskClick}
                  onLoadMore={() => handleLoadMore(column.id)}
                  projectManagers={projectManagers}
                  projectMembers={projectMembers}
                  updatingTaskIds={updatingTaskIds}
                  activeTaskId={activeSubTask?.id ?? null}
                  overCardId={
                    overInfo.columnId === column.id ? overInfo.overId : null
                  }
                  isOverColumn={overInfo.columnId === column.id}
                  permissions={permissions}
                  userId={userId}
                  projects={projects}
                />
              );
            })}
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeSubTask ? (
            <div className="rotate-3 opacity-80">
              <KanbanCard
                subTask={activeSubTask}
                columnColor="text-slate-700"
                isDragging
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      <ActivityDialog
        isOpen={isActivityDialogOpen}
        onClose={() => setIsActivityDialogOpen(false)}
        onSubmit={handleActivitySubmit}
        subTaskName={
          pendingReviewMove
            ? useTaskCacheStore.getState().entities[pendingReviewMove.subTaskId]
              ?.name || "Subtask"
            : ""
        }
      />
    </div>
  );
}


