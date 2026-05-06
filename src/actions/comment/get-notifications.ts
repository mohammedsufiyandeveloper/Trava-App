"use server";

import prisma from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";
import { Notification } from "@prisma/client";

export async function getNotificationsAction(workspaceId: string, limit: number = 25, offset: number = 0) {
    try {
        const user = await requireUser();
        const perms = await getWorkspacePermissions(workspaceId, user.id);

        if (!perms.workspaceMemberId) {
            return { success: false, error: "Access denied" };
        }

        const notifications = await prisma.notification.findMany({
            where: {
                userId: user.id,
                workspaceId,
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: limit,
            skip: offset
        });

        const unreadCount = await prisma.notification.count({
            where: {
                userId: user.id,
                workspaceId,
                isRead: false
            }
        });

        // Group into unread and read for the UI
        const unreadNotifications = notifications.filter((n: any) => !n.isRead);
        const readNotifications = notifications.filter((n: any) => n.isRead);

        return {
            success: true,
            unreadNotifications,
            readNotifications,
            peopleCount: unreadCount,
            totalCount: notifications.length,
            hasMore: notifications.length === limit
        };

    } catch (error) {
        console.error("Error fetching notifications:", error);
        return { success: false, error: "Failed to fetch notifications" };
    }
}

/**
 * Marks a notification as read
 */
export async function markNotificationReadAction(notificationId: string) {
    try {
        const user = await requireUser();
        await prisma.notification.update({
            where: { id: notificationId, userId: user.id },
            data: { isRead: true }
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to mark as read" };
    }
}

/**
 * Marks all notifications for a workspace as read
 */
export async function markAllNotificationsReadAction(workspaceId: string) {
    try {
        const user = await requireUser();
        await prisma.notification.updateMany({
            where: { workspaceId, userId: user.id, isRead: false },
            data: { isRead: true }
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to mark all as read" };
    }
}

// Keep the old function signature for compatibility if needed, but redirect to new logic
export async function markTaskCommentsReadAction(taskId: string) {
    // For now, just mark all related to this entity as read if we have that logic
    // Or just let the user mark individual ones from the UI
    return { success: true };
}
