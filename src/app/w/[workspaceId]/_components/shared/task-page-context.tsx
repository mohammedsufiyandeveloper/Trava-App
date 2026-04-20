"use client";

import { createContext, useContext } from "react";
// import { TaskPageDataType, ProjectPageData, WorkspacePageData } from "@/data/task/get-task-page-data";

// Temporarily define placeholders as this file is currently unused and causing build errors
export type PageDataType = any;
type ProjectPageData = any;
type WorkspacePageData = any;

interface TaskPageContextType {
    pageData: PageDataType;
}

const TaskPageContext = createContext<TaskPageContextType | null>(null);

export function TaskPageProvider({
    children,
    pageData,
}: {
    children: React.ReactNode;
    pageData: PageDataType;
}) {
    return (
        <TaskPageContext.Provider value={{ pageData }}>
            {children}
        </TaskPageContext.Provider>
    );
}

/**
 * Hook to access page data (either project or workspace level)
 */
export function useTaskPageData() {
    const context = useContext(TaskPageContext);
    if (!context) {
        throw new Error("useTaskPageData must be used within TaskPageProvider");
    }
    return context.pageData;
}

/**
 * Type guard to check if page data is Project data
 */
export function isProjectData(data: PageDataType): data is ProjectPageData {
    return 'project' in data;
}

/**
 * Type guard to check if page data is Workspace data
 */
export function isWorkspaceData(data: PageDataType): data is WorkspacePageData {
    return 'workspace' in data;
}

/**
 * Hook specifically for Project level data
 * Throws if used outside a project context
 */
export function useProject() {
    const data = useTaskPageData();
    if (!isProjectData(data)) {
        throw new Error("useProject must be used within a Project level TaskPageProvider");
    }
    return data;
}
