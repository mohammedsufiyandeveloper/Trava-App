import React, { createContext, useState, useContext, useEffect, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";
import { getWorkspaces, getProjects, getTasks, getTags, getTodayAttendance, getTeamAttendance } from "../services/api";
import { Workspace, Project, Task } from "../types";

interface WorkspaceStats {
    totalProjects: number;
    totalTasks: number;
    todoTasks: number;
    inProgressTasks: number;
    completedTasks: number;
}

export interface FilterState {
    status: string[];
    assigneeId: string[];
    tagId: string[];
    projectId?: string[];
    search: string;
    dueAfter?: string;
    dueBefore?: string;
    sorts?: Array<{ field: string; direction: "asc" | "desc" }>;
}

export const DEFAULT_FILTERS: FilterState = {
    status: [],
    assigneeId: [],
    tagId: [],
    projectId: [],
    search: "",
    dueAfter: undefined,
    dueBefore: undefined,
    sorts: undefined
};

interface WorkspaceContextType {
    workspaces: Workspace[];
    activeWorkspace: Workspace | null;
    projects: Project[];
    tags: any[];
    tasks: Task[];
    stats: WorkspaceStats;
    loading: boolean;
    todayAttendance: any;
    teamAttendance: any[] | undefined;
    setTodayAttendance: React.Dispatch<React.SetStateAction<any>>;
    setTeamAttendance: React.Dispatch<React.SetStateAction<any[] | undefined>>;
    globalFilters: FilterState;
    setGlobalFilters: (filters: FilterState) => void;
    projectFilters: Record<string, FilterState>;
    setProjectFilters: (projectId: string, filters: FilterState) => void;
    switchWorkspace: (workspace: Workspace | null) => Promise<void>;
    refreshWorkspaces: () => Promise<void>;
    refreshData: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);
const LAST_WS_ID = "last_workspace_id";

const byteSize = (val: any): string => {
    try {
        const str = JSON.stringify(val) ?? "";
        const bytes = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(str).length : str.length;
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    } catch {
        return "N/A";
    }
};

export const WorkspaceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [tags, setTags] = useState<any[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [todayAttendance, setTodayAttendance] = useState<any>(undefined);
    const [teamAttendance, setTeamAttendance] = useState<any[] | undefined>(undefined);
    const [globalFilters, setGlobalFilters] = useState<FilterState>(DEFAULT_FILTERS);
    const [projectFilters, setProjectFiltersState] = useState<Record<string, FilterState>>({});

    const loadedWorkspaceIdRef = React.useRef<string | null>(null);

    const refreshWorkspaces = useCallback(async () => {
        console.log("[WorkspaceContext] Refreshing workspaces and loading dashboard data in parallel...");
        
        // Avoid calling APIs if user is logged out (no token exists)
        const token = await AsyncStorage.getItem("better_auth_token");
        if (!token) {
            console.log("[WorkspaceContext] No authentication token found. Resetting state.");
            setWorkspaces([]);
            setActiveWorkspace(null);
            setProjects([]);
            setTasks([]);
            setTags([]);
            setTodayAttendance(undefined);
            setTeamAttendance(undefined);
            loadedWorkspaceIdRef.current = null;
            setLoading(false);
            return;
        }

        setLoading(true);
        const t0_total = performance.now();
        try {
            // Step 1: Read active workspace ID from cache first
            const lastId = await AsyncStorage.getItem(LAST_WS_ID);
            const todayString = new Date().toISOString().split('T')[0];

            // Step 2: Run workspaces fetch AND workspace-specific fetches in parallel!
            const workspacesPromise = (async () => {
                const t = performance.now();
                const res = await getWorkspaces();
                console.log(`[WorkspaceContext] ⏱ getWorkspaces took ${(performance.now() - t).toFixed(1)}ms (size: ${byteSize(res)})`);
                return res;
            })();

            const projectsPromise = lastId ? (async () => {
                const t = performance.now();
                const res = await getProjects(lastId, true);
                console.log(`[WorkspaceContext] ⏱ getProjects took ${(performance.now() - t).toFixed(1)}ms (size: ${byteSize(res)})`);
                return res;
            })() : Promise.resolve([]);

            const tasksPromise = Promise.resolve([]);

            const tagsPromise = lastId ? (async () => {
                const t = performance.now();
                const res = await getTags(lastId);
                console.log(`[WorkspaceContext] ⏱ getTags took ${(performance.now() - t).toFixed(1)}ms (size: ${byteSize(res)})`);
                return res;
            })() : Promise.resolve([]);

            const attendancePersonalPromise = lastId ? (async () => {
                const t = performance.now();
                const res = await getTodayAttendance(lastId, todayString);
                console.log(`[WorkspaceContext] ⏱ getTodayAttendance (personal) took ${(performance.now() - t).toFixed(1)}ms (size: ${byteSize(res)})`);
                return res;
            })() : Promise.resolve(null);

            // Wait for workspaces first to check the role
            const ws = await workspacesPromise;
            setWorkspaces(ws);

            // Determine active workspace
            let selected: Workspace | null = null;
            if (lastId) {
                selected = ws.find(w => w.id === lastId) || null;
            }
            if (!selected && ws.length > 0) {
                selected = ws[0];
            }

            const role = selected?.workspaceRole;
            const isAdmin = role === "ADMIN" || role === "OWNER";

            const teamAttendancePromise = (selected && isAdmin) ? (async () => {
                const t = performance.now();
                const res = await getTeamAttendance(selected.id, todayString);
                console.log(`[WorkspaceContext] ⏱ getTeamAttendance took ${(performance.now() - t).toFixed(1)}ms (size: ${byteSize(res)})`);
                return res;
            })() : Promise.resolve([]);

            const [projs, ts, tgs, personalAtt, teamAtt] = await Promise.all([
                projectsPromise,
                tasksPromise,
                tagsPromise,
                attendancePersonalPromise,
                teamAttendancePromise
            ]);

            console.log(`[WorkspaceContext] ⏱ Parallel fetch completed in ${(performance.now() - t0_total).toFixed(1)}ms! Workspaces: ${ws.length}, Projects: ${projs.length}, Tasks: ${ts.length}, Tags: ${tgs.length}, Att: ${personalAtt ? "Yes" : "No"}, TeamAtt: ${teamAtt ? teamAtt.length : 0}`);

            if (selected) {
                const fullSelected = ws.find(w => w.id === selected?.id) || selected;
                setActiveWorkspace(fullSelected);

                // If fullSelected.id matches lastId, we already have all parallel data loaded!
                if (fullSelected.id === lastId) {
                    setProjects(projs);
                    setTasks(ts);
                    setTags(tgs);
                    setTodayAttendance(personalAtt);
                    setTeamAttendance(teamAtt);
                    loadedWorkspaceIdRef.current = fullSelected.id;
                } else {
                    // If the active workspace is different (e.g. lastId was invalid or not found in ws), fetch its correct data
                    console.log("[WorkspaceContext] Active workspace mismatch, fetching correct workspace data...");
                    const correctRole = fullSelected?.workspaceRole;
                    const correctIsAdmin = correctRole === "ADMIN" || correctRole === "OWNER";

                    const tMismatch = performance.now();
                    const [correctProjs, correctTs, correctTgs, correctPersonal, correctTeam] = await Promise.all([
                        getProjects(fullSelected.id, true),
                        Promise.resolve([]),
                        getTags(fullSelected.id),
                        getTodayAttendance(fullSelected.id, todayString),
                        correctIsAdmin ? getTeamAttendance(fullSelected.id, todayString) : Promise.resolve([])
                    ]);
                    console.log(`[WorkspaceContext] ⏱ Workspace mismatch fetch took ${(performance.now() - tMismatch).toFixed(1)}ms`);

                    setProjects(correctProjs);
                    setTasks(correctTs);
                    setTags(correctTgs);
                    setTodayAttendance(correctPersonal);
                    setTeamAttendance(correctTeam);
                    loadedWorkspaceIdRef.current = fullSelected.id;
                }
            } else {
                setActiveWorkspace(null);
                setProjects([]);
                setTasks([]);
                setTags([]);
                setTodayAttendance(undefined);
                setTeamAttendance(undefined);
                loadedWorkspaceIdRef.current = null;
            }
        } catch (err) {
            console.error("WorkspaceContext parallel loading error:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    const refreshData = useCallback(async (force = false) => {
        if (!activeWorkspace) {
            setProjects([]);
            setTasks([]);
            setTags([]);
            setTodayAttendance(undefined);
            setTeamAttendance(undefined);
            loadedWorkspaceIdRef.current = null;
            return;
        }

        // If we already loaded this workspace's data and it's not a forced refresh, skip it!
        if (!force && activeWorkspace.id === loadedWorkspaceIdRef.current) {
            console.log("[WorkspaceContext] Data already loaded for workspace:", activeWorkspace.id, "- skipping duplicate automatic fetch.");
            return;
        }

        try {
            console.log("[WorkspaceContext] Fetching workspace data for:", activeWorkspace.id);
            const todayString = new Date().toISOString().split('T')[0];
            const role = activeWorkspace.workspaceRole;
            const isAdmin = role === "ADMIN" || role === "OWNER";

            const tDataStart = performance.now();
            const [projs, ts, tgs, personal, team] = await Promise.all([
                (async () => {
                    const t = performance.now();
                    const res = await getProjects(activeWorkspace.id, true);
                    console.log(`[WorkspaceContext] ⏱ refreshData -> getProjects took ${(performance.now() - t).toFixed(1)}ms (size: ${byteSize(res)})`);
                    return res;
                })(),
                Promise.resolve([]),
                (async () => {
                    const t = performance.now();
                    const res = await getTags(activeWorkspace.id);
                    console.log(`[WorkspaceContext] ⏱ refreshData -> getTags took ${(performance.now() - t).toFixed(1)}ms (size: ${byteSize(res)})`);
                    return res;
                })(),
                (async () => {
                    const t = performance.now();
                    const res = await getTodayAttendance(activeWorkspace.id, todayString);
                    console.log(`[WorkspaceContext] ⏱ refreshData -> getTodayAttendance took ${(performance.now() - t).toFixed(1)}ms (size: ${byteSize(res)})`);
                    return res;
                })(),
                isAdmin ? (async () => {
                    const t = performance.now();
                    const res = await getTeamAttendance(activeWorkspace.id, todayString);
                    console.log(`[WorkspaceContext] ⏱ refreshData -> getTeamAttendance took ${(performance.now() - t).toFixed(1)}ms (size: ${byteSize(res)})`);
                    return res;
                })() : Promise.resolve([])
            ]);
            console.log(`[WorkspaceContext] ⏱ refreshData total took ${(performance.now() - tDataStart).toFixed(1)}ms`);

            setProjects(projs);
            setTasks(ts);
            setTags(tgs);
            setTodayAttendance(personal);
            setTeamAttendance(team);
            loadedWorkspaceIdRef.current = activeWorkspace.id;
        } catch (err) {
            console.error("WorkspaceContext data refresh error:", err);
        }
    }, [activeWorkspace, globalFilters]);

    useEffect(() => {
        refreshWorkspaces();
    }, [refreshWorkspaces]);

    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener("session_changed", () => {
            console.log("[WorkspaceContext] session_changed event received. Re-fetching workspaces...");
            refreshWorkspaces();
        });
        return () => {
            subscription.remove();
        };
    }, [refreshWorkspaces]);

    useEffect(() => {
        refreshData(false);
    }, [activeWorkspace?.id, refreshData]);

    const switchWorkspace = async (workspace: Workspace | null) => {
        if (workspace) {
            // Find full object to ensure workspaceRole is present
            const fullWorkspace = workspaces.find(w => w.id === workspace.id) || workspace;
            setActiveWorkspace(fullWorkspace);
            await AsyncStorage.setItem(LAST_WS_ID, workspace.id);
        } else {
            setActiveWorkspace(null);
            await AsyncStorage.removeItem(LAST_WS_ID);
        }
        setTodayAttendance(undefined);
        setTeamAttendance(undefined);
        setGlobalFilters(DEFAULT_FILTERS); // Reset global filters on switch
        setProjectFiltersState({}); // Reset project filters on switch
    };

    const stats: WorkspaceStats = {
        totalProjects: projects.length,
        totalTasks: tasks.length,
        todoTasks: tasks.filter(t => t.status === "TO_DO").length,
        inProgressTasks: tasks.filter(t => t.status === "IN_PROGRESS").length,
        completedTasks: tasks.filter(t => t.status === "COMPLETED").length,
    };

    const setGlobalFiltersMemo = useCallback((filters: FilterState) => {
        setGlobalFilters(filters);
    }, []);

    const setProjectFilters = useCallback((projectId: string, filters: FilterState) => {
        setProjectFiltersState(p => ({ ...p, [projectId]: filters }));
    }, []);

    return (
        <WorkspaceContext.Provider value={{
            workspaces,
            activeWorkspace,
            projects,
            tags,
            tasks,
            stats,
            loading,
            todayAttendance,
            teamAttendance,
            setTodayAttendance,
            setTeamAttendance,
            globalFilters,
            setGlobalFilters: setGlobalFiltersMemo,
            projectFilters,
            setProjectFilters,
            switchWorkspace,
            refreshWorkspaces,
            refreshData
        }}>
            {children}
        </WorkspaceContext.Provider>
    );
};

export const useWorkspace = (): WorkspaceContextType => {
    const context = useContext(WorkspaceContext);
    if (!context) {
        throw new Error("useWorkspace must be used within a WorkspaceProvider");
    }
    return context;
};
