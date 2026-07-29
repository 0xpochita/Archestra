import { z } from "zod";
import { blockKindSchema, blockParamSchema } from "./common.js";

export const workflowNodeSchema = z.object({
  id: z.string().min(1),
  kind: blockKindSchema,
  title: z.string().min(1),
  subtitle: z.string(),
  params: z.array(blockParamSchema),
  x: z.number(),
  y: z.number(),
});

export type WorkflowNode = z.infer<typeof workflowNodeSchema>;

export const workflowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  label: z.string(),
});

export type WorkflowEdge = z.infer<typeof workflowEdgeSchema>;

export const workflowSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  name: z.string().min(1),
  tokens: z.array(z.string()),
  nodes: z.array(workflowNodeSchema),
  edges: z.array(workflowEdgeSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Workflow = z.infer<typeof workflowSchema>;

export const createWorkflowBodySchema = z
  .object({
    name: z.string().min(1),
    tokens: z.array(z.string()).default([]),
    nodes: z.array(workflowNodeSchema).default([]),
    edges: z.array(workflowEdgeSchema).default([]),
    templateId: z.string().optional(),
  })
  .strict();

export type CreateWorkflowBody = z.infer<typeof createWorkflowBodySchema>;

export const patchWorkflowBodySchema = z
  .object({
    name: z.string().min(1).optional(),
    tokens: z.array(z.string()).optional(),
    nodes: z.array(workflowNodeSchema).optional(),
    edges: z.array(workflowEdgeSchema).optional(),
  })
  .strict();

export type PatchWorkflowBody = z.infer<typeof patchWorkflowBodySchema>;

export const listWorkflowsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export type ListWorkflowsQuery = z.infer<typeof listWorkflowsQuerySchema>;
