"use client";

import { useState, useCallback, createContext, useContext } from "react";
import { TaskWithSubTasks } from "@/components/task/shared/types";
import { TaskProvider } from "./task-context";

interface TaskPageWrapperProps {
    children: React.ReactNode;
}

interface TaskEvent {
    type: 'ADD' | 'UPDATE' | 'REMOVE';
    task?: TaskWithSubTasks | Partial<TaskWithSubTasks>;
    taskId?: string;
    timestamp: number;
}

interface NewTaskContextType {
    newTask: TaskWithSubTasks | null; // Keep for now or deprecate? Let's keep it as "last added task"
    lastEvent: TaskEvent | null;
    clearEvent: () => void;
}

const NewTaskContext = createContext<NewTaskContextType | undefined>(undefined);

export function useNewTask() {
    const context = useContext(NewTaskContext);
    if (!context) {
        throw new Error("useNewTask must be used within TaskPageWrapper");
    }
    return context;
}

export function TaskPageWrapper({ children }: TaskPageWrapperProps) {
    const [lastEvent, setLastEvent] = useState<TaskEvent | null>(null);

    const handleAddTask = useCallback((task: TaskWithSubTasks) => {
        setLastEvent({ type: 'ADD', task, timestamp: Date.now() });
    }, []);

    const handleUpdateTask = useCallback((taskId: string, task: Partial<TaskWithSubTasks>) => {
        setLastEvent({ type: 'UPDATE', taskId, task, timestamp: Date.now() });
    }, []);

    const handleRemoveTask = useCallback((taskId: string) => {
        setLastEvent({ type: 'REMOVE', taskId, timestamp: Date.now() });
    }, []);

    const clearEvent = useCallback(() => {
        setLastEvent(null);
    }, []);

    return (
        <NewTaskContext.Provider value={{
            newTask: lastEvent?.type === 'ADD' ? lastEvent.task as TaskWithSubTasks : null,
            lastEvent,
            clearEvent
        }}>
            <TaskProvider
                onAddTask={handleAddTask}
                onUpdateTask={handleUpdateTask}
                onRemoveTask={handleRemoveTask}
            >
                {children}
            </TaskProvider>
        </NewTaskContext.Provider>
    );
}
