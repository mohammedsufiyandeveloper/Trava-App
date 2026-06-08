import { pusherServer } from "./pusher";

/**
 * Team Realtime Events using Pusher.
 * This works perfectly in serverless environments like Vercel.
 */

export const TEAM_UPDATE = "team_update";

export type TeamEventData = {
    workspaceId: string;
    type: "INVITE" | "DELETE" | "UPDATE";
    payload: any;
};

/**
 * Broadcast a team event to all connected clients via Pusher.
 */
export const broadcastTeamUpdate = async (data: TeamEventData) => {
    try {
        if (!pusherServer) {
            console.warn("[REALTIME] Pusher not configured, skipping broadcast.");
            return;
        }
        await pusherServer.trigger(
            `team-${data.workspaceId}`, // Channel name
            TEAM_UPDATE,                // Event name
            data                        // Data payload
        );
    } catch (error) {
        console.error("[REALTIME_PUSHER_ERROR]", error);
    }
};
