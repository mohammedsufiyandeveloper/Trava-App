"use server";

import prisma from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";
import { revalidatePath } from "next/cache";
import { BoardStatus } from"@prisma/client";
import { ApiResponse } from "@/lib/types";
import crypto from "crypto";

export async function createBoardItem(workspaceId: string, memberId: string, note: string): Promise<ApiResponse> {
    try {
        const user = await requireUser();
        const perms = await getWorkspacePermissions(workspaceId, user.id);

        if (!perms.isWorkspaceAdmin && perms.WorkspaceMemberId !== memberId) {
            return { status: "error", message: "Unauthorized: You can only add notes to your own board." };
        }

        const newItem = await prisma.board_items.create({
            data: {
                id: crypto.randomUUID(),
                workspaceId,
                memberId,
                assignedById: perms.WorkspaceMemberId!,
                note,
                status: "NOT_DONE",
                updatedAt: new Date()
            }
        });

        revalidatePath(`/w/${workspaceId}/my-board`);
        return { status: "success", message: "Note added successfully", data: newItem };
    } catch (error) {
        console.error("Error creating board item:", error);
        return { status: "error", message: "Failed to create note" };
    }
}

export async function toggleBoardItemStatus(workspaceId: string, itemId: string, currentStatus: BoardStatus): Promise<ApiResponse> {
    try {
        const user = await requireUser();
        const perms = await getWorkspacePermissions(workspaceId, user.id);

        const newStatus: BoardStatus = currentStatus === "DONE" ? "NOT_DONE" : "DONE";

        await prisma.board_items.update({
            where: { id: itemId },
            data: { status: newStatus }
        });

        revalidatePath(`/w/${workspaceId}/my-board`);
        return { status: "success", message: "Status updated" };
    } catch (error) {
        console.error("Error toggling status:", error);
        return { status: "error", message: "Failed to update status" };
    }
}

export async function deleteBoardItem(workspaceId: string, itemId: string): Promise<ApiResponse> {
    try {
        const user = await requireUser();
        const perms = await getWorkspacePermissions(workspaceId, user.id);

        // Fetch the item to check its assigner
        const item = await prisma.board_items.findUnique({
            where: { id: itemId },
            include: {
                WorkspaceMember_board_items_assignedByIdToWorkspaceMember: {
                    select: { workspaceRole: true }
                }
            }
        });

        if (!item) return { status: "error", message: "Note not found" };

        const assignerRole = item.WorkspaceMember_board_items_assignedByIdToWorkspaceMember.workspaceRole;
        const isAdminAssigner = assignerRole === "OWNER" || assignerRole === "ADMIN";

        // Security: Regular members cannot delete notes created by Admin/Owner
        if (!perms.isWorkspaceAdmin && isAdminAssigner) {
            return { status: "error", message: "You cannot delete notes created by an Admin." };
        }

        // Security: Ensure user has permission to delete this specific items
        // They must be an admin OR the assigner OR the owner of the card (if it wasn't assigned by admin)
        const isAssigner = item.assignedById === perms.WorkspaceMemberId;
        const isCardOwner = item.memberId === perms.WorkspaceMemberId;

        if (!perms.isWorkspaceAdmin && !isAssigner && !isCardOwner) {
            return { status: "error", message: "Unauthorized: You don't have permission to delete this note." };
        }

        await prisma.board_items.delete({
            where: { id: itemId }
        });

        revalidatePath(`/w/${workspaceId}/my-board`);
        return { status: "success", message: "Note deleted" };
    } catch (error) {
        console.error("Error deleting item:", error);
        return { status: "error", message: "Failed to delete note" };
    }
}
