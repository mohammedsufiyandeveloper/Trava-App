import { serve } from "@hono/node-server";
import app from "./hono";

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

console.log(`🚀 Standalone Hono API server listening on port ${port}`);

serve({
    fetch: app.fetch,
    port,
});
