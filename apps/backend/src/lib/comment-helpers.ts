import prisma from "@/lib/db";

/**
 * Check if a user is authorized to comment on a task
 * Only workspace admins, project leads, and assigned users can comment
 */
export async function canUserCommentOnTask(
    userId: string,
    taskId: string
): Promise<boolean> {
    const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: {
            project: {
                include: {
                    workspace: {
                        include: {
                            members: {
                                where: { userId },
                                select: { workspaceRole: true }
                            }
                        }
                    },
                    projectMembers: {
                        where: {
                            WorkspaceMember: { userId: userId }
                        },
                        select: { projectRole: true }
                    }
                }
            },

        }
    });

    if (!task) return false;

    // Check if user is workspace admin
    const workspaceMember = task.project.workspace.members[0];
    if (workspaceMember?.workspaceRole === 'ADMIN') return true;

    // Check if user is project lead
    const projectMember = task.project.projectMembers[0];
    if (projectMember?.projectRole === 'LEAD') return true;

    // Check if user is assigned to the task
    if (task.assigneeId === userId) return true;

    return false;
}

/**
 * Get the depth of a comment in the reply thread
 * Useful for limiting nesting depth
 */
export async function getCommentDepth(commentId: string): Promise<number> {
    let depth = 0;
    let currentId: string | null = commentId;

    while (currentId) {
        const comment: { parentCommentId: string | null } | null = await prisma.comment.findUnique({
            where: { id: currentId },
            select: { parentCommentId: true }
        });

        if (!comment?.parentCommentId) break;
        currentId = comment.parentCommentId;
        depth++;

        // Safety limit to prevent infinite loops
        if (depth > 100) break;
    }

    return depth;
}

/**
 * Get all comments for a task with nested replies
 */
export async function getTaskComments(taskId: string, includeDeleted = false) {
    return await prisma.comment.findMany({
        where: {
            taskId,
            parentCommentId: null, // Only top-level comments
            ...(includeDeleted ? {} : { isDeleted: false }),
        },
        include: {
            user: {
                select: {
                    id: true,
                    // name: true,
                    surname: true,
                    // image: true,
                    // email: true,
                }
            },
            replies: {
                where: includeDeleted ? {} : { isDeleted: false },
                include: {
                    user: {
                        select: {
                            id: true,
                            // name: true,
                            surname: true,
                            // image: true,
                            // email: true,
                        }
                    },
                    // Include one level of nested replies
                    replies: {
                        where: includeDeleted ? {} : { isDeleted: false },
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    // name: true,
                                    surname: true,
                                    // image: true,
                                    // email: true,
                                }
                            }
                        },
                        orderBy: { createdAt: 'asc' }
                    }
                },
                orderBy: { createdAt: 'asc' }
            }
        },
        orderBy: { createdAt: 'asc' }
    });
}

/**
 * Get paginated comments for a task
 */
export async function getTaskCommentsPaginated(
    taskId: string,
    page = 0,
    pageSize = 20
) {
    const [comments, total] = await Promise.all([
        prisma.comment.findMany({
            where: {
                taskId,
                parentCommentId: null,
                isDeleted: false,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        // name: true,
                        surname: true,
                        // image: true,
                        // email: true,
                    }
                },
                _count: {
                    select: { replies: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: pageSize,
            skip: page * pageSize,
        }),
        prisma.comment.count({
            where: {
                taskId,
                parentCommentId: null,
                isDeleted: false,
            }
        })
    ]);

    return {
        comments,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        hasMore: (page + 1) * pageSize < total,
    };
}

/**
 * Create a new comment
 */
export async function createComment(data: {
    content: string;
    userId: string;
    taskId: string;
    parentCommentId?: string;
}) {
    // Check authorization
    const canComment = await canUserCommentOnTask(data.userId, data.taskId);
    if (!canComment) {
        throw new Error("You don't have permission to comment on this task");
    }

    // Check reply depth if it's a reply
    if (data.parentCommentId) {
        const depth = await getCommentDepth(data.parentCommentId);
        if (depth >= 5) { // Max 5 levels of nesting
            throw new Error("Maximum reply depth reached");
        }
    }

    return await prisma.comment.create({
        data: {
            content: data.content,
            userId: data.userId,
            taskId: data.taskId,
            parentCommentId: data.parentCommentId,
        },
        include: {
            user: {
                select: {
                    id: true,
                    // name: true,
                    surname: true,
                    // image: true,
                    // email: true,
                }
            }
        }
    });
}

/**
 * Edit a comment
 */
export async function editComment(
    commentId: string,
    userId: string,
    newContent: string
) {
    // Verify ownership
    const comment = await prisma.comment.findUnique({
        where: { id: commentId },
        select: { userId: true, isDeleted: true }
    });

    if (!comment) {
        throw new Error("Comment not found");
    }

    if (comment.isDeleted) {
        throw new Error("Cannot edit deleted comment");
    }

    if (comment.userId !== userId) {
        throw new Error("You can only edit your own comments");
    }

    return await prisma.comment.update({
        where: { id: commentId },
        data: {
            content: newContent,
            isEdited: true,
            editedAt: new Date(),
        },
        include: {
            user: {
                select: {
                    id: true,
                    // name: true,
                    surname: true,
                    // image: true,
                    // email: true,
                }
            }
        }
    });
}

/**
 * Soft delete a comment
 */
export async function deleteComment(commentId: string, userId: string) {
    // Verify ownership
    const comment = await prisma.comment.findUnique({
        where: { id: commentId },
        select: { userId: true, isDeleted: true }
    });

    if (!comment) {
        throw new Error("Comment not found");
    }

    if (comment.isDeleted) {
        throw new Error("Comment already deleted");
    }

    if (comment.userId !== userId) {
        throw new Error("You can only delete your own comments");
    }

    return await prisma.comment.update({
        where: { id: commentId },
        data: {
            isDeleted: true,
            deletedAt: new Date(),
        }
    });
}

/**
 * Restore a soft-deleted comment
 */
export async function restoreComment(commentId: string, userId: string) {
    // Verify ownership
    const comment = await prisma.comment.findUnique({
        where: { id: commentId },
        select: { userId: true, isDeleted: true }
    });

    if (!comment) {
        throw new Error("Comment not found");
    }

    if (!comment.isDeleted) {
        throw new Error("Comment is not deleted");
    }

    if (comment.userId !== userId) {
        throw new Error("You can only restore your own comments");
    }

    return await prisma.comment.update({
        where: { id: commentId },
        data: {
            isDeleted: false,
            deletedAt: null,
        }
    });
}

/**
 * Get comment count for a task
 */
export async function getTaskCommentCount(taskId: string): Promise<number> {
    return await prisma.comment.count({
        where: {
            taskId,
            isDeleted: false,
        }
    });
}

/**
 * Get user's comments across all tasks
 */
export async function getUserComments(userId: string, limit = 50) {
    return await prisma.comment.findMany({
        where: {
            userId,
            isDeleted: false,
        },
        include: {
            task: {
                select: {
                    id: true,
                    name: true,
                    taskSlug: true,
                }
            }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
    });
}
