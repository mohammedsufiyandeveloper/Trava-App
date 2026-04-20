import { pusherClient } from "./pusher";

/**
 * Enhanced Real-Time Service (Pusher + PubSub)
 * This utility centralizes all real-time event handling. 
 * It manages the Pusher connection and broadcasts events to local UI components.
 */

type EventCallback = (data: any) => void;

class RealtimeService {
  private events: { [key: string]: EventCallback[] } = {};
  private currentWorkspaceId: string | null = null;
  private currentUserId: string | null = null;

  /**
   * Initialize the service for a specific workspace.
   * This sets up the Pusher subscription.
   * @param userId - Optional User ID for targeted personal notifications
   */
  init(workspaceId: string, userId?: string) {
    if (this.currentWorkspaceId === workspaceId && this.currentUserId === userId) return;

    // Cleanup previous subscription if switching workspaces
    if (this.currentWorkspaceId) {
      this.cleanup();
    }

    this.currentWorkspaceId = workspaceId;
    this.currentUserId = userId || null;
    console.log(`[REALTIME_SERVICE] Initializing for workspace: ${workspaceId}, user: ${userId || "anon"}`);

    if (pusherClient) {
      const channel = pusherClient.subscribe(`team-${workspaceId}`);

      // Bind to core activity log
      channel.bind("activity_log", (data: any) => {
        // console.log("[REALTIME_SERVICE] Broadasting activity_log:", data.action);
        this.publish(EVENTS.APP_ACTIVITY_LOG, data);
      });

      // Bind to team updates (refreshes/surgical sync)
      channel.bind("team_update", (data: any) => {
        this.publish(EVENTS.TEAM_UPDATE, data);
      });

      // Bind to specific entity updates (standardizing on TEAM_UPDATE logic)
      channel.bind("task_update", (data: any) => {
        this.publish(EVENTS.TEAM_UPDATE, data);
      });

      channel.bind("subtask_update", (data: any) => {
        this.publish(EVENTS.TEAM_UPDATE, data);
      });

      // 2. Subscribe to PERSONAL channel for targeted toasts
      if (userId) {
        const personalChannel = pusherClient.subscribe(`user-${userId}`);
        personalChannel.bind("activity_log", (data: any) => {
          this.publish(EVENTS.APP_ACTIVITY_LOG, data);
        });
      }
    }
  }

  /**
   * Cleanup Pusher subscriptions
   */
  cleanup() {
    if (pusherClient) {
      if (this.currentWorkspaceId) {
        console.log(`[REALTIME_SERVICE] Cleaning up workspace: ${this.currentWorkspaceId}`);
        pusherClient.unsubscribe(`team-${this.currentWorkspaceId}`);
      }
      if (this.currentUserId) {
        console.log(`[REALTIME_SERVICE] Cleaning up user channel: ${this.currentUserId}`);
        pusherClient.unsubscribe(`user-${this.currentUserId}`);
      }
      this.currentWorkspaceId = null;
      this.currentUserId = null;
    }
  }

  /**
   * Subscribe to a local event
   */
  subscribe(event: string, callback: EventCallback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);

    return () => {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    };
  }

  /**
   * Internal: Publish an event to local listeners
   */
  private publish(event: string, data: any) {
    if (!this.events[event]) return;
    this.events[event].forEach(callback => callback(data));
  }
}

// Export a singleton instance
export const pubsub = new RealtimeService();

/**
 * Standard Event Names used across the application
 */
export const EVENTS = {
  APP_ACTIVITY_LOG: "app_activity_log",
  TEAM_UPDATE: "team_update",
} as const;
