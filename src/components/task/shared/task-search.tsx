"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TaskSearchProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    debounceMs?: number;
    className?: string;
}

/**
 * Task Search Component
 * 
 * Provides a debounced search input for filtering tasks and subtasks.
 * Automatically triggers data reload when search value changes.
 * 
 * Features:
 * - Debounced search (default 300ms)
 * - Clear button
 * - Search icon
 * - Keyboard shortcuts support (Cmd+K / Ctrl+K)
 * - Accessible (ARIA labels)
 * 
 * @param value - Current search value
 * @param onChange - Callback when search value changes (debounced)
 * @param placeholder - Optional placeholder text
 * @param debounceMs - Debounce delay in milliseconds (default: 300)
 * @param className - Optional additional CSS classes
 */
export function TaskSearch({
    value,
    onChange,
    placeholder = "Search tasks...",
    debounceMs = 300,
    className,
}: TaskSearchProps) {
    const [localValue, setLocalValue] = useState(value);

    // Update local value when prop changes
    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    // Debounced onChange
    useEffect(() => {
        const timer = setTimeout(() => {
            if (localValue !== value) {
                onChange(localValue);
            }
        }, debounceMs);

        return () => clearTimeout(timer);
    }, [localValue, value, onChange, debounceMs]);

    const handleClear = useCallback(() => {
        setLocalValue("");
        onChange("");
    }, [onChange]);

    // Keyboard shortcut (Cmd+K / Ctrl+K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                const input = document.getElementById("task-search-input");
                if (input) {
                    input.focus();
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    return (
        <div className={cn("relative flex items-center", className)}>
            <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />

            <Input
                id="task-search-input"
                type="text"
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                placeholder={placeholder}
                className={cn(
                    "pl-9",
                    localValue && "pr-9"
                )}
                aria-label="Search tasks"
            />

            {localValue && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClear}
                    className="absolute right-1 h-7 w-7 p-0"
                    aria-label="Clear search"
                >
                    <X className="h-4 w-4" />
                </Button>
            )}

            {/* Keyboard shortcut hint (hidden on mobile) */}
            {/* {!localValue && (
                <kbd className="absolute right-3 hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 pointer-events-none">
                    <span className="text-xs">⌘</span>K
                </kbd>
            )} */}
        </div>
    );
}
