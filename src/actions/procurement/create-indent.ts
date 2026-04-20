"use server";
import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getUserPermissions } from "@/data/user/get-user-permissions";
import { createIndentRequestSchema, type CreateIndentRequestInput } from "@/lib/zodSchemas";

export async function createIndentRequest(input: CreateIndentRequestInput) {
    try {
        // Validate input
        const validatedData = createIndentRequestSchema.parse(input);

        // Check permissions using the centralized utility (this also fetches workspaceMember)
        const permissions = await getUserPermissions(validatedData.workspaceId, validatedData.projectId);

        if (!permissions.workspaceMember) {
            return { success: false, error: "You don't have access to this workspace" };
        }

        if (!permissions.isWorkspaceAdmin && !permissions.isProjectLead) {
            return { success: false, error: "Only Admin or Project Lead can create indents for this project" };
        }

        const workspaceMember = permissions.workspaceMember;

        // Parallel validation queries for better performance
        const [itemRequestor, projectWithTask] = await Promise.all([
            // Verify assignedTo member belongs to workspace
            db.workspaceMember.findFirst({
                where: { userId: validatedData.assignedTo, workspaceId: validatedData.workspaceId },
                select: { id: true },
            }),
            // Verify project and optionally task in one query
            db.project.findFirst({
                where: {
                    id: validatedData.projectId,
                    workspaceId: validatedData.workspaceId,
                },
                include: {
                    tasks: validatedData.taskId ? {
                        where: { id: validatedData.taskId },
                        select: { id: true },
                    } : false,
                },
            }),
        ]);

        if (!itemRequestor) {
            return { success: false, error: "Invalid assignee selected or not in workspace" };
        }

        if (!projectWithTask) {
            return { success: false, error: "Invalid project" };
        }

        // If taskId is provided, verify it was found
        if (validatedData.taskId) {
            const tasks = (projectWithTask as any).tasks as { id: string }[] | undefined;
            if (!tasks || tasks.length === 0) {
                return { success: false, error: "Invalid task" };
            }
        }

        // Generate unique indent key
        const lastIndent = await db.indentDetails.findFirst({
            where: {
                projectId: validatedData.projectId,
            },
            orderBy: {
                createdAt: "desc",
            },
            select: {
                key: true,
            },
        });

        let indentNumber = 1;
        if (lastIndent?.key) {
            const match = lastIndent.key.match(/IND-(\d+)/);
            if (match) {
                indentNumber = parseInt(match[1]) + 1;
            }
        }

        const indentKey = `IND-${indentNumber.toString().padStart(3, "0")}`;

        // Create indent request with status history and items
        const indentRequest = await db.indentDetails.create({
            data: {
                key: indentKey,
                name: validatedData.name,
                projectId: validatedData.projectId,
                taskId: validatedData.taskId || null,
                description: validatedData.description || null,
                expectedDelivery: validatedData.expectedDelivery || null,
                requiresVendor: validatedData.requiresVendor ?? true,
                requestedBy: workspaceMember.userId,
                workspaceId: validatedData.workspaceId,
                assignedTo: validatedData.assignedTo,
                items: validatedData.materials ? {
                    create: validatedData.materials.map((item) => {
                        const hasVendor = !!item.vendorId;
                        const hasPrice = !!item.estimatedPrice;
                        const isAdmin = permissions.isWorkspaceAdmin;

                        // Determine status and approval fields based on admin and vendor presence
                        let status: "PENDING" | "QUANTITY_APPROVED" | "VENDOR_PENDING" | "APPROVED" = "PENDING";
                        let quantityApproved = false;
                        let quantityApprovedBy: string | null = null;
                        let quantityApprovedAt: Date | null = null;
                        let finalApproved = false;
                        let finalApprovedBy: string | null = null;
                        let finalApprovedAt: Date | null = null;

                        if (isAdmin) {
                            const now = new Date();

                            if (hasVendor && hasPrice) {
                                // Admin created with vendor + price → Full approval
                                status = "APPROVED";
                                quantityApproved = true;
                                quantityApprovedBy = workspaceMember.userId;
                                quantityApprovedAt = now;
                                finalApproved = true;
                                finalApprovedBy = workspaceMember.userId;
                                finalApprovedAt = now;
                            } else {
                                // Admin created without vendor → Quantity approved
                                status = "QUANTITY_APPROVED";
                                quantityApproved = true;
                                quantityApprovedBy = workspaceMember.userId;
                                quantityApprovedAt = now;
                            }
                        }

                        return {
                            materialId: item.materialId,
                            quantity: item.quantity,
                            unitId: item.unitId,
                            estimatedPrice: item.estimatedPrice || null,
                            vendorId: item.vendorId || null,
                            documentDisplayName: item.documentDisplayName || "",
                            status,
                            quantityApproved,
                            quantityApprovedBy,
                            quantityApprovedAt,
                            finalApproved,
                            finalApprovedBy,
                            finalApprovedAt,
                        };
                    }),
                } : undefined,

            },
            include: {
                project: {
                    select: {
                        name: true,
                    },
                },
            },
        });

        // Update ProcurementTask status if applicable
        if (validatedData.taskId) {
            await db.procurementTask.updateMany({
                where: { taskId: validatedData.taskId },
                data: { indentCreated: true }
            });
        }

        // Revalidate the procurement page
        revalidatePath(`/w/${validatedData.workspaceId}/procurement`);

        return {
            success: true,
            data: {
                id: indentRequest.id,
                key: indentRequest.key,
                name: indentRequest.name,
            },
        };
    } catch (error) {
        console.error("Error creating indent request:", error);
        return { success: false, error: "Failed to create indent request" };
    }
}
