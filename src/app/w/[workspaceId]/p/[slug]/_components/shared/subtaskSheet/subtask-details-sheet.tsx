"use client";

import { toast } from "sonner";
import { TaskByIdType } from "@/data/task/get-task-by-id";
import { useSearchParams, usePathname } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs } from "@/components/ui/tabs";
import { fetchCommentsAction, fetchActivitiesAction } from "@/actions/comment";

// Import modular components
import { SubtaskSheetHeader } from "./subtask-sheet-header";
import { SubtaskSheetNavBar } from "./subtask-sheet-navbar";
import { getProjectMembers, ProjectMembersType } from "@/data/project/get-project-members";
import dynamic from "next/dynamic";
const MessagesTab = dynamic(() => import("./messages-tab").then(mod => mod.MessagesTab), { ssr: false });
const ActivityTab = dynamic(() => import("./activity-tab").then(mod => mod.ActivityTab), { ssr: false });

interface SubTaskDetailsSheetProps {
    subTask: TaskByIdType | null;
    isOpen: boolean;
    onClose?: () => void;
    disableUrlSync?: boolean;
    // Pre-fetched data from server component
    initialComments?: any[];
    initialActivities?: any[];
    currentUserId?: string | null;
    /** Called when the assignee is updated inline from within the sheet */
    onSubTaskAssigned?: (subTaskId: string, updatedData: any) => void;
    isAdmin?: boolean;
    isProjectManager?: boolean;
}

interface Comment {
    id: string;
    content: string;
    userId: string;
    taskId: string;
    user: {
        id: string;
        surname: string;
    };
    isEdited: boolean;
    editedAt: Date;
    isDeleted: boolean;
    deletedAt: Date;
    createdAt: Date;
    updatedAt: Date;
    replies?: Comment[];
}

interface Activity {
    id: string;
    text: string;
    attachment: {
        fileName?: string;
        fileType?: string;
        fileSize?: number;
        url?: string;
        previousStatus?: string;
        targetStatus?: string;
    } | null;
    author: {
        id: string;
        name: string;
        surname: string;
        image: string;
    };
    createdAt: Date;
}

// Client-side cache for instant re-opening
export const commentCache = new Map<string, any[]>();
export const activityCache = new Map<string, any[]>();
export const pendingPrefetches = new Set<string>(); // LOCK: Prevents redundant DB queries

/**
 * Checks if a subtask is in the cache. 
 */
export function prefetchSubTask(taskId: string) {
    // We only log if it's already there, no DB trigger.
    if (commentCache.has(taskId)) {
        console.log(`📡 [CACHE-HIT] Task ${taskId} is ready in local memory.`);
    }
}

/**
 * Subtask Details Sheet Component (Refactored)
 */
export function SubTaskDetailsSheet({
    subTask,
    isOpen,
    onClose = () => { },
    disableUrlSync = false,
    initialComments = [],
    initialActivities = [],
    currentUserId: initialCurrentUserId = null,
    onSubTaskAssigned,
    isAdmin = false,
    isProjectManager = false,
}: SubTaskDetailsSheetProps) {
    const [activeTab, setActiveTab] = useState<"messages" | "review">("messages");
    const [comments, setComments] = useState<Comment[]>([]);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingActivity, setIsLoadingActivity] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(initialCurrentUserId);
    const [members, setMembers] = useState<ProjectMembersType>([]);

    const pathname = usePathname();
    const searchParams = useSearchParams();

    const loadedSubTaskIdRef = useRef<string>("");
    const activitiesLoadedRef = useRef<boolean>(false);

    // Initial cache sync
    useEffect(() => {
        if (subTask) {
            const hasCache = commentCache.has(subTask.id);
            if (hasCache) {
                console.log(`✨ [MAGIC] Instant load for ${subTask.name} (Hit Pre-fetch Cache)`);
                setComments(commentCache.get(subTask.id)!);
            } else {
                setComments(initialComments as Comment[]);
            }

            if (activityCache.has(subTask.id)) {
                setActivities(activityCache.get(subTask.id)!);
            } else {
                setActivities(initialActivities as Activity[]);
            }
        }
    }, [subTask?.id]);

    // Performance tracking
    const mountTimeRef = useRef<number>(0);

    useEffect(() => {
        if (isOpen) {
            mountTimeRef.current = performance.now();
            if (typeof window !== 'undefined' && (window as any).lastSheetOpenClick) {
                const totalDelay = mountTimeRef.current - (window as any).lastSheetOpenClick;
                console.log(`⏱️ Subtask Sheet visible in: ${totalDelay.toFixed(2)}ms`);
            }
        }
    }, [isOpen]);

    // URL synchronization is now handled globally via context hooks
    // to ensure consistency across all opening/closing methods.

    const loadComments = useCallback(async () => {
        if (!subTask) return;

        if (pendingPrefetches.has(`comments-${subTask.id}`)) return;

        // SKIP IF ACCESSED FROM PRE-FETCH CACHE
        if (commentCache.has(subTask.id)) {
            return; // Already have data, don't re-fetch immediately (even if empty)
        }

        pendingPrefetches.add(`comments-${subTask.id}`);
        setIsLoading(true);
        const startTime = performance.now();
        try {
            const result = await fetchCommentsAction(subTask.id);
            if (result.success && result.comments) {
                const fetchedComments = result.comments as Comment[];
                setComments(fetchedComments);
                commentCache.set(subTask.id, fetchedComments); // Update cache
                if (result.currentUserId) {
                    setCurrentUserId(result.currentUserId);
                }
                const duration = performance.now() - startTime;
                console.log(`🐢 [SLOW LOAD] Comments fetched in: ${duration.toFixed(2)}ms (Missing Pre-fetch)`);
            } else {
                toast.error(result.error || "Failed to load comments");
            }
        } catch (error) {
            console.error("Error loading comments:", error);
            toast.error("Failed to load comments");
        } finally {
            setIsLoading(false);
            pendingPrefetches.delete(`comments-${subTask.id}`);
        }
    }, [subTask?.id]);

    const loadActivities = useCallback(async () => {
        if (!subTask) return;

        if (pendingPrefetches.has(`activities-${subTask.id}`)) return;
        pendingPrefetches.add(`activities-${subTask.id}`);
        setIsLoadingActivity(true);
        try {
            const result = await fetchActivitiesAction(subTask.id);
            if (result.success && result.activities) {
                const fetchedActivities = result.activities as Activity[];
                setActivities(fetchedActivities);
                activityCache.set(subTask.id, fetchedActivities); // Update cache
            } else {
                toast.error(result.error || "Failed to load activities");
            }
        } catch (error) {
            console.error("Error loading activities:", error);
            toast.error("Failed to load activities");
        } finally {
            setIsLoadingActivity(false);
            pendingPrefetches.delete(`activities-${subTask.id}`);
        }
    }, [subTask?.id]);

    // Fetch comments when subtask changes or sheet opens
    useEffect(() => {
        if (subTask && isOpen && loadedSubTaskIdRef.current !== subTask.id) {
            loadedSubTaskIdRef.current = subTask.id;
            loadComments();
        }

        // Reset when sheet closes
        if (!isOpen) {
            loadedSubTaskIdRef.current = "";
        }
    }, [subTask?.id, isOpen, loadComments]);

    // Load activities when switching to activity tab
    useEffect(() => {
        if (activeTab === "review" && subTask && !activitiesLoadedRef.current && !isLoadingActivity) {
            activitiesLoadedRef.current = true;
            loadActivities();
        }

        // Reset when subtask changes
        if (subTask?.id !== loadedSubTaskIdRef.current) {
            activitiesLoadedRef.current = false;
        }
    }, [activeTab, subTask?.id, isLoadingActivity, loadActivities]);

    // Fetch members when projectId changes or sheet opens
    useEffect(() => {
        if (subTask?.projectId && isOpen) {
            getProjectMembers(subTask.projectId).then(setMembers);
        }
    }, [subTask?.projectId, isOpen]);

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col h-full bg-background border-l">
                <SheetTitle className="sr-only">{subTask?.name || "SubTask Details"}</SheetTitle>
                <SheetDescription className="sr-only">
                    {subTask ? `Details and activity for subtask ${subTask.name}` : "Loading subtask details..."}
                </SheetDescription>
                {subTask ? (
                    <>
                        {/* Header Component */}
                        <SubtaskSheetHeader
                            subTask={subTask}
                            currentUserId={currentUserId}
                            members={members}
                            isAdmin={isAdmin || members.find(m => m.userId === currentUserId)?.workspaceRole === 'ADMIN' || members.find(m => m.userId === currentUserId)?.workspaceRole === 'OWNER'}
                            isProjectManager={isProjectManager || members.find(m => m.userId === currentUserId)?.projectRole === 'PROJECT_MANAGER'}
                            onSubTaskAssigned={(memberObj) => {
                                onSubTaskAssigned?.(subTask.id, {
                                    assignee: {
                                        WorkspaceMember: {
                                            user: memberObj
                                        }
                                    }
                                });
                            }}
                        />

                        {/* Tabbed Section - Takes Remaining Space */}
                        <div className="border-t flex-1 flex flex-col min-h-0">
                            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "messages" | "review")} className="flex flex-col h-full">
                                {/* Navigation Bar Component */}
                                <SubtaskSheetNavBar
                                    activeTab={activeTab}
                                    onTabChange={setActiveTab}
                                    messagesCount={comments.length}
                                    activityCount={activities.length}
                                />

                                {/* Tab Content */}
                                {activeTab === "messages" && (
                                    <MessagesTab
                                        taskId={subTask.id}
                                        comments={comments}
                                        setComments={setComments}
                                        currentUserId={currentUserId}
                                        isLoading={isLoading}
                                    />
                                )}

                                {activeTab === "review" && (
                                    <ActivityTab
                                        activities={activities}
                                        isLoadingActivity={isLoadingActivity}
                                    />
                                )}
                            </Tabs>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col h-full items-center justify-center p-8 space-y-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                        <span className="text-sm text-muted-foreground">Preparing subtask...</span>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
