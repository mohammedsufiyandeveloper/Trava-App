import { Suspense } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "../_components/sidebar/workspace-sidebar";
import { SiteHeader } from "../_components/sidebar/header/site-header";
import { notFound } from "next/navigation";
import { DailyReportFAB } from "./reports/_components/DailyReportFAB";
import { getWorkspaceLayoutData } from "@/data/workspace/get-workspace-layout-data";
import { WorkspaceClientProviders } from "@/app/w/[workspaceId]/_components/workspace-client-providers";
import { WorkspaceFullSkeleton } from "../_components/workspace-skeleton";

interface Props {
    children: React.ReactNode;
    params: Promise<{ workspaceId: string }>;
}

export default async function WorkSpaceLayout({ children, params }: Props) {
    const { workspaceId } = await params;
    const layoutDataPromise = getWorkspaceLayoutData(workspaceId);
    return (
        <WorkspaceClientProviders>
            <SidebarProvider
                style={
                    {
                        "--sidebar-width": "calc(var(--spacing) * 72)",
                        "--header-height": "calc(var(--spacing) * 12)",
                    } as React.CSSProperties
                }
            >
                {/* Initial layout shell uses a full-page skeleton for a premium boot experience */}
                <Suspense fallback={<WorkspaceFullSkeleton />}>
                    <SidebarLoader dataPromise={layoutDataPromise} workspaceId={workspaceId} />

                    <SidebarInset className="m-0 rounded-none bg-background">
                        <SiteHeader workspaceId={workspaceId} />
                        <div className="flex flex-1 flex-col">
                            <div className="@container/main flex flex-1 flex-col gap-2">
                                <div className="flex flex-col gap-4 py-2 px-4 sm:px-6 lg:px-8">
                                    <WorkspaceAccessGuard dataPromise={layoutDataPromise}>
                                        {children}
                                    </WorkspaceAccessGuard>
                                </div>
                            </div>
                        </div>
                    </SidebarInset>
                </Suspense>

                <Suspense fallback={null}>
                    <DailyReportFABLoader dataPromise={layoutDataPromise} workspaceId={workspaceId} />
                </Suspense>
            </SidebarProvider>
        </WorkspaceClientProviders>
    );
}

async function SidebarLoader({ dataPromise, workspaceId }: { dataPromise: Promise<any>, workspaceId: string }) {
    const { workspaces } = await dataPromise;
    return <AppSidebar data={workspaces as any} workspaceId={workspaceId} />;
}

async function WorkspaceAccessGuard({ dataPromise, children }: { dataPromise: Promise<any>, children: React.ReactNode }) {
    const { metadata } = await dataPromise;

    if (!metadata) {
        return notFound();
    }

    return <>{children}</>;
}

async function DailyReportFABLoader({ dataPromise, workspaceId }: { dataPromise: Promise<any>, workspaceId: string }) {
    const { reportStatus } = await dataPromise;
    return <DailyReportFAB workspaceId={workspaceId} initialStatus={reportStatus.status} />;
}
