import {
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const runStatusEnum = pgEnum("run_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

export const runModeEnum = pgEnum("run_mode", ["live", "simulation"]);

export const stepStateEnum = pgEnum("step_state", ["running", "success", "failed"]);

export const workflows = pgTable(
  "workflows",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    tokens: jsonb("tokens").notNull().default([]),
    nodes: jsonb("nodes").notNull().default([]),
    edges: jsonb("edges").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("workflows_owner_created_idx").on(t.ownerId, t.createdAt)],
);

export const templates = pgTable("templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  tokens: jsonb("tokens").notNull(),
  kinds: jsonb("kinds").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const blocks = pgTable("blocks", {
  kind: text("kind").primaryKey(),
  label: text("label").notNull(),
  groupName: text("group_name").notNull(),
  description: text("description").notNull(),
  subtitle: text("subtitle").notNull(),
  params: jsonb("params").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const runs = pgTable(
  "runs",
  {
    id: text("id").primaryKey(),
    workflowId: text("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    ownerId: text("owner_id").notNull(),
    status: runStatusEnum("status").notNull().default("queued"),
    mode: runModeEnum("mode").notNull(),
    graphSnapshot: jsonb("graph_snapshot").notNull(),
    estimatedGas: numeric("estimated_gas", { precision: 78, scale: 0 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("runs_workflow_created_idx").on(t.workflowId, t.createdAt)],
);

export const runSteps = pgTable(
  "run_steps",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    nodeId: text("node_id").notNull(),
    kind: text("kind").notNull(),
    position: integer("position").notNull(),
    state: stepStateEnum("state").notNull(),
    txHash: text("tx_hash"),
    gasUsed: numeric("gas_used", { precision: 78, scale: 0 }),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    index("run_steps_run_position_idx").on(t.runId, t.position),
    unique().on(t.runId, t.position),
  ],
);

export const assistantSessions = pgTable("assistant_sessions", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assistantMessages = pgTable(
  "assistant_messages",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => assistantSessions.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("assistant_messages_session_idx").on(t.sessionId, t.createdAt)],
);

export const workflowDrafts = pgTable(
  "workflow_drafts",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => assistantSessions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    version: integer("version").notNull(),
    kinds: jsonb("kinds").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.sessionId, t.version)],
);
