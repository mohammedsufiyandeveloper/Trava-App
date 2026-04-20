import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Unified Entity Store
interface TaskEntity {
    id: string;
    updatedAt: string | Date;
    [key: string]: any;
}

interface ListMetadata {
    ids: string[];
    hasMore: boolean;
    page: number; // legacy
    nextCursor?: any;
    totalCount?: number;
    timestamp: number;
}

interface TaskCacheState {
    userId: string | null;
    entities: Record<string, TaskEntity>;

    // Internal Metadata Maps
    subTaskLists: Record<string, ListMetadata>;
    projectLists: Record<string, ListMetadata>;
    kanbanLists: Record<string, ListMetadata>;

    // Actions
    upsertTasks: (tasks: any[]) => void;

    // Legacy/Public API Adapters
    setCachedSubTasks: (taskId: string, data: { subTasks: any[], hasMore: boolean, page?: number, nextCursor?: any }) => void;
    getCachedSubTasks: (taskId: string) => { subTasks: any[], hasMore: boolean, page: number, nextCursor?: any, timestamp: number } | undefined;

    setProjectTasksCache: (projectId: string, data: { tasks: any[], hasMore: boolean, page?: number, nextCursor?: any, totalCount?: number }) => void;
    getProjectTasksCache: (projectId: string) => { tasks: any[], hasMore: boolean, page: number, nextCursor?: any, totalCount?: number, timestamp: number } | undefined;

    setKanbanTasksCache: (key: string, data: { tasks: any[], hasMore: boolean, page?: number, nextCursor?: any, totalCount?: number }) => void;
    getKanbanTasksCache: (key: string) => { tasks: any[], hasMore: boolean, page: number, nextCursor?: any, totalCount?: number, timestamp: number } | undefined;

    // Command API: Invalidate and sync
    invalidateSubTaskCache: (taskId: string) => void;
    invalidateProjectCache: (projectId: string) => void;
    invalidateWorkspaceCache: (workspaceId: string) => void;
    
    // Surgical Kanban API
    moveTaskBetweenKanbanColumns: (
        subTaskId: string, 
        fromStatus: string, 
        toStatus: string, 
        workspaceId: string, 
        projectId?: string
    ) => void;
    
    // Structural pinpoint sync API
    addTaskToKanbanList: (task: any, workspaceId: string, projectId: string) => void;
    removeTaskFromKanbanList: (taskId: string, status: string, workspaceId: string, projectId: string) => void;

    clearCache: () => void;
    ensureUser: (userId: string) => void;
}

export const useTaskCacheStore = create<TaskCacheState>()(
    persist(
        (set, get) => ({
            userId: null,
            entities: {},
            subTaskLists: {},
            projectLists: {},
            kanbanLists: {},

            upsertTasks: (tasks) => set(state => {
                const newEntities = { ...state.entities };
                for (const t of tasks) {
                    const existing = newEntities[t.id];
                    if (!existing) {
                        newEntities[t.id] = t;
                        continue;
                    }

                    // TEMPORAL GUARD: Determine which version is core-fresher
                    const incomingTime = t.updatedAt ? new Date(t.updatedAt).getTime() : 0;
                    const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
                    const isIncomingNewer = incomingTime >= existingTime;

                    // Start with the older as base, overwrite with newer for core fields
                    const older = isIncomingNewer ? existing : t;
                    const newer = isIncomingNewer ? t : existing;

                    const merged = { ...older, ...newer };

                    // RELATION PRESERVATION (Always keep the richest version of complex objects)
                    // Project
                    if (older.project && !newer.project) {
                        merged.project = older.project;
                    } else if (newer.project && older.project) {
                        merged.project = { ...older.project, ...newer.project };
                        const newerPM = newer.project?.projectMembers || [];
                        const olderPM = older.project?.projectMembers || [];
                        merged.project.projectMembers = newerPM.length > 0 ? newerPM : olderPM;
                    }

                    // Assignee
                    if (older.assignee && !newer.assignee) merged.assignee = older.assignee;

                    // Reviewer
                    if (older.reviewer && !newer.reviewer) merged.reviewer = older.reviewer;

                    // Tag
                    if (older.tag && !newer.tag) merged.tag = older.tag;

                    // Creator
                    if (older.createdBy && !newer.createdBy) merged.createdBy = older.createdBy;

                    // Subtasks
                    if (older.subTasks && !newer.subTasks) merged.subTasks = older.subTasks;

                    newEntities[t.id] = merged;
                }
                return { entities: newEntities };
            }),

            moveTaskBetweenKanbanColumns: (subTaskId, fromStatus, toStatus, workspaceId, projectId) => {
                const state = get();
                const contextId = projectId || "";
                const fromKey = `${workspaceId}-${contextId}-${fromStatus}`;
                const toKey = `${workspaceId}-${contextId}-${toStatus}`;

                const fromList = state.kanbanLists[fromKey];
                const toList = state.kanbanLists[toKey];

                if (!fromList || !fromList.ids.includes(subTaskId)) return;

                // 1. Prepare new lists
                const newFromIds = fromList.ids.filter(id => id !== subTaskId);
                const newToIds = toList ? [subTaskId, ...toList.ids.filter(id => id !== subTaskId)] : [subTaskId];

                // 2. Update entities (status property)
                const task = state.entities[subTaskId];
                const updatedEntities = task ? {
                    ...state.entities,
                    [subTaskId]: { ...task, status: toStatus, updatedAt: new Date().toISOString() }
                } : state.entities;

                // 3. Update Lists
                const newKanbanLists = { ...state.kanbanLists };
                newKanbanLists[fromKey] = {
                    ...fromList,
                    ids: newFromIds,
                    totalCount: Math.max(0, (fromList.totalCount || 0) - 1),
                    timestamp: Date.now()
                };

                if (toList) {
                    newKanbanLists[toKey] = {
                        ...toList,
                        ids: newToIds,
                        totalCount: (toList.totalCount || 0) + 1,
                        timestamp: Date.now()
                    };
                }

                set({
                    entities: updatedEntities,
                    kanbanLists: newKanbanLists
                });
            },

            addTaskToKanbanList: (task, workspaceId, projectId) => {
                const state = get();
                
                // 🚀 STATUS PROTECTION: If a task has no status (e.g. Parent task), it doesn't belong in a status column
                if (!task.status) return;

                const status = task.status;
                const cacheKey = `${workspaceId}-${projectId}-${status}`;
                
                // 1. Upsert entity
                get().upsertTasks([task]);
                
                // 2. Add to list
                const currentList = state.kanbanLists[cacheKey];
                if (!currentList) return; // If list isn't cached, no need to surgically update

                const newIds = [task.id, ...currentList.ids.filter(id => id !== task.id)];
                
                set(state => ({
                    kanbanLists: {
                        ...state.kanbanLists,
                        [cacheKey]: {
                            ...currentList,
                            ids: newIds,
                            totalCount: (currentList.totalCount || 0) + 1,
                            timestamp: Date.now()
                        }
                    }
                }));
            },

            removeTaskFromKanbanList: (taskId, status, workspaceId, projectId) => {
                const state = get();
                const cacheKey = `${workspaceId}-${projectId}-${status}`;
                const currentList = state.kanbanLists[cacheKey];
                
                if (!currentList || !currentList.ids.includes(taskId)) return;

                const newIds = currentList.ids.filter(id => id !== taskId);
                
                set(state => ({
                    kanbanLists: {
                        ...state.kanbanLists,
                        [cacheKey]: {
                            ...currentList,
                            ids: newIds,
                            totalCount: Math.max(0, (currentList.totalCount || 0) - 1),
                            timestamp: Date.now()
                        }
                    }
                }));
            },

            setCachedSubTasks: (taskId, data) => {
                get().upsertTasks(data.subTasks);
                set(state => ({
                    subTaskLists: {
                        ...state.subTaskLists,
                        [taskId]: {
                            ids: data.subTasks.map(t => t.id),
                            hasMore: data.hasMore,
                            page: data.page || 1,
                            nextCursor: data.nextCursor,
                            timestamp: Date.now()
                        }
                    }
                }));
            },

            getCachedSubTasks: (taskId) => {
                const list = get().subTaskLists[taskId];
                if (!list) return undefined;
                const entities = get().entities;
                return {
                    subTasks: list.ids.map(id => entities[id]).filter(Boolean),
                    hasMore: list.hasMore,
                    page: list.page,
                    nextCursor: list.nextCursor,
                    timestamp: list.timestamp
                };
            },

            setProjectTasksCache: (projectId, data) => {
                get().upsertTasks(data.tasks);
                set(state => ({
                    projectLists: {
                        ...state.projectLists,
                        [projectId]: {
                            ids: data.tasks.map(t => t.id),
                            hasMore: data.hasMore,
                            page: data.page || 1,
                            nextCursor: data.nextCursor,
                            totalCount: data.totalCount,
                            timestamp: Date.now()
                        }
                    }
                }));
            },

            getProjectTasksCache: (projectId) => {
                const list = get().projectLists[projectId];
                if (!list) return undefined;
                const entities = get().entities;
                return {
                    tasks: list.ids.map(id => entities[id]).filter(Boolean),
                    hasMore: list.hasMore,
                    page: list.page,
                    nextCursor: list.nextCursor,
                    totalCount: list.totalCount,
                    timestamp: list.timestamp
                };
            },

            setKanbanTasksCache: (key, data) => {
                get().upsertTasks(data.tasks);
                set(state => ({
                    kanbanLists: {
                        ...state.kanbanLists,
                        [key]: {
                            ids: data.tasks.map(t => t.id),
                            hasMore: data.hasMore,
                            page: data.page || 1,
                            nextCursor: data.nextCursor,
                            totalCount: data.totalCount,
                            timestamp: Date.now()
                        }
                    }
                }));
            },

            getKanbanTasksCache: (key) => {
                const list = get().kanbanLists[key];
                if (!list) return undefined;
                const entities = get().entities;
                return {
                    tasks: list.ids.map(id => entities[id]).filter(Boolean),
                    hasMore: list.hasMore,
                    page: list.page || 1,
                    nextCursor: list.nextCursor,
                    totalCount: list.totalCount,
                    timestamp: list.timestamp
                };
            },

            invalidateSubTaskCache: (taskId) => set(state => {
                const newLists = { ...state.subTaskLists };
                delete newLists[taskId];
                return { subTaskLists: newLists };
            }),

            invalidateProjectCache: (projectId) => set(state => {
                const newLists = { ...state.projectLists };
                delete newLists[projectId];
                // Also clear kanban lists that match this project
                const newKanban = { ...state.kanbanLists };
                Object.keys(newKanban).forEach(key => {
                    if (key.includes(`-${projectId}-`)) {
                        delete newKanban[key];
                    }
                });
                return { projectLists: newLists, kanbanLists: newKanban };
            }),

            invalidateWorkspaceCache: (workspaceId) => set(state => {
                return {
                    subTaskLists: {},
                    projectLists: {},
                    kanbanLists: {},
                    entities: {} // Deep reset
                };
            }),
            clearCache: () => set({
                entities: {},
                subTaskLists: {},
                projectLists: {},
                kanbanLists: {},
                userId: null
            }),
            ensureUser: (userId) => {
                const currentUserId = get().userId;
                if (currentUserId && currentUserId !== userId) {
                    // Different user: wipe everything
                    set({
                        entities: {},
                        subTaskLists: {},
                        projectLists: {},
                        kanbanLists: {},
                        userId: userId
                    });
                } else {
                    // Same user or first login: just set/update userId
                    set({ userId });
                }
            },
        }),
        {
            name: 'tusker-task-cache',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                userId: state.userId,
                entities: state.entities,
                kanbanLists: state.kanbanLists,
                projectLists: state.projectLists
            }),
        }
    )
);
