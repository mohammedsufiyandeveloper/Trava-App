import { useMemo } from "react";

/**
 * Hook to calculate due date from start date and days
 * 
 * @param startDate - The start date of the task/subtask
 * @param days - Number of days to add to start date
 * @returns The calculated due date or null if inputs are invalid
 * 
 * @example
 * const dueDate = useDueDate(task.startDate, task.days);
 * if (dueDate) {
 *   console.log(format(dueDate, 'MMM dd, yyyy'));
 * }
 */
export function useDueDate(startDate: Date | string | null | undefined, days: number | null | undefined): Date | null {
    return useMemo(() => {
        if (!startDate || (days === null || days === undefined)) return null;

        const start = new Date(startDate);
        const due = new Date(start);
        due.setDate(due.getDate() + days);

        return due;
    }, [startDate, days]);
}

/**
 * Hook to calculate remaining days until due date
 * 
 * @param startDate - The start date of the task/subtask
 * @param days - Number of days to add to start date
 * @returns Object containing remaining days and status information
 * 
 * @example
 * const { remainingDays, isOverdue, isDueToday, dueDate } = useRemainingDays(task.startDate, task.days);
 * 
 * if (isOverdue) {
 *   return <Badge variant="destructive">{Math.abs(remainingDays)} days overdue</Badge>;
 * }
 */
export function useRemainingDays(
    startDate: Date | string | null | undefined,
    days: number | null | undefined,
    providedDueDate?: Date | string | null
) {
    return useMemo(() => {
        let dueDate: Date | null = null;

        if (providedDueDate) {
            dueDate = new Date(providedDueDate);
        } else if (startDate && (days !== null && days !== undefined)) {
            const start = new Date(startDate);
            dueDate = new Date(start);
            dueDate.setDate(dueDate.getDate() + days);
        }

        if (!dueDate) {
            return {
                remainingDays: null,
                isOverdue: false,
                isDueToday: false,
                isDueSoon: false,
                dueDate: null,
            };
        }

        const now = new Date();
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);

        const startOfDueDate = new Date(dueDate);
        startOfDueDate.setHours(0, 0, 0, 0);

        const diffTime = startOfDueDate.getTime() - startOfToday.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return {
            remainingDays: diffDays,
            isOverdue: diffDays < 0,
            isDueToday: diffDays === 0,
            isDueSoon: diffDays > 0 && diffDays <= 3, // Due within 3 days
            dueDate,
        };
    }, [startDate, days]);
}

/**
 * Hook to get formatted due date information
 * 
 * @param startDate - The start date of the task/subtask
 * @param days - Number of days to add to start date
 * @returns Object with formatted date strings and status
 * 
 * @example
 * const { formattedDueDate, statusText, statusColor } = useDueDateInfo(task.startDate, task.days);
 * 
 * return (
 *   <div className={statusColor}>
 *     {formattedDueDate} - {statusText}
 *   </div>
 * );
 */
export function useDueDateInfo(
    startDate: Date | string | null | undefined,
    days: number | null | undefined,
    providedDueDate?: Date | string | null
) {
    const { remainingDays, isOverdue, isDueToday, isDueSoon, dueDate } = useRemainingDays(startDate, days, providedDueDate);

    return useMemo(() => {
        if (!dueDate || remainingDays === null) {
            return {
                formattedDueDate: null,
                statusText: "No due date",
                statusColor: "text-muted-foreground",
                dueDate: null,
                remainingDays: null,
            };
        }

        // Format the due date
        const formattedDueDate = dueDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });

        // Determine status text and color
        let statusText: string;
        let statusColor: string;

        if (isOverdue) {
            const overdueDays = Math.abs(remainingDays);
            statusText = `${overdueDays} day${overdueDays !== 1 ? 's' : ''} overdue`;
            statusColor = "text-destructive";
        } else if (isDueToday) {
            statusText = "Due today";
            statusColor = "text-orange-600 dark:text-orange-400";
        } else if (isDueSoon) {
            statusText = `${remainingDays} day${remainingDays !== 1 ? 's' : ''} left`;
            statusColor = "text-yellow-600 dark:text-yellow-400";
        } else {
            statusText = `${remainingDays} day${remainingDays !== 1 ? 's' : ''} left`;
            statusColor = "text-muted-foreground";
        }

        return {
            formattedDueDate,
            statusText,
            statusColor,
            dueDate,
            remainingDays,
            isOverdue,
            isDueToday,
            isDueSoon,
        };
    }, [dueDate, remainingDays, isOverdue, isDueToday, isDueSoon]);
}

/**
 * Utility function to calculate due date from start date and days
 * Can be used outside React components (e.g., in filters, utilities)
 * 
 * @param startDate - The start date of the task/subtask
 * @param days - Number of days to add to start date
 * @returns The calculated due date or null if inputs are invalid
 * 
 * @example
 * const dueDate = calculateDueDate(task.startDate, task.days);
 * if (dueDate && dueDate <= filterEndDate) {
 *   // Include task in filtered results
 * }
 */
export function calculateDueDate(
    startDate: Date | string | null | undefined,
    days: number | null | undefined
): Date | null {
    if (!startDate || (days === null || days === undefined)) return null;

    const start = new Date(startDate);
    const due = new Date(start);
    due.setDate(due.getDate() + days);

    return due;
}
