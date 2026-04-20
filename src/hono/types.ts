import { User, Session } from "better-auth";

/**
 * Hono Context Variables
 * Stored in c.set() / c.get()
 */
export type HonoVariables = {
    user: User;
    session: Session;
};

/**
 * Common JSON structure for consistent responses
 */
export type ApiResponse<T = any> = {
    success: boolean;
    data?: T;
    error?: string;
};
