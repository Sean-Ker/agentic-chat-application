import { type NextRequest, NextResponse } from "next/server";

import { handleApiError } from "@/core/api/errors";
import { getLogger } from "@/core/logging";
import { CreateConversationSchema, createConversation } from "@/features/chat";

const logger = getLogger("api.chat.conversations");

/**
 * POST /api/chat/conversations
 * Create a new conversation.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title } = CreateConversationSchema.parse(body);

    logger.info({ title }, "conversation.create_started");

    const conversation = await createConversation(title);

    logger.info({ conversationId: conversation.id }, "conversation.create_completed");

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
