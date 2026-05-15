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

        const todos = await prisma.mySpaceTodo.findMany({
            where: { userId: session.user.id },
            orderBy: { createdAt: "desc" }
        });

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

        const { todos } = await request.json();
        if (!Array.isArray(todos)) {
            return NextResponse.json({ error: "Invalid todos format" }, { status: 400 });
        }

        // Perform a bulk sync
        // For simplicity in a personal space, we can delete removed ones and upsert others
        // Or just wipe and replace if the list is small (it is personal notes)
        // Let's do a more careful upsert/delete

        const incomingIds = todos.map(t => t.id).filter(id => !id.includes("top-input"));
        
        // 1. Delete todos that were removed
        await prisma.mySpaceTodo.deleteMany({
            where: {
                userId: session.user.id,
                id: { notIn: incomingIds }
            }
        });

        // 2. Upsert the rest
        for (const todo of todos) {
            if (todo.id.includes("top-input")) continue;
            
            await prisma.mySpaceTodo.upsert({
                where: { id: todo.id },
                update: {
                    text: todo.text,
                    completed: todo.completed,
                    completedAt: todo.completedAt ? new Date(todo.completedAt) : null,
                },
                create: {
                    id: todo.id,
                    userId: session.user.id,
                    text: todo.text,
                    completed: todo.completed,
                    createdAt: new Date(todo.createdAt || Date.now()),
                    completedAt: todo.completedAt ? new Date(todo.completedAt) : null,
                }
            });
        }

        const updatedTodos = await prisma.mySpaceTodo.findMany({
            where: { userId: session.user.id },
            orderBy: { createdAt: "desc" }
        });

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
