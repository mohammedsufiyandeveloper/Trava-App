import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NotificationService } from "../services/NotificationService";
import { registerPushToken, getNotifications, markNotificationRead, markAllNotificationsRead, getTaskById } from "../services/api";
import { navigationRef } from "../navigation/navigationRef";
import { useWorkspace } from "./WorkspaceContext";
import { DeviceEventEmitter, Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { PusherClient } from "../services/PusherClient";
import { getCachedSession } from "../services/api";

export interface NotificationItem {
    id: string;
    title: string;
    body: string;
    receivedAt: string;
    isRead: boolean;
    data?: any;
}

interface NotificationContextType {
    notifications: NotificationItem[];
    unreadCount: number;
    loading: boolean;
    refresh: () => Promise<void>;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    deleteNotification: (id: string) => void;
    clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const NOTIFICATIONS_STORAGE_KEY = "@tusker_notifications_history";

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);

    const [loading, setLoading] = useState(false);
    const refreshInProgress = React.useRef(false);
    const { activeWorkspace } = useWorkspace();

    // ─── Server Sync ──────────────────────────────────────────────────────────

    const refresh = useCallback(async () => {
        if (!activeWorkspace || refreshInProgress.current) return;
        
        refreshInProgress.current = true;
        setLoading(true);
        try {
            const { getActivities } = await import("../services/api");

            const tNotif = performance.now();
            // Fetch both targeted notifications and general workspace activity logs in parallel
            const [notifResult, activitiesList] = await Promise.all([
                getNotifications(activeWorkspace.id, 50, 0).catch(() => ({ success: false, notifications: [] })),
                getActivities(activeWorkspace.id, undefined, false).catch(() => [])
            ]);
            console.log(`[NotificationContext] ⏱ Notifications & Activities fetched in ${(performance.now() - tNotif).toFixed(1)}ms`);

            const allItems: NotificationItem[] = [];

            if (notifResult.success && notifResult.notifications) {
                const mappedNotifs = notifResult.notifications.map((n: any) => {
                    let metaObj = {};
                    if (n.metadata) {
                        try {
                            metaObj = typeof n.metadata === "string" ? JSON.parse(n.metadata) : n.metadata;
                        } catch (e) {
                            console.error("[NotificationContext] Error parsing notification metadata:", e);
                        }
                    }
                    return {
                        id: n.id,
                        title: n.title,
                        body: n.body,
                        receivedAt: n.createdAt,
                        isRead: n.isRead,
                        data: {
                            ...metaObj,
                            entityId: n.entityId,
                            entityType: n.entityType,
                            action: n.type
                        }
                    };
                });
                allItems.push(...mappedNotifs);
            }

            if (activitiesList && activitiesList.length > 0) {
                activitiesList.forEach((act: any) => {
                    // Prevent duplicate entries where a targeted notification was already created for the same audit event
                    // We use an extended time window (2 hours) to handle Vercel serverless freezing where activity logs can be delayed in DB write
                    const isDuplicate = allItems.some(n =>
                        n.data?.entityId === act.entityId &&
                        n.data?.action === act.action &&
                        Math.abs(new Date(n.receivedAt).getTime() - new Date(act.createdAt).getTime()) < 7200000
                    );

                    if (!isDuplicate) {
                        let metaObj = {};
                        if (act.metadata) {
                            try {
                                metaObj = typeof act.metadata === "string" ? JSON.parse(act.metadata) : act.metadata;
                            } catch (e) {
                                console.error("[NotificationContext] Error parsing activity metadata:", e);
                            }
                        }
                        allItems.push({
                            id: act.id,
                            title: act.text,
                            body: "Workspace Activity", // Fallback text for audit logs
                            receivedAt: act.createdAt,
                            isRead: true, // Audit logs are implicitly read
                            data: {
                                ...metaObj,
                                isAuditLog: true,
                                entityId: act.entityId,
                                entityType: act.entityType,
                                action: act.action
                            }
                        });
                    }
                });
            }

            // Sort chronologically (newest first)
            allItems.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());

            setNotifications(allItems);
        } catch (err) {
            console.error("Failed to fetch notifications:", err);
        } finally {
            refreshInProgress.current = false;
            setLoading(false);
        }
    }, [activeWorkspace]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    // ─── Notification Handler ──────────────────────────────────────────────────

    const addNotification = useCallback((notif: Omit<NotificationItem, "id" | "receivedAt" | "isRead">) => {
        const newItem: NotificationItem = {
            ...notif,
            id: Math.random().toString(36).substring(7),
            receivedAt: new Date().toISOString(),
            isRead: false,
        };
        setNotifications(prev => [newItem, ...prev]);
    }, []);

    useEffect(() => {
        // Register for permissions on mount
        const setupNotifications = async () => {
            const token = await NotificationService.registerForPushNotificationsAsync();
            if (token) {
                console.log("[NotificationContext] Push Token found:", token);
                console.log("[NotificationContext] Registering token with backend...");
                const res = await registerPushToken(token);
                if (res?.ok) {
                    console.log("[NotificationContext] Token registered successfully");
                } else {
                    console.warn("[NotificationContext] Token registration failed:", res?.status);
                }
            } else {
                console.log("[NotificationContext] No push token retrieved (Check permissions or simulator)");
            }
        };

        setupNotifications();

        // Listen for foreground notifications
        const foregroundSubscription = Notifications.addNotificationReceivedListener(response => {
            const { title, body, data } = response.request.content;

            // Trigger refresh to get full data from server
            refresh();

            // Trigger haptic feedback
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        });

        // Listen for notification taps (Background/Killed state)
        const responseSubscription = Notifications.addNotificationResponseReceivedListener(async response => {
            const data = response.notification.request.content.data as any;
            const title = response.notification.request.content.title;
            const body = response.notification.request.content.body;

            // Navigate based on data
            const actionType = data?.action || data?.type;
            if (data?.entityId && typeof data.entityId === "string" && (data?.entityType === "TASK" || data?.entityType === "SUBTASK")) {
                let isSubtask = data.entityType === "SUBTASK" || (typeof actionType === "string" && actionType.includes("SUBTASK"));
                let pId: string | undefined = typeof data.projectId === "string" ? data.projectId : undefined;
                let projName = "Project";
                let apiTask = null;

                try {
                    apiTask = await getTaskById(data.entityId);
                    if (apiTask) {
                        isSubtask = !!apiTask.parentTaskId;
                        if (apiTask.projectId) pId = apiTask.projectId;
                        if (apiTask.project?.name) projName = apiTask.project.name;
                    }
                } catch (err) {
                    console.error("Error looking up task in notification tap:", err);
                }

                if (navigationRef.isReady()) {
                    if (!apiTask) {
                        navigationRef.navigate("TaskDetail", {
                            taskId: data.entityId,
                            taskName: isSubtask ? `Subtask #${data.entityId.slice(-4)}` : `Task #${data.entityId.slice(-4)}`,
                            notificationTitle: title || undefined,
                            notificationBody: body || undefined,
                            isSubtask: isSubtask,
                            taskData: data
                        });
                        return;
                    }

                    if (actionType === "COMMENT_CREATED") {
                        navigationRef.navigate("TaskDetail", {
                            taskId: data.entityId,
                            taskName: isSubtask ? `Subtask #${data.entityId.slice(-4)}` : `Task #${data.entityId.slice(-4)}`,
                            openMessages: true,
                            notificationTitle: title || undefined,
                            notificationBody: body || undefined,
                            isSubtask: isSubtask,
                            taskData: data
                        });
                    } else if (actionType === "TASK_CREATED" || actionType === "TASK_UPDATED" || (!isSubtask && data.entityType === "TASK")) {
                        if (pId) {
                            navigationRef.navigate("ProjectDetail", {
                                projectId: pId,
                                projectName: projName,
                                initialTab: "Tasks"
                            });
                        } else {
                            navigationRef.navigate("TaskDetail", {
                                taskId: data.entityId,
                                taskName: title || "Task Details",
                                notificationTitle: title || undefined,
                                notificationBody: body || undefined,
                                isSubtask: isSubtask,
                                taskData: data
                            });
                        }
                    } else {
                        navigationRef.navigate("TaskDetail", {
                            taskId: data.entityId,
                            taskName: isSubtask ? `Subtask #${data.entityId.slice(-4)}` : `Task #${data.entityId.slice(-4)}`,
                            notificationTitle: title || undefined,
                            notificationBody: body || undefined,
                            isSubtask: isSubtask,
                            taskData: data
                        });
                    }
                }
            } else if (data?.entityType === "MEMBER" && (actionType === "MEMBER_INVITED" || actionType === "MEMBER_REMOVED")) {
                const isInvite = actionType === "MEMBER_INVITED";
                const alertTitle = isInvite ? "Member Invited" : "Member Removed";

                // Get target user's name/surname
                let targetName: string | null =
                    data?.newData?.surname ||
                    data?.payload?.surname ||
                    data?.newData?.name ||
                    data?.payload?.name ||
                    data?.surname ||
                    data?.name ||
                    null;

                const detail = targetName
                    ? (isInvite
                        ? `${targetName} was invited to the workspace`
                        : `${targetName} was removed from the workspace`)
                    : (body || (isInvite ? "System invited a new member" : "System removed a member"));

                if (navigationRef.isReady()) {
                    navigationRef.navigate("Notifications");
                }

                Alert.alert(alertTitle, detail, [
                    { text: "OK", style: "cancel" }
                ]);
            } else if ((data?.type === "direct_message" || actionType === "direct_message") && data?.conversationId) {
                if (navigationRef.isReady()) {
                    navigationRef.navigate("DirectChat", {
                        conversationId: data.conversationId as string,
                        otherUserId: data.senderId as string,
                        otherUserName: (data.senderName as string) || "Chat"
                    });
                }
            } else if (
                actionType === "LEAVE_REQUEST_SUBMITTED" ||
                actionType === "LEAVE_REQUEST_PENDING" ||
                actionType === "LEAVE_REQUEST_APPROVED" ||
                actionType === "LEAVE_REQUEST_REJECTED"
            ) {
                if (navigationRef.isReady()) {
                    if (actionType === "LEAVE_REQUEST_SUBMITTED" || actionType === "LEAVE_REQUEST_PENDING") {
                        (navigationRef as any).navigate("AdminLeave");
                    } else {
                        (navigationRef as any).navigate("Leave");
                    }
                }
            } else if (actionType === "CHECKED_IN" || actionType === "CHECKED_OUT") {
                if (navigationRef.isReady()) {
                    (navigationRef as any).navigate("Attendance");
                }
            } else {
                if (navigationRef.isReady()) {
                    navigationRef.navigate("Notifications");
                }
            }
        });

        // --- Real-time WebSocket (Pusher) Setup ---
        let pusher: import("../services/PusherClient").PusherClient | null = null;
        let teamChannel: any = null;
        let userChannel: any = null;

        const setupPusher = async () => {
            const pusherKey = process.env.EXPO_PUBLIC_PUSHER_KEY;
            const pusherCluster = process.env.EXPO_PUBLIC_PUSHER_CLUSTER;

            if (!pusherKey || !pusherCluster || !activeWorkspace) return;

            pusher = new PusherClient(pusherKey, { cluster: pusherCluster });

            const handleLiveUpdate = (data: any) => {
                // Instantly fetch latest notifications
                refresh();
                // Emit an app-wide event so the Dashboard and Task lists can refresh silently
                DeviceEventEmitter.emit("remote_update", data);
                // Optional haptic feedback for important live events
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            };

            // Subscribe to workspace-wide activity
            teamChannel = pusher.subscribe(`team-${activeWorkspace.id}`);
            teamChannel.bind("activity_log", handleLiveUpdate);

            // Subscribe to user-specific targeted events
            const session = await getCachedSession();
            if (session?.user?.id) {
                userChannel = pusher.subscribe(`user-${session.user.id}`);
                userChannel.bind("activity_log", handleLiveUpdate);
                userChannel.bind("new_notification", handleLiveUpdate);
                userChannel.bind("new-message", handleLiveUpdate);
            }
        };

        setupPusher();

        return () => {
            foregroundSubscription.remove();
            responseSubscription.remove();

            if (pusher) {
                if (teamChannel) pusher.unsubscribe(teamChannel.name);
                if (userChannel) pusher.unsubscribe(userChannel.name);
                pusher.disconnect();
            }
        };
    }, [addNotification, activeWorkspace, refresh]);

    // ─── Actions ──────────────────────────────────────────────────────────────

    const markAsRead = async (id: string) => {
        const item = notifications.find(n => n.id === id);
        if (item?.data?.isAuditLog) return; // Audit logs are implicitly read, skip DB update

        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        await markNotificationRead(id).catch(e => console.log("[NotificationContext] Failed to mark read:", e));
    };

    const markAllAsRead = async () => {
        if (!activeWorkspace) return;
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        await markAllNotificationsRead(activeWorkspace.id);
    };

    const deleteNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const clearAll = () => {
        setNotifications([]);
    };

    const sendTestNotification = () => {
        NotificationService.scheduleLocalNotification(
            "Test Notification",
            "This is a sample notification to verify the system is working!"
        );
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            loading,
            refresh,
            markAsRead,
            markAllAsRead,
            deleteNotification,
            clearAll,
        }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error("useNotifications must be used within a NotificationProvider");
    }
    return context;
};
