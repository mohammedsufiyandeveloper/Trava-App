"use client";

import React, { useState, useEffect } from "react";
import { formatIST } from "@/lib/utils";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    CalendarIcon,
    Clock,
    ChevronLeft,
    ChevronRight,
    Loader2
} from "lucide-react";

interface ReportDetailModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    report: any;
}

export function ReportDetailModal({ isOpen, onOpenChange, report }: ReportDetailModalProps) {
    const [currentEntryIndex, setCurrentEntryIndex] = useState(0);

    // Reset index when modal opens for a new report
    useEffect(() => {
        if (isOpen) {
            setCurrentEntryIndex(0);
        }
    }, [isOpen, report?.id]);

    if (!report) return null;

    const entries = report.entries || [];
    const hasMultipleEntries = entries.length > 1;

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col h-full bg-background border-l">
                <SheetHeader className="p-4 bg-muted/30 shrink-0 border-b">
                    <SheetTitle className="text-lg font-bold flex items-center justify-between">
                        <span>Work Report Details</span>
                    </SheetTitle>
                    <SheetDescription className="text-sm">
                        For {report.date ? formatIST(report.date) : "-"}
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 pt-0 custom-scrollbar">
                    {/* User Header Section */}
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-primary/10">
                            <AvatarImage src={report.user?.image} />
                            <AvatarFallback className="bg-primary/5 text-primary text-base font-bold">
                                {report.user?.surname?.charAt(0) || "U"}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-normal leading-tight truncate">
                                {report.user?.surname}
                            </h3>
                            <p className="text-xs text-muted-foreground truncate">{report.user?.email}</p>
                        </div>

                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg"
                                    disabled={currentEntryIndex === 0 || !hasMultipleEntries}
                                    onClick={() => setCurrentEntryIndex(prev => prev - 1)}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <div className="flex flex-col items-center min-w-[80px]">
                                    <span className="text-sm font-bold font-mono">
                                        {entries.length > 0
                                            ? `${currentEntryIndex + 1} / ${entries.length}`
                                            : "0 / 0"}
                                    </span>
                                </div>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg"
                                    disabled={currentEntryIndex >= (entries.length - 1) || !hasMultipleEntries}
                                    onClick={() => setCurrentEntryIndex(prev => prev + 1)}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    <Separator className="bg-border/50" />

                    {/* Slide Show Section */}
                    <div className="space-y-6">

                        <div className="relative">
                            {entries.length > 0 ? (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500 fill-mode-both" key={currentEntryIndex}>
                                    {/* Entry Metadata (Time) */}

                                    {entries[currentEntryIndex].task ? (
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    {entries[currentEntryIndex].task.project?.color && (
                                                        <div className="w-2 h-2 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: entries[currentEntryIndex].task.project.color }} />
                                                    )}
                                                    <span className="text-[10px] font-normal text-muted-foreground uppercase tracking-wider">
                                                        {entries[currentEntryIndex].task.project?.name || "No Project"}
                                                        {entries[currentEntryIndex].task.parentTask?.name && ` / ${entries[currentEntryIndex].task.parentTask.name}`}
                                                    </span>
                                                </div>
                                                <h5 className="font-normal text-md text-primary tracking-tight leading-tight">
                                                    {entries[currentEntryIndex].task.name}
                                                </h5>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center gap-2 font-normal text-sm bg-primary/5 w-fit px-4 py-2 rounded-xl border border-primary/10">
                                                    <Clock className="h-4 w-4" />
                                                    <span>
                                                        {entries[currentEntryIndex].createdAt ? formatIST(entries[currentEntryIndex].createdAt, "h:mm:ss a") : "Time unknown"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-3">
                                                    <div className="shrink-0" />
                                                    <span className="text-[10px] -ml-2 font-normal text-muted-foreground uppercase tracking-wider">
                                                        General Activity
                                                    </span>
                                                </div>
                                                <h5 className="font-normal text-lg tracking-tight leading-tight text-primary italic">
                                                    Other Work
                                                </h5>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center gap-2 font-normal text-sm bg-primary/5 w-fit px-4 py-2 rounded-xl border border-primary/10">
                                                    <Clock className="h-4 w-4" />
                                                    <span>
                                                        {entries[currentEntryIndex].createdAt ? formatIST(entries[currentEntryIndex].createdAt, "h:mm:ss a") : "Time unknown"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-card rounded-xl min-h-[250px] relative overflow-hidden group/log">
                                        <div className="relative z-10">
                                            {/* <h2 className="font-normal text-lg tracking-tight leading-tight text-primary">Description :</h2> */}
                                            <p className="leading-relaxed whitespace-pre-wrap text-foreground/90 font-normal">
                                                {entries[currentEntryIndex].description || "No description provided."}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-muted/20 rounded-[2rem] border border-dashed py-20 flex flex-col items-center justify-center gap-4 text-center animate-in fade-in zoom-in-95 duration-700">
                                    <div className="space-y-1">
                                        <h5 className="font-bold text-lg text-foreground">No Logs</h5>
                                        <p className="italic text-muted-foreground/60 text-sm max-w-[200px] mx-auto">
                                            {report.status === "ABSENT" ? "Absent" : "No detailed logs."}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}

// function IconReport({ className }: { className?: string }) {
//     return (
//         <svg
//             xmlns="http://www.w3.org/2000/svg"
//             viewBox="0 0 24 24"
//             fill="none"
//             stroke="currentColor"
//             strokeWidth="1.5"
//             strokeLinecap="round"
//             strokeLinejoin="round"
//             className={className}
//         >
//             <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
//             <polyline points="14 2 14 8 20 8" />
//             <line x1="16" y1="13" x2="8" y2="13" />
//             <line x1="16" y1="17" x2="8" y2="17" />
//             <line x1="10" y1="9" x2="8" y2="9" />
//         </svg>
//     );
// }

