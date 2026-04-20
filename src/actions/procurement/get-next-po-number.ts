'use server';

import { generatePONumber } from '@/utils/po-utils';

/**
 * Server action to get the next PO number for a workspace
 * This wraps the generatePONumber utility to make it callable from client components
 */
export async function getNextPONumber(workspaceId: string): Promise<string> {
    return await generatePONumber(workspaceId);
}
