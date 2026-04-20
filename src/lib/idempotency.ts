/**
 * Generate a unique operation ID for idempotency
 * Format: {action}-{entityId}-{timestamp}-{random}
 */
export function generateOperationId(action: string, entityId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `${action}-${entityId}-${timestamp}-${random}`;
}
