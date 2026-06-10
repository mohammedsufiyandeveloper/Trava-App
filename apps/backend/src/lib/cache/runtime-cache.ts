type CacheEntry = {
    value: unknown;
    expiresAt: number;
    tags: Set<string>;
};

type CacheOptions = {
    ttlSeconds: number;
    tags?: string[];
};

const MAX_MEMORY_ENTRIES = 500;
const CACHE_PREFIX = "trava:cache:";
const TAG_PREFIX = "trava:cache-tag:";
const memoryCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const hasDistributedCache = Boolean(redisUrl && redisToken);
const DATE_MARKER = "__travaDate";

function encodeDistributedValue(value: unknown): unknown {
    if (value instanceof Date) {
        return { [DATE_MARKER]: value.toISOString() };
    }
    if (Array.isArray(value)) {
        return value.map(encodeDistributedValue);
    }
    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value).map(([key, nestedValue]) => [
                key,
                encodeDistributedValue(nestedValue),
            ])
        );
    }
    return value;
}

function decodeDistributedValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(decodeDistributedValue);
    }
    if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        if (
            Object.keys(record).length === 1 &&
            typeof record[DATE_MARKER] === "string"
        ) {
            return new Date(record[DATE_MARKER]);
        }
        return Object.fromEntries(
            Object.entries(record).map(([key, nestedValue]) => [
                key,
                decodeDistributedValue(nestedValue),
            ])
        );
    }
    return value;
}

export function serializeCacheValue(value: unknown): string {
    return JSON.stringify(encodeDistributedValue(value));
}

export function deserializeCacheValue<T>(value: string): T {
    return decodeDistributedValue(JSON.parse(value)) as T;
}

async function redisCommand<T>(command: (string | number)[]): Promise<T | null> {
    if (!hasDistributedCache) return null;

    try {
        const response = await fetch(redisUrl!, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${redisToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(command),
        });
        if (!response.ok) return null;
        const payload = await response.json() as { result?: T };
        return payload.result ?? null;
    } catch {
        // Cache outages must never make application reads fail.
        return null;
    }
}

function pruneMemoryCache() {
    const now = Date.now();
    for (const [key, entry] of memoryCache) {
        if (entry.expiresAt <= now) memoryCache.delete(key);
    }

    while (memoryCache.size >= MAX_MEMORY_ENTRIES) {
        const oldestKey = memoryCache.keys().next().value;
        if (!oldestKey) break;
        memoryCache.delete(oldestKey);
    }
}

async function getCachedValue<T>(key: string): Promise<T | undefined> {
    const local = memoryCache.get(key);
    if (local) {
        if (local.expiresAt > Date.now()) return local.value as T;
        memoryCache.delete(key);
    }

    const serialized = await redisCommand<string>(["GET", `${CACHE_PREFIX}${key}`]);
    if (!serialized) return undefined;

    try {
        return deserializeCacheValue<T>(serialized);
    } catch {
        return undefined;
    }
}

async function setCachedValue<T>(
    key: string,
    value: T,
    options: CacheOptions
) {
    pruneMemoryCache();
    const tags = new Set(options.tags ?? []);
    memoryCache.set(key, {
        value,
        expiresAt: Date.now() + options.ttlSeconds * 1000,
        tags,
    });

    if (!hasDistributedCache) return;

    const distributedKey = `${CACHE_PREFIX}${key}`;
    await redisCommand([
        "SET",
        distributedKey,
        serializeCacheValue(value),
        "EX",
        options.ttlSeconds,
    ]);

    await Promise.all(
        [...tags].map(async (tag) => {
            const tagKey = `${TAG_PREFIX}${tag}`;
            await redisCommand(["SADD", tagKey, distributedKey]);
            await redisCommand([
                "EXPIRE",
                tagKey,
                Math.max(options.ttlSeconds, 300),
            ]);
        })
    );
}

export async function cached<T>(
    key: string,
    loader: () => Promise<T>,
    options: CacheOptions
): Promise<T> {
    const existing = await getCachedValue<T>(key);
    if (existing !== undefined) return existing;

    const pending = inFlight.get(key);
    if (pending) return pending as Promise<T>;

    const loadPromise = loader()
        .then(async (value) => {
            await setCachedValue(key, value, options);
            return value;
        })
        .finally(() => {
            inFlight.delete(key);
        });

    inFlight.set(key, loadPromise);
    return loadPromise;
}

export async function invalidateCacheTags(tags: string[]) {
    if (tags.length === 0) return;
    const targetTags = new Set(tags);

    for (const [key, entry] of memoryCache) {
        if ([...entry.tags].some((tag) => targetTags.has(tag))) {
            memoryCache.delete(key);
        }
    }

    if (!hasDistributedCache) return;

    await Promise.all(
        tags.map(async (tag) => {
            const tagKey = `${TAG_PREFIX}${tag}`;
            const keys = await redisCommand<string[]>(["SMEMBERS", tagKey]);
            if (keys?.length) {
                await redisCommand(["DEL", ...keys]);
            }
            await redisCommand(["DEL", tagKey]);
        })
    );
}

export async function invalidateCacheKey(key: string) {
    memoryCache.delete(key);
    if (hasDistributedCache) {
        await redisCommand(["DEL", `${CACHE_PREFIX}${key}`]);
    }
}

export const cacheRuntime = {
    distributed: hasDistributedCache,
    maxMemoryEntries: MAX_MEMORY_ENTRIES,
};

export function resetRuntimeCacheForTests() {
    memoryCache.clear();
    inFlight.clear();
}
