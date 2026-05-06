import { Expo, ExpoPushMessage } from "expo-server-sdk";
import prisma from "./db";
import { pusherServer } from "./pusher";

const expo = new Expo();

interface SendNotificationOptions {
    userId: string;
    workspaceId: string;
    title: string;
    body: string;
    type: string;
    entityType?: string;
    entityId?: string;
    metadata?: any;
}

/**
 * Unified notification service that:
 * 1. Saves to DB
 * 2. Broadcasts via Pusher (Web)
 * 3. Sends Push Notification (Mobile)
 */
export async function sendNotification(options: SendNotificationOptions) {
    const { userId, workspaceId, title, body, type, entityType, entityId, metadata } = options;

    try {
        // 1. Save to Database
        const notification = await prisma.notification.create({
            data: {
                userId,
                workspaceId,
                title,
                body,
                type,
                entityType,
                entityId,
                metadata: metadata || {},
            }
        });

        // 2. Broadcast via Pusher (for real-time Web UI)
        if (pusherServer) {
            await pusherServer.trigger(`user-${userId}`, "new_notification", {
                ...notification,
                receivedAt: notification.createdAt,
            }).catch(err => console.error("[PUSHER_NOTIFICATION_ERROR]", err));
        }

        // 3. Send Push Notification (for Mobile)
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { pushToken: true }
        });

        if (user?.pushToken && Expo.isExpoPushToken(user.pushToken)) {
            const message: ExpoPushMessage = {
                to: user.pushToken,
                sound: "default",
                title,
                body,
                data: {
                    ...(metadata || {}),
                    entityId,
                    entityType,
                    type,
                    notificationId: notification.id
                },
            };

            await expo.sendPushNotificationsAsync([message])
                .catch(err => console.error("[PUSH_NOTIFICATION_ERROR]", err));
        }

        return { success: true, notification };
    } catch (error) {
        console.error("[SEND_NOTIFICATION_ERROR]", error);
        return { success: false, error };
    }
}

/**
 * Utility to find all admins and owners in a workspace
 */
export async function getWorkspaceAdmins(workspaceId: string) {
    const members = await prisma.workspaceMember.findMany({
        where: {
            workspaceId,
            workspaceRole: { in: ["ADMIN", "OWNER"] }
        },
        select: { userId: true }
    });
    return members.map(m => m.userId);
}

/**
 * Sends a notification to multiple users
 */
export async function sendNotificationToUsers(
    userIds: string[],
    options: Omit<SendNotificationOptions, "userId">
) {
    return Promise.all(
        userIds.map(userId => sendNotification({ ...options, userId }))
    );
}
