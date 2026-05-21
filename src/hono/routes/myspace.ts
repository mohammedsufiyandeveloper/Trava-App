import { Hono } from "hono";
import { HonoVariables } from "../types";
import prisma from "@/lib/db";

const myspace = new Hono<{ Variables: HonoVariables }>();

/**
 * GET /api/myspace?workspaceId=...
 * Fetch all todos for the current member in the given workspace
 */
myspace.get("/", async (c) => {
    const authUser = c.get("user");
    const workspaceId = c.req.query("workspaceId");

    if (!workspaceId) {
        return c.json({ success: false, error: "Missing workspaceId" }, 400);
    }

    try {
        const member = await prisma.workspaceMember.findFirst({
            where: { userId: authUser.id, workspaceId }
        });

        if (!member) {
            return c.json({ success: false, error: "Not a workspace member" }, 403);
        }

        const todos = await prisma.member_todos.findMany({
            where: { memberId: member.id },
            orderBy: { createdAt: "desc" }
        });

        console.log(`[MySpace GET] memberId=${member.id} todos=${JSON.stringify(todos)}`);

        return c.json({ success: true, todos });
    } catch (error: any) {
        console.error("[MySpace GET Error]", error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

/**
 * POST /api/myspace
 * Sync (upsert + delete) todos for the current member in the given workspace
 */
myspace.post("/", async (c) => {
    const authUser = c.get("user");

    try {
        const body = await c.req.json();
        const { workspaceId, todos, text, todoId, completed, deleteTodoId } = body;

        if (!workspaceId) {
            return c.json({ success: false, error: "Missing workspaceId" }, 400);
        }

        const member = await prisma.workspaceMember.findFirst({
            where: { userId: authUser.id, workspaceId }
        });

        if (!member) {
            return c.json({ success: false, error: "Not a workspace member" }, 403);
        }

        // Action 1: Create a single Todo (DB generates the UUID automatically)
        if (typeof text === "string" && text.trim() !== "") {
            await prisma.member_todos.create({
                data: {
                    memberId: member.id,
                    text: text.trim(),
                    completed: false,
                    updatedAt: new Date()
                }
            });
        } 
        // Action 2: Delete a single Todo
        else if (deleteTodoId) {
            await prisma.member_todos.deleteMany({
                where: {
                    id: deleteTodoId,
                    memberId: member.id
                }
            });
        }
        // Action 3: Toggle completed status of a single Todo
        else if (todoId && typeof completed === "boolean") {
            await prisma.member_todos.updateMany({
                where: {
                    id: todoId,
                    memberId: member.id
                },
                data: {
                    completed,
                    completedAt: completed ? new Date() : null,
                    updatedAt: new Date()
                }
            });
        }
        // Action 4: Fallback to old full list sync
        else if (Array.isArray(todos)) {
            const incomingIds = todos
                .map((t: any) => t.id)
                .filter((id: string) => !id.includes("top-input"));

            await prisma.member_todos.deleteMany({
                where: {
                    memberId: member.id,
                    id: { notIn: incomingIds }
                }
            });

            for (const todo of todos) {
                if (todo.id.includes("top-input")) continue;

                const isTempId = todo.id.startsWith("temp-");

                if (isTempId) {
                    await prisma.member_todos.create({
                        data: {
                            memberId: member.id,
                            text: todo.text,
                            completed: todo.completed,
                            createdAt: todo.createdAt ? new Date(todo.createdAt) : new Date(),
                            completedAt: todo.completedAt ? new Date(todo.completedAt) : null,
                            updatedAt: new Date()
                        }
                    });
                } else {
                    await prisma.member_todos.upsert({
                        where: { id: todo.id },
                        update: {
                            text: todo.text,
                            completed: todo.completed,
                            createdAt: todo.createdAt ? new Date(todo.createdAt) : undefined,
                            completedAt: todo.completedAt ? new Date(todo.completedAt) : null,
                            updatedAt: new Date()
                        },
                        create: {
                            id: todo.id,
                            memberId: member.id,
                            text: todo.text,
                            completed: todo.completed,
                            createdAt: todo.createdAt ? new Date(todo.createdAt) : new Date(),
                            completedAt: todo.completedAt ? new Date(todo.completedAt) : null,
                            updatedAt: new Date()
                        }
                    });
                }
            }
        }

        const updatedTodos = await prisma.member_todos.findMany({
            where: { memberId: member.id },
            orderBy: { createdAt: "desc" }
        });

        console.log(`[MySpace POST] memberId=${member.id} saved=${updatedTodos.length} todos`);

        return c.json({ success: true, todos: updatedTodos });
    } catch (error: any) {
        console.error("[MySpace POST Error]", error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

export default myspace;
