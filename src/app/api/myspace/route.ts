import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/require-user";
import prisma from "@/lib/db";

/**
 * GET /api/myspace - Get all personal todos
 * POST /api/myspace - Sync personal todos
 */

export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const workspaceId = request.nextUrl.searchParams.get("workspaceId");
        if (!workspaceId) {
            return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
        }

        const member = await prisma.workspaceMember.findFirst({
            where: {
                userId: session.user.id,
                workspaceId
            }
        });

        if (!member) {
            return NextResponse.json({ error: "Not a workspace member" }, { status: 403 });
        }

        const todos = await prisma.member_todos.findMany({
            where: { memberId: member.id },
            orderBy: { createdAt: "desc" }
        });

        console.log("=== MySpace GET DB Output ===");
        console.log(todos);

        return NextResponse.json({
            success: true,
            todos
        });
    } catch (error: any) {
        console.error("API Error [MySpace GET]:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { todos, workspaceId } = await request.json();
        
        if (!workspaceId) {
            return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
        }
        
        if (!Array.isArray(todos)) {
            return NextResponse.json({ error: "Invalid todos format" }, { status: 400 });
        }

        const member = await prisma.workspaceMember.findFirst({
            where: {
                userId: session.user.id,
                workspaceId
            }
        });

        if (!member) {
            return NextResponse.json({ error: "Not a workspace member" }, { status: 403 });
        }

        const incomingIds = todos.map(t => t.id).filter(id => !id.includes("top-input"));
        
        // 1. Delete todos that were removed
        await prisma.member_todos.deleteMany({
            where: {
                memberId: member.id,
                id: { notIn: incomingIds }
            }
        });

        // 2. Upsert the rest
        for (const todo of todos) {
            if (todo.id.includes("top-input")) continue;
            
            await prisma.member_todos.upsert({
                where: { id: todo.id },
                update: {
                    text: todo.text,
                    completed: todo.completed,
                    completedAt: todo.completedAt ? new Date(todo.completedAt) : null,
                    updatedAt: new Date()
                },
                create: {
                    id: todo.id,
                    memberId: member.id,
                    text: todo.text,
                    completed: todo.completed,
                    createdAt: new Date(todo.createdAt || Date.now()),
                    completedAt: todo.completedAt ? new Date(todo.completedAt) : null,
                    updatedAt: new Date()
                }
            });
        }

        const updatedTodos = await prisma.member_todos.findMany({
            where: { memberId: member.id },
            orderBy: { createdAt: "desc" }
        });

        console.log("=== MySpace POST DB Output ===");
        console.log(updatedTodos);

        return NextResponse.json({
            success: true,
            todos: updatedTodos
        });
    } catch (error: any) {
        console.error("API Error [MySpace POST]:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
