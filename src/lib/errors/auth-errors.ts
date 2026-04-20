export class AuthError extends Error {
    constructor(message = "Unauthenticated") {
        super(message);
        this.name = "AuthError";
    }
}

export class NotFoundError extends Error {
    constructor(message = "Not Found") {
        super(message);
        this.name = "NotFoundError";
    }
}
