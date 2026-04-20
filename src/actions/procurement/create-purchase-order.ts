'use server';

import db from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { getUserPermissions } from '@/data/user/get-user-permissions';
import { generatePONumber } from '@/utils/po-utils';
import { CreatePOInput, createPOSchema } from '@/lib/zodSchemas';

export async function createPurchaseOrder(
    workspaceId: string,
    data: CreatePOInput
) {
    try {
        // 1. Validate input
        const validated = createPOSchema.safeParse(data);
        if (!validated.success) {
            return {
                success: false,
                error: validated.error.issues[0]?.message || 'Invalid input',
            };
        }

        // 2. Check permissions
        const permissions = await getUserPermissions(workspaceId, validated.data.projectId);

        if (!permissions.workspaceMember) {
            return { success: false, error: 'Unauthorized' };
        }

        const canCreate = permissions.isWorkspaceAdmin || permissions.isProjectLead || permissions.workspaceMember.workspaceRole !== 'VIEWER';

        if (!canCreate) {
            return { success: false, error: 'You do not have permission to create purchase orders' };
        }

        // 3. Verify vendor exists and belongs to workspace
        const vendor = await db.vendor.findFirst({
            where: {
                id: validated.data.vendorId,
                workspaceId,
                isActive: true,
            },
        });

        if (!vendor) {
            return { success: false, error: 'Vendor not found or inactive' };
        }

        // 4. If projectId provided, verify it belongs to workspace
        if (validated.data.projectId) {
            const project = await db.project.findFirst({
                where: {
                    id: validated.data.projectId,
                    workspaceId,
                },
            });

            if (!project) {
                return { success: false, error: 'Project not found' };
            }
        }

        // 5. Generate PO number
        const poNumber = await generatePONumber(workspaceId);

        // 6. Calculate totals for each item
        const itemsWithTotals = validated.data.items.map((item) => {
            const lineTotal = item.orderedQuantity * item.unitPrice;
            const sgst = item.sgstPercent || 0;
            const cgst = item.cgstPercent || 0;
            const taxAmount = (lineTotal * (sgst + cgst)) / 100;
            const totalAmount = lineTotal + taxAmount;

            return {
                materialId: item.materialId,
                unitId: item.unitId,
                orderedQuantity: item.orderedQuantity,
                unitPrice: item.unitPrice,
                sgstPercent: item.sgstPercent || null,
                cgstPercent: item.cgstPercent || null,
                lineTotal: Math.round(lineTotal * 100) / 100,
                taxAmount: Math.round(taxAmount * 100) / 100,
                totalAmount: Math.round(totalAmount * 100) / 100,
                indentItemId: item.indentItemId || null,
            };
        });

        // 7. Calculate PO totals
        const subtotalAmount = itemsWithTotals.reduce(
            (sum, item) => sum + item.lineTotal,
            0
        );
        const totalTaxAmount = itemsWithTotals.reduce(
            (sum, item) => sum + item.taxAmount,
            0
        );
        const totalAmount = itemsWithTotals.reduce(
            (sum, item) => sum + item.totalAmount,
            0
        );

        // 8. Create PO with items in a transaction
        const purchaseOrder = await db.$transaction(async (tx) => {
            const po = await tx.purchaseOrder.create({
                data: {
                    poNumber,
                    workspaceId,
                    vendorId: validated.data.vendorId,
                    projectId: validated.data.projectId,
                    subtotalAmount: Math.round(subtotalAmount * 100) / 100,
                    totalTaxAmount: Math.round(totalTaxAmount * 100) / 100,
                    totalAmount: Math.round(totalAmount * 100) / 100,
                    currency: 'INR',
                    createdById: permissions.workspaceMemberId,
                    deliveryAddressLine1: validated.data.deliveryAddress,
                    deliveryingAt: validated.data.deliveryDate,
                    deliveryCountry: validated.data.deliveryCountry,
                    deliveryState: validated.data.deliveryState,
                    deliveryCity: validated.data.deliveryCity,
                    deliveryPincode: validated.data.deliveryPincode,
                    termsAndConditions: validated.data.termsAndConditions,
                    purchaseOrderTerms: {
                        create: validated.data.terms?.map((term, index) => ({
                            termNumber: index + 1,
                            content: term,
                        })) || [],
                    },
                    items: {
                        create: itemsWithTotals,
                    },
                },
                include: {
                    items: {
                        include: {
                            material: true,
                            unit: true,
                        },
                    },
                    vendor: true,
                    project: true,
                    createdBy: {
                        select: {
                            user: {
                                select: {
                                    name: true,
                                    email: true,
                                }
                            }
                        },
                    },
                },
            });

            return po;
        });

        // 9. Revalidate cache
        revalidatePath(`/w/${workspaceId}/procurement/po`);

        return {
            success: true,
            message: `Purchase Order ${purchaseOrder.poNumber} created successfully`,
            data: {
                id: purchaseOrder.id,
                poNumber: purchaseOrder.poNumber,
            },
        };
    } catch (error) {
        console.error('Error creating purchase order:', error);
        return {
            success: false,
            error: 'Failed to create purchase order. Please try again.',
        };
    }
}
