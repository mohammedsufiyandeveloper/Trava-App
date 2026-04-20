import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function POST(req: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { token } = await req.json();

        if (!token) {
            return NextResponse.json({ error: "Token is required" }, { status: 400 });
        }

        await prisma.user.update({
            where: { id: session.user.id },
            data: { pushToken: token },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error registering push token:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
