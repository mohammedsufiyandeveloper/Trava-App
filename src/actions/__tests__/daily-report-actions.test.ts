import { describe, it, expect, vi, beforeEach } from "vitest";
import { submitDailyReport } from "../daily-report-actions";
import { requireUser } from "@/lib/auth/require-user";
import prisma from "@/lib/db";

describe("Daily Report Actions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const validWorkspaceId = "846e17c7-d85f-4453-9ca0-0acc7bfce49c";
    const validTaskId = "846e17c7-d85f-4453-9ca0-0acc7bfce49d";

    describe("submitDailyReport", () => {
        const reportData = {
            workspaceId: validWorkspaceId,
            date: "2024-03-20",
            entries: [
                { taskId: validTaskId, description: "Worked on UI implementation for several hours" },
                { taskId: "846e17c7-d85f-4453-9ca0-0acc7bfce49e", description: "Internal team meeting regarding sprint planning" }
            ]
        };

        it("should successfully submit a report with valid entries", async () => {
            (requireUser as any).mockResolvedValue({ id: "user_1", email: "user@example.com" });
            (prisma.dailyReport.findUnique as any).mockResolvedValue(null);
            (prisma.dailyReport.create as any).mockResolvedValue({ id: "dr_1" });
            
            const result = await submitDailyReport(reportData);

            expect(result.success).toBe(true);
            expect(prisma.$transaction).toHaveBeenCalled();
        });

        it("should transition from ABSENT to SUBMITTED if report exists", async () => {
            (requireUser as any).mockResolvedValue({ id: "user_1" });
            (prisma.dailyReport.findUnique as any).mockResolvedValue({ id: "dr_absent", status: "ABSENT" });
            (prisma.dailyReport.update as any).mockResolvedValue({ id: "dr_absent", status: "SUBMITTED" });

            const result = await submitDailyReport(reportData);

            expect(result.success).toBe(true);
            expect(prisma.dailyReport.update).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ status: "SUBMITTED" })
            }));
        });

        it("should fail if validation fails (missing entries)", async () => {
            (requireUser as any).mockResolvedValue({ id: "user_1" });
            
            await expect(submitDailyReport({
                ...reportData,
                entries: [] 
            })).rejects.toThrow();
        });
    });
});
