"use server";

import { unitsService } from "@/server/services/units.service";
import { UnitSchemaType } from "@/lib/zodSchemas";
import { requireUser } from "@/lib/auth/require-user";
import { revalidatePath, revalidateTag } from "next/cache";
import { AppError } from "@/lib/errors/app-error";

/**
 * Server Action: Create Unit
 */
export async function createUnitAction(data: UnitSchemaType, workspaceId: string) {
    try {
        const user = await requireUser();
        const result = await unitsService.create(data, workspaceId, user.id);
        
        revalidatePath(`/w/${workspaceId}/inventory`);
        return { success: true, data: result };
    } catch (error) {
        return { 
            success: false, 
            error: error instanceof AppError ? error.message : "Failed to create unit" 
        };
    }
}

/**
 * Server Action: Update Unit
 */
export async function updateUnitAction(id: string, data: UnitSchemaType, workspaceId: string) {
    try {
        const user = await requireUser();
        const result = await unitsService.update(id, data, workspaceId, user.id);
        
        revalidatePath(`/w/${workspaceId}/inventory`);
        return { success: true, data: result };
    } catch (error) {
        return { 
            success: false, 
            error: error instanceof AppError ? error.message : "Failed to update unit" 
        };
    }
}

/**
 * Server Action: Delete Unit
 */
export async function deleteUnitAction(id: string, workspaceId: string) {
    try {
        const user = await requireUser();
        await unitsService.delete(id, workspaceId, user.id);
        
        revalidatePath(`/w/${workspaceId}/inventory`);
        return { success: true, message: "Unit deleted successfully" };
    } catch (error) {
        return { 
            success: false, 
            error: error instanceof AppError ? error.message : "Failed to delete unit" 
        };
    }
}
