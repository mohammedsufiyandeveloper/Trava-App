import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    cached,
    invalidateCacheKey,
    invalidateCacheTags,
    resetRuntimeCacheForTests,
    deserializeCacheValue,
    serializeCacheValue,
} from "./runtime-cache";

describe("runtime cache", () => {
    beforeEach(() => {
        resetRuntimeCacheForTests();
        vi.useRealTimers();
    });

    it("reuses cached values until their TTL expires", async () => {
        vi.useFakeTimers();
        const loader = vi.fn(async () => ({ value: 1 }));

        const first = await cached("one", loader, {
            ttlSeconds: 10,
            tags: ["numbers"],
        });
        const second = await cached("one", loader, {
            ttlSeconds: 10,
            tags: ["numbers"],
        });

        expect(first).toEqual({ value: 1 });
        expect(second).toEqual({ value: 1 });
        expect(loader).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(10_001);
        await cached("one", loader, {
            ttlSeconds: 10,
            tags: ["numbers"],
        });
        expect(loader).toHaveBeenCalledTimes(2);
    });

    it("deduplicates concurrent cache misses", async () => {
        let resolveLoader: ((value: string) => void) | undefined;
        const loader = vi.fn(
            () => new Promise<string>((resolve) => {
                resolveLoader = resolve;
            })
        );

        const first = cached("shared", loader, { ttlSeconds: 30 });
        const second = cached("shared", loader, { ttlSeconds: 30 });
        await Promise.resolve();
        await Promise.resolve();
        resolveLoader?.("loaded");

        await expect(Promise.all([first, second])).resolves.toEqual([
            "loaded",
            "loaded",
        ]);
        expect(loader).toHaveBeenCalledTimes(1);
    });

    it("invalidates entries by tag or exact key", async () => {
        const loader = vi.fn(async () => "value");
        await cached("tagged", loader, {
            ttlSeconds: 30,
            tags: ["workspace-ws1"],
        });

        await invalidateCacheTags(["workspace-ws1"]);
        await cached("tagged", loader, {
            ttlSeconds: 30,
            tags: ["workspace-ws1"],
        });
        expect(loader).toHaveBeenCalledTimes(2);

        await invalidateCacheKey("tagged");
        await cached("tagged", loader, {
            ttlSeconds: 30,
            tags: ["workspace-ws1"],
        });
        expect(loader).toHaveBeenCalledTimes(3);
    });

    it("preserves nested dates in distributed cache payloads", () => {
        const createdAt = new Date("2026-06-10T08:30:00.000Z");
        const serialized = serializeCacheValue({
            createdAt,
            members: [{ joinedAt: createdAt }],
        });
        const restored = deserializeCacheValue<{
            createdAt: Date;
            members: Array<{ joinedAt: Date }>;
        }>(serialized);

        expect(restored.createdAt).toBeInstanceOf(Date);
        expect(restored.createdAt.toISOString()).toBe(createdAt.toISOString());
        expect(restored.members[0].joinedAt).toBeInstanceOf(Date);
    });
});
