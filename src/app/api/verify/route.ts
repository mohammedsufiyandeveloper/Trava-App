// /app/api/verify/route.ts
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

export async function GET(req: NextRequest) {
  try {
    // Get authenticated user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }

    const userId = session.user.id;

    // try {
    //   // Only update if needed
    //   if (!session.user.emailVerified) {
    //     await prisma.user.update({
    //       where: { id: userId },
    //       data: { emailVerified: true },
    //     });
    //   } else {
    //     // optionally ensure DB is consistent even if session has true but DB doesn't
    //     await prisma.user.update({
    //       where: { id: userId },
    //       data: { emailVerified: true },
    //     });
    //   }
    // } catch (uErr) {
    //   // don't break the whole flow on update failure; log for debugging
    //   console.error("Failed to set emailVerified:", uErr);
    // }

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");
    const role = searchParams.get("role");

    if (!workspaceId || !role) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // Check if user already exists in workspace
    const existingMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: session.user.id,
          workspaceId,
        },
      },
    });

    if (!existingMember) {
      // Add user to workspace
      await prisma.workspaceMember.create({
        data: {
          workspaceId,
          userId: session.user.id,
          workspaceRole: role as "ADMIN" | "MEMBER" | "VIEWER",
        },
      });
    }

    // Redirect to workspace
    return NextResponse.redirect(new URL(`/w/${workspaceId}`, req.url));
  } catch (error) {
    console.error("Verify error:", error);
    return NextResponse.redirect(new URL("/error", req.url));
  }
}
