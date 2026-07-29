import type { Context, Next } from "hono";
import { rateLimited } from "../lib/errors.js";
import type { ContextVariables } from "../lib/hono-types.js";

interface RateLimitWindow {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitWindow>();

function check(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const window = store.get(key);

  if (!window || now >= window.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  if (window.count >= limit) {
    const retryAfter = Math.ceil((window.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  window.count++;
  return { allowed: true, retryAfter: 0 };
}

export function rateLimit(limit: number, windowMs: number) {
  return async function rateLimitMiddleware(
    c: Context<{ Variables: ContextVariables }>,
    next: Next,
  ): Promise<void> {
    const ownerId = c.get("ownerId") ?? c.req.header("x-owner-id") ?? "anonymous";
    const path = c.req.path;
    const key = `${ownerId}:${path}`;

    const { allowed, retryAfter } = check(key, limit, windowMs);

    if (!allowed) {
      c.header("Retry-After", String(retryAfter));
      throw rateLimited(retryAfter);
    }

    await next();
  };
}

export const defaultRateLimit = rateLimit(100, 60_000);
export const strictRateLimit = rateLimit(10, 60_000);
