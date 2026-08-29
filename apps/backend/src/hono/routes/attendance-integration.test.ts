import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/db";
import { attendanceIntegrationRouter } from "./attendance-integration";

const KEY = "a".repeat(48);

const app = new Hono().route("/integrations/attendance", attendanceIntegrationRouter);

const request = (path: string, key?: string) =>
    app.request(path, key ? { headers: { authorization: `Bearer ${key}` } } : undefined);

describe("attendance integration route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.TRAVA_ATTENDANCE_API_KEY = KEY;
        (prisma.workspaceMember.findMany as any).mockResolvedValue([]);
        (prisma.attendance.findMany as any).mockResolvedValue([]);
        (prisma.leave_request.findMany as any).mockResolvedValue([]);
    });

    afterEach(() => {
        delete process.env.TRAVA_ATTENDANCE_API_KEY;
    });

    const seedWorkspace = () => {
        (prisma.workspaceMember.findMany as any).mockResolvedValue([
            { id: "m1", user: { id: "u1", name: "Asha", surname: null, email: "asha@x.com" } },
            { id: "m2", user: { id: "u2", name: "Biju", surname: null, email: "biju@x.com" } },
            { id: "m3", user: { id: "u3", name: "Chan", surname: null, email: "chan@x.com" } },
            { id: "m4", user: { id: "u4", name: "Dev", surname: null, email: "dev@x.com" } },
            { id: "m5", user: { id: "u5", name: "Esha", surname: null, email: "esha@x.com" } },
            { id: "m6", user: { id: "u6", name: "Faiz", surname: null, email: "faiz@x.com" } },
        ]);
        (prisma.attendance.findMany as any).mockResolvedValue([
            {
                workspaceMemberId: "m1",
                status: "PRESENT",
                checkIn: new Date("2026-08-29T03:35:00.000Z"),
                checkOut: new Date("2026-08-29T12:05:00.000Z"),
            },
            {
                workspaceMemberId: "m2",
                status: "LATE",
                checkIn: new Date("2026-08-29T04:40:00.000Z"),
                checkOut: null,
            },
            { workspaceMemberId: "m3", status: "HALF_DAY", checkIn: null, checkOut: null },
            { workspaceMemberId: "m4", status: "ABSENT", checkIn: null, checkOut: null },
        ]);
        // m5 has approved leave, m6 has nothing at all -> absent.
        (prisma.leave_request.findMany as any).mockResolvedValue([{ workspaceMemberId: "m5" }]);
    };

    it("returns 503 when no key is configured on the server", async () => {
        delete process.env.TRAVA_ATTENDANCE_API_KEY;

        const response = await request("/integrations/attendance/summary?workspaceId=ws1", KEY);

        expect(response.status).toBe(503);
        expect(prisma.workspaceMember.findMany).not.toHaveBeenCalled();
    });

    it("rejects a missing or wrong bearer key", async () => {
        expect((await request("/integrations/attendance/summary?workspaceId=ws1")).status).toBe(401);
        expect(
            (await request("/integrations/attendance/summary?workspaceId=ws1", "b".repeat(48))).status
        ).toBe(401);
        expect(prisma.workspaceMember.findMany).not.toHaveBeenCalled();
    });

    it("requires a workspaceId", async () => {
        expect((await request("/integrations/attendance/summary", KEY)).status).toBe(400);
    });

    it("rejects a malformed date", async () => {
        const response = await request(
            "/integrations/attendance/summary?workspaceId=ws1&date=29-08-2026",
            KEY
        );

        expect(response.status).toBe(400);
    });

    it("counts present, late, half day, on leave and absent members", async () => {
        seedWorkspace();

        const response = await request(
            "/integrations/attendance/summary?workspaceId=ws1&date=2026-08-29",
            KEY
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            success: true,
            data: {
                workspaceId: "ws1",
                date: "2026-08-29",
                totalMembers: 6,
                present: 1,
                late: 1,
                absent: 2,
                halfDay: 1,
                onLeave: 1,
                checkedIn: 3,
                checkedOut: 1,
            },
        });

        expect(prisma.attendance.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    workspaceId: "ws1",
                    date: new Date("2026-08-29T00:00:00.000Z"),
                }),
            })
        );
    });

    it("lists the people behind the counts with include=people", async () => {
        seedWorkspace();

        const response = await request(
            "/integrations/attendance/summary?workspaceId=ws1&date=2026-08-29&include=people",
            KEY
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.data.people).toEqual([
            {
                userId: "u1",
                name: "Asha",
                email: "asha@x.com",
                status: "PRESENT",
                checkIn: "2026-08-29T03:35:00.000Z",
                checkOut: "2026-08-29T12:05:00.000Z",
            },
            {
                userId: "u2",
                name: "Biju",
                email: "biju@x.com",
                status: "LATE",
                checkIn: "2026-08-29T04:40:00.000Z",
                checkOut: null,
            },
            { userId: "u3", name: "Chan", email: "chan@x.com", status: "HALF_DAY", checkIn: null, checkOut: null },
            { userId: "u4", name: "Dev", email: "dev@x.com", status: "ABSENT", checkIn: null, checkOut: null },
            { userId: "u5", name: "Esha", email: "esha@x.com", status: "ON_LEAVE", checkIn: null, checkOut: null },
            { userId: "u6", name: "Faiz", email: "faiz@x.com", status: "ABSENT", checkIn: null, checkOut: null },
        ]);
        // The people list must agree with the counts.
        expect(body.data.present).toBe(1);
        expect(body.data.absent).toBe(2);
    });

    it("omits the people list by default", async () => {
        seedWorkspace();

        const response = await request("/integrations/attendance/summary?workspaceId=ws1", KEY);
        const body = await response.json();

        expect(body.data.people).toBeUndefined();
    });
});
