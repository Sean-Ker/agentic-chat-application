import { getLogger } from "@/core/logging";
import { parseCommands, stripCommands } from "@/features/commands/parser";

import { ConversationNotFoundError } from "./errors";
import type { Conversation, Message } from "./models";
import * as repository from "./repository";

const logger = getLogger("chat.service");

export async function createConversation(title: string): Promise<Conversation> {
  logger.info({ title }, "conversation.create_started");

  const conversation = await repository.createConversation({ title });

  logger.info({ conversationId: conversation.id }, "conversation.create_completed");
  return conversation;
}

export async function getConversation(id: string): Promise<Conversation> {
  logger.info({ conversationId: id }, "conversation.get_started");

  const conversation = await repository.findConversationById(id);

  if (!conversation) {
    logger.warn({ conversationId: id }, "conversation.get_failed");
    throw new ConversationNotFoundError(id);
  }

  logger.info({ conversationId: id }, "conversation.get_completed");
  return conversation;
}

export async function updateConversation(id: string, title: string): Promise<Conversation> {
  logger.info({ conversationId: id }, "conversation.update_started");

  const updated = await repository.updateConversation(id, { title });

  if (!updated) {
    logger.warn({ conversationId: id }, "conversation.update_failed");
    throw new ConversationNotFoundError(id);
  }

  logger.info({ conversationId: id }, "conversation.update_completed");
  return updated;
}

export async function deleteConversation(id: string): Promise<void> {
  logger.info({ conversationId: id }, "conversation.delete_started");

  const deleted = await repository.deleteConversation(id);

  if (!deleted) {
    logger.warn({ conversationId: id }, "conversation.delete_failed");
    throw new ConversationNotFoundError(id);
  }

  logger.info({ conversationId: id }, "conversation.delete_completed");
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  logger.info({ conversationId }, "messages.get_started");

  const msgs = await repository.findMessagesByConversationId(conversationId);

  logger.info({ conversationId, count: msgs.length }, "messages.get_completed");
  return msgs;
}

export async function addMessage(
  conversationId: string,
  role: string,
  content: string,
): Promise<Message> {
  logger.info({ conversationId, role }, "message.add_started");

  const message = await repository.createMessage({ conversationId, role, content });

  logger.info({ conversationId, messageId: message.id }, "message.add_completed");
  return message;
}

export function generateTitleFromMessage(content: string): string {
  const stripped = stripCommands(content);
  if (stripped.length > 0) {
    return stripped.length <= 50 ? stripped : `${stripped.substring(0, 50)}...`;
  }

  // Pure-command message — generate a descriptive title from the commands
  const commands = parseCommands(content);
  if (commands.length > 0) {
    const first = commands[0];
    if (first) {
      const ref = first.conversationTitle.replace(/-/g, " ");
      const title = `${first.type} — ${ref}`;
      return title.length <= 50 ? title : `${title.substring(0, 50)}...`;
    }
  }

  const trimmed = content.trim();
  return trimmed.length <= 50 ? trimmed : `${trimmed.substring(0, 50)}...`;
}
