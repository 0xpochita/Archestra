import { serve } from "@hono/node-server";
import { ArcChainAdapter } from "./adapters/chain-arc.js";
import { MockChainAdapter } from "./adapters/chain.js";
import type { ChainAdapter } from "./adapters/chain.js";
import { RulesPlanner } from "./adapters/planner.js";
import { createApp } from "./app.js";
import { getDb } from "./db/client.js";
import { config } from "./lib/config.js";
import { logger } from "./lib/logger.js";
import { AssistantRepository } from "./repositories/assistant.js";
import { CatalogRepository } from "./repositories/catalog.js";
import { RunRepository } from "./repositories/run.js";
import { WorkflowRepository } from "./repositories/workflow.js";

const db = getDb();

const catalogRepo = new CatalogRepository(db);
const workflowRepo = new WorkflowRepository(db);
const runRepo = new RunRepository(db);
const assistantRepo = new AssistantRepository(db);
const chain: ChainAdapter =
  config.CHAIN_ADAPTER === "arc" ? new ArcChainAdapter() : new MockChainAdapter();
const planner = new RulesPlanner();

logger.info("chain adapter selected", { mode: chain.mode });

const app = createApp({
  db,
  catalogRepo,
  workflowRepo,
  runRepo,
  assistantRepo,
  chain,
  planner,
});

serve(
  {
    fetch: app.fetch,
    port: config.PORT,
  },
  (info) => {
    logger.info("server started", { port: info.port });
  },
);
