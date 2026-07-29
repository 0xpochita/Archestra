import { z } from "zod";

export const nodeRunStateSchema = z.enum(["running", "success", "failed"]);
export type NodeRunState = z.infer<typeof nodeRunStateSchema>;

export const runStatusSchema = z.enum(["queued", "running", "succeeded", "failed", "cancelled"]);
export type RunStatus = z.infer<typeof runStatusSchema>;

export const runModeSchema = z.enum(["live", "simulation"]);
export type RunMode = z.infer<typeof runModeSchema>;

export const runStepSchema = z.object({
  id: z.string(),
  runId: z.string(),
  nodeId: z.string(),
  kind: z.string(),
  position: z.number().int(),
  state: nodeRunStateSchema,
  txHash: z.string().nullable(),
  gasUsed: z.string().nullable(),
  error: z.string().nullable(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
});

export type RunStep = z.infer<typeof runStepSchema>;

export const runSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  status: runStatusSchema,
  mode: runModeSchema,
  graphSnapshot: z.object({
    nodes: z.array(z.unknown()),
    edges: z.array(z.unknown()),
  }),
  steps: z.array(runStepSchema),
  estimatedGas: z.string().nullable(),
  createdAt: z.string(),
  finishedAt: z.string().nullable(),
});

export type Run = z.infer<typeof runSchema>;
