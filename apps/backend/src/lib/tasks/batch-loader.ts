import prisma from "@/lib/db";

// ============================================================
//  BATCH LOADER: Users
//  Instead of a JOIN on every task, collect unique IDs and
//  fire a single IN() query.  O(1) lookup via Map.
// ============================================================
export async function batchLoadUsers(ids: (string | null | undefined)[]) {
    const unique = [...new Set(ids.filter(Boolean))] as string[];
    if (unique.length === 0) return new Map<string, any>();

    const users = await prisma.user.findMany({
        where: { id: { in: unique } },
        select: { id: true, name: true, surname: true, image: true, email: true },
    });

    return new Map(users.map(u => [u.id, u]));
}

// ============================================================
//  BATCH LOADER: Tags
// ============================================================
export async function batchLoadTags(ids: (string | null | undefined)[]) {
    const unique = [...new Set(ids.filter(Boolean))] as string[];
    if (unique.length === 0) return new Map<string, any>();

    const tags = await prisma.tag.findMany({
        where: { id: { in: unique } },
        select: { id: true, name: true },
    });

    return new Map(tags.map(t => [t.id, t]));
}

// ============================================================
//  BATCH LOADER: Projects (lean — no member joins)
// ============================================================
export async function batchLoadProjects(ids: (string | null | undefined)[]) {
    const unique = [...new Set(ids.filter(Boolean))] as string[];
    if (unique.length === 0) return new Map<string, any>();

    const projects = await prisma.project.findMany({
        where: { id: { in: unique } },
        select: {
            id: true,
            name: true,
            slug: true,
            color: true,
            workspaceId: true,
            projectMembers: {
                where: { projectRole: { in: ["PROJECT_MANAGER", "LEAD"] }, hasAccess: true },
                take: 2,
                select: {
                    projectRole: true,
                    WorkspaceMember: {
                        select: {
                            user: {
                                select: {
                                    surname: true,
                                }
                            }
                        }
                    }
                }
            }
        },
    });

    return new Map(projects.map(p => [p.id, p]));
}

// ============================================================
//  HYDRATOR: Attach batch-loaded entities to raw tasks
//  Now resolves user info through ProjectMember → WorkspaceMember → User
// ============================================================
export async function hydrateTasks<T extends {
    id: string;
    assigneeId: string | null;
    reviewerId: string | null;
    createdById: string;
    tagId: string | null;
    projectId: string;
}>(
    tasks: T[],
    _userMap: Map<string, any>,
    tagMap: Map<string, any>,
    projectMap: Map<string, any>
) {
    // Collect unique ProjectMember IDs from all three fields
    const memberIds = new Set<string>();
    tasks.forEach(task => {
        if (task.assigneeId) memberIds.add(task.assigneeId);
        if (task.createdById) memberIds.add(task.createdById);
        if (task.reviewerId) memberIds.add(task.reviewerId);
    });

    if (memberIds.size === 0) {
        return tasks.map(task => ({
            ...task,
            assignee: null,
            reviewer: null,
            createdBy: null,
            tag: task.tagId ? tagMap.get(task.tagId) ?? null : null,
            project: projectMap.get(task.projectId) ?? null,
        }));
    }

    // Batch load all ProjectMembers with their WorkspaceMember → User chain
    const projectMembers = await prisma.projectMember.findMany({
        where: { id: { in: Array.from(memberIds) } },
        include: {
            WorkspaceMember: {
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            surname: true,
                            image: true,
                        },
                    },
                },
            },
        },
    });

    // Build a map: ProjectMember.id → { user info }
    const memberMap = new Map<string, {
        id: string;
        name: string;
        surname: string | null;
        image: string | null;
    }>();

    projectMembers.forEach(pm => {
        const user = (pm as any).WorkspaceMember.user;
        memberMap.set(pm.id, {
            id: user.id,
            name: user.name,
            surname: user.surname,
            image: user.image,
        });
    });

    // Hydrate tasks with user info from the member chain
    return tasks.map(task => ({
        ...task,
        assignee: task.assigneeId ? memberMap.get(task.assigneeId) ?? null : null,
        reviewer: task.reviewerId ? memberMap.get(task.reviewerId) ?? null : null,
        createdBy: memberMap.get(task.createdById) ?? null,
        tag: task.tagId ? tagMap.get(task.tagId) ?? null : null,
        project: projectMap.get(task.projectId) ?? null,
    }));
}
