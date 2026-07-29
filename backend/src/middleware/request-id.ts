import type { Context, Next } from "hono";
import type { ContextVariables } from "../lib/hono-types.js";
import { generateId } from "../lib/ids.js";

export async function requestIdMiddleware(
  c: Context<{ Variables: ContextVariables }>,
  next: Next,
): Promise<void> {
  const requestId = c.req.header("x-request-id") ?? generateId("req");
  c.set("requestId", requestId);
  c.header("x-request-id", requestId);
  await next();
}
