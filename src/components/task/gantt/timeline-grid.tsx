"use client";

import { useMemo } from "react";
import { generateTimelineColumns, getDaysBetween, getIndianDate } from "./utils";

import { cn } from "@/lib/utils";
import { GanttTask, TimelineGranularity } from "./types";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronsDownUp, ChevronsUpDown, Download, Calendar, ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";

interface TimelineHeaderProps {
    startDate: Date;
    endDate: Date;
    granularity: TimelineGranularity;
    tasks: GanttTask[];
    expandedTasks: Set<string>;
    expandedProjects: Set<string>;
    groupByProject: boolean;
    onExpandAll: () => void;
    onCollapseAll: () => void;
    onExport: (type: 'pdf' | 'excel') => void;
    onGranularityChange: (g: TimelineGranularity) => void;
    showDetails: boolean;
    onToggleDetails: () => void;
    scrollX: number;
    viewportWidth: number;
}

export function TimelineHeader({
    startDate,
    endDate,
    granularity,
    tasks,
    expandedTasks,
    expandedProjects,
    groupByProject,
    onExpandAll,
    onCollapseAll,
    onExport,
    onGranularityChange,
    showDetails,
    onToggleDetails,
    scrollX,
    viewportWidth
}: TimelineHeaderProps) {
    const columns = useMemo(
        () => generateTimelineColumns(startDate, endDate, granularity),
        [startDate, endDate, granularity]
    );

    const columnWidth = granularity === 'days' ? 40 : granularity === 'weeks' ? 80 : 120;
    const headerHeight = granularity === 'days' ? 72 : 40;

    // 🚀 Horizontal Virtualization: Determine visible indices
    const sidebarWidth = showDetails ? 650 : 250; // Dynamic sidebar width
    const visibleStartIndex = Math.max(0, Math.floor((scrollX - sidebarWidth) / columnWidth));
    const visibleEndIndex = Math.min(columns.length, Math.ceil((scrollX + viewportWidth) / columnWidth));

    const visibleColumns = useMemo(() => {
        return columns.slice(visibleStartIndex, visibleEndIndex);
    }, [columns, visibleStartIndex, visibleEndIndex]);

    const monthLabels = useMemo(() => {
        if (granularity !== 'days') return [];

        const months: { label: string; span: number; startIdx: number }[] = [];
        let currentMonth = '';
        let currentSpan = 0;
        let startIdx = 0;

        columns.forEach((col, idx) => {
            const monthLabel = col.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            if (monthLabel !== currentMonth) {
                if (currentSpan > 0) {
                    months.push({ label: currentMonth, span: currentSpan, startIdx });
                }
                currentMonth = monthLabel;
                currentSpan = 1;
                startIdx = idx;
            } else {
                currentSpan++;
            }
        });

        if (currentSpan > 0) {
            months.push({ label: currentMonth, span: currentSpan, startIdx });
        }

        // Clip month labels to what's visible
        return months.filter(m => (m.startIdx + m.span) >= visibleStartIndex && m.startIdx <= visibleEndIndex);
    }, [columns, granularity, visibleStartIndex, visibleEndIndex]);

    const allExpanded = tasks.length > 0 && tasks.every(t => expandedTasks.has(t.id));

    return (
        <div
            className="sticky top-0 z-40 bg-white dark:bg-neutral-900 min-w-full w-fit"
            style={{
                height: granularity === 'days' ? 72 : 72, // Keep 72 for consistency if we use the top bar for controls
                // @ts-ignore
                "--gantt-header-height": `${granularity === 'days' ? 72 : 72}px`
            }}
        >
            {/* Top Control Bar Row */}
            <div
                className="flex border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 h-8"
            >
                <div
                    className="sticky left-0 z-50 w-[var(--gantt-sidebar-width)] min-w-[var(--gantt-sidebar-width)] shrink-0 px-3 py-1 bg-neutral-50 dark:bg-neutral-800/50 border-r border-neutral-200 dark:border-neutral-700 h-full flex items-center transition-[width] duration-300 ease-in-out overflow-hidden"
                >
                    {/* Expand / Collapse toggle */}
                    <div className="flex items-center gap-1">
                        <TooltipProvider delayDuration={200}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={allExpanded ? onCollapseAll : onExpandAll}
                                        className="h-6 w-6"
                                    >
                                        {allExpanded
                                            ? <ChevronsDownUp className="h-3.5 w-3.5" />
                                            : <ChevronsUpDown className="h-3.5 w-3.5" />
                                        }
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                    {allExpanded ? 'Collapse All' : 'Expand All'}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>

                    <div className="h-3 w-[1px] bg-neutral-300 dark:bg-neutral-700 mx-0.5" />

                    {/* Export */}
                    <div className="flex items-center gap-1">
                        <DropdownMenu>
                            <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                            >
                                                <Download className="h-3.5 w-3.5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">Export options</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            <DropdownMenuContent align="start">
                                <DropdownMenuItem onClick={() => onExport('pdf')}>
                                    Download PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onExport('excel')}>
                                    Download Sheet
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="h-3 w-[1px] bg-neutral-300 dark:bg-neutral-700 mx-0.5" />

                    {/* Granularity picker */}
                    <TooltipProvider delayDuration={200}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6">
                                            <Calendar className="h-3.5 w-3.5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start">
                                        <DropdownMenuItem onClick={() => onGranularityChange('days')}>
                                            Days
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onGranularityChange('weeks')}>
                                            Weeks
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onGranularityChange('months')}>
                                            Months
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                Change Timeline Granularity ({granularity})
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <div className="flex relative items-stretch">
                    {granularity === 'days' ? (
                        <>
                            <div style={{ width: visibleStartIndex * columnWidth }} />
                            {monthLabels.map((month, idx) => (
                                <div
                                    key={idx}
                                    className="text-[10px] font-medium text-muted-foreground text-center border-r border-neutral-200 dark:border-neutral-700 h-full flex items-center justify-center truncate px-1"
                                    style={{
                                        width: (Math.min(month.startIdx + month.span, visibleEndIndex) - Math.max(month.startIdx, visibleStartIndex)) * columnWidth
                                    }}
                                >
                                    {month.label}
                                </div>
                            ))}
                        </>
                    ) : (
                        <div className="flex items-center px-4 text-[10px] font-medium text-muted-foreground">
                            {granularity === 'weeks' ? 'Weekly Overview' : 'Monthly Overview'}
                        </div>
                    )}
                </div>
            </div>

            {/* Day/Week/Month Headers */}
            <div className="flex border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 h-10">
                <div
                    className="sticky left-0 z-50 w-[var(--gantt-sidebar-width)] min-w-[var(--gantt-sidebar-width)] bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-700 h-full flex flex-col justify-between shadow-sm transition-[width] duration-300 ease-in-out overflow-hidden"
                >
                    <div className="flex items-center justify-between w-full h-full">
                        <div className="flex items-center h-full">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-[var(--col-name)] px-3 border-r border-neutral-200 dark:border-neutral-700 h-full flex items-center justify-between group">
                                <span>Task Name</span>
                                <TooltipProvider delayDuration={200}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={onToggleDetails}
                                                className="h-5 w-5 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                                            >
                                                {showDetails ? <PanelLeftClose className="h-3 w-3" /> : <PanelLeftOpen className="h-3 w-3" />}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="right">
                                            {showDetails ? 'Collapse extra details' : 'Expand extra details'}
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </span>
                            {showDetails && (
                                <>
                                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-[var(--col-assignee)] px-2 border-r border-neutral-200 dark:border-neutral-700 h-full flex items-center">
                                        Assignee
                                    </span>
                                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-[var(--col-status)] px-2 border-r border-neutral-200 dark:border-neutral-700 h-full flex items-center">
                                        Status
                                    </span>
                                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-[var(--col-days)] px-2 border-r border-neutral-200 dark:border-neutral-700 h-full flex items-center justify-center text-center">
                                        Days
                                    </span>
                                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-[var(--col-dates)] px-2 h-full flex items-center">
                                        Dates
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex relative">
                    {/* Leading Spacer */}
                    <div style={{ width: visibleStartIndex * columnWidth }} />
                    {visibleColumns.map((col, idx) => (
                        <div
                            key={idx}
                            className={cn(
                                "text-[10px] text-center py-2 border-r border-neutral-200 dark:border-neutral-700 h-full flex items-center justify-center flex-col shrink-0",
                                col.isToday
                                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold"
                                    : "text-muted-foreground"
                            )}
                            style={{ width: columnWidth, minWidth: columnWidth }}
                        >
                            {col.label}
                        </div>
                    ))}
                    {/* Trailing Spacer to keep total width correct for horizontal scrollbar */}
                    <div style={{ width: (columns.length - visibleEndIndex) * columnWidth }} />
                </div>
            </div>
        </div>
    );
}

interface TimelineGridProps {
    startDate: Date;
    endDate: Date;
    granularity: TimelineGranularity;
    tasks: GanttTask[];
    children: React.ReactNode;
    showDetails: boolean;
    scrollX: number;
    viewportWidth: number;
}

export function TimelineGrid({ startDate, endDate, granularity, tasks, children, showDetails, scrollX, viewportWidth }: TimelineGridProps) {
    const columns = useMemo(
        () => generateTimelineColumns(startDate, endDate, granularity),
        [startDate, endDate, granularity]
    );

    const columnWidth = granularity === 'days' ? 40 : granularity === 'weeks' ? 80 : 120;
    const totalWidth = columns.length * columnWidth;

    // 🚀 Horizontal Virtualization
    const sidebarWidth = showDetails ? 650 : 250;
    const visibleStartIndex = Math.max(0, Math.floor((scrollX - sidebarWidth) / columnWidth));
    const visibleEndIndex = Math.min(columns.length, Math.ceil((scrollX + viewportWidth) / columnWidth));

    const visibleColumns = useMemo(() => {
        return columns.slice(visibleStartIndex, visibleEndIndex);
    }, [columns, visibleStartIndex, visibleEndIndex]);

    const todayPosition = useMemo(() => {
        const today = getIndianDate(); // Use IST for today indicator

        if (today < startDate || today > endDate) return null;

        // Find which column today falls into based on granularity
        let columnIndex = -1;

        if (granularity === 'days') {
            columnIndex = columns.findIndex(col =>
                col.date.toDateString() === today.toDateString()
            );
        } else if (granularity === 'weeks') {
            columnIndex = columns.findIndex((col, idx) => {
                const weekStart = new Date(col.date);
                const weekEnd = new Date(col.date);
                weekEnd.setDate(weekEnd.getDate() + 6);
                return today >= weekStart && today <= weekEnd;
            });
        } else {
            columnIndex = columns.findIndex(col =>
                col.date.getMonth() === today.getMonth() &&
                col.date.getFullYear() === today.getFullYear()
            );
        }

        if (columnIndex === -1) return null;

        let positionWithinColumn = 0.5;

        if (granularity === 'weeks') {
            const weekStart = new Date(columns[columnIndex].date);
            const daysIntoWeek = getDaysBetween(weekStart, today);
            positionWithinColumn = (daysIntoWeek + 0.5) / 7;
        } else if (granularity === 'months') {
            const monthStart = new Date(columns[columnIndex].date);
            const daysIntoMonth = today.getDate() - monthStart.getDate();
            const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
            positionWithinColumn = (daysIntoMonth + 0.5) / daysInMonth;
        }

        return columnIndex * columnWidth + (positionWithinColumn * columnWidth);
    }, [startDate, endDate, columnWidth, granularity, columns]);

    return (
        <div
            className="relative min-w-full w-fit"
            style={{
                // @ts-ignore
                "--gantt-total-width": `${totalWidth}px`
            }}
        >
            {/* Grid Background */}
            <div
                className="absolute inset-x-0 inset-y-0 flex pointer-events-none transition-[margin] duration-300 ease-in-out"
                style={{ marginLeft: 'var(--gantt-sidebar-width)' }}
            >
                {/* Horizontal virtual spacer */}
                <div style={{ width: visibleStartIndex * columnWidth }} className="shrink-0" />

                {visibleColumns.map((col, idx) => (
                    <div
                        key={idx}
                        className={cn(
                            "border-r border-neutral-100 dark:border-neutral-800 shrink-0",
                            col.isToday && "bg-blue-50/30 dark:bg-blue-900/10"
                        )}
                        style={{ width: columnWidth, minWidth: columnWidth }}
                    />
                ))}

                {/* Trailing virtual spacer */}
                <div style={{ width: (columns.length - visibleEndIndex) * columnWidth }} className="shrink-0" />
            </div>

            {/* Today Indicator Line */}
            {todayPosition !== null && (
                <div
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500/80 dark:bg-red-400/80 z-30 pointer-events-none"
                    style={{
                        left: `calc(var(--gantt-sidebar-width) + ${todayPosition}px)`,
                    }}
                >
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-red-500 shadow-sm" />
                </div>
            )}

            {/* Content Container (Vertical List of Rows) */}
            <div className="flex flex-col relative z-20">
                {children}
            </div>
        </div>
    );
}
