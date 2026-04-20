"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { formatIST } from "@/lib/utils";
import { DataTable } from "@/components/data-table/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ReportDetailModal } from "./report-detail-sheet";
import { Loader2, CalendarIcon, UserIcon, X, ChevronDown, Clock, Search, ChevronRight, ChevronsUpDown, ChevronsDownUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { WorkspaceMemberRow } from "@/data/workspace/get-workspace-members";
import { loadMoreReportsAction } from "@/actions/daily-report/load-reports";

interface Props {
    initialData: any[];
    workspaceId: string;
    members: WorkspaceMemberRow[];
    initialDate?: string;
    initialUserId?: string;
    isAdmin: boolean;
    currentUserId: string;
}

export function ReportsTable({ initialData, workspaceId, members, initialDate, initialUserId, isAdmin, currentUserId }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [data, setData] = useState(initialData);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(initialData.length >= 30);
    const [skip, setSkip] = useState(30);
    const [selectedReport, setSelectedReport] = useState<any>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
    const [expandedReports, setExpandedReports] = useState<Record<string, boolean>>({});

    // Sync with initialData change (when server-side searchParams change)
    useEffect(() => {
        setData(initialData);
        setSkip(30);
        setHasMore(initialData.length >= 30);
    }, [initialData]);

    const selectedMember = useMemo(() => {
        return members.find(m => m.userId === initialUserId);
    }, [members, initialUserId]);

    const toggleDate = (dateStr: string) => {
        setExpandedDates(prev => ({ ...prev, [dateStr]: !prev[dateStr] }));
    };

    const toggleReport = (reportId: string) => {
        setExpandedReports(prev => ({ ...prev, [reportId]: !prev[reportId] }));
    };

    const populatedData = useMemo(() => {
        const dateGroups: Record<string, any[]> = {};

        // 1. Group existing data by date
        data.forEach(report => {
            let dateStr = "No Date";
            if (report.date) {
                dateStr = typeof report.date === "string"
                    ? report.date.split("T")[0]
                    : formatIST(report.date, "yyyy-MM-dd");
            }
            if (!dateGroups[dateStr]) dateGroups[dateStr] = [];
            dateGroups[dateStr].push(report);
        });

        // 2. Identify all dates to show
        const datesToShow = Array.from(new Set([
            ...Object.keys(dateGroups),
            ...(initialDate ? [initialDate] : [])
        ])).sort((a, b) => b.localeCompare(a));

        const result: Record<string, any[]> = {};

        // 3. For each date, create a fully populated list
        datesToShow.forEach(dateStr => {
            const reportsForDate = dateGroups[dateStr] || [];
            const userReportMap = new Map();
            reportsForDate.forEach(r => {
                const key = r.userId || r.user?.id || r.user?.email || r.reportId;
                if (key && !userReportMap.has(key)) userReportMap.set(key, r);
            });

            const membersToConsider = isAdmin
                ? (initialUserId ? members.filter(m => m.userId === initialUserId) : members)
                : members.filter(m => m.userId === currentUserId);

            result[dateStr] = membersToConsider.map(member => {
                const existing = userReportMap.get(member.userId) ||
                    (member.user?.id ? userReportMap.get(member.user.id) : null) ||
                    (member.user?.email ? userReportMap.get(member.user.email) : null);

                return existing || {
                    id: `virtual-${dateStr}-${member.userId}`,
                    workspaceId,
                    userId: member.userId,
                    user: member.user,
                    status: "NOT_SUBMITTED",
                    submittedAt: null,
                    date: dateStr,
                    entries: [],
                    description: "Not yet submitted."
                };
            });
        });
        return result;
    }, [data, members, isAdmin, initialUserId, currentUserId, initialDate, workspaceId]);

    const toggleAll = useCallback(() => {
        const anyExpanded = Object.values(expandedDates).some(v => v);

        if (anyExpanded) {
            setExpandedDates({});
            setExpandedReports({});
        } else {
            const dateKeys: Record<string, boolean> = {};
            const reportKeys: Record<string, boolean> = {};

            Object.entries(populatedData).forEach(([dateStr, reports]) => {
                // Only toggle if they would be visible (matching current search)
                const lowSearch = searchQuery.toLowerCase();
                const filtered = !searchQuery ? reports : reports.filter(item => {
                    const user = item.user;
                    const userName = `${user?.name || ""} ${user?.surname || ""} ${user?.email || ""}`.toLowerCase();
                    const entries = item.entries || [];
                    const taskMatch = entries.some((e: any) =>
                        (e.task?.name?.toLowerCase() || "").includes(lowSearch) ||
                        (e.task?.taskSlug?.toLowerCase() || "").includes(lowSearch) ||
                        (e.description?.toLowerCase() || "").includes(lowSearch)
                    );
                    const reportDescMatch = (item.description?.toLowerCase() || "").includes(lowSearch);
                    return userName.includes(lowSearch) || taskMatch || reportDescMatch;
                });

                if (filtered.length > 0) {
                    dateKeys[dateStr] = true;
                    filtered.forEach(r => {
                        reportKeys[r.id] = true;
                    });
                }
            });

            setExpandedDates(dateKeys);
            setExpandedReports(reportKeys);
        }
    }, [populatedData, expandedDates, searchQuery]);

    const updateFilters = useCallback((updates: Record<string, string | undefined>) => {
        const params = new URLSearchParams(searchParams.toString());
        Object.entries(updates).forEach(([key, value]) => {
            if (value) {
                params.set(key, value);
            } else {
                params.delete(key);
            }
        });
        router.push(`${pathname}?${params.toString()}`);
    }, [pathname, router, searchParams]);

    const loadMore = useCallback(async () => {
        if (isLoadingMore || !hasMore) return;

        setIsLoadingMore(true);
        try {
            const nextBatch = await loadMoreReportsAction({
                workspaceId,
                date: initialDate,
                userId: initialUserId,
                skip: skip,
                take: 30
            });

            if (nextBatch.length === 0) {
                setHasMore(false);
            } else {
                setData((prev: any[]) => [...prev, ...nextBatch]);
                setSkip((prev: number) => prev + 30);
            }
        } catch (error) {
            console.error("Failed to load more reports:", error);
        } finally {
            setIsLoadingMore(false);
        }
    }, [workspaceId, initialDate, initialUserId, skip, isLoadingMore, hasMore]);

    // Infinite scroll observer
    const observerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
                    loadMore();
                }
            },
            { threshold: 0.1 }
        );

        if (observerRef.current) {
            observer.observe(observerRef.current);
        }

        return () => observer.disconnect();
    }, [loadMore, hasMore, isLoadingMore]);

    const processedRows = useMemo(() => {
        const rows: any[] = [];

        // Sort dates desc
        const sortedDateKeys = Object.keys(populatedData).sort((a, b) => b.localeCompare(a));
        const lowSearch = searchQuery.toLowerCase();

        sortedDateKeys.forEach(dateStr => {
            let reports = populatedData[dateStr];

            // Apply search filter
            if (searchQuery) {
                reports = reports.filter(item => {
                    const user = item.user;
                    const userName = `${user?.name || ""} ${user?.surname || ""} ${user?.email || ""}`.toLowerCase();
                    const entries = item.entries || [];
                    const taskMatch = entries.some((e: any) =>
                        (e.task?.name?.toLowerCase() || "").includes(lowSearch) ||
                        (e.task?.taskSlug?.toLowerCase() || "").includes(lowSearch) ||
                        (e.description?.toLowerCase() || "").includes(lowSearch)
                    );
                    const reportDescMatch = (item.description?.toLowerCase() || "").includes(lowSearch);
                    return userName.includes(lowSearch) || taskMatch || reportDescMatch;
                });
            }

            if (reports.length === 0) return;

            // Build hierarchy rows
            rows.push({
                id: `d-${dateStr}`,
                type: "date",
                date: dateStr,
                count: reports.length,
                level: 0
            });

            if (expandedDates[dateStr]) {
                const sortedReports = [...reports].sort((a, b) => {
                    const nameA = a.user?.surname || "";
                    const nameB = b.user?.surname || "";
                    return nameA.localeCompare(nameB);
                });

                sortedReports.forEach(report => {
                    rows.push({
                        id: `r-${report.id}`,
                        type: "user",
                        user: report.user,
                        report,
                        level: 1
                    });

                    if (expandedReports[report.id]) {
                        const entries = report.entries || [];
                        if (entries.length === 0) {
                            rows.push({
                                id: `empty-${report.id}`,
                                type: "entry",
                                entry: null,
                                report,
                                description: report.status === "ABSENT"
                                    ? "No report submitted (Absent)."
                                    : (report.status === "NOT_SUBMITTED"
                                        ? "Activity pending: No work logs recorded for this day yet."
                                        : "Empty report: Submitted without logs."),
                                level: 2
                            });
                        } else {
                            entries.forEach((entry: any) => {
                                rows.push({
                                    id: `e-${entry.id}`,
                                    type: "entry",
                                    entry,
                                    report,
                                    level: 2
                                });
                            });
                        }
                    }
                });
            }
        });

        return rows;
    }, [populatedData, expandedDates, expandedReports, searchQuery]);

    const reportColumns = useMemo<ColumnDef<any>[]>(() => [
        {
            accessorKey: "hierarchy",
            header: () => {
                const anyExpanded = Object.values(expandedDates).some(v => v);
                return (
                    <div className="flex items-center gap-1.5">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 p-0 hover:bg-muted/60 text-muted-foreground hover:text-foreground shrink-0"
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleAll();
                            }}
                            title={anyExpanded ? "Collapse All" : "Expand All"}
                        >
                            {anyExpanded ? <ChevronsDownUp className="h-3.5 w-3.5" /> : <ChevronsUpDown className="h-3.5 w-3.5" />}
                        </Button>
                        <span className="font-semibold text-xs tracking-tight">Date / Assignee</span>
                    </div>
                );
            },
            meta: { className: "[&_td]:align-top text-left" } as any,
            cell: ({ row }) => {
                const data = row.original;

                if (data.type === "date") {
                    const isExpanded = !!expandedDates[data.date];
                    return (
                        <div className="flex items-center gap-2 pb-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 p-0 shrink-0"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleDate(data.date);
                                }}
                            >
                                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            </Button>
                            <CalendarIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="font-bold text-sm text-foreground">
                                {data.date !== "No Date" ? formatIST(new Date(`${data.date}T12:00:00`), "dd/MM/yyyy") : "No Date"}
                            </span>
                            <Badge variant="secondary" className="px-1.5 py-0 h-4 text-[9px] font-bold opacity-70">
                                {data.count} reports
                            </Badge>
                        </div>
                    );
                }

                if (data.type === "user") {
                    const user = data.user;
                    const report = data.report;
                    const isExpanded = !!expandedReports[report.id];
                    return (
                        <div className="flex items-center gap-2 pb-1 ml-6">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 p-0 shrink-0"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleReport(report.id);
                                }}
                            >
                                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            </Button>
                            <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center overflow-hidden shrink-0 border shadow-sm">
                                {user?.image ? (
                                    <img src={user.image} alt={user.surname} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-[10px] font-medium text-secondary-foreground">
                                        {user?.surname?.charAt(0) || "U"}
                                    </span>
                                )}
                            </div>
                            <span className="font-semibold text-xs truncate">{user?.surname}</span>
                            <Badge
                                variant={report.status === "ABSENT" ? "destructive" : "outline"}
                                className={cn(
                                    "text-[8px] h-3.5 px-1.5 shadow-none font-bold uppercase tracking-tighter ml-auto mr-2 shrink-0 transition-colors",
                                    report.status === "SUBMITTED" && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20",
                                    report.status === "NOT_SUBMITTED" && "bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20"
                                )}
                            >
                                {report.status.replace("_", " ")}
                            </Badge>
                        </div>
                    );
                }

                return null;
            }
        },
        {
            accessorKey: "tasks",
            header: "Task & Time",
            meta: { className: "w-[25%] border-l border-border/10 [&_td]:align-top text-left" } as any,
            cell: ({ row }) => {
                const data = row.original;
                if (data.type !== "entry") return null;

                const entry = data.entry;
                const submittedAt = data.report.submittedAt;

                if (!entry) {
                    return (
                        <div className="py-2 flex items-center gap-3 ml-12">
                            <span className="text-xs text-muted-foreground italic bg-muted/30 px-2 py-1 rounded-md border border-dashed">
                                {data.report.status === "ABSENT" ? "Absent" : "Other Work"}
                            </span>
                        </div>
                    );
                }

                return (
                    <div className="flex flex-col gap-1 pb-1 items-start justify-start min-h-[40px] ml-0">
                        <div className="flex items-center gap-2">
                            <div
                                className="w-2 h-2 rounded-full shrink-0 shadow-sm"
                                style={{ backgroundColor: entry.task?.project?.color || "#cbd5e1" }}
                            />
                            <span className="font-normal text-xs truncate leading-tight text-foreground/80">
                                {entry.task?.name || "Other Work"}
                            </span>
                        </div>
                        <div className="pl-4 flex items-center gap-2">
                            {submittedAt && (
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60 font-mono">
                                    <Clock className="h-2 w-2" />
                                    {formatIST(submittedAt, "h:mm a")}
                                </div>
                            )}
                        </div>
                    </div>
                );
            }
        },
        {
            accessorKey: "logs",
            header: "Work Log Descriptions",
            meta: { className: "w-[50%] border-l border-border/10 [&_td]:align-top text-left" } as any,
            cell: ({ row }) => {
                const data = row.original;
                if (data.type !== "entry") return null;

                const entry = data.entry;
                const description = entry ? entry.description : data.description;

                return (
                    <div className="pb-1 flex items-start min-h-[40px] ml-4">
                        <p className="text-sm text-card-foreground/90 font-normal leading-relaxed whitespace-pre-wrap">
                            {description || "-"}
                        </p>
                    </div>
                );
            }
        }
    ], [expandedDates, expandedReports, toggleAll]);

    return (
        <div className="flex flex-col h-[calc(100vh-210px)] min-h-[500px] gap-4">
            {/* Top Toolbar */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search assignees, tasks, or logs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-9 border-muted/40 focus:border-primary/30 transition-all text-sm"
                    />
                </div>

                <div className="ml-auto flex items-center gap-2">
                    {isAdmin && (
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                        "h-9 justify-start text-left font-normal border-dashed",
                                        !initialUserId && "text-muted-foreground"
                                    )}
                                >
                                    <UserIcon className="mr-2 h-4 w-4" />
                                    {selectedMember ? `${selectedMember.user?.surname || ""}` : "All Assignees"}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="p-0 w-[200px]" align="end">
                                <Command>
                                    <CommandInput placeholder="Search assignee..." />
                                    <CommandList>
                                        <CommandEmpty>No assignee found.</CommandEmpty>
                                        <CommandGroup>
                                            <CommandItem
                                                onSelect={() => updateFilters({ userId: undefined })}
                                            >
                                                All members
                                            </CommandItem>
                                            {members.map((m) => (
                                                <CommandItem
                                                    key={m.userId}
                                                    onSelect={() => updateFilters({ userId: m.userId })}
                                                >
                                                    {m.user?.surname}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    )}

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className={cn(
                                    "h-9 justify-start text-left font-normal border-dashed",
                                    !initialDate && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {initialDate ? formatIST(new Date(`${initialDate}T12:00:00`)) : "Any date"}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                mode="single"
                                selected={initialDate ? new Date(initialDate) : undefined}
                                onSelect={(date) => updateFilters({ date: date ? formatIST(date, "yyyy-MM-dd") : undefined })}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>

                    {(initialDate || (isAdmin && initialUserId)) && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateFilters({ date: undefined, userId: undefined })}
                            className="h-9 px-2 text-muted-foreground hover:text-foreground"
                        >
                            <X className="mr-1 h-4 w-4" />
                            Clear
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-auto relative scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/40 [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-20 [&_thead]:bg-background/95 [&_thead]:backdrop-blur [&_[data-slot=table-container]]:overflow-visible transition-colors">
                <DataTable
                    columns={reportColumns}
                    data={processedRows}
                    getRowId={(row) => row.id}
                    onRowClick={(row) => {
                        if (row.type === 'date') toggleDate(row.date);
                        else if (row.type === 'user') toggleReport(row.report.id);
                        else if (row.type === 'entry') {
                            setSelectedReport(row.report);
                            setIsDialogOpen(true);
                        }
                    }}
                    showPagination={false}
                    showColumnToggle={false}
                    getRowClassName={(row) => cn(
                        "group transition-colors",
                        row.original.type === "date" && "bg-muted/50 hover:bg-muted/70 font-bold border-t-2 border-border/10",
                        row.original.type === "user" && "bg-muted/10 hover:bg-muted/20 border-t border-border/5",
                        row.original.type === "entry" && "hover:bg-accent/5 cursor-default"
                    )}
                />

                {isLoadingMore ? (
                    <div className="flex justify-center p-8 border-t border-border/10 bg-muted/5">
                        <Loader2 className="h-6 w-6 animate-spin text-primary/60" />
                    </div>
                ) : (hasMore && data.length > 0) ? (
                    <div ref={observerRef} className="h-12 flex items-center justify-center border-t border-border/5" />
                ) : data.length > 0 ? (
                    <div className="p-8 text-center border-t border-border/10 bg-muted/5">
                        <p className="text-sm text-muted-foreground font-medium italic opacity-60">
                            ✨ You've reached the end of the logs
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 bg-muted/5 text-center flex-1">
                        <div className="p-4 rounded-2xl bg-muted/50 mb-4 border border-border/40">
                            <Search className="h-8 w-8 text-muted-foreground/40" />
                        </div>
                        <h3 className="font-semibold text-lg">No reports found</h3>
                        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                            Try adjusting your filters or search query to find activity logs.
                        </p>
                    </div>
                )}
            </div>

            {selectedReport && (
                <ReportDetailModal
                    report={selectedReport}
                    isOpen={isDialogOpen}
                    onOpenChange={setIsDialogOpen}
                />
            )}
        </div>
    );
}
