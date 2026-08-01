import { z } from "zod";
import { stepConfigSchema } from "./step-config";

const blockKindSchema = z.enum([
  "trigger",
  "approve",
  "deposit",
  "swap",
  "yield",
  "harvest",
  "bridge",
  "withdraw",
  "condition",
  "alert",
]);

const workflowNodeSchema = z.object({
  id: z.string(),
  kind: blockKindSchema,
  title: z.string(),
  subtitle: z.string(),
  config: stepConfigSchema,
  x: z.number(),
  y: z.number(),
});

const workflowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  label: z.string(),
});

export const savedGraphSchema = z.object({
  nodes: z.array(workflowNodeSchema),
  edges: z.array(workflowEdgeSchema),
});

export const savedStrategySchema = z.object({
  id: z.string(),
  name: z.string(),
  tokens: z.array(z.string()),
  graph: savedGraphSchema,
  onchainId: z.string().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const runStatusSchema = z.enum(["succeeded", "stopped"]);

export const runRecordSchema = z.object({
  runId: z.string(),
  strategyId: z.string(),
  strategyName: z.string(),
  onchainId: z.string().nullable(),
  status: runStatusSchema,
  stepsExecuted: z.number(),
  gasUsed: z.string(),
  txHash: z.string(),
  finishedAt: z.number(),
  steps: z.array(
    z.object({
      position: z.number(),
      kind: blockKindSchema.nullable(),
      tokenOut: z.string(),
      amountOut: z.string(),
    }),
  ),
});

export const strategyStateSchema = z.object({
  strategies: z.array(savedStrategySchema),
  runs: z.array(runRecordSchema),
  activeStrategyId: z.string().nullable(),
});

export type SavedGraph = z.infer<typeof savedGraphSchema>;
export type SavedStrategy = z.infer<typeof savedStrategySchema>;
export type RunRecord = z.infer<typeof runRecordSchema>;
export type RunStatus = z.infer<typeof runStatusSchema>;
export type PersistedStrategyState = z.infer<typeof strategyStateSchema>;
