import { z } from "zod";
import { blockKindSchema } from "./common.js";

export const chatRoleSchema = z.enum(["user", "assistant"]);
export type ChatRole = z.infer<typeof chatRoleSchema>;

export const chatMessageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: chatRoleSchema,
  text: z.string(),
  createdAt: z.string(),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const workflowDraftSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  name: z.string(),
  version: z.number().int().positive(),
  kinds: z.array(blockKindSchema),
  createdAt: z.string(),
});

export type WorkflowDraft = z.infer<typeof workflowDraftSchema>;

export const sendMessageBodySchema = z
  .object({
    text: z.string().min(1),
  })
  .strict();

export type SendMessageBody = z.infer<typeof sendMessageBodySchema>;
