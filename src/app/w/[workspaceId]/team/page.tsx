import { Suspense } from "react";
import { TeamMembers } from "./_components/team-members-table";
import { AppLoader } from "@/components/shared/app-loader";
import { getWorkspaceMembers } from "@/data/workspace";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";

export const dynamic = "force-dynamic";

interface TeamPageProps {
    params: Promise<{ workspaceId: string }>;
}

// ─── Streaming components ────────────────────────────────────────────────────

async function TeamMembersList({ workspaceId }: { workspaceId: string }) {
    // Parallelize permission check and members fetch to reduce waterfall
    const [permissions, data] = await Promise.all([
        getWorkspacePermissions(workspaceId),
        getWorkspaceMembers(workspaceId)
    ]);

    return (
        <TeamMembers
            data={data.workspaceMembers}
            isAdmin={permissions.isWorkspaceAdmin}
            workspaceId={workspaceId}
        />
    );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function TeamPage({ params }: TeamPageProps) {
    const { workspaceId } = await params;

    return (
        <div className="w-full">
            <Suspense fallback={<AppLoader />}>
                <TeamMembersList workspaceId={workspaceId} />
            </Suspense>
        </div>
    );
}
