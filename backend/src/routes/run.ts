import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { validationFailed } from "../lib/errors.js";
import type { ContextVariables } from "../lib/hono-types.js";
import { subscribeRun } from "../services/run.js";
import type { RunService } from "../services/run.js";

const attachTxBodySchema = z
  .object({
    txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "must be a 32 byte hex tx hash"),
  })
  .strict();

const startRunBodySchema = z
  .object({
    callerAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .optional(),
  })
  .strict()
  .optional();

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

    let body: unknown = undefined;
    try {
      const raw = await c.req.text();
      if (raw.trim().length > 0) body = JSON.parse(raw);
    } catch {
      throw validationFailed("Invalid JSON body");
    }

    const parsed = startRunBodySchema.safeParse(body);
    if (!parsed.success) {
      throw validationFailed("Validation failed", { issues: parsed.error.issues });
    }

    const result = await runService.startRun(id, ownerId, parsed.data?.callerAddress);
    return c.json(
      {
        data: {
          run: result.run,
          call: result.call,
          requiresWalletSignature: result.requiresWalletSignature,
        },
      },
      202,
    );
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

  app.post("/runs/:id/tx", async (c) => {
    const { id } = c.req.param();
    const body = await c.req.json().catch(() => {
      throw validationFailed("Invalid JSON body");
    });
    const parsed = attachTxBodySchema.safeParse(body);
    if (!parsed.success) {
      throw validationFailed("Validation failed", { issues: parsed.error.issues });
    }
    const run = await runService.attachTxHash(id, parsed.data.txHash);
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
              tokenOut: step.tokenOut,
              amountOut: step.amountOut,
            }),
          });
        }
      }

      if (run.status === "succeeded" || run.status === "failed" || run.status === "cancelled") {
        await stream.writeSSE({
          event: "done",
          data: JSON.stringify({ status: run.status, stopped: run.stopped }),
        });
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
