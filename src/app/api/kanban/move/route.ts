import { NextRequest, NextResponse } from "next/server";
import { updateSubTaskStatus } from "@/actions/task/kanban/update-subtask-status";

type TaskStatus = "TO_DO" | "IN_PROGRESS" | "CANCELLED" | "REVIEW" | "HOLD" | "COMPLETED";

interface MoveCardRequest {
    subTaskId: string;
    newStatus: TaskStatus;
    workspaceId: string;
    projectId: string;
    activityId?: string;
}

export async function POST(request: NextRequest) {
    try {
        const body: MoveCardRequest = await request.json();

        // Validate required fields
        if (!body.subTaskId || !body.newStatus || !body.workspaceId || !body.projectId) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Missing required fields: subTaskId, newStatus, workspaceId, projectId",
                },
                { status: 400 }
            );
        }

        // Validate status
        const validStatuses: TaskStatus[] = ["TO_DO", "IN_PROGRESS", "CANCELLED", "REVIEW", "HOLD", "COMPLETED"];
        if (!validStatuses.includes(body.newStatus)) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Invalid status: ${body.newStatus}. Must be one of: ${validStatuses.join(", ")}`,
                },
                { status: 400 }
            );
        }

        // Call server action
        const result = await updateSubTaskStatus(
            body.subTaskId,
            body.newStatus,
            body.workspaceId,
            body.projectId,
            body.activityId
        );

        if (!result.success) {
            return NextResponse.json(result, { status: 403 });
        }

        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        console.error("Error in move card API:", error);
        return NextResponse.json(
            {
                success: false,
                error: "An unexpected error occurred while moving the card. Please try again.",
            },
            { status: 500 }
        );
    }
}
