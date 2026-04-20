"use server";

import db from "@/lib/db";
import { cache } from "react";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";

/**
 * Get complete purchase order details for display in slide sheet
 * Includes workspace details, vendor details, delivery address, items, and terms
 */
export const getPODetails = cache(async (poId: string) => {
    const purchaseOrder = await db.purchaseOrder.findUnique({
        where: {
            id: poId,
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
            termsAndConditions: true,
            createdAt: true,
            updatedAt: true,
            workspaceId: true,

            // Workspace details
            workspace: {
                select: {
                    id: true,
                    name: true,
                    legalName: true,
                    gstNumber: true,
                    panNumber: true,
                    companyType: true,
                    industry: true,
                    msmeNumber: true,
                    addressLine1: true,
                    addressLine2: true,
                    city: true,
                    state: true,
                    country: true,
                    pincode: true,
                    email: true,
                    phone: true,
                },
            },

            // Vendor details
            vendor: {
                select: {
                    id: true,
                    name: true,
                    companyName: true,
                    contactPerson: true,
                    phoneNumber: true,
                    email: true,
                    address: true,
                    gstNumber: true,
                },
            },

            // Project details
            project: {
                select: {
                    id: true,
                    name: true,
                },
            },

            // PO Items
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
                            specifications: true,
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
                orderBy: {
                    createdAt: 'asc',
                },
            },

            // Terms and Conditions
            purchaseOrderTerms: {
                select: {
                    id: true,
                    termNumber: true,
                    title: true,
                    content: true,
                },
                orderBy: {
                    termNumber: 'asc',
                },
            },
        },
    });

    if (!purchaseOrder) {
        throw new Error("Purchase order not found");
    }

    // Verify user has access to this workspace
    const { workspaceMember } = await getWorkspacePermissions(purchaseOrder.workspaceId);

    if (!workspaceMember) {
        throw new Error("Access denied");
    }

    // Convert Decimal types to numbers for client-side serialization
    return {
        ...purchaseOrder,
        totalAmount: Number(purchaseOrder.totalAmount),
        subtotalAmount: Number(purchaseOrder.subtotalAmount),
        totalTaxAmount: Number(purchaseOrder.totalTaxAmount),
        items: purchaseOrder.items.map(item => ({
            ...item,
            orderedQuantity: Number(item.orderedQuantity),
            unitPrice: Number(item.unitPrice),
            lineTotal: Number(item.lineTotal),
            taxAmount: Number(item.taxAmount),
            totalAmount: Number(item.totalAmount),
            sgstPercent: item.sgstPercent ? Number(item.sgstPercent) : null,
            cgstPercent: item.cgstPercent ? Number(item.cgstPercent) : null,
        })),
    };
});

export type PODetailsType = Awaited<ReturnType<typeof getPODetails>>;
