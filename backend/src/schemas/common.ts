import { z } from "zod";

export const blockKindSchema = z.enum([
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

export type BlockKind = z.infer<typeof blockKindSchema>;

export const blockParamSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  value: z.string(),
});

export type BlockParam = z.infer<typeof blockParamSchema>;

export const blockDefinitionSchema = z.object({
  kind: blockKindSchema,
  label: z.string().min(1),
  group: z.string().min(1),
  description: z.string().min(1),
  subtitle: z.string().min(1),
  params: z.array(blockParamSchema),
});

export type BlockDefinition = z.infer<typeof blockDefinitionSchema>;

export const strategyTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  tokens: z.array(z.string()),
  kinds: z.array(blockKindSchema),
});

export type StrategyTemplate = z.infer<typeof strategyTemplateSchema>;
