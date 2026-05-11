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

        // 2. Check if user is online via Pusher occupancy
        let isOnline = false;
        if (pusherServer) {
            try {
                const response: any = await pusherServer.get({ path: `/channels/user-${userId}` });
                if (response.status === 200) {
                    const result = JSON.parse(response.body);
                    isOnline = result.occupied;
                }
                console.log(`[NOTIF_DEBUG] User ${userId} occupancy check: status=${response.status}, occupied=${isOnline}`);
            } catch (err) {
                console.error("[NOTIF_DEBUG] Failed to check Pusher occupancy:", err);
                // Fallback to true if check fails to ensure delivery
                isOnline = true;
            }
        }

        // 3. Broadcast via Pusher ONLY if online
        if (pusherServer && isOnline) {
            console.log(`[NOTIF_DEBUG] Broadcasting to user-${userId} via Pusher`);
            await pusherServer.trigger(`user-${userId}`, "new_notification", {
                ...notification,
                receivedAt: notification.createdAt,
            }).catch(err => console.error("[PUSHER_NOTIFICATION_ERROR]", err));
        } else {
            console.log(`[NOTIF_DEBUG] Skipping Pusher broadcast (User is offline)`);
        }

        // 4. Send Push Notification (for Mobile)
        // If they are offline, definitely send. If online, we still send (foreground notification handled by app).
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { pushToken: true }
        });

        console.log(`[PUSH_DEBUG] User ${userId} token: ${user?.pushToken ? "Found" : "Missing"}`);

        if (user?.pushToken && Expo.isExpoPushToken(user.pushToken)) {
            console.log(`[PUSH_DEBUG] Sending to ${user.pushToken.slice(0, 20)}...`);
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

            const tickets = await expo.sendPushNotificationsAsync([message]);
            console.log(`[PUSH_DEBUG] Expo API Response:`, JSON.stringify(tickets));
            
            // Check for errors in tickets
            for (const ticket of tickets) {
                if (ticket.status === "error") {
                    console.error(`[PUSH_ERROR] Ticket error:`, ticket.message, ticket.details);
                }
            }
        } else if (user?.pushToken) {
            console.error(`[PUSH_ERROR] Invalid Expo token: ${user.pushToken}`);
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
