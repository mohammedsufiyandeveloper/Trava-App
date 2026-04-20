"use client";

import { ReactNode, Suspense } from "react";
import dynamic from "next/dynamic";
import { SubTaskSheetProvider } from "@/contexts/subtask-sheet-context";

const GlobalSubTaskSheet = dynamic(() => import("@/components/global-subtask-sheet").then(mod => mod.GlobalSubTaskSheet), {
    ssr: false,
});

export function WorkspaceClientProviders({ children }: { children: ReactNode }) {
    return (
        <SubTaskSheetProvider>
            {children}
            <Suspense fallback={null}>
                <GlobalSubTaskSheet />
            </Suspense>
        </SubTaskSheetProvider>
    );
}
