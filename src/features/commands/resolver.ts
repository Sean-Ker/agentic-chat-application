import { asc, eq } from "drizzle-orm";

import { env } from "@/core/config/env";
import { db } from "@/core/database/client";
import { chatConversations, chatMessages } from "@/core/database/schema";
import { getLogger } from "@/core/logging";
import type { CommandType } from "@/features/commands/constants";
import { MAX_SELECT_CHARS, MAX_SUMMARY_CHARS } from "@/features/commands/constants";
import {
  AmbiguousConversationError,
  CommandResolutionError,
  ConversationNotFoundError,
} from "@/features/commands/errors";

const logger = getLogger("commands.resolver");

export interface ResolvedCommand {
  type: CommandType;
  conversationId: string;
  conversationTitle: string;
  content: string;
  messageCount: number;
}

/**
 * Find a conversation by title with fuzzy matching.
 * - Converts dashes to spaces
 * - Case-insensitive comparison
 * - Prefix matching (partial titles match)
 * - Throws ConversationNotFoundError if no match
 * - Throws AmbiguousConversationError if multiple matches
 */
export async function findConversationByTitle(
  title: string,
): Promise<{ id: string; title: string }> {
  const conversations = await db.select().from(chatConversations);
  const searchTitle = title.replace(/-/g, " ").toLowerCase();

  const matches = conversations.filter((c) => c.title.toLowerCase().startsWith(searchTitle));

  if (matches.length === 0) {
    throw new ConversationNotFoundError(title);
  }

  if (matches.length === 1) {
    const match = matches[0];
    if (match) {
      return { id: match.id, title: match.title };
    }
  }

  // Multiple matches — check for an exact match
  const exactMatch = matches.find((c) => c.title.toLowerCase() === searchTitle);
  if (exactMatch) {
    return { id: exactMatch.id, title: exactMatch.title };
  }

  throw new AmbiguousConversationError(
    title,
    matches.map((c) => c.title),
  );
}

interface Message {
  role: string;
  content: string;
}

function formatMessages(messages: Message[]): string {
  return messages.map((m) => `${capitalize(m.role)}: ${m.content}`).join("\n");
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)} [truncated]`;
}

async function callLLM(systemPrompt: string, userContent: string): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENROUTER_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new CommandResolutionError(`LLM call failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
}

/**
 * Resolve a single parsed command to content.
 */
export async function resolveCommand(
  type: CommandType,
  conversationTitle: string,
  question?: string,
): Promise<ResolvedCommand> {
  logger.info({ type, conversationTitle }, "command.resolve_started");

  const conversation = await findConversationByTitle(conversationTitle);

  const messages = await db
    .select({ role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, conversation.id))
    .orderBy(asc(chatMessages.createdAt));

  let content: string;

  switch (type) {
    case "select": {
      content = truncate(formatMessages(messages), MAX_SELECT_CHARS);
      break;
    }
    case "select:user": {
      const userMessages = messages.filter((m) => m.role === "user");
      content = truncate(formatMessages(userMessages), MAX_SELECT_CHARS);
      break;
    }
    case "select:assistant": {
      const assistantMessages = messages.filter((m) => m.role === "assistant");
      content = truncate(formatMessages(assistantMessages), MAX_SELECT_CHARS);
      break;
    }
    case "select:last": {
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
      const lastMessages: Message[] = [];
      if (lastUser) {
        lastMessages.push(lastUser);
      }
      if (lastAssistant) {
        lastMessages.push(lastAssistant);
      }
      content = truncate(formatMessages(lastMessages), MAX_SELECT_CHARS);
      break;
    }
    case "summarize": {
      const formatted = formatMessages(messages);
      const summary = await callLLM(
        "Summarize the following conversation concisely. Keep your response under " +
          MAX_SUMMARY_CHARS +
          " characters.",
        formatted,
      );
      content = `Summary of "${conversation.title}": ${summary}`;
      break;
    }
    case "keypoints": {
      const formatted = formatMessages(messages);
      content = await callLLM(
        "Extract the key takeaways from this conversation as bullet points. Keep your response under " +
          MAX_SUMMARY_CHARS +
          " characters.",
        formatted,
      );
      break;
    }
    case "inject": {
      const formatted = formatMessages(messages);
      const prompt = question ?? "What are the key insights from this conversation?";
      content = await callLLM(
        "You are answering a question about a conversation. Use the conversation content to provide a helpful answer.",
        `Conversation:\n${formatted}\n\nQuestion: ${prompt}`,
      );
      break;
    }
    case "link": {
      content = "";
      break;
    }
  }

  logger.info(
    { type, conversationTitle, conversationId: conversation.id, messageCount: messages.length },
    "command.resolve_completed",
  );

  return {
    type,
    conversationId: conversation.id,
    conversationTitle: conversation.title,
    content,
    messageCount: messages.length,
  };
}
