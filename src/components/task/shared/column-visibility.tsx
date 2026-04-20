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
import { Settings2 } from "lucide-react";

export type ColumnVisibility = {
    assignee: boolean;
    reviewer: boolean;
    status: boolean;
    startDate: boolean;
    dueDate: boolean;
    progress: boolean;
    tag: boolean;
    description: boolean;
    project: boolean; // For workspace-level view
};

interface ColumnVisibilityProps {
    columnVisibility: ColumnVisibility;
    setColumnVisibility: React.Dispatch<React.SetStateAction<ColumnVisibility>>;
}

/**
 * Column Visibility Dropdown Component
 * 
 * Allows users to toggle visibility of table columns in list view.
 * Used in both project-level and workspace-level task tables.
 */
export function ColumnVisibility({
    columnVisibility,
    setColumnVisibility,
}: ColumnVisibilityProps) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Settings2 className="h-4 w-4" />
                    Columns
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                    checked={columnVisibility.description}
                    onCheckedChange={() => setColumnVisibility((prev) => ({ ...prev, description: !prev.description }))}
                >
                    Description
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                    checked={columnVisibility.assignee}
                    onCheckedChange={() => setColumnVisibility((prev) => ({ ...prev, assignee: !prev.assignee }))}
                >
                    Assignee
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                    checked={columnVisibility.reviewer}
                    onCheckedChange={() => setColumnVisibility((prev) => ({ ...prev, reviewer: !prev.reviewer }))}
                >
                    Reviewer
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                    checked={columnVisibility.status}
                    onCheckedChange={() => setColumnVisibility((prev) => ({ ...prev, status: !prev.status }))}
                >
                    Status
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                    checked={columnVisibility.startDate}
                    onCheckedChange={() => setColumnVisibility((prev) => ({ ...prev, startDate: !prev.startDate }))}
                >
                    Start Date
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                    checked={columnVisibility.dueDate}
                    onCheckedChange={() => setColumnVisibility((prev) => ({ ...prev, dueDate: !prev.dueDate }))}
                >
                    Due Date
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                    checked={columnVisibility.progress}
                    onCheckedChange={() => setColumnVisibility((prev) => ({ ...prev, progress: !prev.progress }))}
                >
                    Deadline
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                    checked={columnVisibility.tag}
                    onCheckedChange={() => setColumnVisibility((prev) => ({ ...prev, tag: !prev.tag }))}
                >
                    Tag
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                    checked={columnVisibility.project}
                    onCheckedChange={() => setColumnVisibility((prev) => ({ ...prev, project: !prev.project }))}
                >
                    Project
                </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
