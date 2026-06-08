import db from '@/lib/db';

/**
 * Generates a unique Purchase Order number for a workspace
 * Format: WT/YYYY-YYYY/NNNNNN
 * Example: WT/2025-2026/000001
 * 
 * @param workspaceId - The workspace ID
 * @returns Promise<string> - The generated PO number
 */
export async function generatePONumber(workspaceId: string): Promise<string> {
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    const yearRange = `${currentYear}-${nextYear}`;

    // Get the last PO number for this workspace and year range
    const lastPO = await db.purchaseOrder.findFirst({
        where: {
            workspaceId,
            poNumber: { startsWith: `WT/${yearRange}/` },
        },
        orderBy: { createdAt: 'desc' },
    });

    let sequence = 1;
    if (lastPO) {
        // Extract sequence from format: WT/2025-2026/000001
        const match = lastPO.poNumber.match(/WT\/\d{4}-\d{4}\/(\d+)/);
        sequence = match ? parseInt(match[1]) + 1 : 1;
    }

    // Format: WT/2025-2026/000001
    return `WT/${yearRange}/${sequence.toString().padStart(6, '0')}`;
}

/**
 * Parses a PO number and extracts its components
 * @param poNumber - The PO number to parse
 * @returns Object with year range and sequence number, or null if invalid
 */
export function parsePONumber(poNumber: string): { yearRange: string; sequence: number } | null {
    const match = poNumber.match(/WT\/(\d{4}-\d{4})\/(\d+)/);
    if (!match) return null;

    return {
        yearRange: match[1],
        sequence: parseInt(match[2]),
    };
}

/**
 * Validates if a PO number matches the expected format
 * @param poNumber - The PO number to validate
 * @returns boolean - True if valid, false otherwise
 */
export function isValidPONumber(poNumber: string): boolean {
    return /^WT\/\d{4}-\d{4}\/\d{6}$/.test(poNumber);
}
