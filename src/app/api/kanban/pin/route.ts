import { pinSubTask } from "@/actions/task/kanban/pin-subtask";
import { generateOperationId } from "@/lib/idempotency";
import { NextRequest, NextResponse } from "next/server";

interface PinCardRequest {
    subTaskId: string;
    isPinned: boolean;
    operationId?: string;
    workspaceId: string;
    projectId: string;
}

/**
 * API Route: Pin/Unpin Kanban Card
 * 
 * POST /api/kanban/pin
 * 
 * Pins or unpins a subtask in the Kanban board. Pinned cards appear at the top of their column.
 * Only project admins and leads can pin/unpin cards.
 * Supports idempotency via operationId to prevent duplicate operations.
 * 
 * Example Request (Pin):
 * ```json
 * {
 *   "subTaskId": "clx123abc",
 *   "isPinned": true,
 *   "operationId": "pin-clx123abc-1702123456789",
 *   "projectId": "proj_123",
 *   "workspaceId": "ws_456"
 * }
 * ```
 * 
 * Example Request (Unpin):
 * ```json
 * {
 *   "subTaskId": "clx123abc",
 *   "isPinned": false,
 *   "operationId": "unpin-clx123abc-1702123456790",
 *   "projectId": "proj_123",
 *   "workspaceId": "ws_456"
 * }
 * ```
 * 
 * Example Response (Success):
 * ```json
 * {
 *   "success": true,
 *   "subTask": {
 *     "id": "clx123abc",
 *     "isPinned": true,
 *     "pinnedAt": "2025-12-09T11:21:33Z",
 *     "updatedAt": "2025-12-09T11:21:33Z"
 *   },
 *   "auditLog": {
 *     "id": "audit_790",
 *     "operationId": "pin-clx123abc-1702123456789",
 *     "action": "PIN",
 *     "timestamp": "2025-12-09T11:21:33Z"
 *   }
 * }
 * ```
 * 
 * Example Response (Error):
 * ```json
 * {
 *   "success": false,
 *   "error": "You are not authorized to pin/unpin cards. Only project admins and leads can pin cards."
 * }
 * ```
 */
export async function POST(request: NextRequest) {
    try {
        const body: PinCardRequest = await request.json();

        // Validate required fields
        if (!body.subTaskId || typeof body.isPinned !== "boolean" || !body.workspaceId || !body.projectId) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Missing required fields: subTaskId, isPinned (boolean), workspaceId, projectId",
                },
                { status: 400 }
            );
        }

        // Generate operation ID if not provided
        const operationId = body.operationId || generateOperationId(
            body.isPinned ? "pin" : "unpin",
            body.subTaskId
        );

        // Call server action
        const result = await pinSubTask(
            body.subTaskId,
            body.isPinned,
            operationId,
            body.workspaceId,
            body.projectId
        );

        if (!result.success) {
            return NextResponse.json(result, { status: 403 });
        }

        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        console.error("Error in pin card API:", error);
        return NextResponse.json(
            {
                success: false,
                error: "An unexpected error occurred while pinning/unpinning the card. Please try again.",
            },
            { status: 500 }
        );
    }
}
