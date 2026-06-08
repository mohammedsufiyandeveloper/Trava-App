/**
 * Production-ready Performance Logger
 * Tracks execution time for critical data-fetching and UI operations.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'perf';

class PerformanceLogger {
    private isEnabled: boolean;

    constructor() {
        // Enable by default or via env var/local storage
        this.isEnabled = process.env.NEXT_PUBLIC_ENABLE_PERF_LOGS === 'true' || process.env.NODE_ENV === 'development';
    }

    perf(label: string, duration: number, metadata: Record<string, any> = {}) {
        if (!this.isEnabled && process.env.NODE_ENV === 'production') return;

        const timestamp = new Date().toISOString();
        const metaStr = Object.keys(metadata).length > 0 ? ` | Meta: ${JSON.stringify(metadata)}` : '';

        console.log(
            `%c[PERF] %c${timestamp} %c| ${label}: %c${duration.toFixed(2)}ms${metaStr}`,
            'color: #8b5cf6; font-weight: bold;', // Purple
            'color: #6b7280; font-style: italic;', // Gray
            'color: #10b981; font-weight: bold;', // Green
            'color: #f59e0b; font-weight: bold;'  // Amber
        );
    }

    serverPerf(label: string, duration: number, metadata: Record<string, any> = {}) {
        const timestamp = new Date().toISOString();
        const metaStr = Object.keys(metadata).length > 0 ? ` | Meta: ${JSON.stringify(metadata)}` : '';

        // Server side doesn't support %c coloring in most logs
        // console.log(`[PERF:SERVER] ${timestamp} | ${label}: ${duration.toFixed(2)}ms${metaStr}`);
    }
}

export const logger = new PerformanceLogger();
