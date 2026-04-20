"use server";

import prisma from "@/lib/db";

export type ProjectReviewer = {
    id: string;
    surname: string;
    role: string;
};

export async function getProjectReviewers(projectId: string): Promise<ProjectReviewer[]> {

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { workspaceId: true }
    });

    if (!project) return [];

    const admins = await prisma.workspaceMember.findMany({
        where: {
            workspaceId: project.workspaceId,
            workspaceRole: { in: ["OWNER", "ADMIN"] }
        },
        include: { user: true }
    });

    const projectLeaders = await prisma.projectMember.findMany({
        where: {
            projectId: projectId,
            projectRole: { in: ["PROJECT_MANAGER", "LEAD"] }
        },
        include: {
            WorkspaceMember: {
                include: {
                    user: {
                        select: { id: true, surname: true }
                    }
                }
            }
        }
    });

    const reviewerMap = new Map<string, ProjectReviewer>();

    admins.forEach(m => {
        reviewerMap.set(m.userId, {
            id: m.userId,
            surname: m.user.surname || "",
            role: m.workspaceRole
        });
    });

    projectLeaders.forEach(pm => {
        const userId = (pm as any).WorkspaceMember.userId;
        const user = (pm as any).WorkspaceMember.user;
        const current = reviewerMap.get(userId);

        if (!current) {
            reviewerMap.set(userId, {
                id: userId,
                surname: user?.surname || "",
                role: pm.projectRole
            });
        }
    });
    return Array.from(reviewerMap.values());
}
