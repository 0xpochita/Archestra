import { Hono } from "hono";
import { validationFailed } from "../lib/errors.js";
import type { ContextVariables } from "../lib/hono-types.js";
import { sendMessageBodySchema } from "../schemas/assistant.js";
import type { AssistantService } from "../services/assistant.js";

export function createAssistantRoute(assistantService: AssistantService) {
  const app = new Hono<{ Variables: ContextVariables }>();

  app.post("/assistant/sessions", async (c) => {
    const ownerId = c.get("ownerId");
    const session = await assistantService.createSession(ownerId);
    return c.json({ data: { id: session.id } }, 201);
  });

  app.delete("/assistant/sessions/:id", async (c) => {
    const ownerId = c.get("ownerId");
    const { id } = c.req.param();
    await assistantService.deleteSession(id, ownerId);
    return new Response(null, { status: 204 });
  });

  app.post("/assistant/sessions/:id/messages", async (c) => {
    const ownerId = c.get("ownerId");
    const { id } = c.req.param();
    const body = await c.req.json().catch(() => {
      throw validationFailed("Invalid JSON body");
    });
    const parsed = sendMessageBodySchema.safeParse(body);
    if (!parsed.success) {
      throw validationFailed("Validation failed", { issues: parsed.error.issues });
    }

    const result = await assistantService.sendMessage(id, ownerId, parsed.data.text);
    return c.json({ data: result });
  });

  app.post("/assistant/drafts/:id/accept", async (c) => {
    const { id } = c.req.param();
    const workflow = await assistantService.acceptDraft(id);
    return c.json({ data: workflow }, 201);
  });

  return app;
}
