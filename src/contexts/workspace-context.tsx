"use client";

import { createContext, useContext } from "react";
import type { WorkspaceData } from "@/data/workspace/get-workspace-by-id";

interface WorkspaceContextType {
    workspaceId: string;
    workspace: WorkspaceData;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({
    workspaceId,
    workspace,
    children,
}: {
    workspaceId: string;
    workspace: WorkspaceData;
    children: React.ReactNode;
}) {
    return (
        <WorkspaceContext.Provider value={{ workspaceId, workspace }}>
            {children}
        </WorkspaceContext.Provider>
    );
}

export function useWorkspace() {
    const context = useContext(WorkspaceContext);
    if (!context) {
        throw new Error("useWorkspace must be used within a WorkspaceProvider");
    }
    return context;
}

/**
 * Hook to get just the workspaceId (for convenience)
 */
export function useWorkspaceId() {
    const { workspaceId } = useWorkspace();
    return workspaceId;
}
