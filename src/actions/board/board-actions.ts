"use server";

import prisma from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";
import { revalidatePath } from "next/cache";
import { BoardStatus } from"@prisma/client";
import { ApiResponse } from "@/lib/types";

export async function createBoardItem(workspaceId: string, memberId: string, note: string): Promise<ApiResponse> {
    try {
        const user = await requireUser();
        const perms = await getWorkspacePermissions(workspaceId, user.id);

        if (!perms.isWorkspaceAdmin && perms.WorkspaceMemberId !== memberId) {
            return { status: "error", message: "Unauthorized: You can only add notes to your own board." };
        }

        const newItem = await prisma.member_todos.create({
            data: {
                memberId,
                text: note,
                completed: false,
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

        const newCompleted = currentStatus === "DONE" ? false : true;

        await prisma.member_todos.update({
            where: { id: itemId },
            data: {
                completed: newCompleted,
                completedAt: newCompleted ? new Date() : null,
                updatedAt: new Date()
            }
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

        // Fetch the item
        const item = await prisma.member_todos.findUnique({
            where: { id: itemId }
        });

        if (!item) return { status: "error", message: "Note not found" };

        // Security: Ensure user has permission to delete this specific item
        // They must be an admin OR the owner of the todo
        const isCardOwner = item.memberId === perms.WorkspaceMemberId;

        if (!perms.isWorkspaceAdmin && !isCardOwner) {
            return { status: "error", message: "Unauthorized: You don't have permission to delete this note." };
        }

        await prisma.member_todos.delete({
            where: { id: itemId }
        });

        revalidatePath(`/w/${workspaceId}/my-board`);
        return { status: "success", message: "Note deleted" };
    } catch (error) {
        console.error("Error deleting item:", error);
        return { status: "error", message: "Failed to delete note" };
    }
}
