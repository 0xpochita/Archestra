import type { Context } from "hono";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";
import type { ContextVariables } from "../lib/hono-types.js";
import { logger } from "../lib/logger.js";

export function errorHandler(err: Error, c: Context<{ Variables: ContextVariables }>) {
  const requestId = c.get("requestId") ?? "unknown";

  if (err instanceof AppError) {
    if (err.status >= 500) {
      logger.error("application error", {
        requestId,
        code: err.code,
        message: err.message,
      });
    }
    return c.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      err.status as 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500,
    );
  }

  if (err instanceof ZodError) {
    return c.json(
      {
        error: {
          code: "validation_failed",
          message: "Request validation failed",
          details: { issues: err.issues },
        },
      },
      400,
    );
  }

  logger.error("unexpected error", {
    requestId,
    message: err.message,
    name: err.name,
  });

  return c.json(
    {
      error: {
        code: "internal_error",
        message: "Unexpected failure",
        details: { requestId },
      },
    },
    500,
  );
}
