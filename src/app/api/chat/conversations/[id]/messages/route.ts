import { type NextRequest, NextResponse } from "next/server";

import { handleApiError } from "@/core/api/errors";
import { getLogger } from "@/core/logging";
import { getMessages } from "@/features/chat";

const logger = getLogger("api.chat.messages");

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/chat/conversations/[id]/messages
 * Get all messages for a conversation.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    logger.info({ conversationId: id }, "messages.get_started");

    const messages = await getMessages(id);

    logger.info({ conversationId: id, count: messages.length }, "messages.get_completed");

    return NextResponse.json({ messages });
  } catch (error) {
    return handleApiError(error);
  }
}
