import prisma from "@/lib/db";

/**
 * Check if the database connection is healthy
 * @returns Promise<boolean> - true if connection is healthy, false otherwise
 */
export async function checkDatabaseHealth(): Promise<boolean> {
    try {
        await prisma.$queryRaw`SELECT 1`;
        console.log("✅ Database connection healthy");
        return true;
    } catch (error) {
        console.error("❌ Database connection failed:", error);
        return false;
    }
}

/**
 * Get current database connection metrics
 */
export async function getDatabaseMetrics() {
    try {
        const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT count(*) as count 
            FROM pg_stat_activity 
            WHERE datname = current_database()
        `;

        const activeConnections = Number(result[0]?.count || 0);

        return {
            activeConnections,
            healthy: true,
        };
    } catch (error) {
        console.error("Failed to get database metrics:", error);
        return {
            activeConnections: 0,
            healthy: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Retry a database operation with exponential backoff
 * Useful for handling transient connection errors
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    initialDelay = 1000
): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // Don't retry if it's not a connection error
            const errorMessage = lastError.message.toLowerCase();
            const isConnectionError =
                errorMessage.includes('closed') ||
                errorMessage.includes('connection') ||
                errorMessage.includes('timeout') ||
                errorMessage.includes('econnrefused');

            if (!isConnectionError || attempt === maxRetries - 1) {
                throw lastError;
            }

            // Exponential backoff: 1s, 2s, 4s, etc.
            const delay = initialDelay * Math.pow(2, attempt);
            console.warn(
                `Database operation failed (attempt ${attempt + 1}/${maxRetries}). ` +
                `Retrying in ${delay}ms...`,
                lastError.message
            );

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError || new Error('Max retries exceeded');
}

/**
 * Ensure database connection is ready
 * Call this on application startup
 */
export async function ensureDatabaseConnection(): Promise<void> {
    const maxAttempts = 5;
    const delayMs = 2000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            await prisma.$connect();
            console.log("✅ Database connected successfully");
            return;
        } catch (error) {
            console.error(
                `❌ Database connection attempt ${attempt}/${maxAttempts} failed:`,
                error instanceof Error ? error.message : error
            );

            if (attempt === maxAttempts) {
                throw new Error(
                    `Failed to connect to database after ${maxAttempts} attempts. ` +
                    `Please check your DATABASE_URL and database status.`
                );
            }

            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
}
