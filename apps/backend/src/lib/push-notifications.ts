import { Expo, ExpoPushMessage } from "expo-server-sdk";
import prisma from "./db";

// Initialize Expo SDK
const expo = new Expo();

/**
 * Send a push notification to one or more users
 * 
 * @param userIds - IDs of users to notify
 * @param title - Notification title
 * @param body - Notification body
 * @param data - Optional data payload for deep-linking
 */
export async function sendPushNotification(
    userIds: string[],
    title: string,
    body: string,
    data: any = {}
) {
    try {
        // 1. Fetch push tokens for the target users
        const users = await prisma.user.findMany({
            where: {
                id: { in: userIds },
                pushToken: { not: null }
            },
            select: {
                pushToken: true
            }
        });

        const tokens = users.map(u => u.pushToken).filter(Boolean) as string[];
        console.log(`[PUSH] Found ${tokens.length} tokens for users:`, userIds);

        if (tokens.length === 0) {
            console.log("[PUSH] No valid push tokens found for users:", userIds);
            return;
        }

        // 2. Filter out invalid tokens
        const messages: ExpoPushMessage[] = [];
        for (const pushToken of tokens) {
            if (!Expo.isExpoPushToken(pushToken)) {
                console.error(`[PUSH] Token ${pushToken} is not a valid Expo push token`);
                continue;
            }

            messages.push({
                to: pushToken,
                sound: "default",
                title,
                body,
                data,
            });
        }

        // 3. Send in batches (max 100 per batch recommended by Expo)
        const chunks = expo.chunkPushNotifications(messages);
        const tickets: any[] = [];

        for (const chunk of chunks) {
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            } catch (error) {
                console.error("[PUSH_BATCH_ERROR]", error);
            }
        }

        // NOTE: In a production environment, you should handle tickets to check for delivery errors
        // and remove tokens that are no longer valid.

    } catch (error) {
        console.error("[PUSH_ERROR]", error);
    }
}
