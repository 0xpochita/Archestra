import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { ContextVariables } from "../lib/hono-types.js";
import { subscribeRun } from "../services/run.js";
import type { RunService } from "../services/run.js";

export function createRunRoute(runService: RunService) {
  const app = new Hono<{ Variables: ContextVariables }>();

  app.post("/workflows/:id/simulate", async (c) => {
    const ownerId = c.get("ownerId");
    const { id } = c.req.param();
    const run = await runService.simulate(id, ownerId);
    return c.json({ data: run });
  });

  app.post("/workflows/:id/runs", async (c) => {
    const ownerId = c.get("ownerId");
    const { id } = c.req.param();
    const run = await runService.startRun(id, ownerId);
    return c.json({ data: run }, 202);
  });

  app.get("/workflows/:id/runs", async (c) => {
    const ownerId = c.get("ownerId");
    const { id } = c.req.param();
    const limit = Number(c.req.query("limit") ?? "20");
    const cursor = c.req.query("cursor");
    const result = await runService.listForWorkflow(id, ownerId, Math.min(limit, 100), cursor);
    return c.json({ data: result.items, nextCursor: result.nextCursor });
  });

  app.get("/runs/:id", async (c) => {
    const { id } = c.req.param();
    const run = await runService.get(id);
    return c.json({ data: run });
  });

  app.get("/runs/:id/events", async (c) => {
    const { id } = c.req.param();
    const lastEventId = c.req.header("last-event-id");

    return streamSSE(c, async (stream) => {
      const run = await runService.get(id);

      if (lastEventId === null || lastEventId === undefined) {
        for (const step of run.steps) {
          await stream.writeSSE({
            event: "step",
            data: JSON.stringify({
              nodeId: step.nodeId,
              state: step.state,
              position: step.position,
              txHash: step.txHash,
              gasUsed: step.gasUsed,
            }),
          });
        }
      }

      if (run.status === "succeeded" || run.status === "failed" || run.status === "cancelled") {
        await stream.writeSSE({ event: "done", data: JSON.stringify({ status: run.status }) });
        return;
      }

      await new Promise<void>((resolve) => {
        const unsub = subscribeRun(id, async (event, data) => {
          await stream.writeSSE({ event, data: JSON.stringify(data) });
          if (event === "done" || event === "error") {
            unsub();
            resolve();
          }
        });

        stream.onAbort(() => {
          unsub();
          resolve();
        });
      });
    });
  });

  return app;
}
