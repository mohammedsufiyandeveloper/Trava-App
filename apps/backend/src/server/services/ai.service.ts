import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import prisma from "@/lib/db";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY || "");

export class AIService {
    private static model = genAI.getGenerativeModel({
        model: "gemini-pro",
        tools: [
            {
                functionDeclarations: [
                    {
                        name: "get_projects",
                        description: "Get all projects in the current workspace",
                        parameters: {
                            type: SchemaType.OBJECT,
                            properties: {},
                        },
                    },
                    {
                        name: "get_tasks",
                        description: "Get tasks for the current workspace, optionally filtered by project",
                        parameters: {
                            type: SchemaType.OBJECT,
                            properties: {
                                projectId: {
                                    type: SchemaType.STRING,
                                    description: "Optional project ID to filter tasks",
                                },
                                status: {
                                    type: SchemaType.STRING,
                                    description: "Optional status filter (TO_DO, IN_PROGRESS, COMPLETED, etc.)",
                                },
                            },
                        },
                    },
                    {
                        name: "get_attendance_summary",
                        description: "Get a summary of attendance for today in the current workspace",
                        parameters: {
                            type: SchemaType.OBJECT,
                            properties: {},
                        },
                    },
                    {
                        name: "get_my_tasks",
                        description: "Get tasks assigned to the current user",
                        parameters: {
                            type: SchemaType.OBJECT,
                            properties: {},
                        },
                    },
                ],
            },
        ],
    });

    static async chat(workspaceId: string, userId: string, message: string, history: any[] = []) {
        const chatSession = this.model.startChat({
            history: history,
        });

        const systemPrompt = `You are Tusker AI, the intelligent assistant for Tusker Management. 
        You are currently helping a user in Workspace ID: ${workspaceId}. 
        The current User ID is ${userId}.
        
        You can query the database using the provided tools to answer questions about projects, tasks, and attendance.
        If a user asks about their tasks, use get_my_tasks.
        If they ask about projects, use get_projects.
        If they ask about who is present today, use get_attendance_summary.
        
        Always provide clear, formatted responses. Use markdown for lists and bold text for emphasis.`;

        // We add the system prompt as the first message if history is empty
        let result = await chatSession.sendMessage(message + "\n\n(Context: " + systemPrompt + ")");
        
        let response = result.response;
        const functionCalls = response.functionCalls();

        // Handle function calls
        if (functionCalls) {
            const toolOutputs = await Promise.all(
                functionCalls.map(async (call) => {
                    const { name, args } = call;
                    let output;

                    if (name === "get_projects") {
                        output = await prisma.project.findMany({
                            where: { workspaceId },
                            select: { id: true, name: true, description: true, status: true },
                        } as any);
                    } else if (name === "get_tasks") {
                        const taskArgs = args as any;
                        output = await prisma.task.findMany({
                            where: {
                                workspaceId,
                                projectId: taskArgs.projectId || undefined,
                                status: taskArgs.status || undefined,
                            },
                            take: 10,
                            orderBy: { createdAt: "desc" },
                            select: { id: true, name: true, status: true, dueDate: true },
                        });
                    } else if (name === "get_attendance_summary") {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const attendance = await prisma.attendance.findMany({
                            where: {
                                workspaceId,
                                date: today,
                            },
                            include: {
                                workspaceMember: {
                                    include: {
                                        user: {
                                            select: { name: true },
                                        },
                                    },
                                },
                            },
                        });
                        output = attendance.map(a => ({
                            userName: a.workspaceMember.user.name,
                            status: a.status,
                            checkIn: a.checkIn,
                        }));
                    } else if (name === "get_my_tasks") {
                        // Find the workspace member for this user
                        const member = await prisma.workspaceMember.findFirst({
                            where: { userId, workspaceId },
                        });
                        
                        if (!member) return { error: "User not found in workspace" };

                        // Find project members for this workspace member
                        const projectMembers = await prisma.projectMember.findMany({
                            where: { workspaceMemberId: member.id },
                        });

                        output = await prisma.task.findMany({
                            where: {
                                workspaceId,
                                assigneeId: { in: projectMembers.map(pm => pm.id) },
                                status: { not: "COMPLETED" },
                            },
                            select: { id: true, name: true, status: true, dueDate: true },
                        });
                    }

                    return {
                        functionResponse: {
                            name,
                            response: { content: output },
                        },
                    };
                })
            );

            // Send tool outputs back to the model
            result = await chatSession.sendMessage(toolOutputs as any);
            response = result.response;
        }

        return response.text();
    }
}
