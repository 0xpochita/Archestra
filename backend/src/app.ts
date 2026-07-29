import { Hono } from "hono";
import { cors } from "hono/cors";
import type { MockChainAdapter } from "./adapters/chain.js";
import type { RulesPlanner } from "./adapters/planner.js";
import type { Database } from "./db/client.js";
import { config } from "./lib/config.js";
import type { ContextVariables } from "./lib/hono-types.js";
import { authMiddleware } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error.js";
import { loggerMiddleware } from "./middleware/logger.js";
import { defaultRateLimit, strictRateLimit } from "./middleware/rate-limit.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import type { AssistantRepository } from "./repositories/assistant.js";
import type { CatalogRepository } from "./repositories/catalog.js";
import type { RunRepository } from "./repositories/run.js";
import type { WorkflowRepository } from "./repositories/workflow.js";
import { createAssistantRoute } from "./routes/assistant.js";
import { createCatalogRoute } from "./routes/catalog.js";
import { createHealthRoute } from "./routes/health.js";
import { createOpenApiRoute } from "./routes/openapi.js";
import { createRunRoute } from "./routes/run.js";
import { createWorkflowRoute } from "./routes/workflow.js";
import { AssistantService } from "./services/assistant.js";
import { CatalogService } from "./services/catalog.js";
import { RunService } from "./services/run.js";
import { WorkflowService } from "./services/workflow.js";

export interface AppDependencies {
  db: Database;
  catalogRepo: CatalogRepository;
  workflowRepo: WorkflowRepository;
  runRepo: RunRepository;
  assistantRepo: AssistantRepository;
  chain: MockChainAdapter;
  planner: RulesPlanner;
}

export function createApp(deps: AppDependencies) {
  const app = new Hono<{ Variables: ContextVariables }>();

  app.use("*", requestIdMiddleware);
  app.use("*", loggerMiddleware);
  app.use(
    "*",
    cors({
      origin: config.CORS_ORIGINS.split(",").map((o) => o.trim()),
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "x-owner-id", "x-request-id"],
      exposeHeaders: ["x-request-id"],
    }),
  );

  const catalogService = new CatalogService(deps.catalogRepo);
  const workflowService = new WorkflowService(deps.workflowRepo, deps.catalogRepo);
  const runService = new RunService(deps.runRepo, deps.workflowRepo, deps.chain);
  const assistantService = new AssistantService(
    deps.assistantRepo,
    deps.workflowRepo,
    deps.planner,
  );

  const v1 = new Hono<{ Variables: ContextVariables }>();

  v1.route("/", createHealthRoute());
  v1.route("/", createOpenApiRoute());

  v1.use("*", authMiddleware);
  v1.use("*", defaultRateLimit);

  v1.route("/", createCatalogRoute(catalogService));
  v1.route("/", createWorkflowRoute(workflowService));

  v1.use("/workflows/:id/simulate", strictRateLimit);
  v1.use("/workflows/:id/runs", strictRateLimit);
  v1.use("/assistant/*", strictRateLimit);

  v1.route("/", createRunRoute(runService));
  v1.route("/", createAssistantRoute(assistantService));

  app.route("/v1", v1);

  app.notFound((c) => {
    return c.json({ error: { code: "not_found", message: "Route not found", details: {} } }, 404);
  });

  app.onError(errorHandler);

  return app;
}

export type App = ReturnType<typeof createApp>;
