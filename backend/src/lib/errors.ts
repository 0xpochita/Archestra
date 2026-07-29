export type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation_failed"
  | "invalid_graph"
  | "empty_workflow"
  | "run_in_progress"
  | "draft_already_accepted"
  | "rate_limited"
  | "internal_error";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status: number,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function notFound(resource: string): AppError {
  return new AppError("not_found", 404, `${resource} not found`);
}

export function forbidden(): AppError {
  return new AppError("forbidden", 403, "Access denied");
}

export function unauthorized(): AppError {
  return new AppError("unauthorized", 401, "Missing or unknown owner");
}

export function validationFailed(message: string, details?: Record<string, unknown>): AppError {
  return new AppError("validation_failed", 400, message, details);
}

export function invalidGraph(rule: string): AppError {
  return new AppError("invalid_graph", 422, rule, { rule });
}

export function emptyWorkflow(): AppError {
  return new AppError("empty_workflow", 422, "Workflow has no nodes");
}

export function runInProgress(): AppError {
  return new AppError("run_in_progress", 409, "A live run is already active for this workflow");
}

export function draftAlreadyAccepted(): AppError {
  return new AppError("draft_already_accepted", 409, "Draft was already accepted");
}

export function rateLimited(retryAfter: number): AppError {
  return new AppError("rate_limited", 429, "Too many requests", { retryAfter });
}

export function internalError(requestId?: string): AppError {
  return new AppError("internal_error", 500, "Unexpected failure", {
    requestId: requestId ?? "unknown",
  });
}
