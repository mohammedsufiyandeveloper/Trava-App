/**
 * Legacy Gantt Chart Types
 * These types are used by the current implementation
 * For new features, consider using types-v2.ts
 */

// ============================================================================
// GRANULARITY & TIMELINE TYPES
// ============================================================================

export type TimelineGranularity = 'days' | 'weeks' | 'months';

export interface TimelineConfig {
    start: Date;
    end: Date;
    granularity: TimelineGranularity;
}

// ============================================================================
// SUBTASK TYPES
// ============================================================================

export interface GanttSubtask {
    id: string;
    name: string;
    taskSlug: string; 
    start: string; // YYYY-MM-DD format
    end: string;   // YYYY-MM-DD format
    status: string;

    projectId: string;
    parentTaskId: string | null;
    description?: string | null;
    tagId?: string | null;
    days?: number | null;
    
    createdById: string | null;
    assignee?: { id: string; name: string; image?: string | null };
    assigneeId?: string | null;
    assigneeRole?: string;
    
    position: number;
    dependsOnIds?: string[];
}

// ============================================================================
// TASK TYPES
// ============================================================================

export interface GanttTask {
    id: string;
    name: string;
    taskSlug: string;
    projectId: string;
    projectName?: string;
    projectColor?: string;
    status: string;
    start?: string; // Optional: DB provided
    end?: string;   // Optional: DB provided
    subtasks: GanttSubtask[];
    assignee?: { id: string; name: string; image?: string | null };
    assigneeId?: string | null;
    createdById: string | null;
    parentTaskId: string | null;
}

// ============================================================================
// COMPUTED TYPES
// ============================================================================

export interface ComputedTaskDates {
    start: Date | null;
    end: Date | null;
}


