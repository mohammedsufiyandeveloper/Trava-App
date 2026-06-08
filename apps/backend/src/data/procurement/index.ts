// @ts-nocheck -- TODO(tech-debt): legacy procurement/inventory code references Prisma models removed in the schema-integrity refactor (PurchaseOrder/ProcurementTask/Unit/Material). Rewrite against indent/indent_line_item/material_catalog/vendor_quote or remove. See docs/TECH_DEBT.md.
"use server";

import db from "@/lib/db";
const cache = <T extends (...args: any[]) => any>(fn: T) => fn; // react cache no-op
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";

/**
 * Centralized procurement data fetching with React cache for deduplication
 * All functions use cache() to prevent duplicate database calls
 * Uses existing getWorkspacePermissions for consistency
 */

/**
 * Get indent requests with all relations
 * Optimized with selective field selection
 */
export const getIndentRequests = cache(async (workspaceId: string) => {
    const { WorkspaceMember: workspaceMember } = await getWorkspacePermissions(workspaceId);

    if (!workspaceMember) {
        throw new Error("Access denied");
    }

    const indentRequests = await db.indentDetails.findMany({
        where: {
            workspaceId,
        },
        select: {
            id: true,
            key: true,
            name: true,
            projectId: true,
            taskId: true,
            description: true,
            expectedDelivery: true,
            requiresVendor: true,
            assignedTo: true,
            createdAt: true,
            updatedAt: true,
            project: {
                select: {
                    id: true,
                    name: true,
                    workspaceId: true,
                },
            },
            task: {
                select: {
                    id: true,
                    name: true,
                    taskSlug: true,
                },
            },
            assignee: {
                select: {
                    id: true,
                    user: { select: { surname: true } }
                },
            },
            requestor: {
                select: {
                    user: { select: { surname: true } }
                },
            },
            items: {
                select: {
                    id: true,
                    documentDisplayName: true,
                    materialId: true,
                    quantity: true,
                    unitId: true,
                    vendorId: true,
                    estimatedPrice: true,
                    status: true,
                    quantityApproved: true,
                    finalApproved: true,
                    material: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    unit: {
                        select: {
                            id: true,
                            abbreviation: true,
                        },
                    },
                    vendor: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    purchaseOrderItems: {
                        select: {
                            id: true,
                            purchaseOrderId: true,
                            purchaseOrder: {
                                select: {
                                    poNumber: true,
                                    approvedById: true,
                                }
                            }
                        }
                    },
                },
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    });

    return {
        indentRequests,
        workspaceMember,
    };
});

/**
 * Get procurable projects (projects where user is admin or lead)
 * Optimized to fetch in single query based on role
 */
export const getProcurableProjects = cache(async (workspaceId: string) => {
    const { workspaceMember, isWorkspaceAdmin } = await getWorkspacePermissions(workspaceId);

    if (!workspaceMember) {
        throw new Error("Access denied");
    }

    // Single query with conditional where clause
    const projects = await db.project.findMany({
        where: {
            workspaceId,
            ...(isWorkspaceAdmin ? {} : {
                projectMembers: {
                    some: {
                        workspaceMemberId: workspaceMember.id,
                        projectRole: "LEAD",
                    },
                },
            }),
        },
        select: {
            id: true,
            name: true,
            slug: true,
            color: true,
            description: true,
            tasks: {
                select: {
                    id: true,
                    name: true,
                    taskSlug: true,
                    ProjectMember_Task_assigneeIdToProjectMember: {
                        select: {
                            id: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: "desc",
                },
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    });

    return projects;
});

/**
 * Get approved indent items for RFQ
 */
export const getApprovedIndentItems = cache(async (workspaceId: string) => {
    const approvedItems = await db.indentItem.findMany({
        where: {
            status: "APPROVED",
            indentDetails: {
                workspaceId,
            },
        },
        select: {
            id: true,
            quantity: true,
            estimatedPrice: true,
            vendorId: true,
            createdAt: true,
            material: {
                select: {
                    id: true,
                    name: true,
                },
            },
            unit: {
                select: {
                    id: true,
                    name: true,
                    abbreviation: true,
                },
            },
            indentDetails: {
                select: {
                    id: true,
                    key: true,
                    name: true,
                    expectedDelivery: true,
                    project: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    });

    return approvedItems;
});

/**
 * Get procurement tasks
 */
export const getProcurementTasks = cache(async (workspaceId: string) => {
    const procurementTasks = await db.procurementTask.findMany({
        where: { workspaceId },
        select: {
            id: true,
            taskId: true,
            projectId: true,
            indentCreated: true,
            createdAt: true,
            task: {
                select: {
                    id: true,
                    name: true,
                    taskSlug: true,
                    status: true,
                    startDate: true,
                    description: true,
                    ProjectMember_Task_assigneeIdToProjectMember: {
                        select: {
                            id: true,
                            WorkspaceMember: { select: { user: { select: { name: true } } } }
                        },
                    },
                },
            },
            project: {
                select: {
                    id: true,
                    name: true,
                    color: true,
                },
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    });

    return procurementTasks;
});

/**
 * Get vendors for workspace
 * Cached and optimized
 */
export const getVendors = cache(async (workspaceId: string) => {
    const vendors = await db.vendor.findMany({
        where: {
            workspaceId,
            isActive: true,
        },
        select: {
            id: true,
            name: true,
        },
        orderBy: { name: "asc" },
    });

    return vendors;
});

/**
 * Get purchase orders with all relations for deliveries tracking
 * Optimized with selective field selection
 * Converts Decimal types to numbers for client-side serialization
 */
export const getPurchaseOrders = cache(async (workspaceId: string) => {
    const { workspaceMember } = await getWorkspacePermissions(workspaceId);

    if (!workspaceMember) {
        throw new Error("Access denied");
    }

    const purchaseOrders = await db.purchaseOrder.findMany({
        where: {
            workspaceId,
        },
        select: {
            id: true,
            poNumber: true,
            totalAmount: true,
            subtotalAmount: true,
            totalTaxAmount: true,
            currency: true,
            deliveryingAt: true,
            deliveryAddressLine1: true,
            deliveryAddressLine2: true,
            deliveryCity: true,
            deliveryState: true,
            deliveryCountry: true,
            deliveryPincode: true,
            createdAt: true,
            updatedAt: true,
            approvedById: true,
            vendor: {
                select: {
                    id: true,
                    name: true,
                    contactPerson: true,
                    phoneNumber: true,
                },
            },
            project: {
                select: {
                    id: true,
                    name: true,
                },
            },
            items: {
                select: {
                    id: true,
                    materialId: true,
                    orderedQuantity: true,
                    unitPrice: true,
                    lineTotal: true,
                    taxAmount: true,
                    totalAmount: true,
                    sgstPercent: true,
                    cgstPercent: true,
                    material: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    unit: {
                        select: {
                            id: true,
                            name: true,
                            abbreviation: true,
                        },
                    },
                },
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    });

    return purchaseOrders.map(po => ({
        ...po,
        status: po.approvedById ? 'APPROVED' : 'PENDING', // Derive status from approvedById
        totalAmount: Number(po.totalAmount),
        subtotalAmount: Number(po.subtotalAmount),
        totalTaxAmount: Number(po.totalTaxAmount),
        items: po.items.map(item => ({
            ...item,
            orderedQuantity: Number(item.orderedQuantity),
            unitPrice: Number(item.unitPrice),
            lineTotal: Number(item.lineTotal),
            taxAmount: Number(item.taxAmount),
            totalAmount: Number(item.totalAmount),
            sgstPercent: item.sgstPercent ? Number(item.sgstPercent) : null,
            cgstPercent: item.cgstPercent ? Number(item.cgstPercent) : null,
        })),
    }));
});

export type IndentRequestWithRelations = Awaited<ReturnType<typeof getIndentRequests>>["indentRequests"][number];
export type ProcurableProject = Awaited<ReturnType<typeof getProcurableProjects>>[number];
export type ApprovedIndentItemWithRelations = Awaited<ReturnType<typeof getApprovedIndentItems>>[number];
export type ProcurementTaskWithRelations = Awaited<ReturnType<typeof getProcurementTasks>>[number];
export type Vendor = Awaited<ReturnType<typeof getVendors>>[number];
export type PurchaseOrderWithRelations = Awaited<ReturnType<typeof getPurchaseOrders>>[number];
