import { Suspense } from "react";
import { getWorkspaceTagsWithCount } from "@/data/tag/get-tags";
import { TagsManager } from "./_components/tag/tags-manager";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";
import { AppLoader } from "@/components/shared/app-loader";

export const revalidate = 60; // 1 minute ISR revalidation

interface SettingsPageProps {
    params: Promise<{ workspaceId: string }>;
}

// ─── Streaming component ─────────────────────────────────────────────────────

async function SettingsContent({ workspaceId }: { workspaceId: string }) {
    const [tagsData, permissions] = await Promise.all([
        getWorkspaceTagsWithCount(workspaceId),
        getWorkspacePermissions(workspaceId),
    ]);

    const tags = tagsData.map((tag) => ({
        id: tag.id,
        name: tag.name,
        requirePurchase: tag.requirePurchase ?? false,
        _count: tag._count,
    }));

    return (
        <div className="space-y-2">
            <TagsManager
                workspaceId={workspaceId}
                tags={tags}
                isWorkspaceAdmin={permissions.isWorkspaceAdmin}
            />
        </div>
    );
}

// ─── Page ────────────────────────────────────────────────────────────────────

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ActivityPage from "./activity/page";
import { History, Settings2 } from "lucide-react";

/**
 * Settings Page — static heading renders immediately; content streams in via AppLoader.
 */
export default async function SettingsPage({ params }: SettingsPageProps) {
    const { workspaceId } = await params;

    return (
        <div className="w-full">
            {/* Static heading — no fetch needed */}
            <div className="mb-6 sm:mb-8">
                <h1 className="text-2xl font-bold">Settings</h1>
                <p className="text-muted-foreground mt-2">
                    Manage your workspace preferences and configurations
                </p>
            </div>

            <Tabs defaultValue="general" className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="general" className="flex items-center gap-2">
                        <Settings2 className="h-4 w-4" />
                        General
                    </TabsTrigger>
                    <TabsTrigger value="activity" className="flex items-center gap-2">
                        <History className="h-4 w-4" />
                        Activity Log
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="general">
                    <Suspense fallback={<AppLoader />}>
                        <SettingsContent workspaceId={workspaceId} />
                    </Suspense>
                </TabsContent>

                <TabsContent value="activity">
                    <Suspense fallback={<AppLoader />}>
                        <ActivityPage params={params} />
                    </Suspense>
                </TabsContent>
            </Tabs>
        </div>
    );
}
