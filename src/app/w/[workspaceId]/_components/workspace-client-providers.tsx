"use client";

import { ReactNode, Suspense } from "react";
import dynamic from "next/dynamic";
import { SubTaskSheetProvider } from "@/contexts/subtask-sheet-context";
import { RealtimeNotificationListener } from "./realtime-notification-listener";

const GlobalSubTaskSheet = dynamic(() => import("@/components/global-subtask-sheet").then(mod => mod.GlobalSubTaskSheet), {
    ssr: false,
});

export function WorkspaceClientProviders({ children }: { children: ReactNode }) {
    return (
        <SubTaskSheetProvider>
            {children}
            <Suspense fallback={null}>
                <RealtimeNotificationListener />
                <GlobalSubTaskSheet />
            </Suspense>
        </SubTaskSheetProvider>
    );
}
