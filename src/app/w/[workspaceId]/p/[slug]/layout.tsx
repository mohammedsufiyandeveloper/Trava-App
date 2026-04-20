import { Suspense } from "react";
import { getProjectMetadata } from "@/data/project/get-project-metadata";
import ProjectHeader from "./_components/layout/project-header";
import { TaskPageWrapper } from "@/app/w/[workspaceId]/_components/shared/task-page-wrapper";

async function ProjectHeaderLoader({
    workspaceId,
    slug,
}: {
    workspaceId: string;
    slug: string;
}) {
    const project = await getProjectMetadata(workspaceId, slug);

    if (!project) {
        return (
            <div className="space-y-4">
                <div className="p-6">
                    <h1 className="text-2xl font-semibold">Access Denied</h1>
                    <p className="text-muted-foreground">
                        You don&apos;t have permission to access this project or it doesn&apos;t exist.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <ProjectHeader
            workspaceId={workspaceId}
            slug={slug}
            projectId={project.id}
            projectName={project.name}
            projectColor={project.color}
            userId={project.userId}
            canPerformBulkOperations={project.canPerformBulkOperations}
        />
    );
}

export default async function ProjectLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{
        workspaceId: string;
        slug: string;
    }>;
}) {
    const { workspaceId, slug } = await params;

    return (
        <TaskPageWrapper>
            <div className="flex flex-col gap-4 pb-3 px-0 h-full">
                <Suspense fallback={null}>
                    <ProjectHeaderLoader workspaceId={workspaceId} slug={slug} />
                </Suspense>

                <div className="flex-1">{children}</div>
            </div>
        </TaskPageWrapper>
    );
}
