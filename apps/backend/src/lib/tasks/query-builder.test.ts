import { describe, expect, it } from "vitest";
import { getTaskSelect } from "./query-builder";

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
