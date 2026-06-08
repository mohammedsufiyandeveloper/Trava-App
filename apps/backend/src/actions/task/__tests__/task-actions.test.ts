import { describe, it, expect, vi, beforeEach } from "vitest";
import { bulkUploadTasksAndSubtasks } from "../bulk-create-taskAndSubTask";
import { requireUser } from "@/lib/auth/require-user";
import { getUserPermissions } from "@/data/user/get-user-permissions";
import prisma from "@/lib/db";

describe("Task Actions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const validWorkspaceId = "846e17c7-d85f-4453-9ca0-0acc7bfce49c";
    const validProjectId = "846e17c7-d85f-4453-9ca0-0acc7bfce49d";

    describe("bulkUploadTasksAndSubtasks", () => {
        const bulkData = {
            projectId: validProjectId,
            tasks: [
                {
                    taskName: "Parent Task 1",
                    subtaskName: "Subtask A",
                    assigneeEmail: "member@example.com",
                    startDate: "2024-12-01",
                    days: 5,
                }
            ]
        };

        it("should fail if no tasks are provided", async () => {
             const result = await bulkUploadTasksAndSubtasks({ projectId: validProjectId, tasks: [] });
             expect(result.status).toBe("error");
             expect(result.message).toBe("No tasks provided");
        });

        it("should successfully bulk upload if user has permission", async () => {
            (requireUser as any).mockResolvedValue({ id: "user_admin", email: "admin@example.com" });
            (prisma.project.findUnique as any).mockResolvedValue({ workspaceId: validWorkspaceId });
            (getUserPermissions as any).mockResolvedValue({
                WorkspaceMember: { id: "wm_admin" },
                projectMember: { id: "pm_admin" },
                isProjectManager: true
            });
            (prisma.projectMember.findMany as any).mockResolvedValue([
                { id: "pm_admin", WorkspaceMember: { user: { email: "admin@example.com", id: "user_admin" } } },
                { id: "pm_member", WorkspaceMember: { user: { email: "member@example.com", id: "user_member" } } }
            ]);
            (prisma.tag.findMany as any).mockResolvedValue([]);
            
            const result = await bulkUploadTasksAndSubtasks(bulkData);

            expect(result.status).toBe("success");
            expect(result.message).toContain("Successfully created 1 task");
            expect(prisma.$transaction).toHaveBeenCalled();
        });

        it("should fail if assignee email is not in project", async () => {
            (requireUser as any).mockResolvedValue({ id: "user_admin", email: "admin@example.com" });
            (prisma.project.findUnique as any).mockResolvedValue({ workspaceId: validWorkspaceId });
            (getUserPermissions as any).mockResolvedValue({
                WorkspaceMember: { id: "wm_admin" },
                projectMember: { id: "pm_admin" },
                isProjectManager: true
            });
            (prisma.projectMember.findMany as any).mockResolvedValue([
                // member@example.com is MISSING
                { id: "pm_admin", WorkspaceMember: { user: { email: "admin@example.com", id: "user_admin" } } }
            ]);

            const result = await bulkUploadTasksAndSubtasks(bulkData);

            expect(result.status).toBe("error");
            expect(result.message).toContain("not members of this project");
        });

        it("should fail if date format is invalid", async () => {
            (requireUser as any).mockResolvedValue({ id: "user_admin", email: "admin@example.com" });
            (prisma.project.findUnique as any).mockResolvedValue({ workspaceId: validWorkspaceId });
            (getUserPermissions as any).mockResolvedValue({
                WorkspaceMember: { id: "wm_admin" },
                projectMember: { id: "pm_admin" },
                isProjectManager: true
            });
            (prisma.projectMember.findMany as any).mockResolvedValue([
                { id: "pm_admin", WorkspaceMember: { user: { email: "admin@example.com", id: "user_admin" } } },
                { id: "pm_member", WorkspaceMember: { user: { email: "member@example.com", id: "user_member" } } }
            ]);

            const result = await bulkUploadTasksAndSubtasks({
                ...bulkData,
                tasks: [{ ...bulkData.tasks[0], startDate: "invalid-date" }]
            });

            expect(result.status).toBe("error");
            expect(result.message).toContain("Invalid date format");
        });

        it("should fail if days value is negative", async () => {
            (requireUser as any).mockResolvedValue({ id: "user_admin", email: "admin@example.com" });
            (prisma.project.findUnique as any).mockResolvedValue({ workspaceId: validWorkspaceId });
            (getUserPermissions as any).mockResolvedValue({
                WorkspaceMember: { id: "wm_admin" },
                projectMember: { id: "pm_admin" },
                isProjectManager: true
            });
            (prisma.projectMember.findMany as any).mockResolvedValue([
                { id: "pm_admin", WorkspaceMember: { user: { email: "admin@example.com", id: "user_admin" } } },
                { id: "pm_member", WorkspaceMember: { user: { email: "member@example.com", id: "user_member" } } }
            ]);

            const result = await bulkUploadTasksAndSubtasks({
                ...bulkData,
                tasks: [{ ...bulkData.tasks[0], days: -5 }]
            });

            expect(result.status).toBe("error");
            expect(result.message).toContain("Invalid days value");
        });
    });
});
