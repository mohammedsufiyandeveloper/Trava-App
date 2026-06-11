import { describe, expect, it } from "vitest";
import { buildWorkspaceFilterWhere, getTaskSelect } from "./query-builder";

describe("getTaskSelect", () => {
    it("keeps list rows compact and excludes full task detail fields", () => {
        const select = getTaskSelect("list") as any;

        expect(select.description).toBeUndefined();
        expect(select.createdBy).toBeUndefined();
        expect(select.project.select.projectMembers.where).toEqual({
            projectRole: { in: ["PROJECT_MANAGER", "LEAD"] },
        });
        expect(
            select.project.select.projectMembers.select.WorkspaceMember.select.user.select.email
        ).toBeUndefined();
        expect(select.reviewer).toBeDefined();
    });

    it("uses a compact Kanban projection", () => {
        const select = getTaskSelect("kanban") as any;

        expect(select.description).toBeUndefined();
        expect(select.createdBy).toBeUndefined();
        expect(select.reviewer).toBeUndefined();
        expect(select._count.select).toEqual({ Activity: true });
        expect(select.project.select.projectMembers).toBeDefined();
    });

    it("does not repeat project managers or tags in Gantt rows", () => {
        const select = getTaskSelect("gantt") as any;

        expect(select.description).toBeUndefined();
        expect(select.project.select.projectMembers).toBeUndefined();
        expect(select.Tag).toBeUndefined();
        expect(select._count).toBeUndefined();
        expect(select.Task_TaskDependency_A).toBeDefined();
    });
});

describe("buildWorkspaceFilterWhere", () => {
    it("returns all subtasks from projects a manager can fully access", () => {
        const where = buildWorkspaceFilterWhere(
            {
                workspaceId: "workspace-1",
                fullAccessProjectIds: ["managed-project"],
                restrictedProjectIds: [],
                onlySubtasks: true,
                view_mode: "list",
                isAdmin: false,
            },
            "manager-1"
        );

        expect(where).toMatchObject({
            workspaceId: "workspace-1",
            projectId: { in: ["managed-project"] },
            parentTaskId: { not: null },
            isParent: false,
        });
        expect(where.OR).toBeUndefined();
        expect(where.AND).toBeUndefined();
    });

    it("keeps restricted-project subtasks scoped to the current member", () => {
        const where = buildWorkspaceFilterWhere(
            {
                workspaceId: "workspace-1",
                fullAccessProjectIds: [],
                restrictedProjectIds: ["member-project"],
                onlySubtasks: true,
                view_mode: "list",
                isAdmin: false,
            },
            "member-1"
        );

        expect(where).toMatchObject({
            workspaceId: "workspace-1",
            projectId: { in: ["member-project"] },
            parentTaskId: { not: null },
            isParent: false,
            OR: expect.arrayContaining([
                { assigneeId: "member-1" },
                {
                    ProjectMember_Task_assigneeIdToProjectMember: {
                        WorkspaceMember: { userId: "member-1" },
                    },
                },
            ]),
        });
    });
});
