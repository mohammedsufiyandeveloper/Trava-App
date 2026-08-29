import { createMiddleware } from "hono/factory";
import { timingSafeEqual } from "crypto";

/**
 * Machine-to-machine auth for the attendance integration endpoint.
 *
 * Callers send the shared key from TRAVA_ATTENDANCE_API_KEY as:
 *     Authorization: Bearer <key>
 *
 * Unlike the cron helper this fails CLOSED: with no key configured the
 * endpoint is disabled rather than open to the internet.
 */
const safeCompare = (a: string, b: string) => {
    const aBuf = Buffer.from(a, "utf8");
    const bBuf = Buffer.from(b, "utf8");
    if (aBuf.length !== bBuf.length) return false;
    return timingSafeEqual(aBuf, bBuf);
};

export const attendanceApiKeyMiddleware = createMiddleware(async (c, next) => {
    const expected = process.env.TRAVA_ATTENDANCE_API_KEY?.trim();

    if (!expected) {
        return c.json(
            {
                success: false,
                error: "Attendance API is not configured",
                message: "TRAVA_ATTENDANCE_API_KEY is not set on the server",
            },
            503
        );
    }

    const authHeader = c.req.header("authorization") ?? "";
    const provided = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : "";

    if (!provided || !safeCompare(provided, expected)) {
        return c.json(
            {
                success: false,
                error: "Unauthorized",
                message: "Valid `Authorization: Bearer <TRAVA_ATTENDANCE_API_KEY>` required",
            },
            401
        );
    }

    await next();
});
