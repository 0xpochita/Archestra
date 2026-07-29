import { Hono } from "hono";
import { validationFailed } from "../lib/errors.js";
import type { ContextVariables } from "../lib/hono-types.js";
import {
  createWorkflowBodySchema,
  listWorkflowsQuerySchema,
  patchWorkflowBodySchema,
} from "../schemas/workflow.js";
import type { WorkflowService } from "../services/workflow.js";

export function createWorkflowRoute(workflowService: WorkflowService) {
  const app = new Hono<{ Variables: ContextVariables }>();

  app.get("/workflows", async (c) => {
    const ownerId = c.get("ownerId");
    const queryObj: Record<string, string> = {};
    for (const [k, v] of Object.entries(c.req.queries())) {
      if (v[0] !== undefined) queryObj[k] = v[0];
    }
    const parsed = listWorkflowsQuerySchema.safeParse(queryObj);
    if (!parsed.success) throw validationFailed("Invalid query parameters");

    const result = await workflowService.list(ownerId, parsed.data);
    return c.json({ data: result.data, nextCursor: result.nextCursor });
  });

  app.post("/workflows", async (c) => {
    const ownerId = c.get("ownerId");
    const body = await c.req.json().catch(() => {
      throw validationFailed("Invalid JSON body");
    });
    const parsed = createWorkflowBodySchema.safeParse(body);
    if (!parsed.success) {
      throw validationFailed("Validation failed", { issues: parsed.error.issues });
    }

    const workflow = await workflowService.create(ownerId, parsed.data);
    return c.json({ data: workflow }, 201);
  });

  app.get("/workflows/:id", async (c) => {
    const ownerId = c.get("ownerId");
    const { id } = c.req.param();
    const workflow = await workflowService.get(id, ownerId);
    return c.json({ data: workflow });
  });

  app.patch("/workflows/:id", async (c) => {
    const ownerId = c.get("ownerId");
    const { id } = c.req.param();
    const body = await c.req.json().catch(() => {
      throw validationFailed("Invalid JSON body");
    });
    const parsed = patchWorkflowBodySchema.safeParse(body);
    if (!parsed.success) {
      throw validationFailed("Validation failed", { issues: parsed.error.issues });
    }

    const workflow = await workflowService.patch(id, ownerId, parsed.data);
    return c.json({ data: workflow });
  });

  app.delete("/workflows/:id", async (c) => {
    const ownerId = c.get("ownerId");
    const { id } = c.req.param();
    await workflowService.delete(id, ownerId);
    return new Response(null, { status: 204 });
  });

  return app;
}
