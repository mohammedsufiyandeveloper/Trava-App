import { GanttTask, GanttSubtask, ComputedTaskDates, TimelineGranularity, } from "./types";

/**
 * Get current date (midnight) for today comparisons
 * Uses local browser time which should be IST for users in India
 */
export function getIndianDate(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}

/**
 * Parse ISO date string to Date object safely
 */
export function parseDate(dateStr: string | null | undefined): Date | null {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date;
}
/**
 * Formats a date for the API (YYYY-MM-DDTHH:mm)
 * If the time component is not set (00:00), it defaults to start of day (00:00) for starts 
 * and end of day (23:59) for ends.
 */
export function formatDateForAPI(date: Date, type: 'start' | 'end'): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    let hours = d.getHours();
    let minutes = d.getMinutes();

    if (type === 'end' && hours === 0 && minutes === 0) {
        hours = 23;
        minutes = 59;
    }
    // Start dates already default to 00:00 if hours/mins are 0

    return `${year}-${month}-${day}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Compute task start/end dates from task metadata or its subtasks
 * 1. Priority: task.start / task.end (Direct DB values)
 * 2. Fallback: min(subtask.start) / max(subtask.end)
 */
export function computeTaskDates(task: GanttTask): ComputedTaskDates {
    // Attempt to use direct values first
    let minStart = task.start ? parseDate(task.start) : null;
    let maxEnd = task.end ? parseDate(task.end) : null;

    // If subtasks exist, they can expand the boundary
    if (task.subtasks && task.subtasks.length > 0) {
        for (const subtask of task.subtasks) {
            const start = parseDate(subtask.start);
            const end = parseDate(subtask.end);

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

/**
 * Calculate the timeline range from all tasks
 */
export function calculateTimelineRange(tasks: GanttTask[]): { start: Date; end: Date } {
    const today = getIndianDate();
    let minDate = new Date(today);
    let maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 60); // Default 60 days ahead

    for (const task of tasks) {
        const { start, end } = computeTaskDates(task);
        if (start && start < minDate) minDate = new Date(start);
        if (end && end > maxDate) maxDate = new Date(end);
    }

    // Ensure today is always within the range
    if (today < minDate) minDate = new Date(today);
    if (today > maxDate) maxDate = new Date(today);

    // Add padding - more padding before today, less after
    const paddingBefore = 7; // 1 week before
    const paddingAfter = 14; // 2 weeks after

    minDate.setDate(minDate.getDate() - paddingBefore);
    maxDate.setDate(maxDate.getDate() + paddingAfter);

    return { start: minDate, end: maxDate };
}

/**
 * Get days between two dates
 */
export function getDaysBetween(start: Date, end: Date): number {
    // Normalize both dates to midnight for accurate day counting
    const startNorm = new Date(start);
    startNorm.setHours(0, 0, 0, 0);
    const endNorm = new Date(end);
    endNorm.setHours(0, 0, 0, 0);

    const diffTime = endNorm.getTime() - startNorm.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate bar position and width as percentages
 * Bars span from the left edge of the start day to the right edge of the end day
 */
export function calculateBarPosition(
    barStart: Date,
    barEnd: Date,
    timelineStart: Date,
    totalDays: number
): { left: number; width: number } {
    // Normalize dates to midnight for accurate day calculations
    const normalizedStart = new Date(barStart);
    normalizedStart.setHours(0, 0, 0, 0);
    const normalizedEnd = new Date(barEnd);
    normalizedEnd.setHours(0, 0, 0, 0);
    const normalizedTimelineStart = new Date(timelineStart);
    normalizedTimelineStart.setHours(0, 0, 0, 0);

    // Calculate the offset from timeline start (in days)
    const startOffset = getDaysBetween(normalizedTimelineStart, normalizedStart);

    // Calculate duration: number of days from start to end (inclusive)
    // Adding 1 because if start=end, it's still 1 day
    const duration = getDaysBetween(normalizedStart, normalizedEnd) + 1;

    // Convert to percentages
    // The bar should start at the left edge of the start day column
    // and end at the right edge of the end day column
    const left = (startOffset / totalDays) * 100;
    const width = (duration / totalDays) * 100;

    return {
        left: Math.max(0, left),
        width: Math.max(1, Math.min(width, 100 - left))
    };
}

/**
 * Generate timeline columns based on granularity
 */
export function generateTimelineColumns(
    start: Date,
    end: Date,
    granularity: TimelineGranularity
): { date: Date; label: string; isToday: boolean }[] {
    const columns: { date: Date; label: string; isToday: boolean }[] = [];
    const current = new Date(start);
    const today = getIndianDate(); // Use IST for today

    while (current <= end) {
        const isToday = current.toDateString() === today.toDateString();

        let label: string;
        if (granularity === 'days') {
            label = current.getDate().toString();
        } else if (granularity === 'weeks') {
            label = `W${getWeekNumber(current)}`;
        } else {
            label = current.toLocaleDateString('en-US', { month: 'short' });
        }

        columns.push({
            date: new Date(current),
            label,
            isToday
        });

        // Increment based on granularity
        if (granularity === 'days') {
            current.setDate(current.getDate() + 1);
        } else if (granularity === 'weeks') {
            current.setDate(current.getDate() + 7);
        } else {
            current.setMonth(current.getMonth() + 1);
        }
    }

    return columns;
}

/**
 * Get week number of the year
 */
function getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Format date for display
 */
export function formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

/**
 * Format date range for display
 */
export function formatDateRange(start: Date | null, end: Date | null): string {
    if (!start || !end) return 'No dates';
    return `${formatDate(start)} — ${formatDate(end)}`;
}

/**
 * Validate dependencies for subtasks within a task
 * Returns subtasks with isBlocked and blockedByNames populated
 */
// export function validateDependencies(subtasks: GanttSubtask[]): GanttSubtask[] {
//     const subtaskMap = new Map<string, GanttSubtask>();
//     subtasks.forEach(st => subtaskMap.set(st.id, st));

//     return subtasks.map(subtask => {
//         if (!subtask.dependsOnIds || subtask.dependsOnIds.length === 0) {
//             return { ...subtask, isBlocked: false, blockedByNames: [] };
//         }

//         // Check if all dependencies are COMPLETED
//         const blockedBy: string[] = [];
//         for (const depId of subtask.dependsOnIds) {
//             const parent = subtaskMap.get(depId);
//             if (parent && parent.status !== 'COMPLETED') {
//                 blockedBy.push(parent.name);
//             }
//         }

//         return {
//             ...subtask,
//             isBlocked: blockedBy.length > 0,
//             blockedByNames: blockedBy
//         };
//     });
// }

/**
 * Extract dependency lines for visual rendering
 */
// export function getDependencyLines(subtasks: GanttSubtask[]): DependencyLine[] {
//     const subtaskMap = new Map<string, GanttSubtask>();
//     subtasks.forEach(st => subtaskMap.set(st.id, st));

//     const lines: DependencyLine[] = [];

//     for (const subtask of subtasks) {
//         if (subtask.dependsOnIds && subtask.dependsOnIds.length > 0) {
//             for (const depId of subtask.dependsOnIds) {
//                 const parent = subtaskMap.get(depId);
//                 if (parent) {
//                     lines.push({
//                         fromId: parent.id,
//                         toId: subtask.id,
//                         fromName: parent.name,
//                         toName: subtask.name
//                     });
//                 }
//             }
//         }
//     }
//     return lines;
// }
