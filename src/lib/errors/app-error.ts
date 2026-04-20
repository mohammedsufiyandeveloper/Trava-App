import { ErrorCode } from "./error-codes";

/**
 * Custom application error class to be thrown from services.
 * Caught by Hono onError handler and Server Action wrappers.
 */
export class AppError extends Error {
    public readonly code: ErrorCode;
    public readonly statusCode: number;

    constructor(
        code: ErrorCode,
        message: string,
        statusCode: number = 400
    ) {
        super(message);
        this.name = "AppError";
        this.code = code;
        this.statusCode = statusCode;

        // Maintain proper stack trace (Node.js only)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    /**
     * Utility to create common error types
     */
    static NotFound(message: string = "Resource not found") {
        return new AppError(ErrorCode.NOT_FOUND, message, 404);
    }

    static Unauthorized(message: string = "Unauthorized") {
        return new AppError(ErrorCode.UNAUTHORIZED, message, 401);
    }

    static Forbidden(message: string = "Forbidden") {
        return new AppError(ErrorCode.FORBIDDEN, message, 403);
    }

    static ValidationError(message: string) {
        return new AppError(ErrorCode.VALIDATION_ERROR, message, 400);
    }

    static Conflict(message: string) {
        return new AppError(ErrorCode.CONFLICT, message, 409);
    }

    static Internal(message: string = "Internal Server Error") {
        return new AppError(ErrorCode.INTERNAL_SERVER_ERROR, message, 500);
    }
}
