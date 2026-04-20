"use client";

import { ProjectNav } from "./project-nav";
import { CreateTaskForm } from "../forms/create-task-form";
import { BulkUploadForm } from "../forms/bulk-upload-form";

interface ProjectHeaderProps {
    workspaceId: string;
    slug: string;
    projectId: string;
    projectName: string;
    projectColor: string | null;
    userId: string;
    canPerformBulkOperations: boolean;
}

function ProjectHeader({
    workspaceId,
    slug,
    projectId,
    projectName,
    projectColor,
    userId,
    canPerformBulkOperations,
}: ProjectHeaderProps) {
    return (
        <>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-normal leading-tight tracking-tighter md:text-2xl flex items-center gap-2 sm:gap-3">
                        {projectName}
                        <div
                            className="h-3 w-3 md:h-5 md:w-5 rounded-full border shadow-sm transition-colors shrink-0"
                            style={{ backgroundColor: projectColor || '#888' }}
                        />
                    </h1>
                    {/* <p className="text-sm md:text-base text-muted-foreground">Manage your project tasks</p> */}
                </div>

                {canPerformBulkOperations && (
                    <div className="flex items-center gap-2 shrink-0">
                        <BulkUploadForm projectId={projectId} />
                        <CreateTaskForm
                            workspaceId={workspaceId}
                            projectId={projectId}
                        />
                    </div>
                )}
            </div>

            <ProjectNav workspaceId={workspaceId} slug={slug} />
        </>
    );
}

export default ProjectHeader;
