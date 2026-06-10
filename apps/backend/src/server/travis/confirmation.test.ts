import { describe, it, expect, beforeEach, vi } from "vitest";
import { issueConfirmationToken, verifyConfirmationToken } from "./confirmation";

const base = {
    tool: "create_task",
    args: { projectId: "p1", name: "Do thing" },
    userId: "u1",
    workspaceId: "ws1",
    idempotencyKey: "idem-1",
};

beforeEach(() => {
    process.env.BETTER_AUTH_SECRET = "test-secret-key-for-hmac";
});

describe("confirmation tokens", () => {
    it("round-trips a valid token", () => {
        const { token } = issueConfirmationToken(base);
        const v = verifyConfirmationToken(token);
        expect(v.ok).toBe(true);
        if (v.ok) {
            expect(v.payload.tool).toBe("create_task");
            expect(v.payload.userId).toBe("u1");
            expect(v.payload.workspaceId).toBe("ws1");
            expect(v.payload.idem).toBe("idem-1");
        }
    });

    it("rejects a tampered payload (signature mismatch)", () => {
        const { token } = issueConfirmationToken(base);
        const [payload, sig] = token.split(".");
        // Flip a character in the payload; signature no longer matches.
        const tampered = `${payload.slice(0, -1)}${payload.slice(-1) === "A" ? "B" : "A"}.${sig}`;
        const v = verifyConfirmationToken(tampered);
        expect(v.ok).toBe(false);
        if (!v.ok) expect(v.reason).toBe("bad_signature");
    });

    it("rejects a token signed with a different secret", () => {
        const { token } = issueConfirmationToken(base);
        process.env.BETTER_AUTH_SECRET = "a-totally-different-secret";
        const v = verifyConfirmationToken(token);
        expect(v.ok).toBe(false);
    });

    it("rejects an expired token", () => {
        const { token } = issueConfirmationToken(base);
        // Travel 6 minutes into the future (TTL is 5 min).
        vi.spyOn(Date, "now").mockReturnValue(Date.now() + 6 * 60 * 1000);
        const v = verifyConfirmationToken(token);
        expect(v.ok).toBe(false);
        if (!v.ok) expect(v.reason).toBe("expired");
        vi.restoreAllMocks();
    });

    it("rejects malformed tokens", () => {
        expect(verifyConfirmationToken("not-a-token").ok).toBe(false);
        expect(verifyConfirmationToken("").ok).toBe(false);
    });
});
