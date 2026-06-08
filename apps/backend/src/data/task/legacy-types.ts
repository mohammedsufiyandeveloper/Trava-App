/**
 * WorkspaceTaskType — The shared task shape returned by the data access layer.
 * 
 * MIGRATION NOTES:
 * - 'position': Removed from schema. Kept as optional here for type compat.
 * - 'isPinned' / 'pinnedAt': Removed from schema. Optional stubs kept.
 * - 'parentTask': Now batch-loaded; present after hydration.
 * - 'assignee' / 'reviewer' / 'tag' / 'createdBy': Batch-loaded — present as resolved objects.
 */
export type WorkspaceTaskType = {
    id: string;
    name: string;
    status: string | null;
    taskSlug: string;
    description: string | null;
    startDate: Date | null;
    dueDate: Date | null;
    days: number | null;
    projectId: string;
    workspaceId?: string;
    parentTaskId?: string | null;
    isParent?: boolean;
    // Removed from schema — optional for backwards compat
    isPinned?: boolean;
    pinnedAt?: Date | null;
    position?: number;
    createdAt: Date;
    updatedAt?: Date;
    createdById: string;
    reviewerId: string | null;
    assigneeId: string | null;          // raw FK (from TASK_CORE_SELECT)
    tagId?: string | null;               // raw FK (from TASK_CORE_SELECT)

    // Hydrated relations — present after batch-loading
    assignee?: {
        id: string;
        name: string | null;
        surname: string | null;
        image: string | null;
        WorkspaceMember?: {
            user: {
                id: string;
                name: string | null;
                surname: string | null;
            }
        }
    } | null;
    reviewer?: {
        id: string;
        name: string | null;
        surname: string | null;
        image: string | null;
        WorkspaceMember?: {
            user: {
                id: string;
                name: string | null;
                surname: string | null;
            }
        }
    } | null;
    createdBy?: {
        id: string;
        name: string | null;
        surname: string | null;
        image: string | null;
        workspaceMember?: {
            user: {
                id: string;
                name: string | null;
                surname: string | null;
            }
        }
    } | null;
    parentTask?: {
        id: string;
        name: string;
        taskSlug: string;
        reviewerId?: string | null;
        reviewer?: {
            id: string;
            surname: string | null;
            name: string | null;
            image: string | null;
        } | null;
    } | null;
    project?: {
        id: string;
        name: string;
        slug: string;
        color: string;
        workspaceId: string;
        projectMembers?: {
            WorkspaceMember: {
                user: {
                    name: string | null;
                    surname: string | null;
                    image: string | null;
                };
            };
        }[];
    } | null;
    tag?: {
        id: string;
        name: string;
    } | null;
    subtaskCount: number;
    completedSubtaskCount: number;
    _count: {
        subTasks?: number;
        Activity: number;
    };
};
