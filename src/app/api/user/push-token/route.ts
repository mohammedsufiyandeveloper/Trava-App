import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/require-user";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/user/push-token
 * Saves the Expo push token for the current user so the backend can send push notifications.
 * Body: { pushToken: string }
 */
export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { pushToken } = body;

        if (!pushToken || typeof pushToken !== "string") {
            return NextResponse.json({ error: "pushToken is required" }, { status: 400 });
        }

        await prisma.user.update({
            where: { id: session.user.id },
            data: { pushToken },
        });

        console.log(`[PUSH_TOKEN] Saved token for user ${session.user.id}: ${pushToken.slice(0, 20)}...`);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("API Error [push-token POST]:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

/**
 * DELETE /api/user/push-token
 * Clears the push token (e.g., on logout).
 */
export async function DELETE(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await prisma.user.update({
            where: { id: session.user.id },
            data: { pushToken: null },
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("API Error [push-token DELETE]:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
