import { z } from "zod/v4";

import { VALID_COMMANDS } from "./constants";

export const CommandInputSchema = z.object({
  type: z.enum(VALID_COMMANDS),
  conversationTitle: z.string().min(1).max(200),
  filter: z.enum(["all", "user", "assistant", "last"]).optional(),
  question: z.string().max(500).optional(),
});

export type CommandInput = z.infer<typeof CommandInputSchema>;

export const ResolveCommandsSchema = z.object({
  commands: z.array(CommandInputSchema).min(1).max(10),
  sourceConversationId: z.string().uuid().optional(),
});

export type ResolveCommandsInput = z.infer<typeof ResolveCommandsSchema>;

export const ResolvedCommandSchema = z.object({
  type: z.enum(VALID_COMMANDS),
  conversationId: z.string().uuid(),
  conversationTitle: z.string(),
  content: z.string(),
  messageCount: z.number().int().nonnegative(),
});

export const ConversationSearchSchema = z.object({
  q: z.string().min(1).max(200),
});

export const CrossReferenceResponseSchema = z.object({
  id: z.string().uuid(),
  sourceConversationId: z.string().uuid(),
  targetConversationId: z.string().uuid(),
  targetTitle: z.string(),
  command: z.string(),
  createdAt: z.string(),
});
