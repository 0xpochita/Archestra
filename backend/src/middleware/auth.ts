import type { Context, Next } from "hono";
import { unauthorized } from "../lib/errors.js";
import type { ContextVariables } from "../lib/hono-types.js";

export async function authMiddleware(
  c: Context<{ Variables: ContextVariables }>,
  next: Next,
): Promise<void> {
  const ownerId = c.req.header("x-owner-id");
  if (!ownerId || ownerId.trim() === "") {
    throw unauthorized();
  }
  c.set("ownerId", ownerId);
  await next();
}
