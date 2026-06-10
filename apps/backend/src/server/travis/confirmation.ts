/**
 * Travis Confirmation Tokens
 * --------------------------
 * Write operations never execute from a model response. The backend instead
 * returns a short-lived, HMAC-signed token that encodes the exact tool +
 * validated arguments + who/where it is bound to. The client echoes it back to
 * execute. The token is tamper-resistant (any change invalidates the MAC) and
 * expires quickly. It is bound to the user + workspace so it cannot be replayed
 * by another account or against another workspace.
 *
 * The signing key is BETTER_AUTH_SECRET (already required in every environment);
 * no new secret is introduced and nothing is ever logged.
 */
import { createHmac, timingSafeEqual } from "crypto";

const TTL_MS = 5 * 60 * 1000; // 5 minutes
const VERSION = 1;

interface TokenPayload {
    v: number;
    tool: string;
    /** Validated, server-trusted arguments (never raw model output). */
    args: unknown;
    userId: string;
    workspaceId: string;
    /** Idempotency key for the eventual mutation. */
    idem: string;
    iat: number;
    exp: number;
}

function b64url(buf: Buffer): string {
    return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Buffer {
    return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function signingKey(): string {
    const key = process.env.BETTER_AUTH_SECRET;
    if (!key) throw new Error("BETTER_AUTH_SECRET is required to sign confirmation tokens");
    return key;
}

function mac(payloadB64: string): string {
    return b64url(createHmac("sha256", signingKey()).update(payloadB64).digest());
}

export interface IssueTokenInput {
    tool: string;
    args: unknown;
    userId: string;
    workspaceId: string;
    idempotencyKey: string;
}

/** Issue a signed confirmation token. Returns the token and its expiry (ms). */
export function issueConfirmationToken(input: IssueTokenInput): {
    token: string;
    expiresAt: number;
} {
    const now = Date.now();
    const payload: TokenPayload = {
        v: VERSION,
        tool: input.tool,
        args: input.args,
        userId: input.userId,
        workspaceId: input.workspaceId,
        idem: input.idempotencyKey,
        iat: now,
        exp: now + TTL_MS,
    };
    const payloadB64 = b64url(Buffer.from(JSON.stringify(payload)));
    const sig = mac(payloadB64);
    return { token: `${payloadB64}.${sig}`, expiresAt: payload.exp };
}

export type VerifyResult =
    | { ok: true; payload: TokenPayload }
    | { ok: false; reason: "malformed" | "bad_signature" | "expired" | "version" };

/**
 * Verify a token's signature and expiry. Caller MUST additionally check that
 * payload.userId / payload.workspaceId match the authenticated context.
 */
export function verifyConfirmationToken(token: string): VerifyResult {
    if (typeof token !== "string" || !token.includes(".")) {
        return { ok: false, reason: "malformed" };
    }
    const [payloadB64, sig] = token.split(".");
    if (!payloadB64 || !sig) return { ok: false, reason: "malformed" };

    const expected = mac(payloadB64);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
        return { ok: false, reason: "bad_signature" };
    }

    let payload: TokenPayload;
    try {
        payload = JSON.parse(fromB64url(payloadB64).toString("utf8"));
    } catch {
        return { ok: false, reason: "malformed" };
    }
    if (payload.v !== VERSION) return { ok: false, reason: "version" };
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) {
        return { ok: false, reason: "expired" };
    }
    return { ok: true, payload };
}
