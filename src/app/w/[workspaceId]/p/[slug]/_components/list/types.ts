import type { WorkspaceTaskType } from "@/data/task";
import type { WorkspaceTaskType as SubTaskType } from "@/data/task";

export type TaskWithSubTasks = WorkspaceTaskType & {
    subTasks?: SubTaskType[];
    subTasksHasMore?: boolean;
    subTasksPage?: number;
};
