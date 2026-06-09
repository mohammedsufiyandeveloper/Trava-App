const manager = (index) => ({
    projectRole: index === 0 ? "PROJECT_MANAGER" : "LEAD",
    WorkspaceMember: {
        user: {
            id: `manager-${index}`,
            name: `Manager ${index}`,
            surname: `Surname ${index}`,
            image: `https://example.com/manager-${index}.png`,
        },
    },
});

const member = (index) => ({
    projectRole: index < 2 ? "PROJECT_MANAGER" : "MEMBER",
    WorkspaceMember: {
        user: {
            id: `user-${index}`,
            name: `User ${index}`,
            surname: `Surname ${index}`,
            image: `https://example.com/user-${index}.png`,
            email: `user-${index}@example.com`,
        },
    },
});

const oldTask = (index) => ({
    id: `task-${index}`,
    name: `Task ${index}`,
    taskSlug: `task-${index}`,
    description: "Representative task description repeated in collection responses.",
    status: "TO_DO",
    dueDate: "2026-06-30T00:00:00.000Z",
    startDate: "2026-06-01T00:00:00.000Z",
    createdAt: "2026-06-09T00:00:00.000Z",
    projectId: "project-1",
    parentTaskId: "parent-1",
    isParent: false,
    createdBy: {
        id: "creator-1",
        WorkspaceMember: { user: { id: "creator-user", surname: "Creator" } },
    },
    project: {
        id: "project-1",
        name: "Large Project",
        color: "#4F46E5",
        projectMembers: Array.from({ length: 20 }, (_, memberIndex) => member(memberIndex)),
    },
    reviewer: {
        id: "reviewer-1",
        WorkspaceMember: { user: { id: "reviewer-user", name: "Reviewer" } },
    },
    Tag: [{ id: "tag-1", name: "Urgent" }],
    _count: { Activity: 3, subTasks: 0 },
});

const optimizedTask = (index) => ({
    id: `task-${index}`,
    name: `Task ${index}`,
    status: "TO_DO",
    dueDate: "2026-06-30T00:00:00.000Z",
    startDate: "2026-06-01T00:00:00.000Z",
    createdAt: "2026-06-09T00:00:00.000Z",
    projectId: "project-1",
    parentTaskId: "parent-1",
    isParent: false,
    project: {
        id: "project-1",
        name: "Large Project",
        color: "#4F46E5",
        projectMembers: [manager(0), manager(1)],
    },
    Tag: [{ id: "tag-1", name: "Urgent" }],
    _count: { Activity: 3 },
});

const bytes = (value) => Buffer.byteLength(JSON.stringify(value), "utf8");
const report = [1, 15, 100].map((count) => {
    const oldBytes = bytes(Array.from({ length: count }, (_, index) => oldTask(index)));
    const optimizedBytes = bytes(
        Array.from({ length: count }, (_, index) => optimizedTask(index))
    );
    return {
        tasks: count,
        oldBytes,
        optimizedBytes,
        reductionPercent: Number(
            ((1 - optimizedBytes / oldBytes) * 100).toFixed(1)
        ),
    };
});

console.table(report);
