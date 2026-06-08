// Unified Task Fetcher
export { getTasks as getWorkspaceTasks, type GetTasksResponse as WorkspaceTasksResponse, type GetTasksOptions as WorkspaceTaskFilters } from "./get-tasks";
export type { WorkspaceTaskType, WorkspaceTaskType as SubTaskType } from "./legacy-types"; // We will create this shim to avoid breaking changes if specific types were relied on
export { getSubTasksByParentIds, type BatchSubTasksResponse, type BatchSubTaskItem } from "./get-subtasks-batch";
export { getTaskById, type TaskByIdType } from "./get-task-by-id";

// Kanban Specific Type Aliases
export type { WorkspaceTaskType as KanbanSubTaskType } from "./legacy-types";
export type SubTasksByStatusResponse = {
    subTasks: import("./legacy-types").WorkspaceTaskType[];
    totalCount: number;
    hasMore: boolean;
    currentPage?: number;
    nextCursor?: any;
};
