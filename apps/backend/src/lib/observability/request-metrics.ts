import { AsyncLocalStorage } from "node:async_hooks";

export type RequestMetrics = {
    requestId: string;
    authMs: number;
    dbMs: number;
    dbQueries: number;
};

const storage = new AsyncLocalStorage<RequestMetrics>();

export function runWithRequestMetrics<T>(
    requestId: string,
    callback: () => T
): T {
    return storage.run(
        {
            requestId,
            authMs: 0,
            dbMs: 0,
            dbQueries: 0,
        },
        callback
    );
}

export function recordAuthDuration(durationMs: number) {
    const metrics = storage.getStore();
    if (metrics) metrics.authMs += durationMs;
}

export function recordDatabaseQuery(durationMs: number) {
    const metrics = storage.getStore();
    if (!metrics) return;
    metrics.dbQueries += 1;
    metrics.dbMs += durationMs;
}

export function getRequestMetrics() {
    return storage.getStore();
}
