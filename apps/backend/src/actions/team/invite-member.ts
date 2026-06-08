"use server";

import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { inviteUserSchema, InviteUserSchemaType } from "@/lib/zodSchemas";
import { broadcastTeamUpdate } from "@/lib/realtime";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";
import { ApiResponse } from "@/lib/types";
const revalidatePath = (..._args: any[]) => {}; // next/cache no-op

/**
 * Shared logic to invite a user to a workspace.
 * Used by both Server Actions and API Route Handlers.
 */
export async function inviteMemberAction(
    values: InviteUserSchemaType
): Promise<ApiResponse> {
    const permissions = await getWorkspacePermissions(values.workspaceId);
    if (!permissions.isWorkspaceAdmin) {
        return { status: "error", message: "Only workspace admins can invite members." };
    }

    const parsed = inviteUserSchema.safeParse(values);
    if (!parsed.success) {
        return {
            status: "error",
            message: "Invalid input data",
        };
    }
    const {
        name,
        niceName,
        email,
        password,
        role,
        workspaceId,
        phoneNumber,
    } = parsed.data;

    let createdAuthUserId: string | undefined;

    try {
        // Create auth user
        const authResult = await auth.api.signUpEmail({
            body: {
                email,
                password,
                name,
            },
        });

        const authUserId = authResult?.user?.id;
        if (!authUserId) {
            throw new Error("Failed to create auth user");
        }
        createdAuthUserId = authUserId;

        // Create user and workspace member records
        await prisma.$transaction([
            prisma.user.upsert({
                where: { id: authUserId },
                create: {
                    id: authUserId,
                    name,
                    email,
                    surname: niceName ?? null,
                    phoneNumber: phoneNumber ?? null,
                },
                update: {
                    name,
                    surname: niceName ?? null,
                    phoneNumber: phoneNumber ?? null,
                    email,
                },
            }),

            prisma.workspaceMember.upsert({
                where: {
                    userId_workspaceId: {
                        userId: authUserId,
                        workspaceId,
                    },
                },
                create: {
                    userId: authUserId,
                    workspaceId,
                    workspaceRole: role,
                },
                update: {
                    workspaceRole: role,
                },
            }),
        ]);

        // Invalidate caches
        revalidatePath(`/w/${workspaceId}/team`);
        const { invalidateUserWorkspaces, invalidateWorkspaceMembers } = await import('@/lib/cache/invalidation');
        await invalidateUserWorkspaces(authUserId);
        await invalidateWorkspaceMembers(workspaceId);

        // 4. Record Activity & Broadcast
        const { recordActivity } = await import("@/lib/audit");

        // Get the actor who is performing the invite.
        // Priority: AsyncLocalStorage (Hono middleware) → authUserId fallback
        let actorId: string = authUserId; // safe fallback (wrong but won't crash)
        try {
            const { requireUser } = await import("@/lib/auth/require-user");
            const actor = await requireUser();
            if (actor?.id) actorId = actor.id;
        } catch {
            // Not in a Hono request context — keep the authUserId fallback.
            // (Previously attempted a next/headers session lookup; that path was
            // dead after the Next.js backend was removed, so it has been dropped.)
        }

        // Fetch surname from DB directly — Better Auth session does not include custom fields
        const actorMember = await prisma.workspaceMember.findFirst({
            where: { userId: actorId, workspaceId },
            include: { user: { select: { name: true, surname: true } } }
        });
        const actorName = actorMember?.user?.surname || actorMember?.user?.name || "Someone";

        await recordActivity({
            userId: actorId,
            userName: actorName,
            workspaceId,
            action: "MEMBER_INVITED",
            entityType: "MEMBER",
            entityId: authUserId,
            newData: { email, name, surname: niceName || name, role },
            customMessage: `${niceName || name} was invited to the workspace`,
            broadcastEvent: "team_update",
            targetUserIds: [authUserId],
        });

        return {
            status: "success",
            message: "Invitation sent successfully.",
        };
    } catch (err: any) {
        console.error("inviteMemberAction error:", err);

        // Cleanup auth user on failure
        if (createdAuthUserId) {
            try {
                if ((auth.api as any).removeUser) {
                    await (auth.api as any).removeUser({ 
                        body: { userId: createdAuthUserId } 
                    });
                }
            } catch (cleanupErr) {
                console.error("Failed to delete auth user after DB error:", cleanupErr);
            }
        }

        return {
            status: "error",
            message: "Failed to invite user",
        };
    }
}
