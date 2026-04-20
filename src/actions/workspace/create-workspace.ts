"use server";

import prisma from "@/lib/db";
import { ApiResponse } from "@/lib/types";
import { workSpaceSchema, WorkSpaceSchemaType } from "@/lib/zodSchemas";
import { requireUser } from "@/lib/auth/require-user";
import { generateInviteCode } from "@/utils/get-invite-code";
import { revalidateTag } from "next/cache";
import { CacheTags } from "@/data/cache-tags";
import { invalidateWorkspacesCache } from "@/data/workspace/get-workspaces";

export async function createWorkSpace(values: WorkSpaceSchemaType): Promise<ApiResponse> {

    const user = await requireUser();

    try {
        const validation = workSpaceSchema.safeParse(values);
        if (!validation.success) {
            return {
                status: "error",
                message: "Invalid validation form data"
            }
        }

        await prisma.workspace.create({
            data: {
                ...validation.data,
                ownerId: user.id,
                inviteCode: generateInviteCode(),
                members: {
                    create: {
                        userId: user.id,
                        workspaceRole: "OWNER",
                    }
                }
            },
        });

        // Invalidate cache to ensure the user is not redirected back to create-workspace
        invalidateWorkspacesCache(user.id);
        (revalidateTag as any)(CacheTags.userWorkspaces(user.id)[0], 'layout');
        (revalidateTag as any)('workspaces', 'layout');

        return {
            status: "success",
            message: "Workspace created successfully",
        };

    } catch {
        return {
            status: "error",
            message: "Login before creating workspace",
        }
    }
}
