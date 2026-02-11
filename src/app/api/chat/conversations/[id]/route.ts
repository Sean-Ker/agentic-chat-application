import { type NextRequest, NextResponse } from "next/server";

import { handleApiError } from "@/core/api/errors";
import { getLogger } from "@/core/logging";
import {
  deleteConversation,
  getConversation,
  UpdateConversationSchema,
  updateConversation,
} from "@/features/chat";

const logger = getLogger("api.chat.conversations");

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/chat/conversations/[id]
 * Get a single conversation by ID.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    logger.info({ conversationId: id }, "conversation.get_started");

    const conversation = await getConversation(id);

    logger.info({ conversationId: id }, "conversation.get_completed");

    return NextResponse.json(conversation);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/chat/conversations/[id]
 * Update a conversation title.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title } = UpdateConversationSchema.parse(body);

    logger.info({ conversationId: id }, "conversation.update_started");

    const conversation = await updateConversation(id, title);

    logger.info({ conversationId: id }, "conversation.update_completed");

    return NextResponse.json(conversation);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/chat/conversations/[id]
 * Delete a conversation and its messages.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    logger.info({ conversationId: id }, "conversation.delete_started");

    await deleteConversation(id);

    logger.info({ conversationId: id }, "conversation.delete_completed");

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
