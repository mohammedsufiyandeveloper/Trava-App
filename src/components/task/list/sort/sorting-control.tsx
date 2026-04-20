"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ArrowUpDown, ArrowUp, ArrowDown, X } from "lucide-react";
import { SortConfig, SortField } from "../../shared/types";
import { Badge } from "@/components/ui/badge";

interface SortingControlProps {
    sorts: SortConfig[];
    onSortsChange: (sorts: SortConfig[]) => void;
}

const SORT_FIELD_LABELS: Record<SortField, string> = {
    name: "Name",
    // assignee: "Assignee",
    // reviewer: "Reviewer",
    status: "Status",
    startDate: "Start Date",
    dueDate: "Due Date",
    createdAt: ""
};

export function SortingControl({ sorts, onSortsChange }: SortingControlProps) {
    const addSort = (field: SortField) => {
        // Check if this field is already being sorted
        const existing = sorts.find(s => s.field === field);
        if (existing) {
            // Toggle direction
            onSortsChange(
                sorts.map(s =>
                    s.field === field
                        ? { ...s, direction: s.direction === "asc" ? "desc" : "asc" }
                        : s
                )
            );
        } else {
            // Add new sort
            onSortsChange([...sorts, { field, direction: "asc" }]);
        }
    };

    const removeSort = (field: SortField) => {
        onSortsChange(sorts.filter(s => s.field !== field));
    };

    const clearAllSorts = () => {
        onSortsChange([]);
    };

    return (
        <div className="flex items-center gap-2">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant={sorts.length > 0 ? "default" : "outline"}
                        size="sm"
                        className="h-8"
                    >
                        <ArrowUpDown className="h-4 w-4 mr-2" />
                        Sort
                        {sorts.length > 0 && (
                            <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                                {sorts.length}
                            </Badge>
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                    {Object.entries(SORT_FIELD_LABELS).map(([field, label]) => {
                        const currentSort = sorts.find(s => s.field === field);
                        return (
                            <DropdownMenuItem
                                key={field}
                                onClick={() => addSort(field as SortField)}
                                className="flex items-center justify-between"
                            >
                                <span>{label}</span>
                                {currentSort && (
                                    currentSort.direction === "asc" ? (
                                        <ArrowUp className="h-4 w-4" />
                                    ) : (
                                        <ArrowDown className="h-4 w-4" />
                                    )
                                )}
                            </DropdownMenuItem>
                        );
                    })}
                    {sorts.length > 0 && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={clearAllSorts}
                                className="text-destructive"
                            >
                                <X className="h-4 w-4 mr-2" />
                                Clear All Sorts
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Active sort badges */}
            {sorts.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                    {sorts.map((sort) => (
                        <Badge
                            key={sort.field}
                            variant="secondary"
                            className="flex items-center gap-1 pr-1"
                        >
                            <span className="text-xs">{SORT_FIELD_LABELS[sort.field]}</span>
                            {sort.direction === "asc" ? (
                                <ArrowUp className="h-3 w-3" />
                            ) : (
                                <ArrowDown className="h-3 w-3" />
                            )}
                            <button
                                onClick={() => removeSort(sort.field)}
                                className="ml-1 hover:bg-muted rounded-sm p-0.5"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    ))}
                </div>
            )}
        </div>
    );
}
