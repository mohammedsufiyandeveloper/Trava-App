"use client";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ListFilter, User, Layers, X } from "lucide-react";
import type { ProjectMembersType } from "@/data/project/get-project-members";

type TaskStatus = "TO_DO" | "IN_PROGRESS" | "CANCELLED" | "REVIEW" | "HOLD" | "COMPLETED";

/** Minimal parent task data for filtering */
interface ParentTask {
    id: string;
    name: string;
    taskSlug: string;
}

/**
 * KanbanToolbar Component
 * 
 * Provides filtering and column visibility controls for the Kanban board.
 * 
 * Features:
 * - Filter by parent task
 * - Filter by assignee
 * - Toggle column visibility
 * 
 * Compatible with both paginated and non-paginated Kanban boards.
 * 
 * @component
 */
interface KanbanToolbarProps {
    /** List of parent tasks for filtering */
    parentTasks: ParentTask[];
    /** List of project members for assignee filtering */
    projectMembers: ProjectMembersType;
    /** Currently selected parent task ID (null = all) */
    selectedParentTask: string | null;
    /** Currently selected assignee ID (null = all) */
    selectedAssignee: string | null;
    /** Visibility state for each column */
    visibleColumns: Record<TaskStatus, boolean>;
    /** Callback when parent task filter changes */
    onParentTaskChange: (taskId: string | null) => void;
    /** Callback when assignee filter changes */
    onAssigneeChange: (assigneeId: string | null) => void;
    /** Callback when column visibility changes */
    onVisibleColumnsChange: (columns: Record<TaskStatus, boolean>) => void;
}

/** Human-readable labels for each status column */
const COLUMN_LABELS: Record<TaskStatus, string> = {
    TO_DO: "To Do",
    IN_PROGRESS: "In Progress",
    CANCELLED: "Cancelled",
    REVIEW: "Review",
    HOLD: "On Hold",
    COMPLETED: "Completed",
};

export function KanbanToolbar({
    parentTasks,
    projectMembers,
    selectedParentTask,
    selectedAssignee,
    visibleColumns,
    onParentTaskChange,
    onAssigneeChange,
    onVisibleColumnsChange,
}: KanbanToolbarProps) {
    const handleColumnToggle = (column: TaskStatus, checked: boolean) => {
        onVisibleColumnsChange({
            ...visibleColumns,
            [column]: checked,
        });
    };

    const visibleColumnsCount = Object.values(visibleColumns).filter(Boolean).length;

    return (
        <div className="flex items-center justify-between gap-4 p-1 rounded-lg">
            <div className="flex items-center gap-3 flex-1">
                {/* Parent Task Filter */}
                <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <Select
                        value={selectedParentTask || "all"}
                        onValueChange={(value) => onParentTaskChange(value === "all" ? null : value)}
                    >
                        <SelectTrigger className="w-[200px] h-9">
                            <SelectValue placeholder="All Tasks" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Tasks</SelectItem>
                            {parentTasks.map((task) => (
                                <SelectItem key={task.id} value={task.id}>
                                    {task.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {selectedParentTask && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onParentTaskChange(null)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                {/* Assignee Filter */}
                <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <Select
                        value={selectedAssignee || "all"}
                        onValueChange={(value) => onAssigneeChange(value === "all" ? null : value)}
                    >
                        <SelectTrigger className="w-[200px] h-9">
                            <SelectValue placeholder="All Assignees" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Assignees</SelectItem>
                            {projectMembers
                                .filter((member) => member.projectRole !== "VIEWER")
                                .map((member) => (
                                    <SelectItem key={member.userId} value={member.userId}>
                                        {member.user.surname || ""}
                                    </SelectItem>
                                ))}
                        </SelectContent>
                    </Select>
                    {selectedAssignee && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onAssigneeChange(null)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Column Visibility */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9">
                        <ListFilter className="mr-2 h-4 w-4" />
                        Columns ({visibleColumnsCount}/6)
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px]">
                    <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {(Object.keys(COLUMN_LABELS) as TaskStatus[]).map((column) => (
                        <DropdownMenuCheckboxItem
                            key={column}
                            checked={visibleColumns[column]}
                            onCheckedChange={(checked) => handleColumnToggle(column, checked)}
                        >
                            {COLUMN_LABELS[column]}
                        </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
