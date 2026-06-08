import app from "./hono";

// Native Web-Standard fetch handler for Vercel Serverless Functions
export const fetch = (request: Request) => app.fetch(request);

// Named HTTP methods for full compatibility
export const GET = (request: Request) => app.fetch(request);
export const POST = (request: Request) => app.fetch(request);
export const PUT = (request: Request) => app.fetch(request);
export const DELETE = (request: Request) => app.fetch(request);
export const PATCH = (request: Request) => app.fetch(request);
export const OPTIONS = (request: Request) => app.fetch(request);


