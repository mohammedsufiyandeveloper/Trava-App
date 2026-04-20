"use client";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Filter, Calendar } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { type TaskFilters, type ViewLevel, type ViewType, type ProjectOption, type MemberOption, type TagOption, getFilterConfig, getActiveFilters } from "./types";
import { formatIST } from "@/lib/utils";
import { Calendar as ShadcnCalendar } from "@/components/ui/calendar";
import { TaskSearch } from "./task-search";
import { ColumnVisibility } from "./column-visibility";
import { KanbanColumnVisibility, type KanbanColumnVisibility as KanbanColumnVisibilityType } from "./kanban-column-visibility";
import { STATUS_OPTIONS } from "@/lib/zodSchemas";
import { getColorFromString } from "@/lib/colors/project-colors";

export interface ParentTaskOption {
    id: string;
    name: string;
    taskSlug?: string;
}



// Add custom theme overrides for the calendar range
const DATE_RANGE_THEME_OVERRIDE = `
  .rdp-day_range_start, .rdp-day_range_end {
    background-color: var(--primary) !important;
    color: var(--primary-foreground) !important;
  }
  .rdp-day_range_middle {
    background-color: var(--accent) !important;
    color: var(--accent-foreground) !important;
  }
`;
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { useState } from "react";


interface GlobalFilterToolbarProps {
    level: ViewLevel;
    view: ViewType;
    filters: TaskFilters;
    searchQuery: string;
    projects?: ProjectOption[];
    members?: MemberOption[];
    tags?: TagOption[];
    onFilterChange: (filters: TaskFilters) => void;
    onSearchChange: (query: string) => void;
    onClearAll: () => void;
    className?: string;
    showSearch?: boolean;
    columnVisibility?: ColumnVisibility;
    setColumnVisibility?: React.Dispatch<React.SetStateAction<ColumnVisibility>>;
    parentTasks?: ParentTaskOption[];
    kanbanColumnVisibility?: KanbanColumnVisibilityType;
    setKanbanColumnVisibility?: React.Dispatch<React.SetStateAction<KanbanColumnVisibilityType>>;
}

export function GlobalFilterToolbar({
    level,
    view,
    filters,
    searchQuery,
    projects,
    members,
    tags,
    onFilterChange,
    onSearchChange,
    onClearAll,
    className,
    showSearch = true,
    columnVisibility,
    setColumnVisibility,
    parentTasks,
    kanbanColumnVisibility,
    setKanbanColumnVisibility,
}: GlobalFilterToolbarProps) {
    const [isOpen, setIsOpen] = useState(false);


    const config = getFilterConfig(view, level);

    const rawActiveFilters = getActiveFilters(filters);
    const activeFilters = rawActiveFilters.map(filter => {
        if (filter.key === 'assigneeId' && members) {
            const assignee = members.find(m => m.id === filter.value);
            if (assignee) {
                const displayName = assignee.surname || assignee.name || "";
                return {
                    ...filter,
                    value: displayName
                };
            }
        }

        if (filter.key === 'projectId' && projects) {
            const project = projects.find(p => p.id === filter.value);
            if (project) {
                return {
                    ...filter,
                    value: project.name
                };
            }
        }
        if (filter.key === 'tagId' && tags) {
            const tag = tags.find(t => t.id === filter.value);
            if (tag) {
                return {
                    ...filter,
                    value: tag.name
                };
            }
        }
        if (filter.key === 'status') {
            const statusOption = STATUS_OPTIONS.find(s => s.value === filter.value);
            if (statusOption) {
                return {
                    ...filter,
                    value: statusOption.label
                };
            }
        }
        if (filter.key === 'parentTaskId' && parentTasks) {
            const parent = parentTasks.find(p => p.id === filter.value);
            if (parent) {
                return {
                    ...filter,
                    value: parent.name
                };
            }
        }
        if ((filter.key === 'startDate' || filter.key === 'endDate') && filter.value) {
            try {
                return {
                    ...filter,
                    value: formatIST(filter.value, "yyyy-MM-dd")
                };
            } catch (e) {
                return filter;
            }
        }

        return filter;
    });

    const handleFilterChange = (key: keyof TaskFilters, value: string | undefined) => {
        const filterValue = value === '__all__' ? undefined : value;
        onFilterChange({
            ...filters,
            [key]: filterValue,
        });
    };

    const removeFilter = (key: keyof TaskFilters) => {
        if (key === 'startDate' || key === 'endDate') {
            onFilterChange({
                ...filters,
                startDate: undefined,
                endDate: undefined,
            });
        } else {
            handleFilterChange(key, undefined);
        }
    };

    const handleClearAll = () => {
        onClearAll();
        onSearchChange("");
        setIsOpen(false);
    };

    const handleApply = () => {
        setIsOpen(false);
    };

    return (
        <div className={cn("space-y-0", className)}>
            <style>{DATE_RANGE_THEME_OVERRIDE}</style>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                {showSearch && config.showSearch && (
                    <div className="flex-1">
                        <TaskSearch
                            value={searchQuery}
                            onChange={onSearchChange}
                            placeholder={`Search ${view === 'kanban' ? 'subtasks' : 'tasks'}...`}
                            className="w-full"
                        />
                    </div>
                )}

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Popover open={isOpen} onOpenChange={setIsOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className="flex-1 sm:flex-none gap-2 relative"
                            >
                                <Filter className="h-4 w-4" />
                                Filter
                                {activeFilters.length > 0 && (
                                    <Badge
                                        variant="destructive"
                                        className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                                    >
                                        {activeFilters.length}
                                    </Badge>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent
                            className="w-[calc(100vw-2rem)] sm:w-[500px] p-0 overflow-hidden"
                            align="end"
                            side="bottom"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between border-b px-4 py-3">
                                <h3 className="text-lg font-semibold">Filter</h3>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsOpen(false)}
                                    className="h-6 w-6 p-0"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* Content - Scrollable */}
                            <div className="max-h-[60vh] overflow-y-auto overflow-x-hidden p-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-slate-400">
                                {/* Filters Grid - Horizontal Layout */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                    {/* Date Range Section */}
                                    {config.showDateRangeFilter && (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xs font-medium text-muted-foreground">Date Range</h4>
                                                {(filters.startDate || filters.endDate) && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            onFilterChange({
                                                                ...filters,
                                                                startDate: undefined,
                                                                endDate: undefined,
                                                            });
                                                        }}
                                                        className="h-auto p-0 text-xs text-blue-600 hover:text-blue-700 hover:bg-transparent"
                                                    >
                                                        Clear
                                                    </Button>
                                                )}
                                            </div>

                                            {/* Calendar Popover */}
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        className={cn(
                                                            "w-full justify-start text-left font-normal h-9 text-xs overflow-hidden px-2",
                                                            !filters.startDate && !filters.endDate && "text-muted-foreground"
                                                        )}
                                                    >
                                                        <Calendar className="mr-1.5 h-3.5 w-3.5 flex-shrink-0" />
                                                        <span className="truncate">
                                                            {filters.startDate && filters.endDate ? (
                                                                <>
                                                                    {formatIST(filters.startDate)} - {formatIST(filters.endDate)}
                                                                </>
                                                            ) : filters.startDate ? (
                                                                <>From: {formatIST(filters.startDate)}</>
                                                            ) : filters.endDate ? (
                                                                <>To: {formatIST(filters.endDate)}</>
                                                            ) : (
                                                                "Pick dates"
                                                            )}
                                                        </span>
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0 border-none shadow-2xl overflow-hidden rounded-xl" align="start">
                                                    <div className="bg-background">
                                                        <ShadcnCalendar
                                                            mode="range"
                                                            selected={{
                                                                from: filters.startDate ? new Date(filters.startDate) : undefined,
                                                                to: filters.endDate ? new Date(filters.endDate) : undefined,
                                                            }}
                                                            onSelect={(range) => {
                                                                onFilterChange({
                                                                    ...filters,
                                                                    startDate: range?.from ? range.from.toISOString() : undefined,
                                                                    endDate: range?.to ? range.to.toISOString() : undefined,
                                                                });
                                                            }}
                                                            numberOfMonths={1}
                                                            initialFocus
                                                        />
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    )}

                                    {/* Project Filter */}
                                    {config.showProjectFilter && level === "workspace" && projects && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-medium text-muted-foreground">Project</h4>
                                                {filters.projectId && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleFilterChange("projectId", undefined)}
                                                        className="h-auto p-0 text-xs text-blue-600 hover:text-blue-700 hover:bg-transparent"
                                                    >
                                                        Clear
                                                    </Button>
                                                )}
                                            </div>
                                            <Select
                                                value={filters.projectId || "__all__"}
                                                onValueChange={(value) => handleFilterChange("projectId", value)}
                                            >
                                                <SelectTrigger className="w-full h-9">
                                                    <SelectValue placeholder="Select project" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__all__">All Projects</SelectItem>
                                                    {projects.map((project) => (
                                                        <SelectItem key={project.id} value={project.id}>
                                                            <div className="flex items-center gap-2">
                                                                <div className="h-2 w-2 rounded-full border shadow-sm" style={{ backgroundColor: project.color || getColorFromString(project.name) }} />
                                                                {project.name}
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    {/* Parent Task Filter (Kanban only) */}
                                    {config.showParentTaskFilter && parentTasks && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-medium text-muted-foreground">Parent Task</h4>
                                                {filters.parentTaskId && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleFilterChange("parentTaskId", undefined)}
                                                        className="h-auto p-0 text-xs text-blue-600 hover:text-blue-700 hover:bg-transparent"
                                                    >
                                                        Clear
                                                    </Button>
                                                )}
                                            </div>
                                            <Select
                                                value={filters.parentTaskId || "__all__"}
                                                onValueChange={(value) => handleFilterChange("parentTaskId", value)}
                                            >
                                                <SelectTrigger className="w-full h-9">
                                                    <SelectValue placeholder="All Tasks" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__all__">All Tasks</SelectItem>
                                                    {parentTasks.map((task) => (
                                                        <SelectItem key={task.id} value={task.id}>
                                                            {task.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    {/* Status Filter */}
                                    {config.showStatusFilter && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
                                                {filters.status && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleFilterChange("status", undefined)}
                                                        className="h-auto p-0 text-xs text-blue-600 hover:text-blue-700 hover:bg-transparent"
                                                    >
                                                        Clear
                                                    </Button>
                                                )}
                                            </div>
                                            <Select
                                                value={filters.status || "__all__"}
                                                onValueChange={(value) => handleFilterChange("status", value)}
                                            >
                                                <SelectTrigger className="w-full h-9">
                                                    <SelectValue placeholder="Select status" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__all__">All Statuses</SelectItem>
                                                    {STATUS_OPTIONS.map((option) => (
                                                        <SelectItem key={option.value} value={option.value}>
                                                            <div className="flex items-center gap-2">
                                                                <div className="h-2 w-2 rounded-full bg-green-500" />
                                                                {option.label}
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    {/* Assignee Filter */}
                                    {config.showAssigneeFilter && members && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-medium text-muted-foreground">Assignee</h4>
                                                {filters.assigneeId && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleFilterChange("assigneeId", undefined)}
                                                        className="h-auto p-0 text-xs text-blue-600 hover:text-blue-700 hover:bg-transparent"
                                                    >
                                                        Clear
                                                    </Button>
                                                )}
                                            </div>
                                            <Select
                                                value={filters.assigneeId || "__all__"}
                                                onValueChange={(value) => handleFilterChange("assigneeId", value)}
                                            >
                                                <SelectTrigger className="w-full h-9">
                                                    <SelectValue placeholder="Select assignee" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__all__">All Assignees</SelectItem>
                                                    {members
                                                        .filter(member => {
                                                            // If a project is selected, only show members of that project
                                                            if (filters.projectId && projects) {
                                                                const project = projects.find(p => p.id === filters.projectId);
                                                                if (project && project.memberIds) {
                                                                    return project.memberIds.includes(member.id);
                                                                }
                                                            }
                                                            // If no project selected (Workspace level), show all members
                                                            return true;

                                                        })

                                                        .map((member) => (
                                                            <SelectItem key={member.id} value={member.id}>
                                                                <div className="flex items-center gap-2">
                                                                    <Avatar className="h-4 w-4 flex-shrink-0">
                                                                        <AvatarFallback className="text-[8px]">{member.surname?.[0] || member.name?.[0]}</AvatarFallback>
                                                                    </Avatar>
                                                                    <span className="truncate">{member.surname || member.name}</span>
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}


                                    {/* Tag Filter */}
                                    {config.showTagFilter && tags && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-medium text-muted-foreground">Tag</h4>
                                                {filters.tagId && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleFilterChange("tagId", undefined)}
                                                        className="h-auto p-0 text-xs text-blue-600 hover:text-blue-700 hover:bg-transparent"
                                                    >
                                                        Clear
                                                    </Button>
                                                )}
                                            </div>
                                            <Select
                                                value={filters.tagId || "__all__"}
                                                onValueChange={(value) => handleFilterChange("tagId", value)}
                                            >
                                                <SelectTrigger className="w-full h-9">
                                                    <SelectValue placeholder="Select tag" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__all__">All Tags</SelectItem>
                                                    {tags.map((tag) => (
                                                        <SelectItem key={tag.id} value={tag.id}>
                                                            {tag.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="border-t p-3 space-y-2">
                                <Button
                                    variant="ghost"
                                    onClick={handleClearAll}
                                    className="w-full h-9"
                                >
                                    Reset
                                </Button>
                                <Button
                                    onClick={handleApply}
                                    className="w-full h-9 bg-primary hover:bg-primary/80"
                                >
                                    Apply Now
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Column Visibility - Only for List View */}
                    {view === 'list' && columnVisibility && setColumnVisibility && (
                        <ColumnVisibility
                            columnVisibility={columnVisibility}
                            setColumnVisibility={setColumnVisibility}
                        />
                    )}

                    {/* Column Visibility - Only for Kanban View */}
                    {view === 'kanban' && kanbanColumnVisibility && setKanbanColumnVisibility && (
                        <KanbanColumnVisibility
                            visibleColumns={kanbanColumnVisibility}
                            setVisibleColumns={setKanbanColumnVisibility}
                        />
                    )}

                    {view === 'gantt' && kanbanColumnVisibility && setKanbanColumnVisibility && (
                        <KanbanColumnVisibility
                            visibleColumns={kanbanColumnVisibility}
                            setVisibleColumns={setKanbanColumnVisibility}
                        />
                    )}
                </div>


            </div>
        </div>
    );
}
