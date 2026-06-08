import { Hono } from "hono";
import { unitsService } from "@/server/services/units.service";
import { getUnits, getUnitById } from "@/data/inventory/units";
import { HonoVariables } from "../types";
import { AppError } from "@/lib/errors/app-error";

const units = new Hono<{ Variables: HonoVariables }>();

/**
 * GET /api/v1/units
 * List all active units
 */
units.get("/", async (c) => {
    const workspaceId = c.req.query("workspaceId");
    const data = await getUnits(workspaceId);
    return c.json({ success: true, data });
});

/**
 * GET /api/v1/units/:id
 * Get details for a specific unit
 */
units.get("/:id", async (c) => {
    const id = c.req.param("id");
    const data = await getUnitById(id);
    if (!data) throw AppError.NotFound("Unit not found");
    return c.json({ success: true, data });
});

/**
 * POST /api/v1/units
 * Create a new unit
 */
units.post("/", async (c) => {
    const user = c.get("user");
    const workspaceId = c.req.query("workspaceId");
    
    if (!workspaceId) {
        throw AppError.ValidationError("workspaceId query parameter is required");
    }

    const body = await c.req.json();
    const data = await unitsService.create(body, workspaceId, user.id);
    
    return c.json({ success: true, data }, 201);
});

/**
 * PATCH /api/v1/units/:id
 * Update an existing unit
 */
units.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const user = c.get("user");
    const workspaceId = c.req.query("workspaceId");

    if (!workspaceId) {
        throw AppError.ValidationError("workspaceId query parameter is required");
    }

    const body = await c.req.json();
    const data = await unitsService.update(id, body, workspaceId, user.id);

    return c.json({ success: true, data });
});

/**
 * DELETE /api/v1/units/:id
 * Soft delete a unit
 */
units.delete("/:id", async (c) => {
    const id = c.req.param("id");
    const user = c.get("user");
    const workspaceId = c.req.query("workspaceId");

    if (!workspaceId) {
        throw AppError.ValidationError("workspaceId query parameter is required");
    }

    await unitsService.delete(id, workspaceId, user.id);

    return c.json({ success: true, message: "Unit deleted successfully" });
});

export default units;
