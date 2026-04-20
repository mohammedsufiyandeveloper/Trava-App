"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProjectRole } from"@prisma/client";
import { WorkspaceMembersResult } from "@/data/workspace";
import { ManageProjectMembersDialog } from "./manage-members-dialog";

interface ProjectMember {
    id: string;
    userId: string;
    userName: string;
    projectRole: ProjectRole;
}

interface ManageMembersButtonProps {
    projectId: string;
    projectName: string;
    currentMembers: ProjectMember[];
    workspaceMembers: WorkspaceMembersResult["workspaceMembers"];
    variant?: "default" | "outline" | "ghost" | "link" | "destructive" | "secondary";
    size?: "default" | "sm" | "lg" | "icon";
    className?: string;
}

/**
 * Button component to open the Manage Members dialog
 * Can be used anywhere in the project UI (sidebar, project settings, etc.)
 */
export const ManageMembersButton = ({
    projectId,
    projectName,
    currentMembers,
    workspaceMembers,
    variant = "outline",
    size = "default",
    className,
}: ManageMembersButtonProps) => {
    const [dialogOpen, setDialogOpen] = useState(false);

    return (
        <>
            <Button
                variant={variant}
                size={size}
                onClick={() => setDialogOpen(true)}
                className={className}
            >
                <Users className="h-4 w-4 mr-2" />
                Manage Members
            </Button>

            <ManageProjectMembersDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                projectId={projectId}
                projectName={projectName}
                currentMembers={currentMembers}
                workspaceMembers={workspaceMembers}
            />
        </>
    );
};
