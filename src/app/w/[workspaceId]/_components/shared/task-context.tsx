"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { TaskWithSubTasks } from "@/components/task/shared/types";

interface TaskContextType {
    addNewTask: (task: TaskWithSubTasks) => void;
    updateTask: (taskId: string, task: Partial<TaskWithSubTasks>) => void;
    removeTask: (taskId: string) => void;
    isAddingTask: boolean;
    setIsAddingTask: (loading: boolean) => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export function useTaskContext() {
    const context = useContext(TaskContext);
    if (!context) {
        throw new Error("useTaskContext must be used within TaskProvider");
    }
    return context;
}

interface TaskProviderProps {
    children: React.ReactNode;
    onAddTask: (task: TaskWithSubTasks) => void;
    onUpdateTask?: (taskId: string, task: Partial<TaskWithSubTasks>) => void;
    onRemoveTask?: (taskId: string) => void;
}

export function TaskProvider({ children, onAddTask, onUpdateTask, onRemoveTask }: TaskProviderProps) {
    const [isAddingTask, setIsAddingTask] = useState(false);

    const addNewTask = useCallback((task: TaskWithSubTasks) => {
        onAddTask(task);
        // Delay hiding skeleton to ensure task is added to UI first
        setTimeout(() => {
            setIsAddingTask(false);
        }, 300);
    }, [onAddTask]);

    const updateTask = useCallback((taskId: string, task: Partial<TaskWithSubTasks>) => {
        onUpdateTask?.(taskId, task);
    }, [onUpdateTask]);

    const removeTask = useCallback((taskId: string) => {
        onRemoveTask?.(taskId);
    }, [onRemoveTask]);

    return (
        <TaskContext.Provider value={{ addNewTask, updateTask, removeTask, isAddingTask, setIsAddingTask }}>
            {children}
        </TaskContext.Provider>
    );
}
