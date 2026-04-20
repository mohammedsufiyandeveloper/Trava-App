"use client";

import { useEffect, useTransition, useCallback } from "react";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";
import { pubsub, EVENTS } from "@/lib/pubsub";
import { authClient } from "@/lib/auth-client";
import { useTaskCacheStore } from "@/lib/store/task-cache-store";
// Simple debounce implementation
const debounce = (func: Function, wait: number) => {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export function RealtimeNotificationListener() {
  const router = useRouter();
  const params = useParams();
  const [isPending, startTransition] = useTransition();
  const { data: session } = authClient.useSession();
  const workspaceId = params?.workspaceId as string;
  const projectId = params?.projectId as string;
  const upsertTasks = useTaskCacheStore((state) => state.upsertTasks);
  const moveTask = useTaskCacheStore(
    (state) => state.moveTaskBetweenKanbanColumns,
  );
  const addTask = useTaskCacheStore((state) => state.addTaskToKanbanList);
  const removeTask = useTaskCacheStore(
    (state) => state.removeTaskFromKanbanList,
  );

  // Debounced versions to prevent rapid successive updates from causing flickering
  const debouncedUpsert = useCallback(
    debounce((tasks: any[]) => upsertTasks(tasks), 100),
    [upsertTasks],
  );
  const debouncedMoveTask = useCallback(
    debounce((subTaskId: string, fromStatus: string, toStatus: string, workspaceId: string, projectId?: string) => 
      moveTask(subTaskId, fromStatus, toStatus, workspaceId, projectId), 100),
    [moveTask],
  );
  const debouncedAddTask = useCallback(
    debounce((task: any, workspaceId: string, projectId: string) => 
      addTask(task, workspaceId, projectId), 100),
    [addTask],
  );
  const debouncedRemoveTask = useCallback(
    debounce((taskId: string, status: string, workspaceId: string, projectId: string) => 
      removeTask(taskId, status, workspaceId, projectId), 100),
    [removeTask],
  );

  useEffect(() => {
    if (!workspaceId) return;

    // 1. Initialize the central Real-Time Service with both Workspace and User context
    pubsub.init(workspaceId, session?.user?.id);

    // 2. Listen to internal events for UI updates (Toasts & Refreshes)
    const unsubscribeActivity = pubsub.subscribe(
      EVENTS.APP_ACTIVITY_LOG,
      (data: any) => {
        const isActor = data.userId === session?.user?.id;
        const isUpdate =
          data.action === "TASK_UPDATED" ||
          data.action === "SUBTASK_UPDATED" ||
          data.action === "COMMENT_CREATED";

        const isStructural =
          data.action === "SUBTASK_CREATED" ||
          data.action === "TASK_CREATED" ||
          data.action === "SUBTASK_DELETED" ||
          data.action === "TASK_DELETED";

        // 🚀 SURGICAL SYNC: Protect structural integrity with pinpoint updates
        if (!isActor && (isUpdate || isStructural) && data.entityId) {
          const payload =
            data.newData || data.metadata?.payload || data.metadata;

          if (!payload) return;

          // 1. Handle Structural Changes
          if (data.action.includes("CREATED")) {
            debouncedAddTask(
              payload,
              workspaceId,
              payload.projectId || projectId,
            );
          } else if (data.action.includes("DELETED")) {
            debouncedRemoveTask(
              data.entityId,
              payload.status,
              workspaceId,
              payload.projectId || projectId,
            );
          }

          // 2. Handle Property Updates
          if (isUpdate) {
            if (payload.status && payload.previousStatus) {
              debouncedMoveTask(
                data.entityId,
                payload.previousStatus,
                payload.status,
                workspaceId,
                projectId,
              );
            }

            debouncedUpsert([
              {
                id: data.entityId,
                ...payload,
                updatedAt: new Date().toISOString(),
              },
            ]);

            // Comment counter increment
            if (data.action === "COMMENT_CREATED") {
              const currentTask =
                useTaskCacheStore.getState().entities[data.entityId];
              if (currentTask) {
                debouncedUpsert([
                  {
                    id: data.entityId,
                    _count: {
                      ...currentTask._count,
                      activities:
                        (currentTask._count?.activities || 0) + 1,
                    },
                  },
                ]);
              }
            }
          }

          // 2. Handle Property Updates
          if (isUpdate) {
            if (payload.status && payload.previousStatus) {
              moveTask(
                data.entityId,
                payload.previousStatus,
                payload.status,
                workspaceId,
                projectId,
              );
            }

            upsertTasks([
              {
                id: data.entityId,
                ...payload,
                updatedAt: new Date().toISOString(),
              },
            ]);

            // Comment counter increment
            if (data.action === "COMMENT_CREATED") {
              const currentTask =
                useTaskCacheStore.getState().entities[data.entityId];
              if (currentTask) {
                upsertTasks([
                  {
                    id: data.entityId,
                    _count: {
                      ...currentTask._count,
                      activities:
                        (currentTask._count?.activities || 0) + 1,
                    },
                  },
                ]);
              }
            }
          }
        } else if (!isActor) {
          // For structural changes (DELETE, CREATE) or other users' actions,
          // we still do a full refresh to ensure list integrity.
          startTransition(() => {
            router.refresh();
          });
        }

        // Show toast message if provided AND not triggered by the current user
        if (data.message && !isActor) {
          toast.info(data.message, {
            description: data.action.replace(/_/g, " ").toLowerCase(),
            duration: 5000,
          });
        }
      },
    );

    // Handle general team updates (Silent refresh)
    const unsubscribeTeam = pubsub.subscribe(
      EVENTS.TEAM_UPDATE,
      (data: any) => {
        const isActor = data?.userId === session?.user?.id;
        if (isActor) return;

        const isSurgicalUpdate = data.type === "UPDATE" && data.payload?.id;

            if (isSurgicalUpdate) {
                // Handle status moves surgically
                if (data.payload.status && data.payload.previousStatus) {
                    debouncedMoveTask(
                        data.payload.id,
                        data.payload.previousStatus,
                        data.payload.status,
                        workspaceId,
                        projectId
                    );
                }

                debouncedUpsert([{
                    ...data.payload,
                    updatedAt: new Date().toISOString()
                }]);
            } else if (data.type === "CREATE" && data.payload?.id) {
                // SURGICAL CREATE: Prepend to the matching status column
                debouncedAddTask(
                    data.payload,
                    workspaceId,
                    data.payload.projectId || projectId
                );
            } else if (data.type === "DELETE" && data.payload?.id) {
                // SURGICAL DELETE: Pluck from the matching status column
                debouncedRemoveTask(
                    data.payload.id,
                    data.payload.status,
                    workspaceId,
                    data.payload.projectId || projectId
                );
            } else {
                // For other types (Generic team updates, etc.), do a full refresh
                startTransition(() => {
                    router.refresh();
                });
            }
        }
    );

        return () => {
      unsubscribeActivity();
      unsubscribeTeam();
      pubsub.cleanup();
    };
  }, [
    workspaceId,
    projectId,
    session?.user?.id,
    router,
    debouncedUpsert,
    debouncedMoveTask,
    debouncedAddTask,
    debouncedRemoveTask,
  ]);

  return null; // This component doesn't render anything
}
