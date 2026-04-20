"use client";

import React from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { SortConfig, SortField, SortDirection } from "../../shared/types";
import { cn } from "@/lib/utils";

interface SortableHeaderProps {
    field: SortField;
    label: string;
    sorts: SortConfig[];
    onSortChange: (field: SortField) => void;
    className?: string;
}

export function SortableHeader({ field, label, sorts, onSortChange, className }: SortableHeaderProps) {
    const currentSort = sorts.find(s => s.field === field);
    const sortIndex = sorts.findIndex(s => s.field === field);

    return (
        <th className={cn("text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap bg-background", className)}>
            <button
                onClick={() => onSortChange(field)}
                className="flex items-center gap-1.5 hover:text-primary transition-colors group w-full"
            >
                <span>{label}</span>
                <div className="flex items-center gap-0.5">
                    {currentSort ? (
                        <>
                            {currentSort.direction === "asc" ? (
                                <ArrowUp className="h-3.5 w-3.5 text-primary" />
                            ) : (
                                <ArrowDown className="h-3.5 w-3.5 text-primary" />
                            )}
                            {sorts.length > 1 && (
                                <span className="text-[10px] font-bold text-primary bg-primary/10 rounded-full w-4 h-4 flex items-center justify-center">
                                    {sortIndex + 1}
                                </span>
                            )}
                        </>
                    ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                </div>
            </button>
        </th>
    );
}
