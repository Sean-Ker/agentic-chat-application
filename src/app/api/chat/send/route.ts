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
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, conversationId: existingConversationId } = SendMessageSchema.parse(body);

    // Create conversation if needed
    let conversationId = existingConversationId;
    if (!conversationId) {
      const title = generateTitleFromMessage(content);
      const conversation = await createConversation(title);
      conversationId = conversation.id;
      logger.info({ conversationId }, "chat.conversation_created");
    }

    // Save user message
    await addMessage(conversationId, "user", content);

    // Get history for context
    const history = await getMessages(conversationId);

    // Stream completion
    const { stream, fullResponse } = await streamChatCompletion(history);

    // Save assistant message after stream completes
    fullResponse.then(async (fullText) => {
      try {
        await addMessage(conversationId, "assistant", fullText);
        logger.info({ conversationId }, "chat.assistant_message_saved");
      } catch (err) {
        logger.error({ conversationId, error: err }, "chat.assistant_message_save_failed");
      }
    });

    // Return SSE response
    return new Response(stream, {
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
