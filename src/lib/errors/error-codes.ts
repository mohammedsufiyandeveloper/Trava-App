/**
 * Standardized Error Codes for the Service Layer
 */
export enum ErrorCode {
    // Auth & Permissions
    UNAUTHORIZED = "UNAUTHORIZED",
    FORBIDDEN = "FORBIDDEN",

    // Resource Issues
    NOT_FOUND = "NOT_FOUND",
    CONFLICT = "CONFLICT",
    VALIDATION_ERROR = "VALIDATION_ERROR",

    // Server Issues
    INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
    BAD_GATEWAY = "BAD_GATEWAY",
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
}
