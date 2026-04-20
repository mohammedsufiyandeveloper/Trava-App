"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { useSubTaskSheet } from "@/contexts/subtask-sheet-context";
const SubTaskDetailsSheet = dynamic(() => import("@/app/w/[workspaceId]/p/[slug]/_components/shared/subtaskSheet/subtask-details-sheet").then(mod => mod.SubTaskDetailsSheet), {
    ssr: false,
    loading: () => null
});
import { useSearchParams, useParams } from "next/navigation";
import { fetchSubTaskBySlugAction } from "@/actions/task/fetch-subtask-by-slug";

export function GlobalSubTaskSheet() {
    const { isOpen, subTask, openSubTaskSheet, openSubTaskSheetLoading, closeSubTaskSheet, patchSubTask } = useSubTaskSheet();
    const searchParams = useSearchParams();
    const params = useParams();
    const workspaceId = params.workspaceId as string;
    const subTaskSlug = searchParams.get("subtask");

    const lastFetchedSlug = useRef<string | null>(null);

    useEffect(() => {
        // If there's a subtask in URL but it's not the one in our context
        if (subTaskSlug && workspaceId) {
            const currentSlug = subTask?.taskSlug || subTask?.id;

            if (currentSlug !== subTaskSlug && lastFetchedSlug.current !== subTaskSlug) {
                lastFetchedSlug.current = subTaskSlug;

                // Instantly open the sheet to show a generic loading fallback
                openSubTaskSheetLoading();

                const loadTask = async () => {
                    const result = await fetchSubTaskBySlugAction(workspaceId, subTaskSlug);
                    if (result.success && result.subTask) {
                        openSubTaskSheet(result.subTask);
                    } else if (result.error) {
                        console.error("Failed to fetch subtask context:", result.error);
                        // If we can't find it, we should probably clear the param to avoid infinite re-tries
                        // but let's just log for now to avoid side-effects
                    }
                };

                loadTask();
            }
        } else if (!subTaskSlug && isOpen) {
            // URL cleared (e.g. back button), close the sheet
            closeSubTaskSheet();
            lastFetchedSlug.current = null;
        }
    }, [subTaskSlug, subTask, workspaceId, isOpen, openSubTaskSheet, openSubTaskSheetLoading, closeSubTaskSheet]);

    return (
        <SubTaskDetailsSheet
            subTask={subTask}
            isOpen={isOpen}
            onClose={closeSubTaskSheet}
            onSubTaskAssigned={patchSubTask}
        />
    );
}
