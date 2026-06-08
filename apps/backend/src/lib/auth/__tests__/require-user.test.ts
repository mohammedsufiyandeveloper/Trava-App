import { describe, it, expect, vi } from "vitest";

// The global test setup (src/tests/setup.ts) mocks this module so action tests
// don't need real auth. Here we test the REAL implementation, so unmock it.
vi.unmock("@/lib/auth/require-user");

import { honoUserStorage, getSession, requireUser } from "../require-user";

/**
 * Security-sensitive: `requireUser` / `getSession` gate every authenticated
 * Hono route via AsyncLocalStorage. These tests pin the contract that:
 *  - outside a request context there is NO ambient user, and
 *  - `requireUser` throws (never silently returns a user) when unauthenticated.
 */
describe("auth/require-user", () => {
    describe("getSession", () => {
        it("returns null when called outside a request context", async () => {
            await expect(getSession()).resolves.toBeNull();
        });

        it("returns the user/session from the active store", async () => {
            const ctx = { user: { id: "u_1" }, session: { id: "s_1" } };
            const result = await honoUserStorage.run(ctx, () => getSession());
            expect(result).toEqual(ctx);
        });
    });

    describe("requireUser", () => {
        it("throws Unauthorized when there is no request context", async () => {
            await expect(requireUser()).rejects.toThrow(/Unauthorized/);
        });

        it("throws Unauthorized when the store has no user", async () => {
            await expect(
                honoUserStorage.run({ user: undefined, session: null }, () => requireUser()),
            ).rejects.toThrow(/Unauthorized/);
        });

        it("returns the user when one is present in the store", async () => {
            const user = { id: "u_42", email: "a@b.com" };
            const result = await honoUserStorage.run({ user, session: { id: "s" } }, () =>
                requireUser(),
            );
            expect(result).toEqual(user);
        });

        it("does not leak a user across nested contexts", async () => {
            const outer = await honoUserStorage.run({ user: { id: "outer" }, session: null }, async () => {
                // Inner run with no user must throw, not inherit the outer user.
                const innerThrew = await honoUserStorage
                    .run({ user: undefined, session: null }, () => requireUser())
                    .then(() => false)
                    .catch(() => true);
                expect(innerThrew).toBe(true);
                return requireUser();
            });
            expect(outer).toEqual({ id: "outer" });
        });
    });
});
