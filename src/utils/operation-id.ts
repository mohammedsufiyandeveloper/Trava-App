/**
 * Generate a unique operation ID for idempotency
 * Format: {action}-{entityId}-{newValue}-{timestamp}
 */
export function generateMoveOperationId(subTaskId: string, newStatus: string): string {
    const timestamp = Date.now();
    return `move-${subTaskId}-${newStatus}-${timestamp}`;
}
