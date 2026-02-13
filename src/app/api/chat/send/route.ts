import type { NextRequest } from "next/server";

import { handleApiError } from "@/core/api/errors";
import { getLogger } from "@/core/logging";
import {
  addMessage,
  createConversation,
  generateTitleFromMessage,
  getMessages,
  SendMessageSchema,
  streamChatCompletion,
} from "@/features/chat";

const logger = getLogger("api.chat.send");

/**
 * POST /api/chat/send
 * Send a message and stream the AI response via SSE.
 * Supports optional resolvedContent and references for semicolon-commands.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, conversationId: existingConversationId } = SendMessageSchema.parse(body);

    // Extract optional command-resolved fields
    const resolvedContent =
      typeof body.resolvedContent === "string" ? body.resolvedContent : undefined;
    const references = Array.isArray(body.references)
      ? (body.references as Array<{ targetConversationId: string; command: string }>)
      : [];

    // Create conversation if needed
    let conversationId = existingConversationId;
    if (!conversationId) {
      const title = generateTitleFromMessage(content);
      const conversation = await createConversation(title);
      conversationId = conversation.id;
      logger.info({ conversationId }, "chat.conversation_created");
    }

    // Save original user message to database
    await addMessage(conversationId, "user", content);

    // Create cross-references for any resolved commands
    if (references.length > 0) {
      const { createCrossReference } = await import("@/features/commands/repository");
      for (const ref of references) {
        await createCrossReference({
          sourceConversationId: conversationId,
          targetConversationId: ref.targetConversationId,
          command: ref.command,
        });
      }
      logger.info(
        { conversationId, referenceCount: references.length },
        "chat.cross_references_created",
      );
    }

    // Get history for context — use resolved content for LLM if available
    const history = await getMessages(conversationId);
    const llmHistory = resolvedContent
      ? history.map((m, i) => (i === history.length - 1 ? { ...m, content: resolvedContent } : m))
      : history;

    // Stream completion
    const { stream, fullResponse } = await streamChatCompletion(llmHistory);

    // Wrap the stream to save assistant message after completion
    const reader = stream.getReader();
    const wrappedStream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (!done) {
          controller.enqueue(value);
          return;
        }
        // Stream finished — save assistant message
        const encoder = new TextEncoder();
        try {
          const fullText = await fullResponse;
          await addMessage(conversationId, "assistant", fullText);
          logger.info({ conversationId }, "chat.assistant_message_saved");
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done", saved: true })}\n\n`),
          );
        } catch (err) {
          logger.error({ conversationId, error: err }, "chat.assistant_message_save_failed");
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", message: "Failed to save response" })}\n\n`,
            ),
          );
        }
        controller.close();
      },
    });

    // Return SSE response
    return new Response(wrappedStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Conversation-Id": conversationId,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
