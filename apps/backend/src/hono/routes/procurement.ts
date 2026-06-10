import { Hono } from "hono";
import { HonoVariables } from "../types";
import prisma from "@/lib/db";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";
import { IndentStatus, LineItemStatus, QuoteStatus } from "@prisma/client";

const procurement = new Hono<{ Variables: HonoVariables }>();

// Helper to generate UUIDs
const generateId = () => {
    return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
};

/**
 * GET /api/procurement/indents
 * Fetches all indents in a workspace
 */
procurement.get("/indents", async (c) => {
    const user = c.get("user");
    const workspaceId = c.req.query("workspaceId");
    const indentId = c.req.query("indentId");
    const requestedLimit = Number.parseInt(c.req.query("limit") || "25", 10);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 50)
        : 25;
    const cursor = c.req.query("cursor") || undefined;
    const search = c.req.query("search")?.trim() || undefined;

    if (!workspaceId) {
        return c.json({ success: false, error: "workspaceId is required" }, 400);
    }

    try {
        const { workspaceMember } = await getWorkspacePermissions(workspaceId, user.id);
        if (!workspaceMember) {
            return c.json({ success: false, error: "Access denied" }, 403);
        }

        const indentInclude = {
            Project: {
                select: { id: true, name: true, color: true }
            },
            Task: {
                select: { id: true, name: true, taskSlug: true }
            },
            WorkspaceMember_indent_requestedByIdToWorkspaceMember: {
                include: { user: { select: { id: true, name: true, surname: true, image: true, email: true } } }
            },
            WorkspaceMember_indent_assignedToIdToWorkspaceMember: {
                include: { user: { select: { id: true, name: true, surname: true, image: true, email: true } } }
            },
            indent_line_item: {
                include: {
                    vendor_quote_indent_line_item_approvedQuoteIdTovendor_quote: {
                        include: { vendor: { select: { id: true, name: true } } }
                    },
                    vendor_quote_vendor_quote_lineItemIdToindent_line_item: {
                        include: { vendor: { select: { id: true, name: true } } }
                    }
                }
            }
        } as const;

        if (indentId) {
            const indent = await prisma.indent.findFirst({
                where: { id: indentId, workspaceId },
                include: indentInclude,
            });
            if (!indent) {
                return c.json({ success: false, error: "Indent not found" }, 404);
            }
            return c.json({ success: true, indent });
        }

        const rows = await prisma.indent.findMany({
            where: {
                workspaceId,
                ...(search
                    ? {
                        OR: [
                            { name: { contains: search, mode: "insensitive" } },
                            { indentId: { contains: search, mode: "insensitive" } },
                            {
                                Project: {
                                    is: {
                                        name: {
                                            contains: search,
                                            mode: "insensitive",
                                        },
                                    },
                                },
                            },
                        ],
                    }
                    : {}),
            },
            include: {
                ...indentInclude,
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });

        const hasMore = rows.length > limit;
        const indents = rows.slice(0, limit);
        return c.json({
            success: true,
            indents,
            hasMore,
            nextCursor: hasMore
                ? indents[indents.length - 1]?.id ?? null
                : null,
        });
    } catch (error: any) {
        console.error("[procurement.get.indents] Error:", error);
        return c.json({ success: false, error: error.message || "Internal Server Error" }, 500);
    }
});

/**
 * GET /api/procurement/procurable-projects
 * Gets projects where user is member/lead/admin
 */
procurement.get("/procurable-projects", async (c) => {
    const user = c.get("user");
    const workspaceId = c.req.query("workspaceId");

    if (!workspaceId) {
        return c.json({ success: false, error: "workspaceId is required" }, 400);
    }

    try {
        const { workspaceMember, isWorkspaceAdmin } = await getWorkspacePermissions(workspaceId, user.id);
        if (!workspaceMember) {
            return c.json({ success: false, error: "Access denied" }, 403);
        }

        const projects = await prisma.project.findMany({
            where: {
                workspaceId,
                ...(isWorkspaceAdmin ? {} : {
                    projectMembers: {
                        some: {
                            WorkspaceMember: { userId: user.id }
                        }
                    }
                })
            },
            select: {
                id: true,
                name: true,
                slug: true,
                color: true,
                description: true,
                tasks: {
                    select: { id: true, name: true, taskSlug: true }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        return c.json({ success: true, projects });
    } catch (error: any) {
        console.error("[procurement.get.projects] Error:", error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

/**
 * GET /api/procurement/vendors
 * Lists active vendors
 */
procurement.get("/vendors", async (c) => {
    const user = c.get("user");
    const workspaceId = c.req.query("workspaceId");

    if (!workspaceId) {
        return c.json({ success: false, error: "workspaceId is required" }, 400);
    }

    try {
        const { workspaceMember } = await getWorkspacePermissions(workspaceId, user.id);
        if (!workspaceMember) {
            return c.json({ success: false, error: "Access denied" }, 403);
        }

        const vendors = await prisma.vendor.findMany({
            where: { workspaceId, isActive: true },
            include: {
                vendor_material_capability: true
            },
            orderBy: { name: "asc" }
        });

        return c.json({ success: true, vendors });
    } catch (error: any) {
        console.error("[procurement.get.vendors] Error:", error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

/**
 * GET /api/procurement/materials
 * Lists autocomplete materials catalog
 */
procurement.get("/materials", async (c) => {
    const user = c.get("user");
    const workspaceId = c.req.query("workspaceId");

    if (!workspaceId) {
        return c.json({ success: false, error: "workspaceId is required" }, 400);
    }

    try {
        const { workspaceMember } = await getWorkspacePermissions(workspaceId, user.id);
        if (!workspaceMember) {
            return c.json({ success: false, error: "Access denied" }, 403);
        }

        const materials = await prisma.material_catalog.findMany({
            where: { workspaceId },
            orderBy: { name: "asc" }
        });

        return c.json({ success: true, materials });
    } catch (error: any) {
        console.error("[procurement.get.materials] Error:", error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

/**
 * POST /api/procurement/indents
 * Creates a new indent request
 */
procurement.post("/indents", async (c) => {
    const user = c.get("user");
    const workspaceId = c.req.query("workspaceId");

    if (!workspaceId) {
        return c.json({ success: false, error: "workspaceId is required" }, 400);
    }

    try {
        const { workspaceMember } = await getWorkspacePermissions(workspaceId, user.id);
        if (!workspaceMember) {
            return c.json({ success: false, error: "Access denied" }, 403);
        }

        const body = await c.req.json();
        const { projectId, taskId, name, description, expectedDelivery, assignedToId, materials } = body;

        if (!projectId || !name) {
            return c.json({ success: false, error: "projectId and name are required" }, 400);
        }

        // Calculate sequential key IND-XXX
        const lastIndent = await prisma.indent.findFirst({
            where: { workspaceId },
            orderBy: { createdAt: "desc" },
            select: { indentId: true }
        });

        let serial = 1;
        if (lastIndent?.indentId) {
            const match = lastIndent.indentId.match(/IND-(\d+)/);
            if (match) serial = parseInt(match[1]) + 1;
        }
        const indentIdStr = `IND-${serial.toString().padStart(3, "0")}`;

        const newIndent = await prisma.$transaction(async (tx) => {
            const ind = await tx.indent.create({
                data: {
                    id: generateId(),
                    indentId: indentIdStr,
                    workspaceId,
                    projectId,
                    taskId: taskId || null,
                    name,
                    description: description || null,
                    expectedDelivery: expectedDelivery ? new Date(expectedDelivery) : null,
                    requestedById: workspaceMember.id,
                    assignedToId: assignedToId || null,
                    status: IndentStatus.SUBMITTED,
                    submittedAt: new Date(),
                    updatedAt: new Date()
                }
            });

            if (materials && Array.isArray(materials) && materials.length > 0) {
                const itemsData = materials.map((m: any) => ({
                    id: generateId(),
                    indentId: ind.id,
                    materialName: m.materialName,
                    description: m.description || null,
                    unit: m.unit || "unit",
                    quantity: parseInt(m.quantity || 0, 10),
                    estimatedUnitPrice: m.estimatedUnitPrice ? parseInt(m.estimatedUnitPrice, 10) : null,
                    specifications: m.specifications || null,
                    status: LineItemStatus.PENDING,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }));

                await tx.indent_line_item.createMany({ data: itemsData });

                // Sync newly inputted materials to autocomplete catalog
                for (const m of materials) {
                    await tx.material_catalog.upsert({
                        where: { workspaceId_name: { workspaceId, name: m.materialName } },
                        create: {
                            id: generateId(),
                            workspaceId,
                            name: m.materialName,
                            unit: m.unit || "unit",
                            source: "INDENT",
                            updatedAt: new Date()
                        },
                        update: {
                            unit: m.unit || "unit",
                            updatedAt: new Date()
                        }
                    });
                }
            }

            return ind;
        });

        return c.json({ success: true, indent: newIndent });
    } catch (error: any) {
        console.error("[procurement.post.indent] Error:", error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

/**
 * PATCH /api/procurement/indents/:id
 * Edits an indent (deletes/re-creates line items for safety)
 */
procurement.patch("/indents/:id", async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const workspaceId = c.req.query("workspaceId");

    if (!workspaceId) {
        return c.json({ success: false, error: "workspaceId is required" }, 400);
    }

    try {
        const { workspaceMember } = await getWorkspacePermissions(workspaceId, user.id);
        const existingIndent = await prisma.indent.findUnique({
            where: { id },
            include: { indent_line_item: true }
        });

        if (!existingIndent || existingIndent.workspaceId !== workspaceId) {
            return c.json({ success: false, error: "Indent not found" }, 404);
        }

        const body = await c.req.json();
        const { projectId, taskId, name, description, expectedDelivery, assignedToId, materials } = body;

        await prisma.$transaction(async (tx) => {
            await tx.indent.update({
                where: { id },
                data: {
                    projectId,
                    taskId: taskId || null,
                    name,
                    description: description || null,
                    expectedDelivery: expectedDelivery ? new Date(expectedDelivery) : null,
                    assignedToId: assignedToId || null,
                    updatedAt: new Date()
                }
            });

            // Delete old and insert new line items
            await tx.indent_line_item.deleteMany({ where: { indentId: id } });

            if (materials && Array.isArray(materials) && materials.length > 0) {
                const itemsData = materials.map((m: any) => ({
                    id: generateId(),
                    indentId: id,
                    materialName: m.materialName,
                    description: m.description || null,
                    unit: m.unit || "unit",
                    quantity: parseInt(m.quantity || 0, 10),
                    estimatedUnitPrice: m.estimatedUnitPrice ? parseInt(m.estimatedUnitPrice, 10) : null,
                    specifications: m.specifications || null,
                    status: LineItemStatus.PENDING,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }));

                await tx.indent_line_item.createMany({ data: itemsData });

                for (const m of materials) {
                    await tx.material_catalog.upsert({
                        where: { workspaceId_name: { workspaceId, name: m.materialName } },
                        create: {
                            id: generateId(),
                            workspaceId,
                            name: m.materialName,
                            unit: m.unit || "unit",
                            source: "INDENT",
                            updatedAt: new Date()
                        },
                        update: {
                            unit: m.unit || "unit",
                            updatedAt: new Date()
                        }
                    });
                }
            }
        });

        return c.json({ success: true, message: "Indent updated successfully" });
    } catch (error: any) {
        console.error("[procurement.patch.indent] Error:", error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

/**
 * DELETE /api/procurement/indents/:id
 * Deletes an indent request
 */
procurement.delete("/indents/:id", async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const workspaceId = c.req.query("workspaceId");

    if (!workspaceId) {
        return c.json({ success: false, error: "workspaceId is required" }, 400);
    }

    try {
        const { workspaceMember } = await getWorkspacePermissions(workspaceId, user.id);
        const existingIndent = await prisma.indent.findUnique({
            where: { id }
        });

        if (!existingIndent || existingIndent.workspaceId !== workspaceId) {
            return c.json({ success: false, error: "Indent not found" }, 404);
        }

        // Delete line items first due to relational constraints if cascade isn't set, then indent
        await prisma.$transaction([
            prisma.indent_line_item.deleteMany({ where: { indentId: id } }),
            prisma.indent.delete({ where: { id } })
        ]);

        return c.json({ success: true, message: "Indent deleted successfully" });
    } catch (error: any) {
        console.error("[procurement.delete.indent] Error:", error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

/**
 * POST /api/procurement/items/:itemId/approve-quantity
 * Approves a line item's requested quantity (Admins only)
 */
procurement.post("/items/:itemId/approve-quantity", async (c) => {
    const user = c.get("user");
    const itemId = c.req.param("itemId");
    const workspaceId = c.req.query("workspaceId");

    if (!workspaceId) {
        return c.json({ success: false, error: "workspaceId is required" }, 400);
    }

    try {
        const { isWorkspaceAdmin } = await getWorkspacePermissions(workspaceId, user.id);
        if (!isWorkspaceAdmin) {
            return c.json({ success: false, error: "Only Admins can approve quantities" }, 403);
        }

        const item = await prisma.indent_line_item.findUnique({ where: { id: itemId } });
        if (!item) {
            return c.json({ success: false, error: "Line item not found" }, 404);
        }

        // Transition from PENDING to RFQ_SENT to signify that sourcing starts
        await prisma.indent_line_item.update({
            where: { id: itemId },
            data: {
                status: LineItemStatus.RFQ_SENT,
                rfqSentAt: new Date(),
                updatedAt: new Date()
            }
        });

        return c.json({ success: true, message: "Quantity approved successfully, item status moved to RFQ_SENT" });
    } catch (error: any) {
        console.error("[procurement.post.approve-qty] Error:", error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

/**
 * POST /api/procurement/items/:itemId/add-quote
 * Adds a vendor quote for a line item (Leads/Admins)
 */
procurement.post("/items/:itemId/add-quote", async (c) => {
    const user = c.get("user");
    const itemId = c.req.param("itemId");
    const workspaceId = c.req.query("workspaceId");

    if (!workspaceId) {
        return c.json({ success: false, error: "workspaceId is required" }, 400);
    }

    try {
        const { workspaceMember } = await getWorkspacePermissions(workspaceId, user.id);
        if (!workspaceMember) {
            return c.json({ success: false, error: "Access denied" }, 403);
        }

        const item = await prisma.indent_line_item.findUnique({ where: { id: itemId } });
        if (!item) {
            return c.json({ success: false, error: "Line item not found" }, 404);
        }

        const body = await c.req.json();
        const { vendorId, unitPrice, quantity, leadTimeDays, notes } = body;

        if (!vendorId || !unitPrice || !quantity) {
            return c.json({ success: false, error: "vendorId, unitPrice, and quantity are required" }, 400);
        }

        const parsedUnitPrice = parseFloat(unitPrice);
        const parsedQuantity = parseFloat(quantity);
        const totalPrice = parsedUnitPrice * parsedQuantity;

        await prisma.$transaction(async (tx) => {
            // Create quote
            await tx.vendor_quote.create({
                data: {
                    id: generateId(),
                    lineItemId: itemId,
                    vendorId,
                    unitPrice: parsedUnitPrice,
                    quantity: parsedQuantity,
                    totalPrice: totalPrice,
                    leadTimeDays: leadTimeDays ? parseInt(leadTimeDays, 10) : null,
                    notes: notes || null,
                    status: QuoteStatus.SUBMITTED,
                    updatedAt: new Date()
                }
            });

            // Update item status to signify quotes are ready
            await tx.indent_line_item.update({
                where: { id: itemId },
                data: {
                    status: LineItemStatus.QUOTES_RECEIVED,
                    updatedAt: new Date()
                }
            });
        });

        return c.json({ success: true, message: "Quote submitted successfully" });
    } catch (error: any) {
        console.error("[procurement.post.add-quote] Error:", error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

/**
 * POST /api/procurement/items/:itemId/approve-quote
 * Approves a specific quote for a line item (Admins only)
 */
procurement.post("/items/:itemId/approve-quote", async (c) => {
    const user = c.get("user");
    const itemId = c.req.param("itemId");
    const workspaceId = c.req.query("workspaceId");

    if (!workspaceId) {
        return c.json({ success: false, error: "workspaceId is required" }, 400);
    }

    try {
        const { isWorkspaceAdmin, workspaceMember } = await getWorkspacePermissions(workspaceId, user.id);
        if (!isWorkspaceAdmin || !workspaceMember) {
            return c.json({ success: false, error: "Only Admins can approve quotes" }, 403);
        }

        const body = await c.req.json();
        const { quoteId } = body;

        if (!quoteId) {
            return c.json({ success: false, error: "quoteId is required" }, 400);
        }

        const item = await prisma.indent_line_item.findUnique({
            where: { id: itemId },
            include: { indent: true }
        });

        if (!item) {
            return c.json({ success: false, error: "Line item not found" }, 404);
        }

        await prisma.$transaction(async (tx) => {
            // Approve quote
            await tx.vendor_quote.update({
                where: { id: quoteId },
                data: {
                    status: QuoteStatus.APPROVED,
                    reviewedById: workspaceMember.id,
                    reviewedAt: new Date(),
                    updatedAt: new Date()
                }
            });

            // Mark quote as approved on item and change state
            await tx.indent_line_item.update({
                where: { id: itemId },
                data: {
                    status: LineItemStatus.APPROVED,
                    approvedQuoteId: quoteId,
                    updatedAt: new Date()
                }
            });

            // If all items in this indent are now APPROVED, mark indent itself as APPROVED
            const indentId = item.indentId;
            const remainingUnapproved = await tx.indent_line_item.count({
                where: {
                    indentId,
                    status: { not: LineItemStatus.APPROVED }
                }
            });

            if (remainingUnapproved === 0) {
                await tx.indent.update({
                    where: { id: indentId },
                    data: {
                        status: IndentStatus.APPROVED,
                        finalApprovedAt: new Date(),
                        finalApprovedById: workspaceMember.id,
                        updatedAt: new Date()
                    }
                });
            }
        });

        return c.json({ success: true, message: "Quote approved and item marked APPROVED" });
    } catch (error: any) {
        console.error("[procurement.post.approve-quote] Error:", error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

/**
 * POST /api/procurement/items/:itemId/reject
 * Rejects a line item
 */
procurement.post("/items/:itemId/reject", async (c) => {
    const user = c.get("user");
    const itemId = c.req.param("itemId");
    const workspaceId = c.req.query("workspaceId");

    if (!workspaceId) {
        return c.json({ success: false, error: "workspaceId is required" }, 400);
    }

    try {
        const { isWorkspaceAdmin } = await getWorkspacePermissions(workspaceId, user.id);
        if (!isWorkspaceAdmin) {
            return c.json({ success: false, error: "Only Admins can reject items" }, 403);
        }

        const body = await c.req.json();
        const { reason } = body;

        await prisma.indent_line_item.update({
            where: { id: itemId },
            data: {
                status: LineItemStatus.REJECTED,
                rejectionReason: reason || "No reason specified",
                updatedAt: new Date()
            }
        });

        return c.json({ success: true, message: "Item rejected successfully" });
    } catch (error: any) {
        console.error("[procurement.post.reject] Error:", error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

export default procurement;
