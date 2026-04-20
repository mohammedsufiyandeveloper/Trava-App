"use client";

import { CornerDownRight, GripVertical, Link2 } from "lucide-react";
import { DraggableSubtaskBar } from "./draggable-subtask-bar";
import { cn } from "@/lib/utils";
import { GanttSubtask } from "./types";
import { getDaysBetween } from "./utils";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { InlineAssigneePicker } from "../shared/inline-assignee-picker";
import { ProjectMembersType } from "@/data/project/get-project-members";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { restrictToVerticalAxis, restrictToWindowEdges } from "@dnd-kit/modifiers";
import { useState } from "react";
import { reorderSubtasks } from "@/actions/task/gantt";
import { toast } from "sonner";
import { DependencyPicker } from "./dependency-picker";
import { DependencyLines } from "./dependency-lines";

interface SortableSubtaskRowProps {
    subtask: GanttSubtask;
    timelineStart: Date;
    totalDays: number;
    onSubtaskClick?: (subtaskId: string) => void;
    onSubTaskUpdate?: (subTaskId: string, data: Partial<any>) => void;
    workspaceId: string;
    projectId: string;
    members?: ProjectMembersType;
    currentUser?: { id: string };
    permissions?: {
        isWorkspaceAdmin: boolean;
        leadProjectIds: string[];
        managedProjectIds: string[];
    };
    showDetails: boolean;
    allowedUserIds?: string[];
    allTasks?: any[];
}

function SortableSubtaskRow({
    subtask,
    timelineStart,
    totalDays,
    showDetails,
    onSubtaskClick,
    onSubTaskUpdate,
    workspaceId,
    projectId,
    members,
    currentUser,
    permissions,
    allowedUserIds,
    allTasks
}: SortableSubtaskRowProps) {
    const [showDepPicker, setShowDepPicker] = useState(false);
    
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: subtask.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
        opacity: isDragging ? 0.5 : 1,
    };

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'COMPLETED':
                return "bg-green-100/50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800";
            case 'IN_PROGRESS':
                return "bg-blue-100/50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800";
            case 'REVIEW':
                return "bg-amber-100/50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800";
            default:
                return "bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700";
        }
    };

    const canManage = permissions?.isWorkspaceAdmin || 
                    permissions?.managedProjectIds.includes(projectId) || 
                    subtask.createdById === currentUser?.id;

    return (
        <div
            ref={setNodeRef}
            style={{
                ...style,
                gridTemplateColumns: 'var(--gantt-sidebar-width) var(--gantt-total-width)',
            }}
            className="grid group/row"
        >
            {/* Left Panel */}
            <div
                className={cn(
                    "sticky left-0 z-30 flex items-center bg-white dark:bg-neutral-900 border-b border-r border-neutral-200 dark:border-neutral-700 h-[32px] w-[var(--gantt-sidebar-width)] min-w-[var(--gantt-sidebar-width)] shrink-0 transition-colors duration-200 overflow-hidden",
                    isDragging ? "bg-blue-50/50 dark:bg-blue-900/10" : (!subtask.assigneeId && subtask.status !== "COMPLETED" && subtask.status !== "CANCELLED") && "bg-red-500/10 animate-[pulse_2s_infinite]"
                )}
            >
                {/* Drag Handle & Name */}
                <div className="w-[var(--col-name)] flex items-center gap-1 px-1 shrink-0 border-r border-neutral-200 dark:border-neutral-700 h-full relative group">
                    {/* Gripper - only visible on hover or dragging */}
                    <div 
                        {...attributes} 
                        {...listeners}
                        className={cn(
                            "cursor-grab active:cursor-grabbing p-1 text-muted-foreground/30 hover:text-muted-foreground transition-colors",
                            !canManage && "pointer-events-none opacity-0"
                        )}
                    >
                        <GripVertical className="h-3.5 w-3.5" />
                    </div>

                    <CornerDownRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                    
                    <span
                        className="text-[12px] text-muted-foreground truncate flex-1 cursor-pointer hover:text-foreground hover:underline transition-colors pl-1"
                        onClick={() => onSubtaskClick?.(subtask.id)}
                        title={subtask.name}
                    >
                        {subtask.name}
                    </span>

                    {/* Dependency Link Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowDepPicker(true);
                        }}
                        className={cn(
                            "absolute right-1 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all",
                            subtask.dependsOnIds && subtask.dependsOnIds.length > 0 && "opacity-100 text-blue-500"
                        )}
                        title="Manage Dependencies"
                    >
                        <Link2 className="h-3 w-3" />
                    </button>
                </div>

                {showDetails && (
                    <>
                        <div className="w-[var(--col-assignee)] flex items-center px-1 shrink-0 border-r border-neutral-200 dark:border-neutral-700 h-full overflow-hidden">
                            {members && (
                                <InlineAssigneePicker
                                    subTask={subtask as any}
                                    members={members}
                                    projectId={projectId}
                                    parentTaskId={subtask.parentTaskId || ""}
                                    canEdit={canManage && !subtask.assigneeId}
                                    onAssigned={(userId, member) => {
                                        onSubTaskUpdate?.(subtask.id, {
                                            assigneeId: member.projectMemberId,
                                            assignee: {
                                                id: member.userId,
                                                name: member.user.surname || member.user.name,
                                                image: member.user.image,
                                            }
                                        });
                                    }}
                                    allowedUserIds={allowedUserIds}
                                />
                            )}
                        </div>

                        <div className="w-[var(--col-status)] flex items-center px-2 shrink-0 border-r border-neutral-200 dark:border-neutral-700 h-full">
                            <Badge
                                variant="outline"
                                className={cn(
                                    "text-[9px] px-1 py-0 h-4 font-normal uppercase whitespace-nowrap border-0",
                                    getStatusStyles(subtask.status)
                                )}
                            >
                                {subtask.status?.replace('_', ' ') || 'TO-DO'}
                            </Badge>
                        </div>

                        <div className="w-[var(--col-days)] flex items-center px-2 shrink-0 border-r border-neutral-200 dark:border-neutral-700 h-full justify-center">
                            <span className="text-[10px] text-muted-foreground font-medium">
                                {subtask.days || "-"}
                            </span>
                        </div>

                        <div className="w-[var(--col-dates)] flex items-center px-2 shrink-0 h-full">
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                {subtask.start && subtask.end
                                    ? `${format(new Date(subtask.start), "dd/MM")} - ${format(new Date(subtask.end), "dd/MM")}`
                                    : "No dates"
                                }
                            </span>
                        </div>
                    </>
                )}
            </div>

            {/* Right Panel - Timeline Bar */}
            <div className="relative min-h-[32px] flex items-center w-full border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20 transition-colors">
                <DraggableSubtaskBar
                    subtask={subtask}
                    timelineStart={timelineStart}
                    totalDays={totalDays}
                    workspaceId={workspaceId}
                    projectId={projectId}
                    currentUser={currentUser}
                    permissions={permissions}
                    onUpdate={(id, data) => onSubTaskUpdate?.(id, data)}
                />
            </div>

            {/* Dependency Picker Modal */}
            {allTasks && (
                <DependencyPicker
                    open={showDepPicker}
                    onOpenChange={setShowDepPicker}
                    subtask={subtask}
                    allTasks={allTasks}
                    workspaceId={workspaceId}
                    projectId={projectId}
                    onUpdate={(id, data) => onSubTaskUpdate?.(id, data)}
                />
            )}
        </div>
    );
}

interface SortableSubtaskListProps {
    subtasks: GanttSubtask[];
    timelineStart: Date;
    totalDays: number;
    onSubtaskClick?: (subtaskId: string) => void;
    onSubTaskUpdate?: (subTaskId: string, data: Partial<any>) => void;
    workspaceId: string;
    projectId: string;
    members?: ProjectMembersType;
    currentUser?: { id: string };
    permissions?: {
        isWorkspaceAdmin: boolean;
        leadProjectIds: string[];
        managedProjectIds: string[];
    };
    showDetails: boolean;
    allowedUserIds?: string[];
    allTasks?: any[];
    granularity: 'days' | 'weeks' | 'months';
}

export function SortableSubtaskList({
    subtasks: initialSubtasks,
    ...props
}: SortableSubtaskListProps) {
    const [items, setItems] = useState(initialSubtasks);

    // Sync items if props change (unless dragging)
    useState(() => {
        setItems(initialSubtasks);
    });

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 }
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = items.findIndex((item) => item.id === active.id);
            const newIndex = items.findIndex((item) => item.id === over.id);

            const newItems = arrayMove(items, oldIndex, newIndex);
            setItems(newItems);

            // Call server action
            try {
                const result = await reorderSubtasks(
                    newItems.map(item => item.id),
                    props.projectId,
                    props.workspaceId
                );
                if (result.status === "error") {
                    toast.error(result.message);
                    setItems(initialSubtasks); // Rollback
                } else {
                    toast.success("Tasks reordered successfully");
                }
            } catch (error) {
                toast.error("Failed to reorder tasks");
                setItems(initialSubtasks); // Rollback
            }
        }
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
            autoScroll={{
                threshold: {
                    x: 0,
                    y: 0.2
                }
            }}
        >
            <SortableContext
                items={items.map(i => i.id)}
                strategy={verticalListSortingStrategy}
            >
                <div className="flex flex-col relative">
                    {/* Dependency Lines Overlay - Positioned over the timeline bars area */}
                    <div 
                        className="absolute top-0 right-0 h-full w-[var(--gantt-total-width)] pointer-events-none z-20"
                        style={{ width: 'var(--gantt-total-width)' }}
                    >
                        <DependencyLines 
                            subtasks={items}
                            timelineStart={props.timelineStart}
                            totalDays={props.totalDays}
                            granularity={props.granularity}
                        />
                    </div>

                    {items.map((subtask) => (
                        <SortableSubtaskRow
                            key={subtask.id}
                            allTasks={props.allTasks}
                            subtask={subtask}
                            {...props}
                        />
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    );
}
