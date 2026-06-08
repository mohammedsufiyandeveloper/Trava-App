import { Task } from "../types";
import { format, differenceInDays } from "date-fns";

export interface GanttHierarchyNode {
    task: Task;
    subtasks: Task[];
}

/**
 * Transforms a flat list of tasks into a hierarchical structure (Parent -> Subtasks)
 */
export function transformToGanttHierarchy(allTasks: Task[]): GanttHierarchyNode[] {
    const allIds = new Set(allTasks.map(t => t.id));

    // A task is a parent if it has no parentTaskId OR if its parentTaskId is not in the current set
    const parentTasks = allTasks.filter(task => !task.parentTaskId || !allIds.has(task.parentTaskId));

    const subtasksMap = new Map<string, Task[]>();
    allTasks.forEach(task => {
        if (task.parentTaskId && allIds.has(task.parentTaskId)) {
            if (!subtasksMap.has(task.parentTaskId)) {
                subtasksMap.set(task.parentTaskId, []);
            }
            subtasksMap.get(task.parentTaskId)!.push(task);
        }
    });

    return parentTasks.map(parent => ({
        task: parent,
        subtasks: subtasksMap.get(parent.id) || []
    }));
}

/**
 * Formats dates for the Gantt view
 * e.g., "14 Apr - 20 Apr" or "14 Apr" if start and end are the same
 */
export function formatGanttDateRange(startDate?: string, dueDate?: string): string {
    if (!startDate && !dueDate) return "No dates set";

    const startStr = startDate ? format(new Date(startDate), "dd-MM-yyyy") : "?";
    const endStr = dueDate ? format(new Date(dueDate), "dd-MM-yyyy") : "?";

    if (startDate && dueDate && format(new Date(startDate), "yyyy-MM-dd") === format(new Date(dueDate), "yyyy-MM-dd")) {
        return startStr;
    }

    if (!startDate && dueDate) {
        return `Due ${endStr}`;
    }

    if (startDate && !dueDate) {
        return `Starts ${startStr}`;
    }

    return `${startStr} - ${endStr}`;
}

/**
 * Calculates duration in days
 */
export function calculateDuration(startDate?: string, dueDate?: string): number | null {
    if (!startDate || !dueDate) return null;
    
    // +1 to make it inclusive
    return differenceInDays(new Date(dueDate), new Date(startDate)) + 1;
}
