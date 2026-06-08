import { differenceInDays, addDays, subDays, startOfDay } from "date-fns";
import { Task } from "../types";

export type TimelineGranularity = 'days' | 'weeks' | 'months';

export interface ComputedTaskDates {
    start: Date | null;
    end: Date | null;
}

export function parseDate(dateStr: string | null | undefined): Date | null {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date;
}

export function getDaysBetween(start: Date, end: Date): number {
    const startNorm = startOfDay(start);
    const endNorm = startOfDay(end);
    return Math.round((endNorm.getTime() - startNorm.getTime()) / (1000 * 60 * 60 * 24));
}

export function computeTaskDates(task: Task, allTasks: Task[] = []): ComputedTaskDates {
    let minStart = parseDate(task.startDate);
    let maxEnd = parseDate(task.dueDate);

    // Find children
    const subtasks = allTasks.filter(t => t.parentTaskId === task.id);
    if (subtasks && subtasks.length > 0) {
        for (const subtask of subtasks) {
            const start = parseDate(subtask.startDate);
            const end = parseDate(subtask.dueDate);

            if (start && (!minStart || start < minStart)) {
                minStart = start;
            }
            if (end && (!maxEnd || end > maxEnd)) {
                maxEnd = end;
            }
        }
    }

    return { start: minStart, end: maxEnd };
}

export function calculateTimelineRange(tasks: Task[]): { start: Date; end: Date } {
    const today = startOfDay(new Date());
    let minDate = new Date(today);
    let maxDate = new Date(today);
    
    // Default 30 days ahead for mobile performance
    maxDate.setDate(maxDate.getDate() + 30); 

    for (const task of tasks) {
        const { start, end } = computeTaskDates(task, tasks);
        if (start && start < minDate) minDate = new Date(start);
        if (end && end > maxDate) maxDate = new Date(end);
    }

    if (today < minDate) minDate = new Date(today);
    if (today > maxDate) maxDate = new Date(today);

    // Padding for mobile (less than web to save horizontal render space)
    const paddingBefore = 4;
    const paddingAfter = 7; 

    minDate = subDays(minDate, paddingBefore);
    maxDate = addDays(maxDate, paddingAfter);

    return { start: minDate, end: maxDate };
}

export function calculateBarPosition(
    barStart: Date,
    barEnd: Date,
    timelineStart: Date,
    totalDays: number
): { left: number; width: number } {
    const normalizedStart = startOfDay(barStart);
    const normalizedEnd = startOfDay(barEnd);
    const normalizedTimelineStart = startOfDay(timelineStart);

    const startOffset = getDaysBetween(normalizedTimelineStart, normalizedStart);
    // Add 1 for inclusive end day
    const duration = getDaysBetween(normalizedStart, normalizedEnd) + 1;

    const left = (startOffset / totalDays) * 100;
    const width = (duration / totalDays) * 100;

    return {
        left: Math.max(0, left),
        width: Math.max(1, Math.min(width, 100 - left))
    };
}
