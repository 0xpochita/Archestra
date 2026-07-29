import type { Context, Next } from "hono";
import type { ContextVariables } from "../lib/hono-types.js";
import { logger } from "../lib/logger.js";

export async function loggerMiddleware(
  c: Context<{ Variables: ContextVariables }>,
  next: Next,
): Promise<void> {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  logger.info("request", {
    requestId: c.get("requestId"),
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    durationMs: duration,
  });
}
