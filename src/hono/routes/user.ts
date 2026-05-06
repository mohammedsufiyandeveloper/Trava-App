import { Hono } from "hono";
import { HonoVariables } from "../types";
import prisma from "@/lib/db";
import { TaskStatus } from "@prisma/client";

const user = new Hono<{ Variables: HonoVariables }>();

/**
 * GET /api/user/profile
 * Fetches user profile with professional statistics
 */
user.get("/profile", async (c) => {
    const authUser = c.get("user");
    const userId = authUser.id;

    try {
        const userData = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                surname: true,
                email: true,
                image: true,
                phoneNumber: true,
                createdAt: true,
            } as any
        });
        
        console.log("[DEBUG] User Profile Data for ID", userId, ":", JSON.stringify(userData));

        if (!userData) {
            return c.json({ success: false, error: "User not found" }, 404);
        }

        // Calculate Professional Stats
        const projectMembers = await prisma.projectMember.findMany({
            where: {
                WorkspaceMember: {
                    userId: userId
                }
            },
            select: { id: true }
        });

        const pmIds = projectMembers.map(pm => pm.id);

        const [totalTasks, completedTasks] = await Promise.all([
            prisma.task.count({
                where: { assigneeId: { in: pmIds } }
            }),
            prisma.task.count({
                where: { 
                    assigneeId: { in: pmIds },
                    status: TaskStatus.COMPLETED
                }
            })
        ]);

        const joinDate = new Date((userData as any).createdAt);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - joinDate.getTime());
        const experienceDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return c.json({
            success: true,
            user: userData,
            stats: {
                totalTasks,
                completedTasks,
                experienceDays,
                completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
            }
        });
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 500);
    }
});

/**
 * PATCH /api/user/profile
 * Updates user professional metadata
 */
user.patch("/profile", async (c) => {
    const authUser = c.get("user");
    const userId = authUser.id;

    try {
        const body = await c.req.json();
        const { name, surname, phoneNumber, image } = body;

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (surname !== undefined) updateData.surname = surname;
        if (image !== undefined) updateData.image = image;
        if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;

        if (Object.keys(updateData).length === 0) {
            return c.json({ success: false, error: "No update data provided" }, 400);
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updateData as any
        });

        return c.json({
            success: true,
            user: updatedUser
        });
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 500);
    }
});

/**
 * POST /api/user/push-token
 * Registers an Expo push token for the user
 */
user.post("/push-token", async (c) => {
    const authUser = c.get("user");
    const userId = authUser.id;

    try {
        const body = await c.req.json();
        const { pushToken } = body;

        if (!pushToken) {
            return c.json({ success: false, error: "Push token is required" }, 400);
        }

        await prisma.user.update({
            where: { id: userId },
            data: { pushToken } as any
        });

        return c.json({ success: true });
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 500);
    }
});

export default user;
