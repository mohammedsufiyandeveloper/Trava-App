import { getBoardData } from "@/data/board/get-board-data";
import BoardClient from "./_components/board-client";
import { notFound } from "next/navigation";

interface PageProps {
    params: Promise<{ workspaceId: string }>;
}

export default async function MyBoardPage({ params }: PageProps) {
    const { workspaceId } = await params;

    // Fetch unified board data (auto-filtered by role)
    const data = await getBoardData(workspaceId);

    // If no access or not found
    if (!data.currentMemberId && !data.isOwner) {
        return notFound();
    }

    return (
        <div className="container max-w-screen-2xl mx-auto">
            <BoardClient data={data} workspaceId={workspaceId} />
        </div>
    );
}

export async function generateMetadata({ params }: PageProps) {
    const { workspaceId } = await params;
    return {
        title: `Workspace Board | Tusker`,
        description: `Manage team notes and personal focus items within the workspace.`,
    };
}