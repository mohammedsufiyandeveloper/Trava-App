"use client";

import { useRef, useMemo } from "react";
import { parseDate, getDaysBetween } from "./utils";
import { GanttSubtask } from "./types";

interface DependencyLinesProps {
    subtasks: GanttSubtask[];
    timelineStart: Date;
    totalDays: number;
    granularity: 'days' | 'weeks' | 'months';
    containerRef?: React.RefObject<HTMLDivElement | null>;
}

export function DependencyLines({
    subtasks,
    timelineStart,
    totalDays,
    granularity,
    containerRef
}: DependencyLinesProps) {
    const svgRef = useRef<SVGSVGElement>(null);

    // Calculate column width based on granularity
    const columnWidth = granularity === 'days' ? 40 : granularity === 'weeks' ? 80 : 120;
    const totalWidth = totalDays * columnWidth;

    // Build a map of subtask positions in absolute pixels
    const subtaskPositions = useMemo(() => {
        const positions = new Map<string, { x: number; y: number; width: number; endX: number }>();

        subtasks.forEach((subtask, index) => {
            const start = parseDate(subtask.start);
            const end = parseDate(subtask.end);

            if (!start || !end) return;

            const startOffset = getDaysBetween(timelineStart, start);
            const duration = getDaysBetween(start, end) + 1;

            // X positions in pixels
            const left = startOffset * columnWidth;
            const width = duration * columnWidth;

            // Y position based on row index - 32px per row, centered at 16px
            const y = index * 32 + 16;

            positions.set(subtask.id, {
                x: left,
                y,
                width,
                endX: left + width
            });
        });

        return positions;
    }, [subtasks, timelineStart, columnWidth]);

    // Generate dependency lines with smooth right-angle connectors
    const lines = useMemo(() => {
        const result: Array<{
            path: string;
            isCompleted: boolean;
            fromId: string;
            toId: string;
        }> = [];

        const cornerRadius = 8;

        subtasks.forEach((subtask) => {
            if (!subtask.dependsOnIds || subtask.dependsOnIds.length === 0) return;

            const toPos = subtaskPositions.get(subtask.id);
            if (!toPos) return;

            subtask.dependsOnIds.forEach((depId: string) => {
                const fromPos = subtaskPositions.get(depId);
                if (!fromPos) return;

                // Start from the end of the predecessor bar
                const startX = fromPos.endX;
                const startY = fromPos.y;

                // End at the start of the successor bar
                const endX = toPos.x;
                const endY = toPos.y;

                let path: string;

                if (Math.abs(startY - endY) < 1) {
                    // Same row - simple horizontal line
                    path = `M ${startX} ${startY} L ${endX} ${endY}`;
                } else if (startX < endX - 12) {
                    // Predecessor ends before successor starts (Normal Forward Case)
                    const midX = (startX + endX) / 2;
                    
                    // Path: Start -> Horizontal -> Curve -> Vertical -> Curve -> Horizontal -> End
                    const up = endY < startY;
                    const r = Math.min(cornerRadius, Math.abs(endY - startY) / 2, Math.abs(midX - startX));
                    
                    path = `M ${startX} ${startY} ` +
                           `L ${midX - r} ${startY} ` +
                           `Q ${midX} ${startY} ${midX} ${startY + (up ? -r : r)} ` +
                           `L ${midX} ${endY + (up ? r : -r)} ` +
                           `Q ${midX} ${endY} ${midX + r} ${endY} ` +
                           `L ${endX} ${endY}`;
                } else {
                    // Predecessor ends after successor starts (Overlap or Backwards Case)
                    const offset = 12; // Pixels
                    const x1 = startX + offset;
                    const midY = (startY + endY) / 2;
                    const x2 = endX - offset;
                    
                    const up = endY < startY;
                    const r = Math.min(cornerRadius, Math.abs(midY - startY) / 2, offset / 2);
                    
                    path = `M ${startX} ${startY} ` +
                           `L ${x1 - r} ${startY} ` +
                           `Q ${x1} ${startY} ${x1} ${startY + (up ? -r : r)} ` +
                           `L ${x1} ${midY + (up ? r : -r)} ` +
                           `Q ${x1} ${midY} ${x1 - r} ${midY} ` +
                           `L ${x2 + r} ${midY} ` +
                           `Q ${x2} ${midY} ${x2} ${midY + (up ? -r : r)} ` +
                           `L ${x2} ${endY + (up ? r : -r)} ` +
                           `Q ${x2} ${endY} ${x2 + r} ${endY} ` +
                           `L ${endX} ${endY}`;
                }

                const predecessor = subtasks.find(s => s.id === depId);

                result.push({
                    path,
                    isCompleted: predecessor?.status === "COMPLETED",
                    fromId: depId,
                    toId: subtask.id
                });
            });
        });

        return result;
    }, [subtasks, subtaskPositions]);

    if (lines.length === 0) return null;

    return (
        <svg
            ref={svgRef}
            className="absolute inset-0 pointer-events-none z-10"
            viewBox={`0 0 ${totalWidth} ${subtasks.length * 32}`}
            style={{
                width: `${totalWidth}px`,
                height: `${subtasks.length * 32}px`,
                overflow: 'visible'
            }}
        >
            <defs>
                <marker
                    id="arrow-head"
                    markerWidth="6"
                    markerHeight="6"
                    refX="5"
                    refY="3"
                    orient="auto"
                >
                    <path d="M0,0 L0,6 L6,3 z" fill="currentColor" />
                </marker>
            </defs>

            {lines.map((line, index) => (
                <path
                    key={`${line.fromId}-${line.toId}-${index}`}
                    d={line.path}
                    fill="none"
                    stroke={line.isCompleted ? "#22c55e" : "#3b82f6"}
                    strokeWidth="1.2"
                    strokeOpacity={line.isCompleted ? "0.8" : "0.6"}
                    markerEnd="url(#arrow-head)"
                    className={line.isCompleted ? "text-green-500" : "text-blue-500"}
                    style={{
                        transition: 'stroke 0.3s ease, stroke-opacity 0.3s ease'
                    }}
                />
            ))}
        </svg>
    );
}
